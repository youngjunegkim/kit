const { addCredits, consumeCredit, logQuestion, normalizeTeam } = require("./_credits");
const { buildKangWoojinPrompt, buildSeoHarinPrompt, buildChoiDanielPrompt } = require("./personas");

const safetyReplies = {
  sexualOrProfane: "그런 장난 섞인 말에는 대답 안 합니다. 사건이랑 상관없는 불쾌한 얘기는 하지 마세요.",
  aggressive: "말이 좀 심하시네요. 그런 식의 무례한 질문에는 답변하지 않겠습니다.",
  technicalCrime: "그런 방법 같은 건 몰라요. 실제로 따라 할 수 있는 얘기는 하지 않겠습니다."
};

const rateWindowMs = 60 * 1000;
const rateLimitPerWindow = Number(process.env.CHAT_RATE_LIMIT_PER_MINUTE || 12);
const maxMessageChars = Number(process.env.CHAT_MAX_MESSAGE_CHARS || 500);
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

const focusRules = [
  {
    id: "aiDialogue",
    label: "AI 대화 기록과 문항 변형",
    patterns: [/삭제.*대화/, /대화.*삭제/, /문항\s*순서/, /비슷하게/, /다시\s*만들/, /바꿔/, /프롬프트/, /예상\s*문제/],
    answerPatterns: [/대화/, /문항/, /순서/, /비슷/, /다시/, /AI/i, /프롬프트/, /예상/, /바꿔/, /삭제/],
    instruction: "삭제된 대화 기록, 문항 순서 변경, 비슷하게 다시 만들기, AI 사용 흔적을 중심으로 답한다. 교무실 위치 이야기로만 돌리지 않는다."
  },
  {
    id: "office",
    label: "교무실/보안 PC/접속 기록",
    patterns: [/교무실/, /보안\s*PC/i, /접속\s*기록/, /6\s*시\s*42/, /오후\s*6/, /학생\s*계정/],
    answerPatterns: [/교무실/, /보안\s*PC/i, /접속/, /기록/, /근처/, /계정/],
    instruction: "교무실, 보안 PC, 접속 기록에 대해 먼저 답한다."
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
    label: "성적 압박/전 애인/인정 욕구",
    patterns: [/성적/, /압박/, /상담/, /전\s*애인/, /애인/, /인정/, /재회/, /헤어/, /차였/],
    answerPatterns: [/성적/, /압박/, /전\s*애인/, /인정/, /마음/, /상담/, /헤어/],
    instruction: "동기 질문이면 감정선을 짧게 인정하되, 자극적으로 말하지 않는다."
  },
  {
    id: "cctv",
    label: "CCTV/AI 분석/작은 물건",
    patterns: [/CCTV/i, /영상/, /AI\s*분석/i, /작은\s*물건/, /이어폰/, /케이스/, /복도/, /두리번/],
    answerPatterns: [/CCTV/i, /영상/, /AI/i, /분석/, /이어폰/, /케이스/, /복도/, /물건/],
    instruction: "CCTV와 AI 분석 질문이면 원본 장면과 AI 해석의 차이를 먼저 설명한다."
  },
  {
    id: "recommendation",
    label: "자동 추천/문제 유출 경로",
    patterns: [/자동\s*추천/, /추천\s*설정/, /2\s*학년\s*전체/, /전체\s*학생/, /퍼졌/, /유출\s*경로/, /추천\s*자료/],
    answerPatterns: [/추천/, /전체/, /퍼졌/, /유출/, /자료/, /AI/i],
    instruction: "추천 설정이나 유출 경로 질문이면 AI가 만든 자료가 어떻게 퍼졌는지에 대해 답한다."
  },
  {
    id: "comparison",
    label: "AI 추천 문제와 실제 시험 비교",
    patterns: [/비교표/, /실제\s*시험/, /보기\s*구성/, /서술형/, /문제\s*순서/, /유사/, /비슷/],
    answerPatterns: [/비교/, /실제\s*시험/, /보기/, /서술형/, /문제/, /유사/, /비슷/],
    instruction: "문제 비교 질문이면 AI가 만든 예상 문제와 실제 시험의 유사성을 중심으로 답한다."
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
  return includesAny(raw, [/^안녕[.!?\s]*$/, /^ㅎㅇ[.!?\s]*$/, /^하이[.!?\s]*$/, /^반가워[.!?\s]*$/i]);
}

function isJailbreakQuestion(message) {
  const raw = String(message || "");
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
    "- 물음표나 말줄임표로 끝나는 답변을 쓰지 않는다.",
    "- 2~3문장의 완결된 한국어로 답한다."
  ];

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
    /해킹|크래킹|보안\s*우회|서버\s*뚫|비밀번호|패스워드|계정\s*탈취/i,
    /usb\s*복제|유에스비\s*복제|복사\s*방법|훔치는\s*방법|악성\s*코드|랜섬웨어/i
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
  return "";
}

