(function () {
  const panels = [...document.querySelectorAll("[data-suspect-panel]")].map((panel) => ({
    root: panel,
    suspect: panel.dataset.suspect || "kangWoojin",
    name: panel.dataset.suspectName || "용의자",
    messages: panel.querySelector("[data-chat-messages]"),
    form: panel.querySelector("[data-chat-form]"),
    input: panel.querySelector("[data-chat-input]"),
    submit: panel.querySelector("[data-chat-submit]"),
    state: panel.querySelector("[data-chat-state]"),
    history: [],
    waiting: false
  }));

  if (!panels.length) return;

  const cardLightbox = document.querySelector("[data-card-lightbox]");
  const cardLightboxImage = document.querySelector("[data-card-lightbox-image]");
  const closeCardButton = document.querySelector("[data-close-card]");

  const greetings = {
    kangWoojin: "안녕하세요. 강우진입니다. 축구부 연습 끝나고 바로 불려와서 조금 당황했어요. 어떤 걸 확인하면 될까요?",
    seoHarin: "안녕하세요. 서하린입니다. 제가 시스템 로그를 본 건 맞지만, 시험지를 유출했다는 뜻은 아니에요. 어떤 기록부터 확인할까요?",
    choiDaniel: "안녕하세요. 최다니엘입니다. 제가 교무실 근처 복도에 있었던 건 맞지만, 교무실 안에 들어간 건 아니에요. 어떤 장면을 확인하고 싶으세요?"
  };
  const suspectNames = {
    kangWoojin: "강우진",
    seoHarin: "서하린",
    choiDaniel: "최다니엘"
  };
  const safetyReplies = {
    sexualOrProfane: "그런 장난 섞인 말에는 대답 안 합니다. 사건이랑 상관없는 불쾌한 얘기는 하지 마세요.",
    aggressive: "말이 좀 심하시네요. 그런 식의 무례한 질문에는 답변하지 않겠습니다.",
    technicalCrime: "그런 방법 같은 건 몰라요. 실제로 따라 할 수 있는 얘기는 하지 않겠습니다."
  };

  const state = {
    credits: 0,
    count: 0,
    logs: [],
    requesting: false,
    requiresAccessCode: false,
    accessCode: sessionStorage.getItem("class-access-code") || "",
    user: sessionStorage.getItem("kit-auth-user") || "",
    role: sessionStorage.getItem("kit-auth-role") || "",
    team: sessionStorage.getItem("kit-auth-team") || ""
  };

  const creditCounts = [...document.querySelectorAll("[data-credit-count]")];
  const teamLabels = [...document.querySelectorAll("[data-team-label]")];
  const logCounts = [...document.querySelectorAll("[data-log-count]")];
  const refreshButtons = [...document.querySelectorAll("[data-refresh-credits]")];
  const studentLogList = document.querySelector("[data-student-log-list]");
  const apiStatus = document.querySelector("[data-api-status]");

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

    if (includesAny(raw, sexualOrProfane) || includesAny(compact, sexualOrProfane)) return safetyReplies.sexualOrProfane;
    if (includesAny(raw, aggressive) || includesAny(compact, aggressive)) return safetyReplies.aggressive;
    if (includesAny(raw, technicalCrime) || includesAny(compact, technicalCrime)) return safetyReplies.technicalCrime;
    return "";
  }

  function setCreditText(text) {
    creditCounts.forEach((node) => {
      node.textContent = text;
    });
  }

  function setLogCount(count) {
    state.count = Number(count || 0);
    logCounts.forEach((node) => {
      node.textContent = `${state.count}회`;
    });
  }

  function setApiStatus(text, type = "") {
    if (!apiStatus) return;
    apiStatus.textContent = text;
    apiStatus.classList.toggle("status-ok", type === "ok");
    apiStatus.classList.toggle("status-bad", type === "bad");
  }

  function setRefreshBusy(isBusy) {
    refreshButtons.forEach((button) => {
      button.disabled = isBusy || state.requesting;
      button.textContent = isBusy ? "받는 중..." : "질문권 받기";
    });
  }

  function setPanelState(panel, text) {
    if (panel.state) panel.state.textContent = text;
  }

  function openCardLightbox(image) {
    if (!cardLightbox || !cardLightboxImage || !image) return;
    cardLightboxImage.src = image.currentSrc || image.src;
    cardLightboxImage.alt = image.alt || "";
    cardLightbox.hidden = false;
    document.body.classList.add("lightbox-open");
    closeCardButton?.focus({ preventScroll: true });
  }

  function closeCardLightbox() {
    if (!cardLightbox || !cardLightboxImage) return;
    cardLightbox.hidden = true;
    cardLightboxImage.removeAttribute("src");
    document.body.classList.remove("lightbox-open");
  }

  function setupCardLightbox() {
    if (!cardLightbox || !cardLightboxImage) return;

    panels.forEach((panel) => {
      const card = panel.root.querySelector(".suspect-card");
      const image = card?.querySelector("img");
      if (!card || !image) return;

      card.tabIndex = 0;
      card.setAttribute("role", "button");
      card.setAttribute("aria-label", "Open suspect card");
      card.addEventListener("click", () => openCardLightbox(image));
      card.addEventListener("keydown", (event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        openCardLightbox(image);
      });
    });

    closeCardButton?.addEventListener("click", closeCardLightbox);
    cardLightbox.addEventListener("click", (event) => {
      if (event.target === cardLightbox) closeCardLightbox();
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && !cardLightbox.hidden) closeCardLightbox();
    });
  }

  function updateControls() {
    const locked = state.role === "student" && state.credits <= 0;
    panels.forEach((panel) => {
      const disabled = locked || state.requesting || panel.waiting;
      panel.input.disabled = disabled;
      panel.submit.disabled = disabled;
      panel.input.placeholder = locked ? "질문권 받기를 눌러 확인하세요" : `${panel.name}에게 질문하기`;
    });
    setRefreshBusy(false);
  }

  function addMessage(panel, role, text, options = {}) {
    const row = document.createElement("div");
    row.className = `message message--${role}`;
    if (options.pending) row.dataset.pending = "true";

    const name = document.createElement("div");
    name.className = "message__name";
    name.textContent = role === "bot" ? panel.name : "조사단";

    const bubble = document.createElement("div");
    bubble.className = "message__bubble";
    bubble.textContent = text;

    row.append(name, bubble);
    panel.messages.append(row);
    panel.messages.scrollTop = panel.messages.scrollHeight;
    return { row, bubble };
  }

  function formatLogTime(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return date.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });
  }

  function renderStudentLogs() {
    if (!studentLogList) return;
    studentLogList.textContent = "";

    if (!state.logs.length) {
      const empty = document.createElement("p");
      empty.className = "student-log-empty";
      empty.textContent = "아직 질문 로그가 없습니다.";
      studentLogList.append(empty);
      return;
    }

    state.logs.slice(0, 12).forEach((entry) => {
      const item = document.createElement("article");
      item.className = "student-log-entry";

      const meta = document.createElement("span");
      const suspect = suspectNames[entry.suspect] || "용의자";
      meta.textContent = `${formatLogTime(entry.at)} · ${suspect} · ${entry.count || 0}번째`;

      const text = document.createElement("p");
      text.textContent = entry.message || "질문 내용 없음";

      item.append(meta, text);
      studentLogList.append(item);
    });
  }

  function applyCredits(credits) {
    state.credits = Math.max(0, Number(credits) || 0);
    setCreditText(`${state.credits}개`);
    updateControls();
  }

  function applyUsage(usage) {
    if (!usage) return;
    if (usage.count !== undefined) setLogCount(usage.count);
    if (usage.log) {
      state.logs = [usage.log, ...state.logs.filter((entry) => entry.id !== usage.log.id)].slice(0, 12);
      renderStudentLogs();
    }
  }

  async function refreshCredits() {
    if (!state.team) {
      setCreditText("학생 없음");
      setLogCount(0);
      state.logs = [];
      renderStudentLogs();
      updateControls();
      return;
    }

    try {
      setRefreshBusy(true);
      const response = await fetch(`/api/credits?team=${encodeURIComponent(state.team)}`, {
        headers: {
          "x-kit-role": state.role
        }
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "sync failed");
      applyCredits(data.credits);
      setLogCount(data.count || 0);
      state.logs = Array.isArray(data.logs) ? data.logs : [];
      renderStudentLogs();
    } catch {
      setCreditText("받기 실패");
    } finally {
      setRefreshBusy(false);
      updateControls();
    }
  }

  async function refreshApiStatus() {
    try {
      const response = await fetch("/api/status");
      const data = await response.json().catch(() => ({}));
      state.requiresAccessCode = Boolean(data.requiresAccessCode);

      if (data.provider === "gemini" && data.hasGeminiKey) {
        setApiStatus(data.requiresAccessCode && !state.accessCode ? "코드 필요" : "준비됨", data.requiresAccessCode && !state.accessCode ? "bad" : "ok");
      } else if (data.provider === "gemini") {
        setApiStatus("키 필요", "bad");
      } else {
        setApiStatus(data.provider || "로컬", data.hasOpenAiKey ? "ok" : "");
      }
    } catch {
      setApiStatus("연결 실패", "bad");
    }
  }

  function ensureAccessCode() {
    if (!state.requiresAccessCode || state.accessCode) return true;

    const code = window.prompt("입장 코드를 입력하세요.");
    if (!code || !code.trim()) {
      setApiStatus("코드 필요", "bad");
      return false;
    }

    state.accessCode = code.trim();
    sessionStorage.setItem("class-access-code", state.accessCode);
    setApiStatus("준비됨", "ok");
    return true;
  }

  function clearAccessCode() {
    state.accessCode = "";
    sessionStorage.removeItem("class-access-code");
  }

  async function requestReply(panel, text, priorHistory) {
    const safetyReply = safetyReplyFor(text);
    if (safetyReply) return safetyReply;
    if (!ensureAccessCode()) return "입장 코드가 필요합니다. 선생님에게 받은 코드를 입력해 주세요.";

    try {
      const headers = {
        "content-type": "application/json",
        "x-kit-role": state.role
      };
      if (state.accessCode) headers["x-class-code"] = state.accessCode;

      const response = await fetch("/api/chat", {
        method: "POST",
        headers,
        body: JSON.stringify({
          suspect: panel.suspect,
          message: text,
          history: priorHistory,
          user: state.user,
          role: state.role,
          team: state.team
        })
      });

      const data = await response.json().catch(() => ({}));
      if (data.credits) applyCredits(data.credits.remaining);
      if (data.usage) applyUsage(data.usage);

      if (response.status === 401 && data.requiresAccessCode) {
        clearAccessCode();
        setApiStatus("코드 필요", "bad");
        return "입장 코드가 맞지 않습니다. 다시 입력해 주세요.";
      }
      if (response.status === 402 && data.code === "NO_CREDITS") {
        applyCredits(0);
        return "질문권이 0개입니다. 선생님이 질문권을 준 뒤 질문권 받기를 눌러주세요.";
      }
      if (response.ok && data.reply) return data.reply;

      const errorText = data.error || "AI 응답을 받지 못했습니다.";
      setApiStatus("응답 실패", "bad");
      if (data.code === "LOW_QUALITY_REPLY") {
        return "AI가 질문에 맞는 답변을 만들지 못했습니다. 같은 증거를 조금 더 구체적으로 다시 질문해 주세요.";
      }
      return `AI 오류가 발생했습니다. 잠시 후 다시 시도해 주세요. (${errorText})`;
    } catch {
      setApiStatus("연결 실패", "bad");
      return "AI에 연결하지 못했습니다. 서버 상태를 확인한 뒤 다시 시도해 주세요.";
    }
  }

  function trimHistory(panel) {
    panel.history = panel.history.slice(-12);
  }

  async function submitQuestion(panel) {
    const text = panel.input.value.trim();
    if (!text || state.requesting || panel.waiting) return;
    if (state.role === "student" && state.credits <= 0) {
      addMessage(panel, "bot", "질문권이 0개입니다. 선생님이 질문권을 준 뒤 질문권 받기를 눌러주세요.");
      updateControls();
      return;
    }

    state.requesting = true;
    panel.waiting = true;
    setPanelState(panel, "응답 중");
    updateControls();
    addMessage(panel, "user", text);
    panel.input.value = "";

    const priorHistory = panel.history.slice();
    panel.history.push({ role: "user", content: text });
    trimHistory(panel);

    const pending = addMessage(panel, "bot", "...");
    try {
      const reply = await requestReply(panel, text, priorHistory);
      pending.bubble.textContent = reply;
      delete pending.row.dataset.pending;
      panel.history.push({ role: "assistant", content: reply });
      trimHistory(panel);
    } finally {
      panel.waiting = false;
      state.requesting = false;
      setPanelState(panel, "대기");
      updateControls();
      if (!panel.input.disabled) panel.input.focus();
    }
  }

  teamLabels.forEach((node) => {
    node.textContent = state.team || "학생";
  });
  setCreditText(state.team ? "받기 필요" : "학생 없음");
  setLogCount(0);
  renderStudentLogs();
  updateControls();

  panels.forEach((panel) => {
    const greeting = greetings[panel.suspect] || greetings.kangWoojin;
    panel.history = [{ role: "assistant", content: greeting }];
    addMessage(panel, "bot", greeting);
    panel.form.addEventListener("submit", (event) => {
      event.preventDefault();
      submitQuestion(panel);
    });
  });

  setupCardLightbox();

  refreshButtons.forEach((button) => {
    button.addEventListener("click", refreshCredits);
  });

  refreshApiStatus();
})();
