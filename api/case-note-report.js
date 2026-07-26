const { applyCors, handleCorsPreflight, isAllowedOrigin } = require("./_origin");

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

function getOpenAiKey() {
  return String(process.env.OPENAI_API_KEY || "").trim();
}

function openAiModelName() {
  return String(process.env.OPENAI_MODEL || process.env.AI_MODEL || "gpt-5.5").trim();
}

function maxOutputTokens() {
  const configured = Number(process.env.CASE_NOTE_REPORT_MAX_OUTPUT_TOKENS || 1800);
  return Number.isFinite(configured) && configured > 0 ? configured : 1800;
}

function extractOpenAiText(data) {
  if (typeof data.output_text === "string") return data.output_text.trim();
  const chunks = [];
  for (const item of data.output || []) {
    for (const content of item.content || []) {
      if (typeof content.text === "string") chunks.push(content.text);
    }
  }
  return chunks.join("\n").trim();
}

function safeJson(text) {
  const raw = String(text || "").trim();
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const source = fenced ? fenced[1].trim() : raw;
  const start = source.indexOf("{");
  const end = source.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    return JSON.parse(source.slice(start, end + 1));
  } catch {
    return null;
  }
}

function roundScore(value) {
  const score = Math.max(0, Math.min(100, Number(value) || 0));
  return Math.round(score * 10) / 10;
}

function formatScore(value) {
  const score = roundScore(value);
  return Number.isInteger(score) ? String(score) : score.toFixed(1);
}

function normalizeTeams(teams) {
  return Array.isArray(teams)
    ? teams.slice(0, 30).map((team, index) => ({
      name: String(team.name || `${index + 1}팀`).slice(0, 40),
      score: roundScore(team.score),
      contentScore: roundScore(team.contentScore ?? team.score),
      remainingCredits: Math.max(0, Math.round(Number(team.remainingCredits) || 0)),
      questionCreditBonus: {
        credits: Math.max(0, Math.round(Number(team.questionCreditBonus?.credits ?? team.remainingCredits) || 0)),
        score: roundScore(team.questionCreditBonus?.score ?? team.remainingCredits)
      },
      rank: Number(team.rank) || index + 1,
      note: String(team.note || "").slice(0, 1400),
      specificity: {
        score: roundScore(team.specificity?.score),
        terms: Array.isArray(team.specificity?.terms) ? team.specificity.terms.slice(0, 8).map(String) : []
      },
      details: Array.isArray(team.details) ? team.details.map((detail) => ({
        label: String(detail.label || ""),
        score: Number(detail.score) || 0,
        max: Number(detail.max) || 0,
        matches: Array.isArray(detail.matches) ? detail.matches.slice(0, 4).map(String) : [],
        misses: Array.isArray(detail.misses) ? detail.misses.slice(0, 4).map(String) : []
      })) : []
    }))
    : [];
}

function fallbackReports(teams) {
  return teams.map((team) => {
    const strong = [...team.details].sort((a, b) => (b.score / Math.max(1, b.max)) - (a.score / Math.max(1, a.max)))[0];
    const weak = [...team.details].sort((a, b) => (a.score / Math.max(1, a.max)) - (b.score / Math.max(1, b.max)))[0];
    const entry = {
      name: team.name,
      rank: team.rank,
      score: team.score,
      report: `${team.name}은 ${formatScore(team.score)}%로 측정됐습니다. ${strong?.label || "핵심 요소"}는 비교적 잘 반영됐고, ${weak?.label || "빠진 요소"} 보완 여부가 순위에 큰 영향을 줬습니다.`
    };
    const bonus = team.specificity?.score ? ` 길이와 구체성 보정 +${formatScore(team.specificity.score)}점도 반영했습니다.` : "";
    const questionBonus = team.questionCreditBonus?.credits
      ? ` 남은 코인 ${team.questionCreditBonus.credits}개를 +${formatScore(team.questionCreditBonus.score)}점으로 더했습니다.`
      : " 남은 코인 보너스는 없습니다.";
    entry.report = `${team.name}은 사건노트 ${formatScore(team.contentScore)}점에 코인 보너스를 반영해 최종 ${formatScore(team.score)}%로 측정되었습니다. 기준 항목 중 '${strong?.label || "핵심 단서"}' 점수가 가장 높았고, '${weak?.label || "부족한 단서"}' 항목 보완 여부가 순위에 영향을 줬습니다.${bonus}${questionBonus}`;
    return entry;
  });
}