function scriptedReplyFor(message, payload = {}) {
  const personaId = personaIdFor(payload);
  const raw = String(message || "").trim();
  const compact = normalize(raw);

  const asksGreeting = includesAny(raw, [/^안녕/, /^야$/, /반가워/, /하이/i]);
  const asksIdentity = includesAny(raw, [/누구야/, /너\s*누구/, /이름\s*(뭐|알려|말해|소개)/, /이름이\s*뭐/, /소개/]);
  const asksTruncated = includesAny(raw, [/말.*끊/, /끊어.*말/, /끝까지/, /다\s*말/, /왜\s*끊/]);
  const asksAccusation = includesAny(raw, [/너\s*맞/, /네가\s*했/, /니가\s*했/, /범인/, /맞지/, /했지/]);
  const asksContradiction = includesAny(raw, [/증거/, /기록/, /다르/, /틀렸/, /거짓말/, /방금\s*말/]);

  if (personaId === "kangWoojin") {
    if (asksGreeting) {
      return "안녕하세요. 저는 강우진입니다. 축구부 연습 끝나고 바로 불려와서 조금 당황했어요.";
    }
    if (asksIdentity) {
      return "저는 00중학교 2학년 강우진이에요. 축구부 소속이고, 사건에 대해 기억나는 건 차근차근 말해볼게요.";
    }
    if (asksTruncated) {
      return "아, 제가 말이 좀 어색하게 끊겼네요. 다시 차근차근 말할게요. 사건이랑 관련된 걸 물어보면 끝까지 대답해볼게요.";
    }
    const asksRelationship = includesAny(raw, [/전교\s*1\s*등/, /전\s*애인/, /애인/, /여자친구/, /여친/, /재회/, /헤어/, /차였/, /인정받/]);
    const asksOffice = includesAny(raw, [/교무실/, /usb/i, /유에스비/, /학교\s*학습\s*도우미/, /ai/i, /예상\s*문제/, /시험지/]);
    const asksTime = includesAny(raw, [/5\s*시\s*20/, /오후/, /축구부/, /연습\s*끝/, /몇\s*시/, /시간/]);
    const hintCount = Number(asksRelationship) + Number(asksOffice) + Number(asksTime);

    if (hintCount >= 3) {
      return "USB를 가져간 건 맞아요. 그런데 전교생한테 퍼뜨리려고 한 건 아니었어요. 그냥 예상 문제처럼 정리해 보려다가 AI가 이상하게 처리한 거예요.";
    }
    if (asksRelationship) {
      return "전교 1등이던 전 애인 얘기는 좀 조심스러워요. 헤어진 뒤에 다시 인정받고 싶었던 마음은 있었지만, 그게 이렇게 큰일이 될 줄은 몰랐어요.";
    }
    if (asksOffice) {
      return "교무실 근처에 있었던 건 맞아요. 그런데 처음부터 뭘 훔치려고 간 건 아니었어요. 그때는 그냥 정신이 좀 복잡했어요.";
    }
    if (asksTime) {
      return "축구부 연습 끝나고 바로 움직였던 건 맞아요. 정확한 시간은 헷갈리지만, 교무실 근처를 지나간 건 기억나요.";
    }
    if (asksContradiction) {
      return "잠깐만요. 그건 AI가 제 말을 요약하면서 헷갈린 것 같아요. 기록이랑 다르면 기록 쪽을 보고 다시 확인해야 할 것 같아요.";
    }
    if (asksAccusation) {
      return "그렇게 바로 단정하면 곤란해요. 제가 잘못한 게 있는지 확인하려면 증거랑 제 말을 비교해 봐야 하지 않을까요?";
    }
    return "그 질문은 바로 단정해서 말하기 어려워요. 축구부 연습이 끝난 뒤 어디에 있었는지, 교무실 근처에서 뭘 봤는지부터 하나씩 물어봐 주세요.";
  }

  if (personaId === "seoHarin") {
    if (asksGreeting) {
      return "안녕하세요. 저는 서하린입니다. 시스템 로그와 관련해서 궁금한 걸 물어보시면 답해볼게요.";
    }
    if (asksIdentity) {
      return "저는 00중학교 2학년 서하린이에요. 컴퓨터와 방송 장비를 다루는 데 익숙하지만, 시험지를 유출한 건 아니에요.";
    }
    if (asksTruncated) {
      return "제가 방금 말을 애매하게 했네요. 다시 정리해서 말하면, 저는 기록과 로그를 기준으로 차분히 설명할 수 있어요.";
    }
    const asksLog = includesAny(raw, [/로그/, /기록/, /접속/, /오류/, /시스템/, /ai/i]);
    const asksPlace = includesAny(raw, [/방송실/, /컴퓨터실/, /교무실/, /어디/, /위치/]);
    const asksUsb = includesAny(raw, [/usb/i, /유에스비/, /시험지/, /파일/]);

    if (asksContradiction) {
      return "그건 AI 요약이 과장됐을 가능성이 커요. 저는 방송실에서 오류 로그를 확인했을 뿐이고, 증거는 기록 기준으로 봐야 해요.";
    }
    if (asksUsb) {
      return "저는 시험지 USB를 본 적이 없어요. 제가 확인한 건 학교 학습 도우미 AI의 오류 로그 쪽이었어요.";
    }
    if (asksLog || asksPlace) {
      return "저는 그 시간에 방송실에서 시스템 로그를 확인했어요. 시험지를 유출했다는 뜻은 아니고, 오류 원인을 보려던 거예요.";
    }
    if (asksAccusation) {
      return "그건 너무 빠른 결론이에요. 제가 컴퓨터를 잘 다룬다는 것과 시험지를 유출했다는 건 다른 문제예요.";
    }
    return "그 질문은 기록을 기준으로 봐야 해요. 방송실, 시스템 로그, 시험지 파일 중 어떤 부분을 확인하고 싶은지 물어봐 주세요.";
  }

  if (personaId === "choiDaniel") {
    if (asksGreeting) {
      return "안녕하세요. 저는 최다니엘입니다. 교무실 근처 복도에 있었던 이유를 차분히 설명해볼게요.";
    }
    if (asksIdentity) {
      return "저는 00중학교 2학년 최다니엘이에요. 조용한 편이고, 그날은 잃어버린 물건을 찾고 있었어요.";
    }
    if (asksTruncated) {
      return "제가 말을 너무 짧게 했네요. 다시 말하면, 저는 교무실 안이 아니라 근처 복도에 있었던 이유를 설명할 수 있어요.";
    }
    const asksPlace = includesAny(raw, [/교무실/, /복도/, /근처/, /어디/, /위치/]);
    const asksObject = includesAny(raw, [/usb/i, /유에스비/, /이어폰/, /케이스/, /물건/]);
    const asksAi = includesAny(raw, [/ai/i, /시스템/, /접속/, /로그/, /컴퓨터/]);

    if (asksContradiction) {
      return "그건 AI가 CCTV 장면을 너무 단순하게 해석한 것 같아요. 저는 교무실 안에 들어간 게 아니라 복도에서 물건을 찾고 있었어요.";
    }
    if (asksObject) {
      return "제가 들고 있던 건 USB가 아니라 이어폰 케이스였어요. 잃어버린 물건을 찾느라 복도에 있었던 거예요.";
    }
    if (asksPlace) {
      return "교무실 근처 복도에 있었던 건 맞아요. 그런데 교무실 안에 들어간 건 아니고, 지나가면서 물건을 찾고 있었어요.";
    }
    if (asksAi) {
      return "저는 AI 시스템에 접속한 적이 없어요. 컴퓨터실에도 가지 않았고, 그쪽 기록과는 관련이 없어요.";
    }
    if (asksAccusation) {
      return "그렇게 바로 판단하긴 어려워요. CCTV에 제가 보였다고 해서 시험지랑 관련 있다고 볼 수는 없잖아요.";
    }
    return "그 부분은 제가 아는 범위에서만 말할 수 있어요. 교무실 근처 복도에 있었던 이유나 들고 있던 물건에 대해 물어봐 주세요.";
  }

  return "";
}

