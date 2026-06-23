const http = require("node:http");
const fs = require("node:fs/promises");
const path = require("node:path");
const { URL } = require("node:url");
const creditsHandler = require("./api/credits");
const { buildKangWoojinPrompt, buildSeoHarinPrompt, buildChoiDanielPrompt } = require("./api/personas");
const presenceHandler = require("./api/presence");

const rootDir = __dirname;
const port = Number(process.env.PORT || 8123);
const provider = "openai";
const openaiApiKey = process.env.OPENAI_API_KEY;
const geminiApiKey = process.env.GEMINI_API_KEY;
const geminiImageApiKey = process.env.GEMINI_IMAGE_API_KEY;
const openaiModel = process.env.OPENAI_MODEL || process.env.AI_MODEL || "gpt-5.5";
const geminiModel = process.env.GEMINI_MODEL || process.env.AI_MODEL || "gemini-2.5-flash";
const freeImageProvider = String(process.env.FREE_IMAGE_PROVIDER || "pollinations").trim().toLowerCase();
const freeImageFallbackSetting = String(process.env.FREE_IMAGE_FALLBACK || "1").trim().toLowerCase();
const freeImageFallbackEnabled = !["0", "false", "off", "none"].includes(freeImageFallbackSetting);
const geminiImageGenerationSetting = String(process.env.GEMINI_IMAGE_GENERATION || process.env.GOOGLE_IMAGE_GENERATION || "0").trim().toLowerCase();
const geminiImageGenerationEnabled = ["1", "true", "on", "yes"].includes(geminiImageGenerationSetting);
const freeImageTimeoutMs = Number(process.env.FREE_IMAGE_TIMEOUT_MS || 70000);
const translationTimeoutMs = Number(process.env.IMAGE_TRANSLATION_TIMEOUT_MS || 12000);
const imagePromptTranslationSetting = String(process.env.IMAGE_PROMPT_TRANSLATION || process.env.GEMINI_IMAGE_PROMPT_TRANSLATION || "1").trim().toLowerCase();
const imagePromptTranslationEnabled = ["1", "true", "on", "yes"].includes(imagePromptTranslationSetting);
const translationCache = new Map();
function normalizeGeminiImageModel(model) {
  if (!model) return "gemini-3.1-flash-image";
  return String(model).trim().replace(/^models\//, "");
}

const geminiImageModel = normalizeGeminiImageModel(process.env.GEMINI_IMAGE_MODEL);
function uniqueKeysFrom(...values) {
  return [...new Set(values
    .filter(Boolean)
    .join(",")
    .split(/[,\n;]/)
    .map((key) => key.trim())
    .filter(Boolean))];
}

const geminiApiKeys = uniqueKeysFrom(process.env.GEMINI_API_KEYS, geminiApiKey);
const geminiImageApiKeys = uniqueKeysFrom(process.env.GEMINI_IMAGE_API_KEYS, geminiImageApiKey);
const activeGeminiImageApiKeys = uniqueKeysFrom(
  process.env.GEMINI_IMAGE_API_KEYS,
  geminiImageApiKey,
  process.env.GEMINI_API_KEYS,
  geminiApiKey
);
let activeProvider = provider;
let runtimeGeminiApiKey = geminiApiKeys[0] || "";

function getGeminiTextKeys() {
  return uniqueKeysFrom(
    process.env.GEMINI_API_KEYS,
    geminiApiKey,
    process.env.GEMINI_IMAGE_API_KEYS,
    geminiImageApiKey,
    activeGeminiImageApiKeys.join(","),
    runtimeGeminiApiKey
  );
}

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml; charset=utf-8"
};

const safetyReplies = {
  sexualOrProfane: "그런 장난 섞인 말에는 대답 안 합니다. 사건이랑 상관없는 불쾌한 얘기는 하지 마세요.",
  aggressive: "말이 좀 심하시네요. 그런 식의 무례한 질문에는 답변하지 않겠습니다.",
  technicalCrime: "그런 방법 같은 건 몰라요. 실제로 따라 할 수 있는 얘기는 하지 않겠습니다."
};

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
  response.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store"
  });
  response.end(JSON.stringify(body));
}

function normalize(text) {
  return String(text || "").toLowerCase().replace(/\s+/g, "");
}

function includesAny(text, patterns) {
  return patterns.some((pattern) => pattern.test(text));
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
    /꺼지라고|입\s*닫아|협박/i
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
  return `이전 대화와 마지막 질문이다. 마지막 질문 하나에만 ${personaName} 인터뷰 AI로 답하라.\n\n${lines.join("\n")}`;
}

function extractOpenAiText(data) {
  if (typeof data.output_text === "string") return data.output_text;
  if (!Array.isArray(data.output)) return "";

  return data.output
    .flatMap((item) => item.content || [])
    .map((content) => content.text || content.output_text || "")
    .join("")
    .trim();
}

