const { applyCors, handleCorsPreflight, isAllowedOrigin } = require("./_origin");

const rateWindowMs = 60 * 1000;
const rateLimitPerWindow = Number(process.env.IMAGE_RATE_LIMIT_PER_MINUTE || 8);
const maxPromptChars = Number(process.env.IMAGE_MAX_PROMPT_CHARS || 900);
const maxRequestBytes = Number(process.env.IMAGE_MAX_REQUEST_BYTES || 8000);
const freeImageProvider = String(process.env.FREE_IMAGE_PROVIDER || "pollinations").trim().toLowerCase();
const freeImageFallbackSetting = String(process.env.FREE_IMAGE_FALLBACK || "1").trim().toLowerCase();
const freeImageFallbackEnabled = !["0", "false", "off", "none"].includes(freeImageFallbackSetting);
const geminiImageGenerationSetting = String(process.env.GEMINI_IMAGE_GENERATION || process.env.GOOGLE_IMAGE_GENERATION || "0").trim().toLowerCase();
const geminiImageGenerationEnabled = ["1", "true", "on", "yes"].includes(geminiImageGenerationSetting);
const freeImageTimeoutMs = Number(process.env.FREE_IMAGE_TIMEOUT_MS || 70000);
const translationTimeoutMs = Number(process.env.IMAGE_TRANSLATION_TIMEOUT_MS || 12000);
const imagePromptTranslationSetting = String(process.env.IMAGE_PROMPT_TRANSLATION || process.env.GEMINI_IMAGE_PROMPT_TRANSLATION || "1").trim().toLowerCase();
const imagePromptTranslationEnabled = ["1", "true", "on", "yes"].includes(imagePromptTranslationSetting);
const rateBuckets = new Map();
const translationCache = new Map();

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

