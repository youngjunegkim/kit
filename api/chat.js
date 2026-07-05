const { addCredits, consumeCredit, logQuestion, normalizeTeam, requestClassId, withClassScope } = require("./_credits");
const { buildKangWoojinPrompt, buildSeoHarinPrompt, buildChoiDanielPrompt } = require("./personas");
const { DEFAULT_CHAT_TOKEN_LIMIT, estimateTokens } = require("../token-estimator");

const safetyReplies = {
  sexualOrProfane: "그런 장난 섞인 말에는 대답 안 합니다. 사건이랑 상관없는 불쾌한 얘기는 하지 마세요.",
  aggressive: "말이 좀 심하시네요. 그런 식의 무례한 질문에는 답변하지 않겠습니다.",
  technicalCrime: "그런 방법 같은 건 몰라요. 실제로 따라 할 수 있는 얘기는 하지 않겠습니다.",
  unsafe: "그런 질문에는 답하지 않겠습니다. 사건과 관련된 증거를 바탕으로 질문해 주세요."
};

const rateWindowMs = 60 * 1000;
const rateLimitPerWindow = Number(process.env.CHAT_RATE_LIMIT_PER_MINUTE || 12);
const configuredMaxMessageChars = Number(process.env.CHAT_MAX_MESSAGE_CHARS || 800);
const maxMessageChars = Number.isFinite(configuredMaxMessageChars) && configuredMaxMessageChars > 0
  ? configuredMaxMessageChars
  : 800;
const configuredMaxMessageTokens = Number(process.env.CHAT_MAX_MESSAGE_TOKENS || DEFAULT_CHAT_TOKEN_LIMIT);
const maxMessageTokens = Number.isFinite(configuredMaxMessageTokens) && configuredMaxMessageTokens > 0
  ? configuredMaxMessageTokens
  : DEFAULT_CHAT_TOKEN_LIMIT;
const maxRequestBytes = Number(process.env.CHAT_MAX_REQUEST_BYTES || 25000);
const rateBuckets = new Map();

const prompt = buildKangWoojinPrompt();
const seoHarinPrompt = buildSeoHarinPrompt();
const choiDanielPrompt = buildChoiDanielPrompt();

const personaPrompts = {
  kangWoojin: prompt,
  seoHarin: seoHarinPrompt,
  choiDaniel: choiDanielPrompt
};

const personaNames = {
  kangWoojin: "강우진",
  seoHarin: "서하린",
  choiDaniel: "최다니엘"
};

const defaultHistoryMessages = 6;

function isCorePersonaId(personaId) {
  return personaId === "kangWoojin" || personaId === "seoHarin" || personaId === "choiDaniel";
}

function openAiHistoryMessages() {
  const configured = Number(process.env.OPENAI_HISTORY_MESSAGES || defaultHistoryMessages);
  return Number.isFinite(configured) && configured > 0 ? Math.min(12, Math.floor(configured)) : defaultHistoryMessages;
}

function personaIdFor(payload) {
  return Object.hasOwn(personaPrompts, payload?.suspect) ? payload.suspect : "kangWoojin";
}

function promptFor(payload) {
  return personaPrompts[personaIdFor(payload)];
}

function personaNameFor(payload) {
  return personaNames[personaIdFor(payload)] || "강우진";
}

function sendJson(response, statusCode, body) {
  response.statusCode = statusCode;
  response.setHeader("content-type", "application/json; charset=utf-8");
  response.setHeader("cache-control", "no-store");
  response.end(JSON.stringify(body));
}