function trimToThreeSentences(text) {
  const cleaned = String(text || "").replace(/\s+/g, " ").trim();
  if (!cleaned) return "저 지금 뭐라고 답해야 할지 모르겠는데요. 제대로 다시 물어봐 주세요.";

  const sentences = cleaned.match(/[^.!?。！？\n]+[.!?。！？]?/g) || [cleaned];
  return sentences.slice(0, 3).join(" ").slice(0, 420).trim();
}

async function readBody(request) {
  let body = "";
  for await (const chunk of request) {
    body += chunk;
    if (body.length > 16_384) {
      throw new Error("Request body too large");
    }
  }
  return body;
}

async function callOpenAi(payload, message) {
  if (!openaiApiKey) {
    return {
      statusCode: 503,
      body: { error: "OPENAI_API_KEY is not set", fallback: true }
    };
  }

  const openaiResponse = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "authorization": `Bearer ${openaiApiKey}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({
      model: openaiModel,
      instructions: promptFor(payload),
      input: buildTranscriptFor(payload.history, message, personaNameFor(payload))
    })
  });

  const data = await openaiResponse.json();
  if (!openaiResponse.ok) {
    return {
      statusCode: openaiResponse.status,
      body: {
        error: data.error?.message || "OpenAI API request failed",
        fallback: true
      }
    };
  }

  const reply = trimToThreeSentences(extractOpenAiText(data));
  return {
    statusCode: 200,
    body: { reply: safetyReplyFor(reply) || reply, source: "openai", model: openaiModel }
  };
}

async function handleApiKey(request, response) {
  if (process.env.ALLOW_RUNTIME_API_KEY !== "1") {
    sendJson(response, 404, { error: "Not found" });
    return;
  }

  let payload;
  try {
    payload = JSON.parse(await readBody(request));
  } catch {
    sendJson(response, 400, { error: "Invalid JSON body" });
    return;
  }

  const apiKey = String(payload.apiKey || "").trim();
  if (!apiKey) {
    sendJson(response, 400, { error: "Gemini API key is required" });
    return;
  }

  runtimeGeminiApiKey = apiKey;
  sendJson(response, 200, {
    ok: true,
    provider: activeProvider,
    model: openaiModel,
    hasGeminiKey: true
  });
}

async function handleStatus(response) {
  const imageApiKeys = uniqueKeysFrom(activeGeminiImageApiKeys.join(","), runtimeGeminiApiKey);
  const discoveredImageModels = [];
  const seen = new Set();

  if (geminiImageGenerationEnabled) {
    for (const key of imageApiKeys) {
      const models = [
        ...await listAvailableGeminiImageModels(key),
        ...await listAvailableImagenModels(key)
      ];
      for (const model of models) {
        const id = `${model.model}:${model.apiVersion}`;
        if (seen.has(id)) continue;
        seen.add(id);
        discoveredImageModels.push(model);
      }
    }
  }

  sendJson(response, 200, {
    provider: activeProvider,
    model: openaiModel,
    imageModel: geminiImageModel,
    hasGeminiKey: Boolean(runtimeGeminiApiKey),
    hasGeminiImageKey: activeGeminiImageApiKeys.length > 0 || Boolean(runtimeGeminiApiKey),
    hasAvailableImageModel: geminiImageGenerationEnabled && discoveredImageModels.length > 0,
    availableImageModels: discoveredImageModels.slice(0, 8),
    geminiImageGenerationEnabled,
    allowsRuntimeApiKey: process.env.ALLOW_RUNTIME_API_KEY === "1",
    freeImageFallback: freeImageFallbackEnabled,
    freeImageProvider,
    translatesImagePrompts: imagePromptTranslationEnabled && getGeminiTextKeys().length > 0,
    imagePromptTranslationEnabled,
    translationModel: translationModelName(),
    usesSeparateImageKey: geminiImageApiKeys.length > 0,
    hasOpenAiKey: Boolean(openaiApiKey)
  });
}

async function handleChat(request, response) {
  let payload;
  try {
    payload = JSON.parse(await readBody(request));
  } catch {
    sendJson(response, 400, { error: "Invalid JSON body" });
    return;
  }

  const message = String(payload.message || "").trim();
  if (!message) {
    sendJson(response, 400, { error: "Message is required" });
    return;
  }

  const blockedReply = safetyReplyFor(message);
  if (blockedReply) {
    sendJson(response, 200, { reply: blockedReply, source: "safety" });
    return;
  }

  try {
    const result = await callOpenAi(payload, message);
    sendJson(response, result.statusCode, result.body);
  } catch (error) {
    sendJson(response, 502, {
      error: error.message || `${activeProvider} API request failed`,
      fallback: true
    });
  }
}

function apiVersionsForImageModel(model) {
  if (/preview|experimental/i.test(model)) return ["v1beta"];
  return ["v1", "v1beta"];
}

function shouldTryNextImageModel(statusCode, message) {
  return statusCode === 400 ||
    statusCode === 401 ||
    statusCode === 403 ||
    statusCode === 404 ||
    statusCode === 429 ||
    statusCode === 503 ||
    /api key|quota|rate|model|not found|high demand/i.test(message || "");
}

function geminiImageModelCandidates() {
  return [
    geminiImageModel,
    "gemini-3.1-flash-image",
    "gemini-2.5-flash-image",
    "gemini-2.5-flash-image-preview",
    "gemini-3-pro-image",
    "gemini-3-pro-image-preview"
  ]
    .filter(Boolean)
    .filter((model, index, models) => models.indexOf(model) === index);
}

function imagenModelCandidates() {
  const configuredGeminiImageModel = normalizeGeminiModelName(geminiImageModel);
  return [
    normalizeGeminiModelName(process.env.IMAGEN_MODEL),
    normalizeGeminiModelName(process.env.GEMINI_IMAGEN_MODEL),
    configuredGeminiImageModel.startsWith("imagen-") ? configuredGeminiImageModel : "",
    "imagen-4.0-generate-001",
    "imagen-4.0-fast-generate-001",
    "imagen-3.0-generate-002"
  ]
    .filter(Boolean)
    .filter((model, index, models) => models.indexOf(model) === index);
}

function normalizeGeminiModelName(model) {
  return String(model || "").trim().replace(/^models\//, "");
}

function isGeminiImageGenerationModel(model) {
  const name = normalizeGeminiModelName(model.name);
  const methods = model.supportedGenerationMethods || model.supported_generation_methods || [];
  return methods.includes("generateContent") && /(^|[-_])(image|imagen)([-_]|$)/i.test(name);
}

async function listAvailableGeminiImageModels(key) {
  const seen = new Set();
  const available = [];

  for (const apiVersion of ["v1", "v1beta"]) {
    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/${apiVersion}/models`, {
        headers: { "x-goog-api-key": key }
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !Array.isArray(data.models)) continue;

      for (const model of data.models) {
        if (!isGeminiImageGenerationModel(model)) continue;
        const name = normalizeGeminiModelName(model.name);
        const id = `${name}:${apiVersion}`;
        if (seen.has(id)) continue;
        seen.add(id);
        available.push({ model: name, apiVersion });
      }
    } catch {
      // Model discovery is best-effort. Static candidates still run.
    }
  }

  return available;
}