function clientIdFor(request) {
  const forwarded = headerValue(request, "x-forwarded-for");
  return String(forwarded || request.socket?.remoteAddress || "unknown").split(",")[0].trim();
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
  return String(text || "")
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[.,!?'"`~\-_/\\()[\]{}:;|]/g, "");
}

function forbiddenWordFor(prompt, card) {
  if (!card || !Array.isArray(card.forbidden)) return "";
  const compact = normalize(prompt);
  return card.forbidden.find((word) => compact.includes(normalize(word))) || "";
}

function uniqueKeysFrom(...values) {
  const keys = values
    .filter(Boolean)
    .join(",")
    .split(/[,\n;]/)
    .map((key) => key.trim())
    .filter(Boolean);
  return [...new Set(keys)];
}

function getGeminiImageKeys() {
  return uniqueKeysFrom(
    process.env.GEMINI_IMAGE_API_KEYS,
    process.env.GEMINI_IMAGE_API_KEY,
    process.env.GEMINI_API_KEYS,
    process.env.GEMINI_API_KEY
  );
}

function getGeminiTextKeys() {
  return uniqueKeysFrom(
    process.env.GEMINI_API_KEYS,
    process.env.GEMINI_API_KEY,
    process.env.GEMINI_IMAGE_API_KEYS,
    process.env.GEMINI_IMAGE_API_KEY
  );
}

function imageModelCandidates() {
  function normalizeModelName(model) {
    if (!model) return "";
    return String(model).trim().replace(/^models\//, "");
  }

  return [
    normalizeModelName(process.env.GEMINI_IMAGE_MODEL),
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
  function normalizeModelName(model) {
    if (!model) return "";
    return String(model).trim().replace(/^models\//, "");
  }

  return [
    normalizeModelName(process.env.IMAGEN_MODEL),
    normalizeModelName(process.env.GEMINI_IMAGEN_MODEL),
    normalizeModelName(process.env.GEMINI_IMAGE_MODEL)?.startsWith("imagen-")
      ? normalizeModelName(process.env.GEMINI_IMAGE_MODEL)
      : "",
    "imagen-4.0-generate-001",
    "imagen-4.0-fast-generate-001",
    "imagen-3.0-generate-002"
  ]
    .filter(Boolean)
    .filter((model, index, models) => models.indexOf(model) === index);
}

function apiVersionsFor(model) {
  if (/preview|experimental/i.test(model)) return ["v1beta"];
  return ["v1", "v1beta"];
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

function imageRequestBodies(prompt, room) {
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
  return String(process.env.GEMINI_TRANSLATION_MODEL || process.env.GEMINI_MODEL || "gemini-2.5-flash")
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

function extractText(data) {
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

    const translated = cleanTranslatedPrompt(extractText(data));
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

function seedForText(text) {
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
    seed: String(seedForText(imagePrompt)),
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

function extractImage(data) {
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

function shouldTryNext(statusCode, message) {
  return statusCode === 400 ||
    statusCode === 401 ||
    statusCode === 403 ||
    statusCode === 404 ||
    statusCode === 429 ||
    statusCode === 503 ||
    /api key|quota|rate|model|not found|high demand/i.test(message || "");
}

function normalizeModelName(model) {
  return String(model || "").trim().replace(/^models\//, "");
}

function isImageGenerationModel(model) {
  const name = normalizeModelName(model.name);
  const methods = model.supportedGenerationMethods || model.supported_generation_methods || [];
  return methods.includes("generateContent") && /(^|[-_])(image|imagen)([-_]|$)/i.test(name);
}

async function listAvailableImageModels(key) {
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
        if (!isImageGenerationModel(model)) continue;
        const name = normalizeModelName(model.name);
        const id = `${name}:${apiVersion}`;
        if (seen.has(id)) continue;
        seen.add(id);
        available.push({ model: name, apiVersion });
      }
    } catch {
      // Model discovery is a best-effort helper. Static candidates still run.
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
        const name = normalizeModelName(model.name);
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

async function imageRequestCandidates(key) {
  const staticCandidates = imageModelCandidates()
    .flatMap((model) => apiVersionsFor(model).map((apiVersion) => ({ model, apiVersion })));
  const discoveredCandidates = await listAvailableImageModels(key);
  const preferredOrder = imageModelCandidates();

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

async function callGeminiImage(prompt, room) {
  const translatedPrompt = await translatePromptToEnglish(prompt, room);

  if (!geminiImageGenerationEnabled) {
    const freeResult = await callFreeImageFallback(prompt, room, "Gemini image generation is disabled; using Pollinations directly.", translatedPrompt);
    if (freeResult) return freeResult;
    return {
      statusCode: 503,
      body: { error: "Free image fallback is disabled, and Gemini image generation is disabled.", fallback: true }
    };
  }

  const keys = getGeminiImageKeys();
  const imagePrompt = translatedPrompt || prompt;
  if (!keys.length) {
    const freeResult = await callFreeImageFallback(prompt, room, "GEMINI_IMAGE_API_KEY or GEMINI_API_KEY is not set.", translatedPrompt);
    if (freeResult) return freeResult;
    return {
      statusCode: 503,
      body: { error: "GEMINI_IMAGE_API_KEY or GEMINI_API_KEY is not set.", fallback: true }
    };
  }

  const startIndex = Math.floor(Math.random() * keys.length);
  let lastFailure = {
    statusCode: 502,
    body: { error: "Gemini image request failed.", fallback: true }
  };
  const attempted = [];

  for (let attempt = 0; attempt < keys.length; attempt += 1) {
    const key = keys[(startIndex + attempt) % keys.length];
    const imagenCandidates = await imagenRequestCandidates(key);
    for (const { model, apiVersion } of imagenCandidates) {
      const endpoint = `https://generativelanguage.googleapis.com/${apiVersion}/models/${encodeURIComponent(model)}:predict`;
      const imagenResponse = await fetch(endpoint, {
        method: "POST",
        headers: {
          "x-goog-api-key": key,
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
      if (!shouldTryNext(imagenResponse.status, errorMessage)) {
        return lastFailure;
      }
    }

    const candidates = await imageRequestCandidates(key);
    for (const { model, apiVersion } of candidates) {
      for (const requestBody of imageRequestBodies(imagePrompt, room)) {
        const endpoint = `https://generativelanguage.googleapis.com/${apiVersion}/models/${encodeURIComponent(model)}:generateContent`;
        const geminiResponse = await fetch(endpoint, {
          method: "POST",
          headers: {
            "x-goog-api-key": key,
            "content-type": "application/json"
          },
          body: JSON.stringify(requestBody.body)
        });

        const data = await geminiResponse.json().catch(() => ({}));
        if (geminiResponse.ok) {
          const image = extractImage(data);
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

        const errorMessage = data.error?.message || data.promptFeedback?.blockReason || "Gemini image request failed.";
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

        if (!shouldTryNext(geminiResponse.status, errorMessage)) {
          return lastFailure;
        }
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

module.exports = async function handler(request, response) {
  applyCors(request, response);
  if (handleCorsPreflight(request, response, "POST")) return;

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

  if (!isTeacherAuthorized(request)) {
    sendJson(response, 401, {
      error: "Teacher access code is required.",
      code: "TEACHER_CODE_REQUIRED",
      fallback: true
    });
    return;
  }

  if (isRateLimited(request)) {
    sendJson(response, 429, { error: "Too many image requests. Please slow down.", fallback: true });
    return;
  }

  if (isTooLargePayload(request.body)) {
    sendJson(response, 413, { error: "Request is too large.", fallback: true });
    return;
  }

  const prompt = String(request.body?.prompt || "").trim();
  const room = String(request.body?.room || "").trim().slice(0, 80);
  const card = request.body?.card || null;

  if (!prompt) {
    sendJson(response, 400, { error: "Prompt is required." });
    return;
  }

  if (prompt.length > maxPromptChars) {
    sendJson(response, 413, { error: "Prompt is too long.", fallback: true });
    return;
  }

  const forbidden = forbiddenWordFor(prompt, card);
  if (forbidden) {
    sendJson(response, 400, {
      error: `Forbidden word included: ${forbidden}`,
      code: "FORBIDDEN_WORD",
      fallback: true
    });
    return;
  }

  try {
    const result = await callGeminiImage(prompt, room);
    sendJson(response, result.statusCode, result.body);
  } catch (error) {
    sendJson(response, 502, {
      error: error.message || "Gemini image request failed.",
      fallback: true
    });
  }
};