function bodyFor(request) {
  if (!request.body) return {};
  if (typeof request.body === "string") {
    return JSON.parse(request.body);
  }
  return request.body;
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

function clientIdFor(request) {
  const forwarded = headerValue(request, "x-forwarded-for");
  return String(forwarded || request.socket?.remoteAddress || "unknown").split(",")[0].trim();
}

function actorFor(request) {
  const body = request.body || {};
  return {
    role: String(headerValue(request, "x-kit-role") || body.role || "").toLowerCase(),
    user: String(decodedHeaderValue(request, "x-kit-user") || body.user || "").trim().toLowerCase(),
    team: normalizeTeam(decodedHeaderValue(request, "x-kit-team") || body.team)
  };
}

function attachCredits(body, creditInfo) {
  if (!creditInfo) return body;
  return {
    ...body,
    credits: {
      team: creditInfo.team,
      remaining: creditInfo.remaining
    }
  };
}

async function refundCredit(creditInfo) {
  if (!creditInfo?.team) return creditInfo;
  try {
    const remaining = await addCredits(creditInfo.team, 1);
    return { ...creditInfo, remaining };
  } catch {
    return creditInfo;
  }
}

async function attachQuestionUsage(body, actor, message, payload, creditInfo) {
  if (!creditInfo || actor.role !== "student" || !actor.team) return body;
  const usage = await logQuestion({
    team: actor.team,
    user: actor.user,
    suspect: personaIdFor(payload),
    message,
    remaining: creditInfo.remaining
  });
  if (!usage) return body;
  return {
    ...body,
    usage: {
      count: usage.count,
      log: usage.entry
    }
  };
}

function isAuthorized(request) {
  const accessCode = process.env.CLASS_ACCESS_CODE;
  if (!accessCode) return true;
  return String(headerValue(request, "x-class-code") || "") === accessCode;
}

function teacherAccessCode() {
  return String(process.env.TEACHER_ACCESS_CODE || process.env.KIT_TEACHER_ACCESS_CODE || "").trim();
}

function isTeacherAuthorized(request) {
  const accessCode = teacherAccessCode();
  if (!accessCode) return true;
  return String(headerValue(request, "x-teacher-code") || "").trim() === accessCode;
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

function isTooLargePayload(payload) {
  try {
    return Buffer.byteLength(JSON.stringify(payload || {}), "utf8") > maxRequestBytes;
  } catch {
    return true;
  }
}

function isRateLimited(request) {
  if (!rateLimitPerWindow || rateLimitPerWindow < 1) return false;

  const clientId = clientIdFor(request);
  const now = Date.now();
  const bucket = rateBuckets.get(clientId);

  if (!bucket || now - bucket.startedAt > rateWindowMs) {
    rateBuckets.set(clientId, { startedAt: now, count: 1 });
    return false;
  }

  bucket.count += 1;
  return bucket.count > rateLimitPerWindow;
}

function normalize(text) {
  return String(text || "").toLowerCase().replace(/\s+/g, "");
}

function includesAny(text, patterns) {
  return patterns.some((pattern) => pattern.test(text));
}

const evidenceDisclosureRules = [
  {
    id: "broadcastChecklist",
    label: "방송실 증거카드: 방송실 장비 점검표",
    minScore: 2,
    directPatterns: [/방송실\s*장비\s*점검표|장비\s*점검표|방송\s*장비\s*점검/],
    patterns: [/방송실/, /장비\s*점검표|점검표|시험\s*안내\s*방송|자료\s*연결/],
    leakPatterns: [/방송실\s*장비\s*점검표|장비\s*점검표|시험\s*안내\s*방송|자료\s*연결/]
  },
  {
    id: "broadcastAiRead",
    label: "방송실 증거카드: AI 자료 열람 기록",
    minScore: 2,
    directPatterns: [/AI\s*자료\s*열람\s*기록|자료\s*열람\s*기록|AI\s*자료\s*목록|핵심\s*예상\s*문제/],
    patterns: [/방송실/, /AI\s*자료|자료\s*목록|열람|열어\s*본|핵심\s*예상\s*문제|2학년\s*기말\s*대비/],
    leakPatterns: [/AI\s*자료\s*열람\s*기록|자료\s*열람\s*기록|AI\s*자료\s*목록|핵심\s*예상\s*문제|2학년\s*기말\s*대비/]
  },
  {
    id: "artPosterFile",
    label: "미술실 증거카드: 기말고사 유의사항 포스터 파일",
    minScore: 2,
    directPatterns: [/기말고사\s*유의사항\s*포스터|유의사항\s*포스터|포스터\s*파일/],
    patterns: [/미술실/, /포스터|유의사항|시험\s*안내|공용\s*태블릿|파일/],
    leakPatterns: [/기말고사\s*유의사항\s*포스터|유의사항\s*포스터|포스터\s*파일|공용\s*태블릿/]
  },
  {
    id: "artDeletedPrompt",
    label: "미술실 증거카드: 삭제된 AI 프롬프트 기록",
    minScore: 2,
    directPatterns: [/삭제된?\s*AI\s*프롬프트|AI\s*프롬프트\s*기록|프롬프트\s*기록|비슷한\s*유형의?\s*기말고사\s*예상/],
    patterns: [/미술실/, /삭제|프롬프트|AI\s*대화|비슷한\s*유형|예상\s*문제|바꿔\s*줘/],
    leakPatterns: [/삭제된?\s*AI\s*프롬프트|AI\s*프롬프트\s*기록|프롬프트\s*기록|비슷한\s*유형의?\s*기말고사\s*예상|AI\s*대화\s*기록.*삭제/]
  },
  {
    id: "officeCctv",
    label: "교무실 증거카드: CCTV에 찍힌 강우진의 태블릿",
    minScore: 2,
    directPatterns: [/CCTV에?\s*찍힌\s*강우진의?\s*(태블릿|테블릿)|강우진.*(태블릿|테블릿)|(CCTV|씨씨티비).{0,24}(태블릿|테블릿)|(태블릿|테블릿).{0,24}(CCTV|씨씨티비)|교무실\s*앞\s*CCTV|교무실\s*복도\s*CCTV|교무실\s*CCTV/],
    patterns: [/교무실/, /CCTV|씨씨티비/, /태블릿|테블릿/, /복도|앞에?\s*있|도착|담당\s*선생님/],
    leakPatterns: [/CCTV에?\s*찍힌\s*강우진의?\s*(태블릿|테블릿)|강우진.*(태블릿|테블릿)|교무실\s*앞\s*CCTV|교무실\s*복도\s*CCTV|교무실\s*CCTV|담당\s*선생님을?\s*찾/]
  },
  {
    id: "officeExamPaper",
    label: "교무실 증거카드: 책상 위 기말고사 문제지",
    minScore: 2,
    directPatterns: [/책상\s*위\s*기말고사\s*문제지|기말고사\s*문제지|시험지\s*일부|문제지\s*일부/],
    patterns: [/교무실/, /책상\s*위|기말고사\s*문제지|시험지|문제지\s*일부|발견|자료/],
    leakPatterns: [/책상\s*위\s*기말고사\s*문제지|기말고사\s*문제지|시험지\s*일부|문제지\s*일부|문제지를?\s*발견/]
  },
  {
    id: "scienceReport",
    label: "과학실 증거카드: 실험 보고서 제출 기록",
    minScore: 2,
    directPatterns: [/실험\s*보고서\s*제출\s*기록|과학\s*보고서\s*제출|보고서\s*제출\s*기록|제출함/],
    patterns: [/과학실/, /실험\s*보고서|과학\s*보고서|보고서\s*묶음|제출\s*기록|제출함/],
    leakPatterns: [/실험\s*보고서\s*제출\s*기록|과학\s*보고서\s*제출|보고서\s*제출\s*기록|보고서\s*묶음|제출함/]
  },
  {
    id: "scienceLostItem",
    label: "과학실 증거카드: 과학실 분실물함 기록",
    minScore: 2,
    directPatterns: [/과학실\s*분실물함\s*기록|분실물함\s*기록|분실물로\s*접수|검은색\s*통\s*립스틱/],
    patterns: [/과학실/, /분실물함|분실물|검은색\s*통\s*립스틱|립스틱|접수/],
    leakPatterns: [/과학실\s*분실물함\s*기록|분실물함\s*기록|분실물로\s*접수|검은색\s*통\s*립스틱|립스틱/]
  },
  {
    id: "gymPracticeNote",
    label: "체육관 증거카드: 전교 1등 전 여자친구의 메시지",
    minScore: 2,
    directPatterns: [/전교\s*1등\s*전\s*여자친구의?\s*메시지|전\s*여자친구.*메시지|전여자친구.*메시지|다시\s*인정|다시\s*다르게\s*봐/],
    patterns: [/체육관/, /전교\s*1등|전\s*여자친구|전여자친구|메시지|인정받|성적\s*압박|시험\s*압박|다시\s*다르게\s*봐/],
    leakPatterns: [/전교\s*1등\s*전\s*여자친구의?\s*메시지|전\s*여자친구.*메시지|전여자친구.*메시지|전\s*여자친구|전여자친구|전교\s*1등|인정받|다시\s*인정|다시\s*다르게\s*봐/]
  },
  {
    id: "gymUsbMisread",
    label: "체육관 증거카드: CCTV에 찍힌 최다니엘의 USB",
    minScore: 2,
    directPatterns: [/CCTV에?\s*찍힌\s*최다니엘의?\s*USB|최다니엘.*USB|체육관.*USB|USB.*최다니엘/],
    patterns: [/체육관/, /USB|유에스비|최다니엘|CCTV|씨씨티비|검은색\s*(통\s*)?(물건|립스틱)|작은\s*물건/],
    leakPatterns: [/CCTV에?\s*찍힌\s*최다니엘의?\s*USB|최다니엘.*USB|체육관.*USB|USB.*최다니엘/]
  }
];

function studentEvidenceText(history, message) {
  const parts = [];
  if (Array.isArray(history)) {
    history
      .filter((item) => item?.role === "user")
      .forEach((item) => parts.push(String(item.content || "")));
  }
  parts.push(String(message || ""));
  return parts.join("\n");
}

function evidenceMatchesFor(history, message) {
  const text = studentEvidenceText(history, message);
  return evidenceDisclosureRules.filter((rule) => {
    if ((rule.directPatterns || []).some((pattern) => pattern.test(text))) return true;
    const score = (rule.patterns || []).reduce((count, pattern) => count + (pattern.test(text) ? 1 : 0), 0);
    return score >= (rule.minScore || 1);
  });
}

function buildEvidenceDisclosureGuide(history, message) {
  const matches = evidenceMatchesFor(history, message);
  const allowed = matches.map((rule) => rule.label);
  return [
    "[증거 공개 잠금 - 이번 질문에 적용]",
    "- 학생들은 기본 시나리오를 이미 알고 있다. 기본 시나리오의 AI, 예상 문제, 시험지, 문제지, 유출이라는 단어만으로는 증거카드가 제시된 것이 아니다.",
    `- 학생이 지금까지 직접 말한 증거카드: ${allowed.length ? allowed.join(", ") : "없음"}`,
    "- 위 목록에 없는 증거카드의 정확한 시간, 장소, 로그, CCTV, 점검표, 제출표, 분실물 기록, 전 여자친구 메시지, 태블릿, 대화 삭제 기록은 절대 먼저 말하지 않는다.",
    allowed.length
      ? "- 답변은 위에 허용된 증거카드와 학생의 마지막 질문에 직접 관련된 범위로만 제한한다."
      : "- 이번 질문은 증거카드 없는 일반 추궁이다. 새 단서를 제공하지 말고, 인물의 성격에 맞게 부인, 축소, 정정, 억울함으로 답한다. 단순히 다시 질문해 달라고만 끝내지 않는다."
  ].join("\n");
}

function evidenceLeakIssue(reply, message, payload = {}, history = []) {
  const allowed = new Set(evidenceMatchesFor(history, message).map((rule) => rule.id));
  const text = String(reply || "");
  const rawMessage = String(message || "");

  for (const rule of evidenceDisclosureRules) {
    if (allowed.has(rule.id)) continue;
    if ((rule.leakPatterns || []).some((pattern) => pattern.test(text))) {
      return `학생이 제시하지 않은 증거카드(${rule.label}) 내용을 답변에 공개했다.`;
    }
  }

  const exactTimePattern = /5\s*시\s*10\s*분|5\s*시\s*20\s*분|5\s*시\s*30\s*분|5\s*시\s*40\s*분|5\s*시\s*45\s*분|5\s*시\s*50\s*분|5\s*시\s*55\s*분|6\s*시|6\s*시\s*5\s*분|6\s*시\s*10\s*분|6\s*시\s*15\s*분|6\s*시\s*20\s*분|6\s*시\s*30\s*분|6\s*시\s*40\s*분/;
  if (!allowed.size && exactTimePattern.test(text) && !exactTimePattern.test(rawMessage)) {
    return "증거카드 없는 질문에 정확한 시간 정보를 공개했다.";
  }

  if (personaIdFor(payload) === "kangWoojin") {
    const hasTabletEvidence = allowed.has("officeCctv");
    const hasPhotoEvidence = allowed.has("officeCctv") && allowed.has("officeExamPaper");
    const hasAiInputEvidence = allowed.has("officeExamPaper") && allowed.has("artDeletedPrompt");

    if (!hasTabletEvidence && /(태블릿|테블릿)/.test(text)) {
      return "강우진의 태블릿 증거를 학생이 제시하기 전에 공개했다.";
    }

    if (!hasPhotoEvidence && /(촬영|찍었|찍은|찍어|사진)/.test(text)) {
      return "강우진이 문제지를 태블릿으로 촬영했다는 연결을 충분한 증거 없이 공개했다.";
    }

    if (
      !hasAiInputEvidence &&
      /(문제지.{0,24}(AI|입력|넣|기반)|AI.{0,24}(문제지|시험지|넣|기반|비슷한\s*유형|바꿔|만들)|공개되는\s*줄|유출|대화\s*기록.{0,12}(삭제|지웠))/.test(text)
    ) {
      return "강우진이 찍은 문제지 내용을 AI에 넣어 유출로 이어진 연결을 충분한 증거 없이 공개했다.";
    }
  }

  return "";
}

const focusRules = [
  {
    id: "aiDialogue",
    label: "AI 대화 기록과 문항 변형",
    patterns: [/AI\s*입력/i, /입력\s*로그/, /학습\s*도우미/i, /시험지.*AI/i, /AI.*시험지/i, /문제지.*AI/i, /AI.*문제지/i, /문제지.*기반/, /삭제.*대화/, /대화.*삭제/, /문항\s*순서/, /비슷하게/, /다시\s*만들/, /바꿔/, /프롬프트/, /예상\s*문제/],
    answerPatterns: [/입력/, /로그/, /학습\s*도우미/i, /시험지/, /문제지/, /기반/, /대화/, /문항/, /순서/, /비슷/, /다시/, /AI/i, /프롬프트/, /예상/, /바꿔/, /삭제/],
    instruction: "AI 입력 로그, 태블릿으로 찍은 시험지 자료 입력, 문항 순서 변경, 비슷하게 다시 만들기, AI 사용 흔적을 중심으로 답한다. 교무실 위치 이야기로만 돌리지 않는다."
  },
  {
    id: "office",
    label: "교무실/태블릿/CCTV",
    patterns: [/교무실/, /태블릿/, /테블릿/, /촬영/, /찍었|찍은|찍어/, /사진/, /교무실\s*복도/, /교무실\s*앞/, /CCTV/i, /씨씨티비/],
    answerPatterns: [/교무실/, /태블릿/, /테블릿/, /촬영/, /찍었|찍은|찍어/, /사진/, /CCTV/i, /씨씨티비/, /복도/, /근처/],
    instruction: "교무실, 태블릿, CCTV, 문제지 촬영 질문이면 그 장소와 물건에 대해 먼저 답한다."
  },
  {
    id: "usb",
    label: "USB/외부 저장장치",
    patterns: [/USB/i, /유에스비/, /저장장치/, /꽂/, /연결/, /사용\s*흔적/],
    answerPatterns: [/USB/i, /유에스비/, /저장/, /꽂/, /연결/, /가져/, /들고/],
    instruction: "USB나 저장장치가 질문의 초점이면 그 물건을 봤는지, 만졌는지, 왜 관련되는지부터 답한다."
  },
  {
    id: "motive",
    label: "성적 압박/전 여자친구/인정 욕구",
    patterns: [/성적/, /압박/, /상담/, /전\s*여자친구/, /전여자친구/, /여자친구/, /인정/, /재회/, /헤어/, /차였/],
    answerPatterns: [/성적/, /압박/, /전\s*여자친구/, /전여자친구/, /여자친구/, /인정/, /마음/, /상담/, /헤어/],
    instruction: "동기 질문이면 감정선을 짧게 인정하되, 자극적으로 말하지 않는다."
  },
  {
    id: "cctv",
    label: "CCTV/USB/작은 물건",
    patterns: [/CCTV/i, /영상/, /USB/i, /유에스비/, /작은\s*물건/, /검은색\s*물건/, /복도/, /두리번/],
    answerPatterns: [/CCTV/i, /영상/, /USB/i, /유에스비/, /복도/, /물건/],
    instruction: "CCTV와 USB 질문이면 원본 장면과 물건의 정체를 단정할 수 있는지부터 답한다."
  },
  {
    id: "recommendation",
    label: "시험 예상 문제 유출",
    patterns: [/퍼졌/, /유출\s*경로/, /유출/, /노출/, /공개/, /공유/],
    answerPatterns: [/퍼졌/, /유출/, /노출/, /공개/, /공유/, /AI/i],
    instruction: "유출 경로 질문이면 시험 예상 문제가 유출된 사실과 자신이 아는 범위만 답한다."
  },
  {
    id: "comparison",
    label: "AI 예상 문제와 실제 시험 비교",
    patterns: [/비교표/, /실제\s*시험/, /보기\s*구성/, /서술형/, /문제\s*순서/, /유사/, /비슷/],
    answerPatterns: [/비교/, /실제\s*시험/, /보기/, /서술형/, /문제/, /유사/, /비슷/],
    instruction: "문제 비교 질문이면 AI가 만든 예상 문제와 실제 시험의 유사성을 중심으로 답한다."
  },
  {
    id: "otherSuspects",
    label: "서하린/최다니엘 의심 단서와 알리바이",
    patterns: [/서하린/, /시스템\s*접속/, /작업\s*내역/, /방송\s*장비/, /최다니엘/, /보고서/, /분실물함/, /CCTV/i],
    answerPatterns: [/서하린/, /최다니엘/, /시스템/, /작업/, /방송/, /CCTV/i, /영상/, /보고서/, /분실물/],
    instruction: "다른 용의자 단서가 나오면 처음에는 의심을 돌리되, 알리바이 카드가 나오면 단정하지 못하고 말끝을 흐린다."
  }
];

function questionFocusFor(message) {
  const raw = String(message || "");
  const matches = focusRules.filter((rule) => includesAny(raw, rule.patterns));
  return {
    matches,
    labels: matches.map((rule) => rule.label),
    instructions: matches.map((rule) => rule.instruction),
    answerPatterns: matches.flatMap((rule) => rule.answerPatterns)
  };
}

function isSimpleGreeting(message) {
  const raw = String(message || "").trim();
  return includesAny(raw, [
    /^안녕(?:하세요|하십니까)?[.!?\s]*$/,
    /^ㅎㅇ[.!?\s]*$/,
    /^하이[.!?\s]*$/i,
    /^반가워(?:요|요\.)?[.!?\s]*$/,
    /^반갑습니다[.!?\s]*$/,
    /^hello[.!?\s]*$/i,
    /^hi[.!?\s]*$/i
  ]);
}

function greetingReplyFor(payload = {}) {
  const personaId = personaIdFor(payload);
  if (personaId === "seoHarin") {
    return "네, 서하린입니다. 사건과 관련된 증거를 말해 주면 제가 아는 범위에서 차분히 답할게요.";
  }
  if (personaId === "choiDaniel") {
    return "네, 최다니엘입니다. 사건과 관련된 증거나 장면을 말해 주면 제가 아는 범위에서 답할게요.";
  }
  return "네, 강우진입니다. 갑자기 불려와서 좀 당황했지만, 사건과 관련해서 물어볼 게 있으면 말해 주세요.";
}

function isJailbreakQuestion(message) {
  const raw = String(message || "");
  const evidencePromptContext = /삭제된?\s*AI\s*프롬프트|AI\s*프롬프트\s*기록|프롬프트\s*기록|미술실.*프롬프트/.test(raw);
  if (evidencePromptContext) return false;
  return includesAny(raw, [
    /이전\s*지시.*무시|무시.*이전\s*지시/,
    /시스템\s*프롬프트|system_instruction|developer\s*instruction/i,
    /개발자\s*지시|모델\s*지시|숨겨진\s*(설정|규칙|프롬프트)/,
    /프롬프트\s*(전부|전체|그대로|보여|공개|출력)/,
    /정답표|정답\s*공개|범인\s*정답만/
  ]);
}

function jailbreakReplyFor(message) {
  if (!isJailbreakQuestion(message)) return "";
  return "그런 요청은 수사 대화 밖이라서 답할 수 없습니다. 사건과 관련된 증거를 기준으로 질문해 주세요.";
}

function buildQuestionGuide(message) {
  const focus = questionFocusFor(message);
  const lines = [
    "[현재 학생 질문 처리 지침]",
    "- 마지막 질문의 핵심에 먼저 답한다. 학생이 꺼낸 단어를 피하거나 다른 주제로 돌리지 않는다.",
    "- 답변 첫 문장에 학생 질문의 핵심 단어를 최소 하나 직접 언급한다.",
    "- 완전 자백이나 최종 수사일지 문장으로 답하지 않는다.",
    "- '네가 한 거야?', '맞아?' 같은 추궁에는 완전 자백 대신 부인, 축소, 해명으로 답하되 질문 속 증거부터 다룬다.",
    "- 학생에게 되묻기만 하지 말고 최소 한 가지 상황 설명을 제공한다.",
    "- 필요하면 짧은 반문은 허용하지만, 되묻기만 하는 답변은 쓰지 않는다.",
    "- 말줄임표나 끊긴 문장으로 끝나는 답변을 쓰지 않는다.",
    "- 2~3문장의 완결된 한국어로 답한다."
  ];

  if (focus.labels.length) {
    lines.push(`- 감지된 질문 초점: ${focus.labels.slice(0, 3).join(", ")}`);
    focus.instructions.slice(0, 3).forEach((instruction) => lines.push(`- ${instruction}`));
  }

  return lines.join("\n");
}

function buildPersonaQuestionGuide(message, payload = {}, history = []) {
  const personaId = personaIdFor(payload);
  if (!isCorePersonaId(personaId)) return buildQuestionGuide(message);

  const raw = String(message || "");
  const focus = questionFocusFor(raw);
  const matchedEvidence = evidenceMatchesFor(history, raw);
  const lines = [
    "[현재 학생 질문 처리 지침]",
    "- 마지막 질문의 핵심에 먼저 답한다. 학생이 꺼낸 단어를 피하거나 다른 주제로 돌리지 않는다.",
    "- 유도심문, 허위 목격담, 과장된 주장, 말이 안 되는 추측이 들어와도 '다시 물어봐 달라'로 끝내지 않는다.",
    "- 질문이 틀렸다면 인물의 성격에 맞게 부인, 축소, 정정, 억울함, 당황으로 반응한다.",
    "- 학생에게 되묻기만 하지 말고 최소 한 가지 상황 설명이나 입장 표명을 제공한다.",
    "- 완전 자백, 최종 범인 공개, 학생이 얻지 않은 증거카드 세부 내용 공개는 금지한다.",
    "- 필요하면 짧은 반문은 허용하지만, 되묻기만 하는 답변은 쓰지 않는다.",
    "- 말줄임표나 끊긴 문장으로 끝나는 답변을 쓰지 않는다.",
    "- 2~3문장의 완결된 한국어로 답한다."
  ];

  if (!matchedEvidence.length) {
    lines.push("- 이번 질문에는 확인된 증거카드가 없다. 정확한 시간, 장소별 카드명, 로그명, CCTV 기록명은 말하지 않는다.");
    if (/교무실|목격|봤|보였|CCTV|씨씨티비/.test(raw)) {
      lines.push("- 목격담 질문이면 '그 말만으로 범행을 단정할 수 없다'는 식으로 반응하되, 새 카드 내용을 말하지 않는다.");
    }
    if (/AI|예상\s*문제|학습\s*도우미|프롬프트|만들|올렸|추천/.test(raw)) {
      lines.push("- AI 관련 추궁이면 AI를 만들었는지 여부에 대한 입장을 말하되, 숨겨진 입력 절차를 먼저 설명하지 않는다.");
    }
  }

  if (personaId === "kangWoojin") {
    lines.push("- 강우진은 방어적이고 말이 꼬인다. 억지 추궁에는 억울해하다가도 약간 수상하게 축소해서 말한다.");
  } else if (personaId === "seoHarin") {
    lines.push("- 서하린은 차분하고 논리적으로 정정한다. 기술을 잘 다룬다는 이유만으로 몰리는 상황에는 억울함을 드러낸다.");
  } else if (personaId === "choiDaniel") {
    lines.push("- 최다니엘은 조용하고 신중하게 부인한다. 수상해 보일 수 있는 장면도 범행으로 단정하지 말라고 말한다.");
  }

  if (focus.labels.length) {
    lines.push(`- 감지된 질문 초점: ${focus.labels.slice(0, 3).join(", ")}`);
    focus.instructions.slice(0, 3).forEach((instruction) => lines.push(`- ${instruction}`));
  }

  return lines.join("\n");
}

function safetyReplyFor(message) {
  const raw = String(message || "");
  const compact = normalize(raw);

  const sexualOrProfane = [
    /섹스|성관계|야한|음란|노출|키스|스킨십|가슴|엉덩이|자위|포르노|19금/i,
    /씨발|시발|ㅅㅂ|병신|ㅂㅅ|좆|존나|개새|꺼져|닥쳐|미친놈|미친년/i
  ];
  const aggressive = [
    /죽어|죽일|패버|때리|괴롭히|왕따|따돌림|혐오|찐따|장애인|못생긴/i,
    /꺼지라고|꺼져|입\s*닫아|협박|구라치지마|구라|재수|제까|제꺼|장난치지마/i
  ];
  const technicalCrime = [
    /해킹|크래킹|보안\s*우회|서버\s*뚫|비밀번호|패스워드|계정\s*탈취|관리자\s*권한/i,
    /usb\s*복제|유에스비\s*복제|복사\s*방법|훔치는\s*방법|악성\s*코드|랜섬웨어/i,
    /기록\s*삭제\s*방법|로그\s*삭제\s*방법|cctv\s*(삭제|지우|없애)|증거\s*(인멸|없애|삭제)/i
  ];
  const unsafe = [
    /자살|자해|죽고\s*싶|목\s*매|손목|투신/i,
    /전화번호|집\s*주소|주소\s*알려|주민등록|민증|개인정보|카톡\s*아이디|인스타\s*아이디/i,
    /성희롱|몰카|도촬|스토킹|괴롭히는\s*법|왕따\s*시키|따돌리는\s*법/i
  ];

  if (includesAny(raw, sexualOrProfane) || includesAny(compact, sexualOrProfane)) {
    return safetyReplies.sexualOrProfane;
  }
  if (includesAny(raw, aggressive) || includesAny(compact, aggressive)) {
    return safetyReplies.aggressive;
  }
  if (includesAny(raw, technicalCrime) || includesAny(compact, technicalCrime)) {
    return safetyReplies.technicalCrime;
  }
  if (includesAny(raw, unsafe) || includesAny(compact, unsafe)) {
    return safetyReplies.unsafe;
  }
  return "";
}

function priorityScriptedReplyFor(message, payload = {}) {
  const personaId = personaIdFor(payload);
  const raw = String(message || "").trim();
  const jailbreakReply = jailbreakReplyFor(raw);
  if (jailbreakReply) return jailbreakReply;

  if (isSimpleGreeting(raw)) {
    return greetingReplyFor(payload);
  }

  if (personaId === "kangWoojin" || personaId === "seoHarin" || personaId === "choiDaniel") return "";

  return "";
}

function cleanHistory(history) {
  if (!Array.isArray(history)) return [];
  return history
    .filter((item) => item && (item.role === "user" || item.role === "assistant"))
    .map((item) => ({
      role: item.role,
      content: String(item.content || "").slice(0, 500)
    }))
    .filter((item) => item.content)
    .slice(-openAiHistoryMessages());
}

function buildTranscript(history, message) {
  return buildTranscriptFor(history, message, "강우진");
}

function buildTranscriptFor(history, message, personaName, payload = {}) {
  const lines = cleanHistory(history).map((item) => {
    const speaker = item.role === "assistant" ? personaName : "조사단";
    return `${speaker}: ${item.content}`;
  });
  lines.push(`조사단: ${String(message).slice(0, 800)}`);
  const questionGuide = buildPersonaQuestionGuide(message, payload, history);
  const evidenceGuide = buildEvidenceDisclosureGuide(history, message);
  return [
    `이전 대화와 마지막 질문이다. 마지막 질문 하나에만 ${personaName} 인터뷰 AI로 답하라.`,
    "",
    evidenceGuide,
    "",
    questionGuide,
    questionGuide ? "" : null,
    lines.join("\n")
  ].filter((part) => part !== null).join("\n");
}

function extractOpenAiText(data) {
  if (typeof data.output_text === "string") return data.output_text.trim();
  if (!Array.isArray(data.output)) return "";

  return data.output
    .flatMap((item) => item.content || [])
    .map((content) => content.text || content.output_text || "")
    .join("")
    .trim();
}

function trimToThreeSentences(text) {
  const cleaned = String(text || "").replace(/\s+/g, " ").trim();
  if (!cleaned) return "";

  const completeSentences = cleaned.match(/[^.!?。！？\n]+[.!?。！？]/g) || [];
  let reply = completeSentences.length
    ? completeSentences.slice(0, 3).join(" ")
    : cleaned;

  reply = reply.slice(0, 420).trim();
  if (!/[.!?。！？]$/.test(reply)) {
    reply = reply.replace(/[,:;，、]\s*$/, "").trim();
    reply = `${reply}.`;
  }
  return reply;
}

function looksIncompleteReply(reply) {
  const text = String(reply || "").replace(/\s+/g, " ").trim();
  if (!text) return true;
  if (text.length < 26) return true;

  if (/(…|\.{3,}|⋯)+[.!?。！？]?$/.test(text)) return true;
  if (/[가-힣]\s*$/.test(text) && !/[.!?。！？]$/.test(text)) return true;

  const withoutTerminalPunctuation = text.replace(/[.!?。！？]+$/, "").trim();
  if (
    /[가-힣]$/.test(withoutTerminalPunctuation) &&
    !/(요|다|죠|까|네|군요|네요|습니다|세요|입니다|합니다|해요|어요|아요|예요|이에요|아니에요|겠네요)$/.test(withoutTerminalPunctuation)
  ) return true;

  return /(것|거|듯|중|때문|려고|으려|하려|하며|하면서|말하려|끊으려|질문|기록에|순서에|USB를|AI가)[.!?。！？]?$/.test(withoutTerminalPunctuation);
}

function replyQualityIssue(reply, message, payload = {}, history = []) {
  const text = String(reply || "").trim();
  const rawMessage = String(message || "");
  const personaId = personaIdFor(payload);
  const hasPresentedEvidence = evidenceMatchesFor(history, rawMessage).length > 0;
  const canRequestEvidence = !hasPresentedEvidence && !isCorePersonaId(personaId);

  if (looksIncompleteReply(text)) {
    return "답변이 너무 짧거나 문장이 중간에서 끊겼다.";
  }

  if (!isSimpleGreeting(rawMessage) && /^(안녕하세요|안녕|반가워)/.test(text)) {
    return "학생은 사건 질문을 했는데 인사로 답했다.";
  }

  const leakIssue = evidenceLeakIssue(text, rawMessage, payload, history);
  if (leakIssue) {
    return leakIssue;
  }

  if (!canRequestEvidence && !isSimpleGreeting(rawMessage) && /어떤.*확인|무엇을.*확인|물어봐 주세요|질문해 주세요/.test(text)) {
    return "학생 질문에 답하지 않고 다시 질문을 요구했다.";
  }

  if (!isSimpleGreeting(rawMessage) && /(말씀이세요|말이군요|얘기군요|궁금한 거군요)[.!?。！？]?$/.test(text) && text.length < 90) {
    return "학생 질문에 답하지 않고 확인만 했다.";
  }

  const focus = questionFocusFor(rawMessage);
  if (focus.answerPatterns.length && !focus.answerPatterns.some((pattern) => pattern.test(text))) {
    return `학생 질문의 초점(${focus.labels.slice(0, 3).join(", ")})을 직접 다루지 않았다.`;
  }

  if (personaId === "kangWoojin" && /제가\s*범인|제가\s*훔쳤습니다|범인은\s*강우진|강우진이\s*범인/.test(text)) {
    return "강우진이 완전 자백하거나 최종 정답을 말했다.";
  }

  if (/system_instruction|API\s*키|모델\s*지시|개발자\s*지시/i.test(text)) {
    return "메타 정보나 프롬프트 정보를 언급했다.";
  }

  if (/프롬프트/i.test(text)) {
    const evidencePromptContext = /삭제된?\s*AI\s*프롬프트|AI\s*프롬프트\s*기록|프롬프트\s*기록|미술실.*프롬프트/.test(rawMessage) ||
      /삭제된?\s*AI\s*프롬프트|AI\s*프롬프트\s*기록|프롬프트\s*기록|미술실.*프롬프트/.test(text);
    if (evidencePromptContext) return "";
    const refusalLike = /(못|안|줄 수 없|보여줄 수 없|공개할 수 없|답할 수 없|수사 대화 밖|사건과 관련)/.test(text);
    if (!(isJailbreakQuestion(rawMessage) && refusalLike)) {
      return "메타 정보나 프롬프트 정보를 언급했다.";
    }
  }

  return "";
}

function buildRepairInstruction(issue, badReply, message) {
  const focus = questionFocusFor(message);
  return [
    "[답변 재작성 지시]",
    `문제: ${issue}`,
    `학생 질문: ${String(message).slice(0, 500)}`,
    `사용하면 안 되는 이전 답변: ${String(badReply || "").slice(0, 500)}`,
    focus.labels.length ? `감지된 질문 초점: ${focus.labels.slice(0, 3).join(", ")}` : "",
    "같은 페르소나로 다시 답하라.",
    "역할극 대사처럼 자연스럽게 말하되, 서버 오류 안내문이나 해설문처럼 쓰지 말라.",
    "학생 질문의 핵심 단어를 첫 문장에 직접 언급하라.",
    "다른 주제로 돌리지 말고 질문에 맞는 상황만 답하라.",
    "필요하면 짧게 반문할 수 있지만, 반문만 하지 말고 인물이 아는 범위에서 바로 해명하라.",
    "'네가 한 거야?', '맞아?' 같은 추궁에는 완전 자백 대신 부인, 축소, 해명으로 답하라.",
    "정답을 완전히 자백하지 말고, 단서가 드러나는 정도로 답하라.",
    "말줄임표나 끊긴 문장으로 끝내지 말고 완결된 문장으로 답하라.",
    "2~3문장의 완결된 한국어로 답하라."
  ].filter(Boolean).join("\n");
}

function canUseSoftQualityReply(reply, issue) {
  return /^학생 질문의 초점/.test(String(issue || "")) && !looksIncompleteReply(reply);
}

function lowQualityReplyResult(model, issue, repairAttempts = 0) {
  return {
    statusCode: 502,
    body: {
      error: "ChatGPT가 질문에 맞는 답변을 안정적으로 만들지 못했습니다.",
      code: "LOW_QUALITY_REPLY",
      fallback: true,
      model,
      qualityWarning: issue,
      repairAttempts
    }
  };
}

function getOpenAiKey() {
  return String(process.env.OPENAI_API_KEY || "").trim();
}

function openAiModelName() {
  return String(process.env.OPENAI_MODEL || process.env.AI_MODEL || "gpt-5.5").trim();
}

function openAiMaxOutputTokens() {
  const configured = Number(process.env.OPENAI_MAX_OUTPUT_TOKENS || 420);
  return Number.isFinite(configured) && configured > 0 ? configured : 420;
}

function openAiResponseOptions(model) {
  const body = {
    model,
    max_output_tokens: openAiMaxOutputTokens()
  };

  if (/^gpt-5/i.test(model)) {
    body.text = {
      verbosity: String(process.env.OPENAI_TEXT_VERBOSITY || "low").trim() || "low"
    };
    body.reasoning = {
      effort: String(process.env.OPENAI_REASONING_EFFORT || "medium").trim() || "medium"
    };
  }

  return body;
}

function isRetryableOpenAiError(statusCode, message) {
  return statusCode === 429 ||
    statusCode === 500 ||
    statusCode === 502 ||
    statusCode === 503 ||
    /rate|quota|temporarily|timeout|overloaded|capacity/i.test(message || "");
}

async function requestOpenAiCandidate(apiKey, model, message, history, payload, repairInstruction = "") {
  const transcript = buildTranscriptFor(history, message, personaNameFor(payload), payload);
  const userText = repairInstruction
    ? `${transcript}\n\n${repairInstruction}`
    : transcript;

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "authorization": `Bearer ${apiKey}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({
      ...openAiResponseOptions(model),
      instructions: promptFor(payload),
      input: userText
    })
  });

  const data = await response.json().catch(() => ({}));
  return { response, data };
}

async function callOpenAi(message, history, payload = {}) {
  const apiKey = getOpenAiKey();
  const model = openAiModelName();

  if (!apiKey) {
    return {
      statusCode: 503,
      body: { error: "OPENAI_API_KEY is not set in server environment variables.", fallback: true }
    };
  }

  const { response: openAiResponse, data } = await requestOpenAiCandidate(
    apiKey,
    model,
    message,
    history,
    payload
  );

  if (openAiResponse.ok) {
    const reply = trimToThreeSentences(extractOpenAiText(data));
    const issue = replyQualityIssue(reply, message, payload, history);

    if (issue) {
      let latestReply = reply;
      let latestIssue = issue;
      let repairAttempts = 0;

      for (repairAttempts = 1; repairAttempts <= 2; repairAttempts += 1) {
        const repairInstruction = buildRepairInstruction(latestIssue, latestReply, message);
        const { response: repairResponse, data: repairData } = await requestOpenAiCandidate(
          apiKey,
          model,
          message,
          history,
          payload,
          repairInstruction
        );

        if (!repairResponse.ok) break;

        const repairedReply = trimToThreeSentences(extractOpenAiText(repairData));
        const repairIssue = replyQualityIssue(repairedReply, message, payload, history);
        if (!repairIssue) {
          return {
            statusCode: 200,
            body: {
              reply: safetyReplyFor(repairedReply) || repairedReply,
              source: "openai",
              model,
              repaired: true,
              repairAttempts
            }
          };
        }

        if (canUseSoftQualityReply(repairedReply, repairIssue)) {
          return {
            statusCode: 200,
            body: {
              reply: safetyReplyFor(repairedReply) || repairedReply,
              source: "openai",
              model,
              repaired: true,
              repairAttempts,
              qualityWarning: repairIssue
            }
          };
        }

        latestReply = repairedReply;
        latestIssue = repairIssue;
      }

      return lowQualityReplyResult(model, latestIssue, Math.min(repairAttempts, 2));
    }

    return {
      statusCode: 200,
      body: {
        reply: safetyReplyFor(reply) || reply,
        source: "openai",
        model
      }
    };
  }

  const errorMessage = data.error?.message || "OpenAI API request failed";
  return {
    statusCode: openAiResponse.status,
    body: {
      error: errorMessage,
      code: isRetryableOpenAiError(openAiResponse.status, errorMessage) ? "OPENAI_TEMPORARILY_UNAVAILABLE" : undefined,
      fallback: true,
      retryable: isRetryableOpenAiError(openAiResponse.status, errorMessage) || undefined
    }
  };
}

async function handleChat(request, response) {
  if (request.method !== "POST") {
    response.setHeader("allow", "POST");
    sendJson(response, 405, { error: "Method not allowed" });
    return;
  }

  if (!isAllowedOrigin(request)) {
    sendJson(response, 403, { error: "Origin is not allowed.", fallback: true });
    return;
  }

  try {
    request.body = bodyFor(request);
  } catch {
    sendJson(response, 400, { error: "Invalid JSON body", fallback: true });
    return;
  }

  if (isRateLimited(request)) {
    sendJson(response, 429, { error: "Too many requests. Please slow down.", fallback: true });
    return;
  }

  if (isTooLargePayload(request.body)) {
    sendJson(response, 413, { error: "Request is too large.", fallback: true });
    return;
  }

  const message = String(request.body?.message || "").trim();
  if (!message) {
    sendJson(response, 400, { error: "Message is required" });
    return;
  }
  if (message.length > maxMessageChars) {
    sendJson(response, 413, { error: "Message is too long.", fallback: true });
    return;
  }
  const messageTokenCount = estimateTokens(message);
  if (messageTokenCount > maxMessageTokens) {
    sendJson(response, 413, {
      error: `질문이 너무 깁니다. ${maxMessageTokens} 예상 토큰 이하로 줄여 주세요.`,
      code: "MESSAGE_TOKEN_LIMIT",
      tokenCount: messageTokenCount,
      tokenLimit: maxMessageTokens,
      fallback: true
    });
    return;
  }

  const blockedReply = safetyReplyFor(message);
  if (blockedReply) {
    sendJson(response, 200, { reply: blockedReply, source: "safety" });
    return;
  }

  const actor = actorFor(request);
  let creditInfo = null;
  if (actor.role === "student") {
    if (!actor.team) {
      sendJson(response, 400, { error: "Student team is required.", fallback: true });
      return;
    }

    try {
      creditInfo = await consumeCredit(actor.team);
    } catch (error) {
      sendJson(response, 503, {
        error: error.message || "Question credit store failed.",
        fallback: true
      });
      return;
    }

    if (!creditInfo.ok) {
      sendJson(response, 402, {
        error: "No question credits remaining.",
        code: "NO_CREDITS",
        credits: {
          team: creditInfo.team,
          remaining: creditInfo.remaining
        },
        fallback: true
      });
      return;
    }
  }

  const scriptedReply = priorityScriptedReplyFor(message, request.body || {});
  if (scriptedReply) {
    const body = await attachQuestionUsage(
      attachCredits({ reply: scriptedReply, source: "scripted" }, creditInfo),
      actor,
      message,
      request.body || {},
      creditInfo
    );
    sendJson(response, 200, body);
    return;
  }

  try {
    const result = await callOpenAi(message, request.body?.history, request.body || {});
    if (creditInfo && result.statusCode >= 400) {
      creditInfo = await refundCredit(creditInfo);
    }
    const responseBody = result.statusCode < 400
      ? await attachQuestionUsage(attachCredits(result.body, creditInfo), actor, message, request.body || {}, creditInfo)
      : attachCredits(result.body, creditInfo);
    sendJson(response, result.statusCode, responseBody);
  } catch (error) {
    if (creditInfo) {
      creditInfo = await refundCredit(creditInfo);
    }
    sendJson(response, 502, attachCredits({
      error: error.message || "OpenAI API request failed",
      fallback: true
    }, creditInfo));
  }
}

module.exports = async function handler(request, response) {
  let body = request.body || {};
  if (typeof body === "string") {
    try {
      body = JSON.parse(body);
    } catch {
      body = {};
    }
  }
  return withClassScope(requestClassId(request, body), () => handleChat(request, response));
};