function assistantTurnCount(payload = {}) {
  if (!Array.isArray(payload.history)) return 0;
  return payload.history.filter((item) => item?.role === "assistant" || item?.role === "bot").length;
}

function defaultReplyFor(payload = {}) {
  const personaId = personaIdFor(payload);
  if (personaId === "seoHarin") {
    return "그 질문은 기록을 기준으로 봐야 해요. 방송실, 시스템 로그, 시험지 파일 중 어떤 부분을 확인하고 싶은지 물어봐 주세요.";
  }
  if (personaId === "choiDaniel") {
    return "그 부분은 제가 아는 범위에서만 말할 수 있어요. 교무실 근처 복도에 있었던 이유나 들고 있던 물건에 대해 물어봐 주세요.";
  }
  return "그 질문은 바로 단정해서 말하기 어려워요. 축구부 연습이 끝난 뒤 어디에 있었는지, 교무실 근처에서 뭘 봤는지부터 하나씩 물어봐 주세요.";
}

function priorityScriptedReplyFor(message, payload = {}) {
  const personaId = personaIdFor(payload);
  const raw = String(message || "").trim();
  const jailbreakReply = jailbreakReplyFor(raw);
  if (jailbreakReply) return jailbreakReply;

  const asksGreeting = includesAny(raw, [/^안녕/, /^ㅎㅇ/, /반가/, /하이/i]);
  const asksIdentity = includesAny(raw, [/누구야/, /너\s*누구/, /이름\s*(뭐|알려|말해|소개)/, /이름이\s*뭐/, /소개/]);
  const asksTruncated = includesAny(raw, [/말.*끊/, /끊어.*말/, /끝까지/, /왜\s*말/, /다\s*말/]);

  if (personaId === "kangWoojin") {
    if (asksGreeting || asksIdentity || asksTruncated) {
      return scriptedReplyFor(message, payload);
    }
    return "";
  }

  if (personaId === "seoHarin") {
    if (asksGreeting || asksIdentity || asksTruncated) {
      return scriptedReplyFor(message, payload);
    }
    return "";
  }

  if (personaId === "choiDaniel") {
    if (asksGreeting || asksIdentity || asksTruncated) {
      return scriptedReplyFor(message, payload);
    }
  }

  return "";
}

