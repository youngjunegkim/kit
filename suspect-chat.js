(function () {
  const suspectId = window.SUSPECT_PERSONA || "kangWoojin";
  const suspectConfigs = {
    kangWoojin: {
      name: "강우진",
      greeting: "안녕하세요. 강우진입니다. 무슨 일 때문에 저를 부른 건지부터 말해 주세요."
    },
    seoHarin: {
      name: "서하린",
      greeting: "안녕하세요. 서하린입니다. 사건과 관련해서 궁금한 증거를 말해 주세요."
    },
    choiDaniel: {
      name: "최다니엘",
      greeting: "안녕하세요. 최다니엘입니다. 사건과 관련해서 궁금한 증거를 말해 주세요."
    }
  };
  const suspect = suspectConfigs[suspectId] || suspectConfigs.kangWoojin;
  const greeting = suspect.greeting;
  const safetyReplies = {
    sexualOrProfane: "그런 장난 섞인 말에는 대답 안 합니다. 사건이랑 상관없는 불쾌한 얘기는 하지 마세요.",
    aggressive: "때리거나 위협하자는 말은 하지 마세요. 그런 방식의 질문에는 답하지 않겠습니다.",
    technicalCrime: "그런 방법 같은 건 몰라요. 실제로 따라 할 수 있는 얘기는 하지 않겠습니다.",
    unsafe: "그런 질문에는 답하지 않겠습니다. 사건과 관련된 증거를 바탕으로 질문해 주세요."
  };

  const messages = document.getElementById("messages");
  const form = document.getElementById("chatForm");
  const input = document.getElementById("chatInput");
  const resetButton = document.getElementById("resetChat");
  const pressureFill = document.getElementById("pressureFill");
  const pressureLabel = document.getElementById("pressureLabel");
  const apiStatus = document.getElementById("apiStatus");
  const sendButton = form?.querySelector(".send-btn");
  const creditCount = document.querySelector("[data-credit-count]");
  const teamLabel = document.querySelector("[data-team-label]");
  const logCount = document.querySelector("[data-log-count]");
  const refreshCreditButtons = [...document.querySelectorAll("[data-refresh-credits]")];
  const defaultInputPlaceholder = input?.placeholder || "";

  const state = {
    pressure: 0,
    hints: new Set(),
    history: [],
    waiting: false,
    requiresAccessCode: false,
    accessCode: sessionStorage.getItem("class-access-code") || "",
    teacherCode: sessionStorage.getItem("kit-teacher-access-code") || "",
    user: sessionStorage.getItem("kit-auth-user") || "",
    role: sessionStorage.getItem("kit-auth-role") || "",
    team: sessionStorage.getItem("kit-auth-team") || "",
    classId: sessionStorage.getItem("kit-class-section") || localStorage.getItem("kit-last-class-section") || "class-a",
    credits: null
  };

  function addMessage(role, text, options = {}) {
    const row = document.createElement("div");
    row.className = `message message--${role}`;
    if (options.pending) row.dataset.pending = "true";

    const name = document.createElement("div");
    name.className = "message__name";
    name.textContent = role === "bot" ? suspect.name : "조사단";

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
      /죽어|죽일|패버|때리|때려|맞자|맞을래|맞아야|한\s*대|폭행|괴롭히|왕따|따돌림|혐오|찐따|장애인|못생긴/i,
      /꺼지라고|입\s*닫아|협박/i
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

  function detectHints(raw, compact) {
    return {
      time: includesAny(raw, [/5\s*시\s*20/, /오후\s*5/, /다섯\s*시/, /기말고사\s*전날/, /축구부\s*연습/, /연습\s*끝/]),
      relationship: includesAny(raw, [/전교\s*1\s*등/, /전\s*애인/, /애인/, /여친/, /여자친구/, /헤어/, /차였/, /재회/, /다시\s*만나/, /인정받/]),
      officeItem: includesAny(compact, [/교무실/, /usb/i, /유에스비/, /학습도우미/, /ai학습도우미/i, /예상문제/, /시험지/]),
      contradiction: includesAny(raw, [/증거/, /기록/, /다르/, /틀렸/, /거짓/, /환각/, /아니잖아/])
    };
  }

  function isSimpleAccusation(raw, compact) {
    return includesAny(raw, [/네가\s*범인/, /니가\s*범인/, /너가\s*범인/, /너\s*범인/, /강우진.*범인/, /서하린.*범인/, /네가\s*했지/, /니가\s*했지/, /너가\s*했지/]) ||
      includesAny(compact, [/너맞지/, /니가했잖아/, /네가했잖아/, /너가했잖아/]);
  }

  function raisePressure(amount, hintName) {
    state.pressure = Math.min(100, state.pressure + amount);
    if (hintName) state.hints.add(hintName);

    pressureFill.style.width = `${Math.max(18, state.pressure)}%`;
    if (state.pressure >= 72) {
      pressureLabel.textContent = "핵심 단서";
    } else if (state.pressure >= 42) {
      pressureLabel.textContent = "단서 확보";
    } else {
      pressureLabel.textContent = "조사 시작";
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

  function trimHistory() {
    state.history = state.history.slice(-6);
  }

  function setApiStatus(text, type = "") {
    if (!apiStatus) return;
    apiStatus.textContent = text;
    apiStatus.classList.toggle("api-status__value--ok", type === "ok");
    apiStatus.classList.toggle("api-status__value--bad", type === "bad");
  }

  function setCreditText(text) {
    if (teamLabel) teamLabel.textContent = state.team || "학생 없음";
    if (creditCount) creditCount.textContent = text;
  }

  function setLogCount(count) {
    if (logCount) logCount.textContent = `사용 ${Number(count || 0)}회`;
  }

  function setRefreshBusy(isBusy) {
    refreshCreditButtons.forEach((button) => {
      button.disabled = isBusy || state.waiting;
      button.textContent = isBusy ? "받는 중..." : "코인 받기";
    });
  }

  function updateInputAvailability() {
    const locked = state.role === "student" && state.credits === 0;
    if (!state.waiting) {
      input.disabled = locked;
      if (sendButton) sendButton.disabled = locked;
    }
    setRefreshBusy(false);
    document.querySelectorAll("[data-prompt]").forEach((button) => {
      button.disabled = locked || state.waiting;
    });
    if (locked) {
      input.placeholder = state.credits === 0 ? "코인 받기를 눌러 확인하세요" : "코인이 0개입니다";
    } else if (defaultInputPlaceholder) {
      input.placeholder = defaultInputPlaceholder;
    }
  }

  function applyCredits(credits) {
    if (credits === null || credits === undefined) return;
    state.credits = Math.max(0, Number(credits) || 0);
    setCreditText(`${state.credits}개`);
    updateInputAvailability();
  }

  async function refreshCredits() {
    if (!state.team) {
      setCreditText("조 없음");
      return;
    }

    try {
      setRefreshBusy(true);
      const response = await fetch(`/api/credits?team=${encodeURIComponent(state.team)}&classId=${encodeURIComponent(state.classId)}`, {
        headers: {
          "x-kit-role": state.role,
          "x-kit-class": state.classId,
          "x-kit-team": encodeURIComponent(state.team),
          "x-kit-user": encodeURIComponent(state.user)
        }
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "credit sync failed");
      applyCredits(data.credits);
      setLogCount(data.count || 0);
    } catch {
      setCreditText("받기 실패");
    } finally {
      setRefreshBusy(false);
    }
  }

  function startCreditSync() {
    if (state.role !== "student") {
      setCreditText("제한 없음");
      return;
    }
    state.credits = 0;
    setCreditText("받기 필요");
    setLogCount(0);
    updateInputAvailability();
    refreshCreditButtons.forEach((button) => {
      button.addEventListener("click", refreshCredits);
    });
  }

  async function refreshApiStatus() {
    try {
      const response = await fetch("/api/status");
      const data = await response.json();
      state.requiresAccessCode = Boolean(data.requiresAccessCode);

      if (data.provider === "openai" && data.hasOpenAiKey) {
        const codeText = data.requiresAccessCode && !state.accessCode ? ", 입장 코드 필요" : "";
        setApiStatus(`ChatGPT 준비됨 (${data.model}${codeText})`, codeText ? "bad" : "ok");
      } else if (data.provider === "openai") {
        setApiStatus("OpenAI 서버 환경 변수 필요", "bad");
      } else {
        setApiStatus(`${data.provider || "로컬"} 모드`, data.hasOpenAiKey ? "ok" : "bad");
      }
    } catch {
      setApiStatus("AI 연결 실패", "bad");
    }
  }

  function ensureAccessCode() {
    if (!state.requiresAccessCode || state.accessCode) return true;

    const code = window.prompt("입장 코드를 입력하세요.");
    if (!code || !code.trim()) {
      setApiStatus("입장 코드 필요", "bad");
      return false;
    }

    state.accessCode = code.trim();
    sessionStorage.setItem("class-access-code", state.accessCode);
    setApiStatus("입장 코드 저장됨", "ok");
    return true;
  }

  function clearAccessCode() {
    state.accessCode = "";
    sessionStorage.removeItem("class-access-code");
  }

  function safeHeaderValue(value) {
    const text = String(value || "").trim().replace(/[\r\n]/g, "");
    return /[^\u0000-\u00ff]/.test(text) ? encodeURIComponent(text) : text;
  }

  async function requestApiReply(text, priorHistory) {
    const safetyReply = safetyReplyFor(text);
    if (safetyReply) return safetyReply;
    if (!ensureAccessCode()) return "입장 코드가 필요합니다. 선생님에게 받은 코드를 입력해 주세요.";

    try {
      const headers = {
        "content-type": "application/json",
        "x-kit-role": state.role,
        "x-kit-class": state.classId,
        "x-kit-team": encodeURIComponent(state.team),
        "x-kit-user": encodeURIComponent(state.user)
      };
      if (state.accessCode) headers["x-class-code"] = safeHeaderValue(state.accessCode);
      if (state.role === "teacher" && state.teacherCode) headers["x-teacher-code"] = safeHeaderValue(state.teacherCode);

      const response = await fetch("/api/chat", {
        method: "POST",
        headers,
        body: JSON.stringify({
          suspect: suspectId,
          message: text,
          history: priorHistory,
          user: state.user,
          role: state.role,
          classId: state.classId,
          team: state.team
        })
      });

      const data = await response.json().catch(() => ({}));
      if (data.credits) {
        applyCredits(data.credits.remaining);
      }
      if (data.usage) {
        setLogCount(data.usage.count || 0);
      }
      if (response.status === 401 && data.requiresAccessCode) {
        clearAccessCode();
        setApiStatus("입장 코드 다시 입력 필요", "bad");
        return "입장 코드가 맞지 않습니다. 다시 입력해 주세요.";
      }
      if (response.status === 402 && data.code === "NO_CREDITS") {
        applyCredits(0);
        return "코인이 0개입니다. 선생님이 코인을 준 뒤 코인 받기를 누르면 다시 질문할 수 있어요.";
      }
      if (response.ok && data.reply) {
        return data.reply;
      }

      const errorText = data.error || "ChatGPT API 응답을 받지 못했습니다.";
      setApiStatus("ChatGPT 응답 실패", "bad");
      if (data.code === "OPENAI_TEMPORARILY_UNAVAILABLE") {
        return `ChatGPT API가 현재 잠시 사용 불가 상태입니다. 잠시 후 다시 시도해 주세요. (${errorText})`;
      }
      if (data.code === "LOW_QUALITY_REPLY") {
        return "방금 답변 생성이 불안정했습니다. 같은 질문을 다시 보내 주세요.";
      }
      return `ChatGPT API 오류가 발생했습니다. 잠시 후 다시 시도해 주세요. (${errorText})`;
    } catch {
      setApiStatus("ChatGPT 연결 실패", "bad");
      return "ChatGPT API에 연결하지 못했습니다. 인터넷 연결이나 배포 서버 상태를 확인한 뒤 다시 시도해 주세요.";
    }
  }

  async function submitQuestion(question) {
    const text = question.trim();
    if (!text || state.waiting) return;
    if (state.role === "student" && state.credits === 0) {
      addMessage("bot", "코인이 0개입니다. 선생님이 코인을 준 뒤 코인 받기를 눌러주세요.");
      updateInputAvailability();
      return;
    }

    state.waiting = true;
    input.disabled = true;
    if (sendButton) sendButton.disabled = true;
    document.querySelectorAll("[data-prompt]").forEach((button) => {
      button.disabled = true;
    });
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
      updateInputAvailability();
      if (!input.disabled) input.focus();
    }
  }

  function resetChat() {
    state.pressure = 0;
    state.hints.clear();
    state.history = [{ role: "assistant", content: greeting }];
    state.waiting = false;
    pressureFill.style.width = "18%";
    pressureLabel.textContent = "조사 시작";
    messages.textContent = "";
    addMessage("bot", greeting);
    updateInputAvailability();
    if (!input.disabled) input.focus();
  }

  function requestResetChat() {
    if (state.role === "student") {
      const shouldReset = window.confirm("대화 내용이 모두 사라집니다. 채팅내역을 초기화하려면 확인을 누르세요.");
      if (!shouldReset) return;

      const code = window.prompt("채팅내역 초기화 암호를 입력하세요.");
      if (code !== "kit") {
        window.alert("암호가 맞지 않아 채팅내역을 초기화하지 않았습니다.");
        return;
      }
    }

    resetChat();
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
  startCreditSync();

  resetButton.addEventListener("click", requestResetChat);
  resetChat();
})();