async function listAvailableImagenModels(key) {
  const seen = new Set();
  const available = [];

  for (const apiVersion of ["v1beta"]) {
    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/${apiVersion}/models`, {
        headers: { "x-goog-api-key": key }
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !Array.isArray(data.models)) continue;

      for (const model of data.models) {
        const name = normalizeGeminiModelName(model.name);
        const methods = model.supportedGenerationMethods || model.supported_generation_methods || [];
        if (!methods.includes("predict") || !/^imagen-/i.test(name)) continue;
        const id = `${name}:${apiVersion}`;
        if (seen.has(id)) continue;
        seen.add(id);
        available.push({ model: name, apiVersion });
      }
    } catch {
      // Imagen discovery is best-effort. Static candidates still run.
    }
  }

  return available;
}

async function geminiImageRequestCandidates(key) {
  const staticCandidates = geminiImageModelCandidates()
    .flatMap((model) => apiVersionsForImageModel(model).map((apiVersion) => ({ model, apiVersion })));
  const discoveredCandidates = await listAvailableGeminiImageModels(key);
  const preferredOrder = geminiImageModelCandidates();

  return [...staticCandidates, ...discoveredCandidates]
    .sort((a, b) => {
      const aIndex = preferredOrder.indexOf(a.model);
      const bIndex = preferredOrder.indexOf(b.model);
      return (aIndex === -1 ? 999 : aIndex) - (bIndex === -1 ? 999 : bIndex);
    })
    .filter((candidate, index, candidates) =>
      candidates.findIndex((item) => item.model === candidate.model && item.apiVersion === candidate.apiVersion) === index
    );
}

async function imagenRequestCandidates(key) {
  const staticCandidates = imagenModelCandidates().map((model) => ({ model, apiVersion: "v1beta" }));
  const discoveredCandidates = await listAvailableImagenModels(key);
  const preferredOrder = imagenModelCandidates();

  return [...staticCandidates, ...discoveredCandidates]
    .sort((a, b) => {
      const aIndex = preferredOrder.indexOf(a.model);
      const bIndex = preferredOrder.indexOf(b.model);
      return (aIndex === -1 ? 999 : aIndex) - (bIndex === -1 ? 999 : bIndex);
    })
    .filter((candidate, index, candidates) =>
      candidates.findIndex((item) => item.model === candidate.model && item.apiVersion === candidate.apiVersion) === index
    );
}

function normalizeImageText(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[.,!?'"`~\-_/\\()[\]{}:;|]/g, "");
}

function forbiddenImageWordFor(prompt, card) {
  if (!card || !Array.isArray(card.forbidden)) return "";
  const compact = normalizeImageText(prompt);
  return card.forbidden.find((word) => compact.includes(normalizeImageText(word))) || "";
}

