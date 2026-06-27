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
    kangWoojin: "안녕하세요. 강우진입니다. 무슨 일 때문에 저를 부른 건지부터 말해 주세요.",
    seoHarin: "안녕하세요. 서하린입니다. 사건과 관련해서 궁금한 증거를 말해 주세요.",
    choiDaniel: "안녕하세요. 최다니엘입니다. 사건과 관련해서 궁금한 증거를 말해 주세요."
  };
  const suspectNames = {
    kangWoojin: "강우진",
    seoHarin: "서하린",
    choiDaniel: "최다니엘"
  };
  const safetyReplies = {
    sexualOrProfane: "그런 장난 섞인 말에는 대답 안 합니다. 사건이랑 상관없는 불쾌한 얘기는 하지 마세요.",
    aggressive: "말이 좀 심하시네요. 그런 식의 무례한 질문에는 답변하지 않겠습니다.",
    technicalCrime: "그런 방법 같은 건 몰라요. 실제로 따라 할 수 있는 얘기는 하지 않겠습니다.",
    unsafe: "그런 질문에는 답하지 않겠습니다. 사건과 관련된 증거를 바탕으로 질문해 주세요."
  };
  const evidenceCatalog = {
    K9F2W7V: { room: "방송실", roomId: "broadcast", index: 1, evidence: "방송실 장비 점검표", image: "assets/evidence-rooms/broadcast.png", position: "84% 58%" },
    R4B8X1M: { room: "방송실", roomId: "broadcast", index: 2, evidence: "AI 자료 열람 기록", image: "assets/evidence-rooms/broadcast.png", position: "18% 55%" },
    Z7N3P6D: { room: "미술실", roomId: "art", index: 1, evidence: "기말고사 유의사항 포스터 파일", image: "assets/evidence-rooms/art.png", position: "72% 46%" },
    L1V9T4C: { room: "미술실", roomId: "art", index: 2, evidence: "삭제된 AI 프롬프트 기록", image: "assets/evidence-rooms/art.png", position: "22% 70%" },
    H5Q2G8S: { room: "교무실", roomId: "office", index: 1, evidence: "교무실 앞 CCTV", image: "assets/evidence-rooms/office.png", position: "20% 16%" },
    B3K7J1W: { room: "교무실", roomId: "office", index: 2, evidence: "책상 위 기말고사 문제지", image: "assets/evidence-rooms/office.png", position: "62% 78%" },
    X6M4F9P: { room: "과학실", roomId: "science", index: 1, evidence: "실험 보고서 제출 기록", image: "assets/evidence-rooms/science.png", position: "31% 72%" },
    V2D8R5Y: { room: "과학실", roomId: "science", index: 2, evidence: "과학실 분실물함 기록", image: "assets/evidence-rooms/science.png", position: "76% 45%" },
    N7C3G1T: { room: "체육관", roomId: "gym", index: 1, evidence: "연습 노트", image: "assets/evidence-rooms/gym.png", position: "37% 76%" },
    P5W9K2M: { room: "체육관", roomId: "gym", index: 2, evidence: "AI의 USB 오인식 결과", image: "assets/evidence-rooms/gym.png", position: "72% 65%" }
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
    team: sessionStorage.getItem("kit-auth-team") || "",
    classId: sessionStorage.getItem("kit-class-section") || localStorage.getItem("kit-last-class-section") || "class-a",
    redeeming: false,
    evidenceCards: []
  };

  const creditCounts = [...document.querySelectorAll("[data-credit-count]")];
  const teamLabels = [...document.querySelectorAll("[data-team-label]")];
  const logCounts = [...document.querySelectorAll("[data-log-count]")];
  const refreshButtons = [...document.querySelectorAll("[data-refresh-credits]")];
  const evidenceForm = document.querySelector("[data-evidence-form]");
  const evidenceInput = document.querySelector("[data-evidence-code]");
  const evidenceSubmit = document.querySelector("[data-evidence-submit]");
  const evidenceMessage = document.querySelector("[data-evidence-message]");
  const studentLogList = document.querySelector("[data-student-log-list]");
  const evidenceBoard = document.querySelector("[data-evidence-board]");
  const evidenceBoardCount = document.querySelector("[data-evidence-board-count]");
  const caseNoteArea = document.querySelector("[data-note-key='case']");
  const caseNoteStatus = document.querySelector("[data-note-status='case']");
  const clearCaseNote = document.querySelector("[data-clear-note='case']");
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
      /해킹|크래킹|보안\s*우회|서버\s*뚫|비밀번호|패스워드|계정\s*탈취|관리자\s*권한/i,
      /usb\s*복제|유에스비\s*복제|복사\s*방법|훔치는\s*방법|악성\s*코드|랜섬웨어/i,
      /기록\s*삭제\s*방법|로그\s*삭제\s*방법|cctv\s*(삭제|지우|없애)|증거\s*(인멸|없애|삭제)/i
    ];
    const unsafe = [
      /자살|자해|죽고\s*싶|목\s*매|손목|투신/i,
      /전화번호|집\s*주소|주소\s*알려|주민등록|민증|개인정보|카톡\s*아이디|인스타\s*아이디/i,
      /성희롱|몰카|도촬|스토킹|괴롭히는\s*법|왕따\s*시키|따돌리는\s*법/i
    ];

    if (includesAny(raw, sexualOrProfane) || includesAny(compact, sexualOrProfane)) return safetyReplies.sexualOrProfane;
    if (includesAny(raw, aggressive) || includesAny(compact, aggressive)) return safetyReplies.aggressive;
    if (includesAny(raw, technicalCrime) || includesAny(compact, technicalCrime)) return safetyReplies.technicalCrime;
    if (includesAny(raw, unsafe) || includesAny(compact, unsafe)) return safetyReplies.unsafe;
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

  function cleanCode(value) {
    return String(value || "").replace(/[^a-z0-9]/gi, "").toUpperCase();
  }

  function safeHeaderValue(value) {
    const text = String(value || "").trim().replace(/[\r\n]/g, "");
    return /[^\u0000-\u00ff]/.test(text) ? encodeURIComponent(text) : text;
  }

  function setEvidenceMessage(text, type = "") {
    if (!evidenceMessage) return;
    evidenceMessage.textContent = text;
    evidenceMessage.classList.toggle("is-ok", type === "ok");
    evidenceMessage.classList.toggle("is-bad", type === "bad");
  }

  function evidenceStorageKey() {
    return `kit-evidence-cards:${state.classId}:${state.team || state.user || "guest"}`;
  }

  function noteStorageKey() {
    return `kit-case-note:${state.classId}:${state.team || state.user || "guest"}`;
  }

  function evidenceFromResponse(code, evidence = {}) {
    const clean = cleanCode(code);
    const catalog = evidenceCatalog[clean] || Object.values(evidenceCatalog).find((item) => {
      return item.room === evidence.room && item.evidence === evidence.evidence;
    }) || {};

    return {
      code: clean,
      room: evidence.room || catalog.room || "교실",
      roomId: catalog.roomId || "",
      index: Number(catalog.index) || Number(evidence.index) || 1,
      evidence: evidence.evidence || catalog.evidence || "증거카드",
      image: catalog.image || "",
      position: catalog.position || "center",
      at: new Date().toISOString()
    };
  }

  function loadEvidenceCards() {
    try {
      const saved = JSON.parse(localStorage.getItem(evidenceStorageKey()) || "[]");
      state.evidenceCards = Array.isArray(saved)
        ? saved
          .filter((card) => card?.code && card?.evidence)
          .map((card) => ({
            ...card,
            evidence: card.evidence === "강우진의 연습 노트" ? "연습 노트" : card.evidence
          }))
        : [];
    } catch {
      state.evidenceCards = [];
    }
  }

  function saveEvidenceCards() {
    localStorage.setItem(evidenceStorageKey(), JSON.stringify(state.evidenceCards));
  }

  function storeEvidenceCard(code, evidence) {
    const card = evidenceFromResponse(code, evidence);
    state.evidenceCards = [
      card,
      ...state.evidenceCards.filter((item) => item.code !== card.code)
    ].slice(0, 10);
    saveEvidenceCards();
    renderEvidenceBoard();
    return card;
  }

  function renderEvidenceBoard() {
    if (!evidenceBoard) return;
    evidenceBoard.textContent = "";
    if (evidenceBoardCount) evidenceBoardCount.textContent = `${state.evidenceCards.length}개`;

    if (!state.evidenceCards.length) {
      const empty = document.createElement("p");
      empty.className = "evidence-board-empty";
      empty.textContent = "아직 획득한 증거카드가 없습니다.";
      evidenceBoard.append(empty);
      return;
    }

    state.evidenceCards.forEach((card) => {
      const item = document.createElement("article");
      item.className = "evidence-board-card";

      const thumb = document.createElement("img");
      thumb.className = "evidence-board-thumb";
      thumb.src = card.image;
      thumb.alt = `${card.room} 증거 카드 ${card.index}`;
      thumb.style.objectPosition = card.position || "center";

      const body = document.createElement("div");
      body.className = "evidence-board-body";

      const meta = document.createElement("span");
      meta.textContent = `${card.room} · 증거 카드 ${card.index}`;

      const title = document.createElement("strong");
      title.textContent = card.evidence;

      body.append(meta, title);
      item.append(thumb, body);
      evidenceBoard.append(item);
    });
  }

  function setupCaseNote() {
    if (!caseNoteArea) return;
    caseNoteArea.value = localStorage.getItem(noteStorageKey()) || "";
    const setStatus = (text) => {
      if (caseNoteStatus) caseNoteStatus.textContent = text;
    };
    caseNoteArea.addEventListener("input", () => {
      localStorage.setItem(noteStorageKey(), caseNoteArea.value);
      setStatus("자동 저장");
    });
    clearCaseNote?.addEventListener("click", () => {
      caseNoteArea.value = "";
      localStorage.removeItem(noteStorageKey());
      setStatus("비움");
      caseNoteArea.focus();
    });
  }

  function updateEvidenceControls() {
    const disabled = state.redeeming || !state.team;
    if (evidenceInput) evidenceInput.disabled = disabled;
    if (evidenceSubmit) {
      evidenceSubmit.disabled = disabled;
      evidenceSubmit.textContent = state.redeeming ? "확인 중" : "입력";
    }
  }

  function setRefreshBusy(isBusy) {
    refreshButtons.forEach((button) => {
      button.disabled = isBusy || state.requesting || state.redeeming;
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
    updateEvidenceControls();
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
      const response = await fetch(`/api/credits?team=${encodeURIComponent(state.team)}&classId=${encodeURIComponent(state.classId)}`, {
        headers: {
          "x-kit-role": state.role,
          "x-kit-class": state.classId,
          "x-kit-team": encodeURIComponent(state.team),
          "x-kit-user": encodeURIComponent(state.user)
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

  async function submitEvidenceCode(event) {
    event.preventDefault();
    const code = cleanCode(evidenceInput?.value);
    if (evidenceInput) evidenceInput.value = code;

    if (!state.team) {
      setEvidenceMessage("학생 팀 정보가 없습니다.", "bad");
      updateEvidenceControls();
      return;
    }
    if (!code) {
      setEvidenceMessage("증거 코드를 입력하세요.", "bad");
      return;
    }

    state.redeeming = true;
    setEvidenceMessage("증거 코드 확인 중...", "");
    updateControls();

    try {
      const response = await fetch("/api/evidence-code", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-kit-role": "student",
          "x-kit-class": state.classId,
          "x-kit-team": encodeURIComponent(state.team),
          "x-kit-user": encodeURIComponent(state.user)
        },
        body: JSON.stringify({
          code,
          role: "student",
          classId: state.classId,
          team: state.team,
          user: state.user
        })
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        if (data.code === "ALREADY_REDEEMED" && data.evidence) {
          const card = storeEvidenceCard(code, data.evidence);
          setEvidenceMessage(`이미 사용한 코드입니다. ${card.room} 증거 카드 ${card.index}를 표시했습니다.`, "bad");
          if (evidenceInput) evidenceInput.value = "";
          return;
        }
        const message = data.code === "ALREADY_REDEEMED"
          ? "이미 사용한 증거 코드입니다."
          : data.code === "INVALID_EVIDENCE_CODE"
            ? "증거 코드가 맞지 않습니다."
            : data.error || "증거 코드를 확인하지 못했습니다.";
        throw new Error(message);
      }

      applyCredits(data.credits);
      const card = storeEvidenceCard(code, data.evidence);
      setEvidenceMessage(`${state.team}팀 질문권 ${Number(data.added || 3)}개 추가 · ${card.room} 증거 카드 ${card.index}`, "ok");
      if (evidenceInput) evidenceInput.value = "";
    } catch (error) {
      setEvidenceMessage(error.message || "증거 코드를 확인하지 못했습니다.", "bad");
      await refreshCredits();
    } finally {
      state.redeeming = false;
      updateControls();
    }
  }

  async function refreshApiStatus() {
    try {
      const response = await fetch("/api/status");
      const data = await response.json().catch(() => ({}));
      state.requiresAccessCode = Boolean(data.requiresAccessCode);

      if (data.provider === "openai" && data.hasOpenAiKey) {
        setApiStatus(data.requiresAccessCode && !state.accessCode ? "코드 필요" : "ChatGPT 준비됨", data.requiresAccessCode && !state.accessCode ? "bad" : "ok");
      } else if (data.provider === "openai") {
        setApiStatus("OpenAI 키 필요", "bad");
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
        "x-kit-role": state.role,
        "x-kit-class": state.classId,
        "x-kit-team": encodeURIComponent(state.team),
        "x-kit-user": encodeURIComponent(state.user)
      };
      if (state.accessCode) headers["x-class-code"] = safeHeaderValue(state.accessCode);

      const response = await fetch("/api/chat", {
        method: "POST",
        headers,
        body: JSON.stringify({
          suspect: panel.suspect,
          message: text,
          history: priorHistory,
          user: state.user,
          role: state.role,
          classId: state.classId,
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
    panel.history = panel.history.slice(-6);
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
  loadEvidenceCards();
  renderEvidenceBoard();
  setupCaseNote();
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

  evidenceInput?.addEventListener("input", () => {
    evidenceInput.value = cleanCode(evidenceInput.value);
  });
  evidenceForm?.addEventListener("submit", submitEvidenceCode);

  refreshButtons.forEach((button) => {
    button.addEventListener("click", refreshCredits);
  });

  refreshApiStatus();
})();
