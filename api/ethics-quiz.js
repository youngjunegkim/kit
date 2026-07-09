const {
  clearEthicsQuizRedemptions,
  getCredits,
  getCustomEthicsQuestions,
  getEthicsQuizRedemptions,
  getEthicsQuizSolvedQuestions,
  getQuestionLogs,
  grantCredits,
  hasPersistentStore,
  normalizeTeam,
  recordEthicsQuizRedemption,
  redeemEthicsQuizQuestion,
  requestClassId,
  withClassScope
} = require("./_credits");

const answers = {
  1: "3",
  2: "3",
  3: "2",
  4: "2",
  5: "3",
  6: "3",
  7: "2",
  8: "2",
  9: "O",
  10: "3",
  11: "3",
  12: "3",
  13: "4",
  14: "3",
  15: "3"
};
const ethicsQuizRewardCredits = 1;
const baseQuestionCount = Object.keys(answers).length;

async function correctAnswerFor(questionNumber, questionId = "") {
  if (answers[questionNumber]) return answers[questionNumber];

  const customQuestions = await getCustomEthicsQuestions();
  const byId = String(questionId || "").trim()
    ? customQuestions.find((question) => question.id === String(questionId).trim())
    : null;
  if (byId) return byId.answer;

  const customIndex = questionNumber - baseQuestionCount - 1;
  return customQuestions[customIndex]?.answer || "";
}

function sendJson(response, statusCode, body) {
  response.statusCode = statusCode;
  response.setHeader("content-type", "application/json; charset=utf-8");
  response.setHeader("cache-control", "no-store");
  response.end(JSON.stringify(body));
}

function headerValue(request, name) {
  const value = request.headers?.[name.toLowerCase()] || request.headers?.[name];
  return Array.isArray(value) ? value[0] : value;
}

function decodedHeaderValue(request, name) {
  const value = headerValue(request, name);
  if (!value) return "";
  try {
    return decodeURIComponent(String(value));
  } catch {
    return String(value);
  }
}

function isAllowedOrigin(request) {
  const origin = headerValue(request, "origin");
  if (!origin) return true;

  const allowedOrigins = String(process.env.ALLOWED_ORIGINS || "")
    .split(/[,\n;]/)
    .map((item) => item.trim())
    .filter(Boolean);
  if (allowedOrigins.includes(origin)) return true;

  const host = String(headerValue(request, "x-forwarded-host") || headerValue(request, "host") || "");
  if (!host) return false;

  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

function bodyFor(request) {
  if (!request.body) return {};
  if (typeof request.body === "string") {
    try {
      return JSON.parse(request.body);
    } catch {
      return {};
    }
  }
  return request.body;
}

function queryValue(request, name) {
  try {
    return new URL(request.url || "", "http://localhost").searchParams.get(name) || "";
  } catch {
    return "";
  }
}

function publicEthicsLog(entry = {}) {
  return {
    team: normalizeTeam(entry.team),
    user: String(entry.user || entry.team || "").trim().slice(0, 40),
    question: Math.max(0, Number(entry.question) || 0),
    added: Math.max(0, Number(entry.added) || 0),
    at: entry.at || ""
  };
}

async function handleEthicsQuiz(request, response) {
  try {
    if (!isAllowedOrigin(request)) {
      sendJson(response, 403, { error: "Origin is not allowed.", fallback: true });
      return;
    }

    const role = String(headerValue(request, "x-kit-role") || queryValue(request, "role") || "").toLowerCase();
    const team = normalizeTeam(decodedHeaderValue(request, "x-kit-team") || queryValue(request, "team"));

    if (role !== "student") {
      sendJson(response, 403, { error: "Student role is required.", code: "STUDENT_ROLE_REQUIRED" });
      return;
    }
    if (!team) {
      sendJson(response, 400, { error: "Valid student team is required.", code: "INVALID_TEAM" });
      return;
    }

    if (request.method === "GET") {
      const logs = await getEthicsQuizRedemptions(team);
      sendJson(response, 200, {
        team,
        solved: await getEthicsQuizSolvedQuestions(team),
        ethicsLogs: logs.map(publicEthicsLog),
        credits: await getCredits(team),
        persistent: hasPersistentStore()
      });
      return;
    }

    if (request.method !== "POST") {
      response.setHeader("allow", "GET, POST");
      sendJson(response, 405, { error: "Method not allowed" });
      return;
    }

    const body = bodyFor(request);
    const action = String(body.action || "").trim().toLowerCase();
    if (action === "reset") {
      if (String(body.password || "") !== "kit") {
        sendJson(response, 403, { error: "초기화 비밀번호가 맞지 않습니다.", code: "BAD_RESET_PASSWORD" });
        return;
      }
      await clearEthicsQuizRedemptions(team);
      sendJson(response, 200, {
        ok: true,
        reset: true,
        team,
        solved: [],
        ethicsLogs: [],
        credits: await getCredits(team),
        logs: await getQuestionLogs(team),
        persistent: hasPersistentStore()
      });
      return;
    }

    const question = Math.max(0, Math.round(Number(body.question) || 0));
    const answer = String(body.answer || "").trim();
    const correctAnswer = await correctAnswerFor(question, body.questionId);

    if (!correctAnswer) {
      sendJson(response, 400, { error: "문제 번호를 확인해 주세요.", code: "INVALID_QUESTION" });
      return;
    }

    if (answer !== correctAnswer) {
      sendJson(response, 200, {
        ok: false,
        correct: false,
        question,
        credits: await getCredits(team),
        solved: await getEthicsQuizSolvedQuestions(team)
      });
      return;
    }

    const isNew = await redeemEthicsQuizQuestion(team, question);
    if (!isNew) {
      const logs = await getEthicsQuizRedemptions(team);
      sendJson(response, 200, {
        ok: true,
        correct: true,
        alreadyRewarded: true,
        question,
        added: 0,
        credits: await getCredits(team),
        solved: await getEthicsQuizSolvedQuestions(team),
        logs: await getQuestionLogs(team),
        persistent: hasPersistentStore()
      });
      return;
    }

    const result = await grantCredits(team, ethicsQuizRewardCredits);
    const ethicsLog = await recordEthicsQuizRedemption({
      team,
      user: decodedHeaderValue(request, "x-kit-user") || body.user || team,
      question,
      added: ethicsQuizRewardCredits,
      remaining: result.credits
    });
    const logs = await getEthicsQuizRedemptions(team);

    sendJson(response, 200, {
      ok: true,
      correct: true,
      alreadyRewarded: false,
      question,
      added: ethicsQuizRewardCredits,
      credits: result.credits,
      granted: result.granted,
      ethicsLog: publicEthicsLog(ethicsLog),
      solved: await getEthicsQuizSolvedQuestions(team),
      logs: await getQuestionLogs(team),
      persistent: hasPersistentStore()
    });
  } catch (error) {
    sendJson(response, 503, {
      error: error.message || "Ethics quiz check failed.",
      fallback: true
    });
  }
}

module.exports = async function handler(request, response) {
  const body = bodyFor(request);
  return withClassScope(requestClassId(request, body), () => handleEthicsQuiz(request, response));
};