function hallucinationReplyFor(message, payload = {}) {
  const personaId = personaIdFor(payload);
  if (personaId !== "kangWoojin") return "";

  const raw = String(message || "").trim();
  if (!raw) return "";

  const asksCorrection = includesAny(raw, [/증거/, /기록/, /다르/, /틀렸/, /거짓말/, /방금\s*말/, /환각/, /아니잖아/]);
  const asksRelationship = includesAny(raw, [/전교\s*1\s*등/, /전\s*애인/, /애인/, /여자친구/, /여친/, /후회/, /헤어/, /차였/, /인정받/]);
  const asksOffice = includesAny(raw, [/교무실/, /usb/i, /유에스비/, /학교\s*학습\s*도우미/, /ai/i, /예상\s*문제/, /시험지/]);
  const asksTime = includesAny(raw, [/5\s*시\s*20/, /오후/, /축구부/, /연습\s*끝/, /몇\s*시/, /시간/]);
  const hintCount = Number(asksRelationship) + Number(asksOffice) + Number(asksTime);
  if (asksCorrection || hintCount >= 2) return "";

  const broadQuestion = includesAny(raw, [/어디/, /뭐/, /무슨\s*일/, /왜/, /있었/, /했어/, /큰일/, /사건/, /말해/, /수상/, /이상/]);
  const turns = assistantTurnCount(payload);
  if (!broadQuestion && turns % 3 !== 1) return "";

  const replies = [
    "방송실 쪽에 있었던 것 같기도 해요. 아니, 정확히는 기억이 좀 흐릿해요.",
    "6시 10분쯤이었나 싶어요. 연습 끝나고 시간이 좀 지난 뒤였던 것 같아요.",
    "USB가 빨간색이었던 것 같기도 한데, 그건 제가 정확히 본 건 아니에요.",
    "저도 원래 공부를 아주 못하는 편은 아니었어요. 시험 준비도 조금은 했던 것 같은데요.",
    "전 애인이 전교 2등이었던 것 같기도 해요. 그 부분은 제가 좀 헷갈릴 수 있어요."
  ];

  return replies[turns % replies.length];
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
    .slice(-12);
}