async function callOpenAi(teams, standardNote) {
  const apiKey = getOpenAiKey();
  if (!apiKey) {
    return { reports: fallbackReports(teams), source: "fallback", error: "OPENAI_API_KEY is not set." };
  }

  const model = openAiModelName();
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "authorization": `Bearer ${apiKey}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({
      model,
      max_output_tokens: maxOutputTokens(),
      text: /^gpt-5/i.test(model) ? { verbosity: "low" } : undefined,
      reasoning: /^gpt-5/i.test(model) ? { effort: "low" } : undefined,
      instructions: [
        "너는 초등/중등 수업용 추리 게임의 탐정 캐릭터다.",
        "각 팀의 사건노트가 기준 사건노트와 어느 기준으로 유사했는지 논리적으로 설명한다.",
        "반드시 한국어로, 팀별 2문장 이내로 간결하게 말한다.",
        "학생에게 직접 말하는 탐정 말투를 쓰되 과장하지 않는다.",
        "관련 인물 비난이나 정답 유출 이상의 새 사실을 만들지 않는다.",
        "출력은 JSON만 사용한다. 형식: {\"reports\":[{\"name\":\"팀명\",\"rank\":1,\"score\":85,\"report\":\"문장\"}]}"
      ].join("\n"),
      input: JSON.stringify({
        standardNote,
        rubricHint: "범인 지목, 사건 장소, 태블릿 촬영, 교무실 기말고사 문제지 기반, AI 입력, 예상 문제 생성, 유출 결과, 전 여자친구 압박·오후 6시 접속·CCTV·오후 6시 15분 AI 대화 기록 근거, AI 윤리 역량 주체성 충족도를 기준으로 사건노트 점수를 계산했다. 윤리 역량은 주체성 언급을 기준으로 보며, 부정행위 목적이나 스스로 결정했다는 이유 설명은 필수 채점 요소로 보지 않는다. 최종 유사도에는 남은 코인 1개당 1점 보너스를 별도로 더했으며, 리포트에서 사건노트 점수와 코인 보너스를 구분해 설명한다.",
        teams
      })
    })
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    return {
      reports: fallbackReports(teams),
      source: "fallback",
      error: data.error?.message || "OpenAI report request failed."
    };
  }

  const parsed = safeJson(extractOpenAiText(data));
  const reports = Array.isArray(parsed?.reports) ? parsed.reports : [];
  if (!reports.length) {
    return { reports: fallbackReports(teams), source: "fallback", error: "OpenAI report JSON parse failed." };
  }

  return {
    reports: reports.map((report, index) => ({
      name: String(report.name || teams[index]?.name || `${index + 1}팀`),
      rank: Number(report.rank) || teams[index]?.rank || index + 1,
      score: roundScore(report.score ?? teams[index]?.score),
      report: String(report.report || "").slice(0, 360)
    })),
    source: "openai",
    model
  };
}

module.exports = async function handler(request, response) {
  applyCors(request, response);
  if (handleCorsPreflight(request, response, "POST")) return;

  if (!isAllowedOrigin(request)) {
    sendJson(response, 403, { error: "Origin is not allowed.", fallback: true });
    return;
  }

  if (request.method !== "POST") {
    response.setHeader("allow", "POST");
    sendJson(response, 405, { error: "Method not allowed" });
    return;
  }

  const body = bodyFor(request);
  const role = String(headerValue(request, "x-kit-role") || body.role || "").toLowerCase();
  if (role !== "teacher") {
    sendJson(response, 403, { error: "Teacher role is required.", code: "TEACHER_ROLE_REQUIRED" });
    return;
  }

  const teams = normalizeTeams(body.teams);
  if (!teams.length) {
    sendJson(response, 400, { error: "Team reports are required." });
    return;
  }

  try {
    const result = await callOpenAi(teams, String(body.standardNote || ""));
    sendJson(response, 200, result);
  } catch (error) {
    sendJson(response, 200, {
      reports: fallbackReports(teams),
      source: "fallback",
      error: error.message || "Case note report failed."
    });
  }
};
