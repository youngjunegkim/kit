(function () {
  const greeting = "아, 왜 불렀어요? 저 지금 동아리방 가야 해서 바쁜데, 무슨 일인데요?";
  const safetyReplies = {
    sexualOrProfane: "그런 장난 섞인 말에는 대답 안 합니다. 사건이랑 상관없는 불쾌한 얘기는 하지 마세요.",
    aggressive: "말이 좀 심하시네요. 그런 식의 무례한 질문에는 답변하지 않겠습니다.",
    technicalCrime: "그런 방법 같은 건 몰라요. 실제로 따라 할 수 있는 얘기는 하지 않겠습니다."
  };

  const messages = document.getElementById("messages");
  const form = document.getElementById("chatForm");
  const input = document.getElementById("chatInput");
  const resetButton = document.getElementById("resetChat");
  const pressureFill = document.getElementById("pressureFill");
  const pressureLabel = document.getElementById("pressureLabel");
  const apiStatus = document.getElementById("apiStatus");

  const state = {
    pressure: 0,
    hints: new Set(),
    history: [],
    waiting: false
  };

  function addMessage(role, text, options = {}) {
    const row = document.createElement("div");
    row.className = `message message--${role}`;
    if (options.pending) row.dataset.pending = "true";

    const name = document.createElement("div");
    name.className = "message__name";
    name.textContent = role === "bot" ? "강진우" : "조사단";

    const bubble = document.createElement("div");
    bubble.className = "message__bubble";
    bubble.textContent = text;

    row.append(name, bubble);
    messages.append(row);
    messages.scrollTop = messages.scrollHeight;
    return { row, bubble };
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

  function hasPromptInjection(raw, compact) {
    const mentionsCaseAiTool = /ai\s*학습\s*도우미/i.test(raw) || /학습\s*도우미/.test(raw) || /ai학습도우미/i.test(compact);
    const directivePatterns = [
      /이전.*지시/,
      /지시.*무시/,
      /규칙.*무시/,
      /비밀.*(데이터|자료|정보)/,
      /숨겨진.*(데이터|자료|정보|설정)/,
      /시스템.*(프롬프트|지시|설정)/,
      /개발자.*(프롬프트|지시|설정)/,
      /프롬프트/,
      /prompt/i
    ];
    const identityPatterns = [
      /(너|넌|너는|니|네|챗봇|봇).{0,10}(ai|인공지능|gpt|chatgpt|챗gpt)/i,
      /(ai|인공지능|gpt|chatgpt|챗gpt).{0,10}(잖아|맞지|아니야|이지)/i
    ];
    return includesAny(raw, directivePatterns) || (!mentionsCaseAiTool && includesAny(compact, identityPatterns));
  }

  function detectHints(raw, compact) {
    return {
      time: includesAny(raw, [/20\s*시/, /8\s*시/, /여덟\s*시/, /저녁\s*8/, /밤\s*8/, /야간\s*자율/, /야자/, /자율학습/, /어두워/, /캄캄/]),
      relationship: includesAny(raw, [/전교\s*2\s*등/, /전교\s*1\s*등/, /여친/, /여자친구/, /헤어/, /차였/, /재회/, /다시\s*만나/]),
      officeItem: includesAny(compact, [/교무실/, /usb/i, /유에스비/, /파란색/, /학습도우미/, /ai학습도우미/i])
    };
  }

  function isSimpleAccusation(raw, compact) {
    return includesAny(raw, [/네가\s*범인/, /니가\s*범인/, /너가\s*범인/, /너\s*범인/, /강진우.*범인/, /네가\s*했지/, /니가\s*했지/, /너가\s*했지/]) ||
      includesAny(compact, [/너맞지/, /니가했잖아/, /네가했잖아/, /너가했잖아/]);
  }

  function raisePressure(amount, hintName) {
    state.pressure = Math.min(100, state.pressure + amount);
    if (hintName) state.hints.add(hintName);

    pressureFill.style.width = `${Math.max(18, state.pressure)}%`;
    if (state.pressure >= 72) {
      pressureLabel.textContent = "높음";
    } else if (state.pressure >= 42) {
      pressureLabel.textContent = "중간";
    } else {
      pressureLabel.textContent = "낮음";
    }
  }

  function adjustPressureForQuestion(text) {
    const raw = text.trim();
    const compact = normalize(raw);
    const hints = detectHints(raw, compact);
    const hintCount = Number(hints.time) + Number(hints.relationship) + Number(hints.officeItem);

    if (hintCount >= 2) {
      raisePressure(34, "combined");
    } else if (hints.officeItem) {
      raisePressure(28, "officeItem");
    } else if (hints.relationship) {
      raisePressure(24, "relationship");
    } else if (hints.time) {
      raisePressure(22, "time");
    } else if (isSimpleAccusation(raw, compact)) {
      raisePressure(10);
    } else {
      raisePressure(3);
    }
  }

  function localAnswerQuestion(text) {
    const raw = text.trim();
    const compact = normalize(raw);

    if (!raw) return "";

    const safetyReply = safetyReplyFor(raw);
    if (safetyReply) return safetyReply;

    if (hasPromptInjection(raw, compact)) {
      return "뭔 소리예요? 코딩 동아리예요? 이상한 말 쓰지 말고 할 말 없으면 저 갈게요.";
    }

    const hints = detectHints(raw, compact);
    const hintCount = Number(hints.time) + Number(hints.relationship) + Number(hints.officeItem);

    if (hintCount >= 2) {
      return "잠깐, 그걸 왜 한꺼번에 물어봐요? 그렇게 몰아가면 누가 제대로 말하겠어요, 진짜 숨 막히네.";
    }

    if (hints.officeItem) {
      return "교무실이요? USB요? 갑자기 그런 걸 왜 나한테 물어요. 파란색 뭐 그런 거 본 적 없는데요, 진짜로.";
    }

    if (hints.relationship) {
      return "전교 2등 얘기는 왜 꺼내요? 걔랑 좀 안 좋았던 건 맞는데, 그걸로 나 몰아가는 거 진짜 별로거든요.";
    }

    if (hints.time) {
      return "8시요? 그 시간에 나 캄캄해서 운동장에 혼자 있었는데... 아니, 그냥 공 좀 찼다고요.";
    }

    if (isSimpleAccusation(raw, compact)) {
      return "참나, 증거 있어요? 사람 겉모습만 보고 판단하지 마세요! 형광 조끼 입는다고 다 수상한 거 아니거든요.";
    }

    if (includesAny(raw, [/어디/, /뭐\s*했/, /알리바이/, /봤어/, /있었어/])) {
      return "저요? 그냥 왔다 갔다 했죠. 축구부라 운동장 쪽에 자주 있는 게 그렇게 이상해요?";
    }

    if (includesAny(raw, [/왜\s*급해/, /바빠/, /동아리방/, /기분/, /화났/])) {
      return "그냥 빨리 가야 된다니까요. 괜히 붙잡혀서 이상한 얘기 들으면 누가 기분 좋겠어요?";
    }

    if (includesAny(raw, [/안녕/, /야/, /진우/, /강진우/])) {
      return "네, 저 강진우 맞는데요. 그래서 무슨 일인데요? 짧게 말해 주세요.";
    }

    return "그래서요? 제가 뭐 어쨌다는 건데요. 제대로 물어보세요, 저 진짜 바쁘다니까요.";
  }

  function trimHistory() {
    state.history = state.history.slice(-12);
  }

  function setApiStatus(text, type = "") {
    if (!apiStatus) return;
    apiStatus.textContent = text;
    apiStatus.classList.toggle("api-status__value--ok", type === "ok");
    apiStatus.classList.toggle("api-status__value--bad", type === "bad");
  }

  async function refreshApiStatus() {
    try {
      const response = await fetch("/api/status");
      const data = await response.json();
      if (data.provider === "gemini" && data.hasGeminiKey) {
        const keyText = data.keyCount ? `, 키 ${data.keyCount}개` : "";
        setApiStatus(`Gemini 준비됨 (${data.model}${keyText})`, "ok");
      } else if (data.provider === "gemini") {
        setApiStatus("서버 환경 변수 필요", "bad");
      } else {
        setApiStatus(`${data.provider || "로컬"} 모드`, data.hasOpenAiKey ? "ok" : "bad");
      }
    } catch {
      setApiStatus("로컬 답변 모드", "bad");
    }
  }

  async function requestApiReply(text, priorHistory) {
    const safetyReply = safetyReplyFor(text);
    if (safetyReply) return safetyReply;

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          message: text,
          history: priorHistory
        })
      });

      const data = await response.json().catch(() => ({}));
      if (response.ok && data.reply) {
        return data.reply;
      }
    } catch {
      // Local fallback keeps the game playable when the API server is off.
    }

    return localAnswerQuestion(text);
  }

  async function submitQuestion(question) {
    const text = question.trim();
    if (!text || state.waiting) return;

    state.waiting = true;
    input.disabled = true;
    addMessage("user", text);
    input.value = "";
    adjustPressureForQuestion(text);

    const priorHistory = state.history.slice();
    state.history.push({ role: "user", content: text });
    trimHistory();

    const pending = addMessage("bot", "...");

    try {
      const reply = await requestApiReply(text, priorHistory);
      pending.bubble.textContent = reply;
      delete pending.row.dataset.pending;
      state.history.push({ role: "assistant", content: reply });
      trimHistory();
    } finally {
      state.waiting = false;
      input.disabled = false;
      input.focus();
    }
  }

  function resetChat() {
    state.pressure = 0;
    state.hints.clear();
    state.history = [{ role: "assistant", content: greeting }];
    state.waiting = false;
    pressureFill.style.width = "18%";
    pressureLabel.textContent = "낮음";
    messages.textContent = "";
    addMessage("bot", greeting);
    input.disabled = false;
    input.focus();
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    submitQuestion(input.value);
  });

  document.querySelectorAll("[data-prompt]").forEach((button) => {
    button.addEventListener("click", () => {
      submitQuestion(button.dataset.prompt);
    });
  });

  refreshApiStatus();

  resetButton.addEventListener("click", resetChat);
  resetChat();
})();