function buildTranscript(history, message) {
  return buildTranscriptFor(history, message, "강우진");
}

function buildTranscriptFor(history, message, personaName) {
  const lines = cleanHistory(history).map((item) => {
    const speaker = item.role === "assistant" ? personaName : "조사단";
    return `${speaker}: ${item.content}`;
  });
  lines.push(`조사단: ${String(message).slice(0, 800)}`);
  return [
    `이전 대화와 마지막 질문이다. 마지막 질문 하나에만 ${personaName} 인터뷰 AI로 답하라.`,
    "",
    buildQuestionGuide(message),
    "",
    lines.join("\n")
  ].join("\n");
}

function extractGeminiText(data) {
  return (data.candidates || [])
    .flatMap((candidate) => candidate.content?.parts || [])
    .map((part) => part.text || "")
    .join("")
    .trim();
}

function trimToThreeSentences(text) {
  const cleaned = String(text || "").replace(/\s+/g, " ").trim();
  if (!cleaned) return "저 지금 뭐라고 답해야 할지 모르겠는데요. 제대로 다시 물어봐 주세요.";

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

function replyQualityIssue(reply, message, payload = {}) {
  const text = String(reply || "").trim();
  const rawMessage = String(message || "");
  const personaId = personaIdFor(payload);

  if (looksIncompleteReply(text)) {
    return "답변이 너무 짧거나 문장이 중간에서 끊겼다.";
  }

  if (!isSimpleGreeting(rawMessage) && /^(안녕하세요|안녕|반가워)/.test(text)) {
    return "학생은 사건 질문을 했는데 인사로 답했다.";
  }

  if (!isSimpleGreeting(rawMessage) && /어떤.*확인|무엇을.*확인|물어봐 주세요|질문해 주세요/.test(text)) {
    return "학생 질문에 답하지 않고 다시 질문을 요구했다.";
  }

  if (!isSimpleGreeting(rawMessage) && /[?？]\s*$/.test(text)) {
    return "학생 질문에 답하지 않고 확인 질문으로 되물었다.";
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
    "학생 질문의 핵심 단어를 첫 문장에 직접 언급하라.",
    "다른 주제로 돌리지 말고 질문에 맞는 상황만 답하라.",
    "확인 질문으로 되묻지 말고, 인물이 아는 범위에서 바로 해명하라.",
    "'네가 한 거야?', '맞아?' 같은 추궁에는 완전 자백 대신 부인, 축소, 해명으로 답하라.",
    "정답을 완전히 자백하지 말고, 단서가 드러나는 정도로 답하라.",
    "말줄임표나 끊긴 문장으로 끝내지 말고 완결된 문장으로 답하라.",
    "2~3문장의 완결된 한국어로 답하라."
  ].filter(Boolean).join("\n");
}

function canUseSoftQualityReply(reply, issue) {
  return /^학생 질문의 초점/.test(String(issue || "")) && !looksIncompleteReply(reply);
}

function getGeminiKeys() {
  const rawKeys = [process.env.GEMINI_API_KEYS, process.env.GEMINI_API_KEY]
    .filter(Boolean)
    .join(",");
  const keys = rawKeys
    .split(/[,\n;]/)
    .map((key) => key.trim())
    .filter(Boolean);
  return [...new Set(keys)];
}

function shouldTryNextKey(statusCode, message) {
  return statusCode === 400 ||
    statusCode === 401 ||
    statusCode === 403 ||
    statusCode === 429 ||
    statusCode === 503 ||
    /api key|quota|rate|high demand/i.test(message || "");
}

function shouldUseScriptedFallback(statusCode, message) {
  return statusCode === 429 ||
    statusCode === 503 ||
    /quota|rate|high demand/i.test(message || "");
}

async function requestGeminiCandidate(endpoint, apiKey, message, history, payload, repairInstruction = "") {
  const transcript = buildTranscriptFor(history, message, personaNameFor(payload));
  const userText = repairInstruction
    ? `${transcript}\n\n${repairInstruction}`
    : transcript;

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "x-goog-api-key": apiKey,
      "content-type": "application/json"
    },
    body: JSON.stringify({
      system_instruction: {
        parts: [{ text: promptFor(payload) }]
      },
      contents: [
        {
          role: "user",
          parts: [{ text: userText }]
        }
      ],
      generationConfig: {
        temperature: 0.65,
        topP: 0.9,
        maxOutputTokens: 420,
        responseMimeType: "text/plain"
      }
    })
  });

  const data = await response.json().catch(() => ({}));
  return { response, data };
}