function buildImagePrompt(prompt, room) {
  return [
    "Create one classroom-safe image for a Korean middle school guessing game.",
    "Follow only the scene described by the student's prompt.",
    "Do not add captions, labels, watermarks, logos, UI, or readable text.",
    "Use a clear, colorful, realistic classroom-projection friendly style.",
    room ? `Game room: ${room}.` : "",
    `Student prompt: ${prompt}`
  ].filter(Boolean).join("\n");
}

function buildImagenPrompt(prompt, room) {
  return [
    "Create one classroom-safe image for a Korean middle school guessing game.",
    "Use a clear, colorful, realistic classroom-projection friendly style.",
    "Do not include captions, labels, logos, UI, or readable text.",
    room ? `Game room: ${room}.` : "",
    `Scene description: ${prompt}`
  ].filter(Boolean).join(" ");
}

function translationModelName() {
  return String(process.env.GEMINI_TRANSLATION_MODEL || geminiModel || "gemini-2.5-flash")
    .trim()
    .replace(/^models\//, "");
}

function cleanTranslatedPrompt(text) {
  return String(text || "")
    .replace(/```[\s\S]*?```/g, (block) => block.replace(/```[a-z]*|```/gi, ""))
    .replace(/^(english|translation|prompt)\s*:\s*/i, "")
    .replace(/^["'“”‘’]+|["'“”‘’]+$/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 700);
}

function cacheTranslation(key, value) {
  if (translationCache.size > 120) {
    const firstKey = translationCache.keys().next().value;
    translationCache.delete(firstKey);
  }
  translationCache.set(key, value);
}

function extractGeminiText(data) {
  return (data.candidates || [])
    .flatMap((candidate) => candidate.content?.parts || [])
    .map((part) => part.text || "")
    .filter(Boolean)
    .join("\n")
    .trim();
}

async function translatePromptToEnglish(prompt, room) {
  if (!imagePromptTranslationEnabled) return "";

  const source = String(prompt || "").trim();
  if (!source) return "";

  const cacheKey = `${room || ""}\n${source}`;
  if (translationCache.has(cacheKey)) return translationCache.get(cacheKey);

  const key = getGeminiTextKeys()[0];
  if (!key) return "";

  try {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(translationModelName())}:generateContent`;
    const response = await fetchWithTimeout(endpoint, {
      method: "POST",
      headers: {
        "x-goog-api-key": key,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: [
              "Translate this Korean image-generation prompt into a concise English visual prompt.",
              "Return only the English prompt. Do not add explanations, quotes, labels, markdown, or extra objects.",
              "Preserve the original visual meaning and all concrete details.",
              "If the prompt is already English, lightly polish it for image generation.",
              room ? `Room context for safety only: ${room}` : "",
              `Prompt: ${source}`
            ].filter(Boolean).join("\n")
          }]
        }],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 180
        }
      })
    }, translationTimeoutMs);
    const data = await response.json().catch(() => ({}));
    if (!response.ok) return "";

    const translated = cleanTranslatedPrompt(extractGeminiText(data));
    if (!/[a-zA-Z]/.test(translated)) return "";
    cacheTranslation(cacheKey, translated);
    return translated;
  } catch {
    return "";
  }
}

const koreanImageKeywordMap = [
  [/골대|그물이\s*달린\s*문/g, "soccer goal net"],
  [/빨간색|빨간|붉은|빨강/g, "red"],
  [/파란색|파란|푸른|파랑/g, "blue"],
  [/초록색|초록|녹색/g, "green"],
  [/노란색|노란|노랑/g, "yellow"],
  [/검은색|검은|검정/g, "black"],
  [/흰색|하얀|하얀색|흰/g, "white"],
  [/사과/g, "apple"],
  [/바나나/g, "banana"],
  [/공/g, "ball"],
  [/축구공/g, "soccer ball"],
  [/운동장|경기장/g, "sports field"],
  [/문/g, "door"],
  [/사람|인물/g, "person"],
  [/학생/g, "student"],
  [/유니폼/g, "uniform"],
  [/방송실/g, "broadcast studio"],
  [/카메라/g, "camera"],
  [/마이크/g, "microphone"],
  [/교실/g, "classroom"],
  [/칠판/g, "blackboard"],
  [/책상/g, "desk"],
  [/책/g, "book"],
  [/컴퓨터/g, "computer"],
  [/USB|유에스비/g, "USB drive"],
  [/시험지/g, "exam paper"],
  [/고양이/g, "cat"],
  [/강아지|개/g, "dog"]
];

function scenePromptFromKorean(prompt) {
  const text = String(prompt || "");
  const rules = [
    {
      keys: ["주가", "올라"],
      prompt: "minimalist vector-style image of one single smartphone investment account app screen filling the frame, the screen shows a red upward stock price line chart and rising numbers, pure white background, absolutely no other objects"
    },
    {
      keys: ["계좌", "올라"],
      prompt: "minimalist vector-style image of one single smartphone investment account app screen filling the frame, the screen shows a red upward stock price line chart and rising numbers, pure white background, absolutely no other objects"
    },
    {
      keys: ["방탄", "공연"],
      prompt: "a K-pop boy band performing on a large concert stage in Busan, bright stage lights, cheering crowd, energetic live performance, no classroom, no empty room, no desks"
    },
    {
      keys: ["BTS", "공연"],
      prompt: "a K-pop boy band performing on a large concert stage in Busan, bright stage lights, cheering crowd, energetic live performance, no classroom, no empty room, no desks"
    },
    {
      keys: ["부산", "공연"],
      prompt: "a live concert stage in Busan with performers under bright stage lights and a cheering crowd, coastal city atmosphere, no classroom, no empty room, no desks"
    },
    {
      keys: ["도복", "발차기"],
      prompt: "a full-body taekwondo martial artist wearing a white dobok uniform on a visible padded training mat, one leg raised high above the waist with the foot extended in a powerful front kick, dynamic action pose, not standing still"
    },
    {
      keys: ["잔디", "경기장", "공"],
      prompt: "a wide outdoor grass soccer field with soccer players in uniforms kicking a round ball, soccer goal nets at both ends"
    },
    {
      keys: ["파란 물", "수영모"],
      prompt: "a swimmer wearing a swim cap in a blue swimming pool lane, moving forward with strong arm strokes, clear water splashes"
    },
    {
      keys: ["배낭", "산길"],
      prompt: "hikers wearing backpacks walking up a mountain trail, distant mountain peak, trees around the path"
    },
    {
      keys: ["다이아몬드", "방망이"],
      prompt: "a diamond-shaped baseball field with a batter holding a bat and other players wearing gloves"
    },
    {
      keys: ["빨간 국물", "꼬불꼬불"],
      prompt: "a bowl of red spicy soup with curly noodles, chopsticks lifting the noodles"
    },
    {
      keys: ["토마토소스", "치즈"],
      prompt: "a round flat bread topped with tomato sauce, stretchy melted cheese, and colorful toppings"
    },
    {
      keys: ["밥", "회"],
      prompt: "small rice pieces topped with thin slices of raw fish, neatly arranged on a wooden board"
    },
    {
      keys: ["콘", "디저트"],
      prompt: "a cold white creamy dessert scoop sitting on a crispy cone"
    },
    {
      keys: ["불판", "고기"],
      prompt: "thick pieces of striped pork belly sizzling on a hot grill plate"
    },
    {
      keys: ["검정", "흰색", "새"],
      prompt: "a plump black-and-white bird standing on snow"
    },
    {
      keys: ["다리", "여덟", "먹물"],
      prompt: "an underwater octopus with eight arms swimming and releasing dark ink"
    },
    {
      keys: ["긴 목", "점박이"],
      prompt: "a tall giraffe with a long neck and spotted pattern eating leaves from a tree"
    },
    {
      keys: ["뾰족한", "가시"],
      prompt: "a small round hedgehog curled on grass with sharp spines raised"
    },
    {
      keys: ["도마뱀", "나뭇가지"],
      prompt: "a color-changing chameleon on a tree branch, stretching out a long tongue"
    },
    {
      keys: ["책장", "책"],
      prompt: "a quiet library interior filled with bookshelves, a person sitting at a desk reading a book"
    },
    {
      keys: ["롤러코스터"],
      prompt: "an amusement park with a roller coaster, ferris wheel, and people waiting in line"
    },
    {
      keys: ["흰 가운", "침대"],
      prompt: "a clean hospital room with a doctor wearing a white coat, a bed, and a stethoscope"
    },
    {
      keys: ["텐트", "모닥불"],
      prompt: "a campsite in a forest at night with a tent, a campfire, and people resting under a starry sky"
    },
    {
      keys: ["열차", "손잡이"],
      prompt: "inside a subway train, people standing while holding hand straps, station platform visible through the windows"
    }
  ];

  const match = rules.find((rule) => rule.keys.every((key) => text.includes(key)));
  return match?.prompt || "";
}

function isLikelySoccerScene(prompt) {
  return /(잔디|운동장|경기장|유니폼|그물|골대)/.test(prompt) && /(공|발|차고|찬다|축구)/.test(prompt);
}

function englishImageHint(prompt) {
  const hints = [];
  const soccerScene = isLikelySoccerScene(prompt);
  if (soccerScene) {
    hints.push("outdoor grass soccer field");
    hints.push("soccer players in uniforms kicking a round ball");
    hints.push("soccer goal nets at both ends");
  }
  for (const [pattern, phrase] of koreanImageKeywordMap) {
    pattern.lastIndex = 0;
    if (soccerScene && phrase === "door") continue;
    if (pattern.test(prompt) && !hints.includes(phrase)) hints.push(phrase);
  }
  if (/흰\s*배경|하얀\s*배경|흰색\s*배경/.test(prompt)) hints.push("plain white background");
  if (/크게|큰|확대/.test(prompt)) hints.push("large centered main subject");
  if (/하나|한\s*개|1\s*개/.test(prompt)) hints.push("single object");
  return hints.join(", ");
}

function buildFreeImagePrompt(prompt, room, translatedPrompt = "") {
  const scenePrompt = scenePromptFromKorean(prompt);
  const rewrittenPrompt = [translatedPrompt, scenePrompt].filter(Boolean).join(". ");
  const hint = englishImageHint(prompt);
  const soccerScene = isLikelySoccerScene(prompt);
  return [
    rewrittenPrompt ? `English scene description: ${rewrittenPrompt}` : "",
    hint ? `English visual keywords: ${hint}.` : "",
    rewrittenPrompt ? "" : `Original scene description: ${prompt}`,
    "Only draw what the prompt asks for. Do not add any extra objects, furniture, people, room, or background props.",
    "Draw only the described scene. Include every mentioned object, clothing item, place, and action.",
    "The main subject and action must be clearly visible in the center of the image.",
    soccerScene ? "This is an outdoor soccer scene; do not draw an indoor hallway or an ordinary door." : "",
    "If it describes a single object, make that object large, centered, and unmistakable.",
    "If the prompt does not explicitly describe a location, use a plain simple background.",
    "Do not invent extra people, desks, walls, boards, posters, classroom props, or room interiors.",
    "Use a high-quality, sharp, clear, colorful, realistic illustration style with a clean composition.",
    "Never add a classroom, art room, studio, school room, office, or unrelated indoor background unless the scene explicitly asks for it.",
    "No readable text, no captions, no logos, no watermarks.",
  ].filter(Boolean).join(" ");
}

function seedForImageText(text) {
  let hash = 2166136261;
  for (const char of String(text || "")) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash) % 2147483647;
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 70000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function callFreeImageFallback(prompt, room, googleError, translatedPrompt = "") {
  if (!freeImageFallbackEnabled || freeImageProvider !== "pollinations") return null;

  const finalTranslatedPrompt = translatedPrompt || await translatePromptToEnglish(prompt, room);
  const imagePrompt = buildFreeImagePrompt(prompt, room, finalTranslatedPrompt);
  const query = new URLSearchParams({
    width: "1024",
    height: "1024",
    seed: String(seedForImageText(imagePrompt)),
    nologo: "true",
    safe: "true",
    enhance: "true",
    negative: "classroom, school room, art room, office, desk, table, keyboard, monitor, blackboard, posters, books, cup, pencils, calculator, extra props, unrelated background, empty room",
    model: process.env.POLLINATIONS_IMAGE_MODEL || "flux"
  });
  const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(imagePrompt)}?${query.toString()}`;

  try {
    const response = await fetchWithTimeout(url, {
      headers: { accept: "image/png,image/jpeg,image/webp,image/*" }
    }, freeImageTimeoutMs);
    const contentType = response.headers.get("content-type") || "";

    if (!response.ok) {
      const message = await response.text().catch(() => "");
      return {
        statusCode: response.status,
        body: {
          error: `Free image fallback failed: ${message || response.statusText || response.status}`,
          fallback: true,
          provider: "pollinations",
          googleError
        }
      };
    }

    if (!contentType.startsWith("image/")) {
      const message = await response.text().catch(() => "");
      return {
        statusCode: 502,
        body: {
          error: `Free image fallback did not return an image: ${message.slice(0, 240)}`,
          fallback: true,
          provider: "pollinations",
          googleError
        }
      };
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    return {
      statusCode: 200,
      body: {
        imageDataUrl: `data:${contentType};base64,${buffer.toString("base64")}`,
        mimeType: contentType,
        model: process.env.POLLINATIONS_IMAGE_MODEL || "flux",
        apiVersion: "free-http",
        requestFormat: "pollinations-prompt",
        provider: "pollinations",
        freeFallback: true,
        translatedPrompt: finalTranslatedPrompt || undefined,
        translationProvider: finalTranslatedPrompt ? "gemini" : undefined,
        googleError
      }
    };
  } catch (error) {
    return {
      statusCode: 502,
      body: {
        error: `Free image fallback failed: ${error.message || "request failed"}`,
        fallback: true,
        provider: "pollinations",
        googleError
      }
    };
  }
}

function geminiImageRequestBodies(prompt, room) {
  const contents = [{
    parts: [{ text: buildImagePrompt(prompt, room) }]
  }];

  return [
    {
      label: "default",
      body: { contents }
    },
    {
      label: "text-image",
      body: {
        contents,
        generationConfig: { responseModalities: ["TEXT", "IMAGE"] }
      }
    },
    {
      label: "image",
      body: {
        contents,
        generationConfig: { responseModalities: ["Image"] }
      }
    }
  ];
}

function extractGeminiImage(data) {
  const parts = (data.candidates || [])
    .flatMap((candidate) => candidate.content?.parts || []);
  const imagePart = parts.find((part) => {
    const inlineData = part.inlineData || part.inline_data;
    return inlineData?.data;
  });
  const inlineData = imagePart?.inlineData || imagePart?.inline_data;
  const text = parts.map((part) => part.text || "").filter(Boolean).join("\n").trim();

  if (!inlineData?.data) return { text };
  return {
    text,
    mimeType: inlineData.mimeType || inlineData.mime_type || "image/png",
    data: inlineData.data
  };
}

function extractImagenImage(data) {
  const prediction = (data.predictions || []).find((item) =>
    item?.bytesBase64Encoded || item?.bytes_base64_encoded || item?.image?.bytesBase64Encoded || item?.image?.imageBytes
  );
  if (!prediction) return {};

  const dataValue = prediction.bytesBase64Encoded ||
    prediction.bytes_base64_encoded ||
    prediction.image?.bytesBase64Encoded ||
    prediction.image?.imageBytes;
  return {
    mimeType: prediction.mimeType || prediction.mime_type || prediction.image?.mimeType || "image/png",
    data: dataValue
  };
}

async function callGeminiImage(payload) {
  const prompt = String(payload.prompt || "").trim();
  const room = String(payload.room || "").trim().slice(0, 80);
  const translatedPrompt = await translatePromptToEnglish(prompt, room);

  if (!geminiImageGenerationEnabled) {
    const freeResult = await callFreeImageFallback(prompt, room, "Gemini image generation is disabled; using Pollinations directly.", translatedPrompt);
    if (freeResult) return freeResult;
    return {
      statusCode: 503,
      body: { error: "Free image fallback is disabled, and Gemini image generation is disabled.", fallback: true }
    };
  }

  const imageApiKeys = uniqueKeysFrom(activeGeminiImageApiKeys.join(","), runtimeGeminiApiKey);
  const imagePrompt = translatedPrompt || prompt;
  if (!imageApiKeys.length) {
    const freeResult = await callFreeImageFallback(prompt, room, "GEMINI_IMAGE_API_KEY or GEMINI_API_KEY is not set.", translatedPrompt);
    if (freeResult) return freeResult;
    return {
      statusCode: 503,
      body: { error: "GEMINI_IMAGE_API_KEY or GEMINI_API_KEY is not set", fallback: true }
    };
  }

  let lastFailure = {
    statusCode: 502,
    body: { error: "Gemini image request failed", fallback: true }
  };
  const attempted = [];

  for (const imageApiKey of imageApiKeys) {
    const imagenCandidates = await imagenRequestCandidates(imageApiKey);
    for (const { model, apiVersion } of imagenCandidates) {
      const endpoint = `https://generativelanguage.googleapis.com/${apiVersion}/models/${encodeURIComponent(model)}:predict`;
      const imagenResponse = await fetch(endpoint, {
        method: "POST",
        headers: {
          "x-goog-api-key": imageApiKey,
          "content-type": "application/json"
        },
        body: JSON.stringify({
          instances: [{ prompt: buildImagenPrompt(imagePrompt, room) }],
          parameters: {
            sampleCount: 1,
            aspectRatio: "1:1"
          }
        })
      });
      const data = await imagenResponse.json().catch(() => ({}));
      if (imagenResponse.ok) {
        const image = extractImagenImage(data);
        if (image.data) {
          return {
            statusCode: 200,
            body: {
              imageDataUrl: `data:${image.mimeType};base64,${image.data}`,
              mimeType: image.mimeType,
              model,
              apiVersion,
              requestFormat: "imagen-predict"
            }
          };
        }
      }

      const errorMessage = data.error?.message || "Imagen image request failed.";
      attempted.push(`${model} (${apiVersion}, imagen-predict): ${imagenResponse.status}`);
      lastFailure = {
        statusCode: imagenResponse.status,
        body: {
          error: errorMessage,
          fallback: true,
          model,
          apiVersion,
          requestFormat: "imagen-predict"
        }
      };
      if (!shouldTryNextImageModel(imagenResponse.status, errorMessage)) {
        return lastFailure;
      }
    }

    const candidates = await geminiImageRequestCandidates(imageApiKey);
    for (const { model, apiVersion } of candidates) {
      for (const requestBody of geminiImageRequestBodies(imagePrompt, room)) {
      const endpoint = `https://generativelanguage.googleapis.com/${apiVersion}/models/${encodeURIComponent(model)}:generateContent`;
      const geminiResponse = await fetch(endpoint, {
        method: "POST",
        headers: {
          "x-goog-api-key": imageApiKey,
          "content-type": "application/json"
        },
        body: JSON.stringify(requestBody.body)
      });

      const data = await geminiResponse.json().catch(() => ({}));
      if (!geminiResponse.ok) {
        const errorMessage = data.error?.message || data.promptFeedback?.blockReason || "Gemini image request failed";
        attempted.push(`${model} (${apiVersion}, ${requestBody.label}): ${geminiResponse.status}`);
        lastFailure = {
          statusCode: geminiResponse.status,
          body: {
            error: errorMessage,
            fallback: true,
            model,
            apiVersion,
            requestFormat: requestBody.label
          }
        };
        if (!shouldTryNextImageModel(geminiResponse.status, errorMessage)) {
          return lastFailure;
        }
        continue;
      }

      const image = extractGeminiImage(data);
      if (!image.data) {
        return {
          statusCode: 502,
          body: {
            error: image.text || data.promptFeedback?.blockReason || "Gemini did not return an image.",
            fallback: true,
            model,
            apiVersion,
            requestFormat: requestBody.label
          }
        };
      }

      return {
        statusCode: 200,
        body: {
          imageDataUrl: `data:${image.mimeType};base64,${image.data}`,
          mimeType: image.mimeType,
          text: image.text,
          model,
          apiVersion,
          requestFormat: requestBody.label
        }
      };
      }
    }
  }

  const freeResult = await callFreeImageFallback(prompt, room, lastFailure.body.error || "Google image request failed.", translatedPrompt);
  if (freeResult?.statusCode === 200) {
    freeResult.body.attemptedModels = attempted.slice(-12);
    return freeResult;
  }
  if (freeResult && lastFailure.statusCode >= 500) {
    return {
      statusCode: freeResult.statusCode,
      body: {
        ...freeResult.body,
        attemptedModels: attempted.slice(-12)
      }
    };
  }

  return {
    statusCode: lastFailure.statusCode,
    body: {
      ...lastFailure.body,
      error: `이미지 생성 모델 호출이 모두 실패했습니다. 마지막 시도: ${lastFailure.body.model || "unknown"} / ${lastFailure.body.apiVersion || "unknown"} / ${lastFailure.body.requestFormat || "unknown"}. 마지막 오류: ${lastFailure.body.error || "Gemini image request failed."}`,
      attemptedModels: attempted.slice(-12)
    }
  };
}

async function handleGenerateImage(request, response) {
  let payload;
  try {
    payload = JSON.parse(await readBody(request));
  } catch {
    sendJson(response, 400, { error: "Invalid JSON body" });
    return;
  }

  const prompt = String(payload.prompt || "").trim();
  if (!prompt) {
    sendJson(response, 400, { error: "Prompt is required" });
    return;
  }
  if (prompt.length > 900) {
    sendJson(response, 413, { error: "Prompt is too long.", fallback: true });
    return;
  }

  const forbidden = forbiddenImageWordFor(prompt, payload.card);
  if (forbidden) {
    sendJson(response, 400, {
      error: `Forbidden word included: ${forbidden}`,
      code: "FORBIDDEN_WORD",
      fallback: true
    });
    return;
  }

  try {
    const result = await callGeminiImage(payload);
    sendJson(response, result.statusCode, result.body);
  } catch (error) {
    sendJson(response, 502, {
      error: error.message || "Gemini image request failed",
      fallback: true
    });
  }
}

async function handleApiModule(request, response, handler) {
  if (request.method !== "GET" && request.method !== "HEAD") {
    request.body = await readBody(request);
  }
  await handler(request, response);
}

async function handleStatic(request, response, url) {
  const pathname = decodeURIComponent(url.pathname === "/" ? "/teacherroom.html" : url.pathname);
  const safePath = path.normalize(path.join(rootDir, pathname));

  const relativePath = path.relative(rootDir, safePath);
  if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
    response.writeHead(403);
    response.end("Forbidden");
    return;
  }

  try {
    const stat = await fs.stat(safePath);
    const filePath = stat.isDirectory() ? path.join(safePath, "index.html") : safePath;
    const extension = path.extname(filePath).toLowerCase();
    const contentType = mimeTypes[extension] || "application/octet-stream";
    const content = await fs.readFile(filePath);

    response.writeHead(200, {
      "content-type": contentType,
      "cache-control": "no-cache"
    });
    response.end(content);
  } catch {
    response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    response.end("Not found");
  }
}

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url, `http://${request.headers.host || "127.0.0.1"}`);

  if (request.method === "GET" && url.pathname === "/api/status") {
    await handleStatus(response);
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/key") {
    await handleApiKey(request, response);
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/chat") {
    await handleChat(request, response);
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/generate-image") {
    await handleGenerateImage(request, response);
    return;
  }

  if ((request.method === "GET" || request.method === "POST") && url.pathname === "/api/credits") {
    await handleApiModule(request, response, creditsHandler);
    return;
  }

  if ((request.method === "GET" || request.method === "POST" || request.method === "DELETE") && url.pathname === "/api/presence") {
    await handleApiModule(request, response, presenceHandler);
    return;
  }

  if (request.method === "GET" || request.method === "HEAD") {
    await handleStatic(request, response, url);
    return;
  }

  response.writeHead(405, { "allow": "GET, HEAD, POST" });
  response.end("Method not allowed");
});

server.listen(port, "127.0.0.1", () => {
  console.log(`강우진 챗봇 서버(${activeProvider}): http://127.0.0.1:${port}/teacherroom.html`);
});