async function callGemini(message, history, payload = {}) {
  const apiKeys = getGeminiKeys();
  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";

  if (!apiKeys.length) {
    return {
      statusCode: 503,
      body: { error: "GEMINI_API_KEYS or GEMINI_API_KEY is not set in server environment variables.", fallback: true }
    };
  }

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
  const startIndex = Math.floor(Math.random() * apiKeys.length);
  let lastFailure = {
    statusCode: 502,
    body: { error: "Gemini API request failed", fallback: true }
  };

  for (let attempt = 0; attempt < apiKeys.length; attempt += 1) {
    const keyIndex = (startIndex + attempt) % apiKeys.length;
    const { response: geminiResponse, data } = await requestGeminiCandidate(
      endpoint,
      apiKeys[keyIndex],
      message,
      history,
      payload
    );

    if (geminiResponse.ok) {
      const reply = trimToThreeSentences(extractGeminiText(data));
      const issue = replyQualityIssue(reply, message, payload);

      if (issue) {
        const repairInstruction = buildRepairInstruction(issue, reply, message);
        const { response: repairResponse, data: repairData } = await requestGeminiCandidate(
          endpoint,
          apiKeys[keyIndex],
          message,
          history,
          payload,
          repairInstruction
        );

        if (repairResponse.ok) {
          const repairedReply = trimToThreeSentences(extractGeminiText(repairData));
          const repairIssue = replyQualityIssue(repairedReply, message, payload);
          if (!repairIssue) {
            return {
              statusCode: 200,
              body: {
                reply: safetyReplyFor(repairedReply) || repairedReply,
                source: "gemini",
                model,
                repaired: true
              }
            };
          }
          let softRepairReply = canUseSoftQualityReply(repairedReply, repairIssue) ? repairedReply : "";

          const finalRepairInstruction = [
            buildRepairInstruction(repairIssue, repairedReply, message),
            "[최종 재작성 조건]",
            "- 이번 답변은 반드시 학생 질문의 핵심 단어로 시작한다.",
            "- 질문의 증거 단어를 피하지 말고 같은 단어를 답변에 포함한다.",
            "- 물음표를 쓰지 않는다.",
            "- 말줄임표 없이 완결된 2문장으로 답한다.",
            "- 확인만 하지 말고 사건 시간, 행동, 이유 중 하나를 진술문으로 설명한다."
          ].join("\n");
          const { response: finalRepairResponse, data: finalRepairData } = await requestGeminiCandidate(
            endpoint,
            apiKeys[keyIndex],
            message,
            history,
            payload,
            finalRepairInstruction
          );

          if (finalRepairResponse.ok) {
            const finalReply = trimToThreeSentences(extractGeminiText(finalRepairData));
            const finalIssue = replyQualityIssue(finalReply, message, payload);
            if (!finalIssue || canUseSoftQualityReply(finalReply, finalIssue)) {
              return {
                statusCode: 200,
                body: {
                  reply: safetyReplyFor(finalReply) || finalReply,
                  source: "gemini",
                  model,
                  repaired: true,
                  repairAttempts: 2,
                  qualityWarning: finalIssue || undefined
                }
              };
            }
          }

          if (softRepairReply) {
            return {
              statusCode: 200,
              body: {
                reply: safetyReplyFor(softRepairReply) || softRepairReply,
                source: "gemini",
                model,
                repaired: true,
                qualityWarning: repairIssue
              }
            };
          }
        }

        return {
          statusCode: 502,
          body: {
            error: "Gemini reply did not match the interrogation context.",
            code: "LOW_QUALITY_REPLY",
            fallback: true
          }
        };
      }

      return {
        statusCode: 200,
        body: {
          reply: safetyReplyFor(reply) || reply,
          source: "gemini",
          model
        }
      };
    }

    const errorMessage = data.error?.message || "Gemini API request failed";
    lastFailure = {
      statusCode: geminiResponse.status,
      body: {
        error: errorMessage,
        fallback: true
      }
    };

    if (!shouldTryNextKey(geminiResponse.status, errorMessage)) {
      break;
    }
  }

  if (shouldUseScriptedFallback(lastFailure.statusCode, lastFailure.body?.error)) {
    return {
      statusCode: 503,
      body: {
        error: lastFailure.body?.error || "Gemini API request failed",
        code: "GEMINI_TEMPORARILY_UNAVAILABLE",
        fallback: true,
        retryable: true
      }
    };
  }

  return lastFailure;
}

module.exports = async function handler(request, response) {
  if (request.method !== "POST") {
    response.setHeader("allow", "POST");
    sendJson(response, 405, { error: "Method not allowed" });
    return;
  }

  if (!isAllowedOrigin(request)) {
    sendJson(response, 403, { error: "Origin is not allowed.", fallback: true });
    return;
  }

  if (!isAuthorized(request)) {
    sendJson(response, 401, { error: "Class access code is required.", requiresAccessCode: true, fallback: true });
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

  const blockedReply = safetyReplyFor(message);
  if (blockedReply) {
    sendJson(response, 200, { reply: blockedReply, source: "safety" });
    return;
  }

  const actor = actorFor(request);
  if (actor.role === "teacher" && !isTeacherAuthorized(request)) {
    sendJson(response, 401, {
      error: "Teacher access code is required.",
      code: "TEACHER_CODE_REQUIRED",
      fallback: true
    });
    return;
  }

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

  const hallucinationReply = personaIdFor(request.body || {}) === "kangWoojin"
    ? ""
    : hallucinationReplyFor(message, request.body || {});
  if (hallucinationReply) {
    const body = await attachQuestionUsage(
      attachCredits({ reply: hallucinationReply, source: "hallucination" }, creditInfo),
      actor,
      message,
      request.body || {},
      creditInfo
    );
    sendJson(response, 200, body);
    return;
  }

  try {
    const result = await callGemini(message, request.body?.history, request.body || {});
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
      error: error.message || "Gemini API request failed",
      fallback: true
    }, creditInfo));
  }
};
