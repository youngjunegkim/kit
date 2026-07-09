(function () {
  const page = document.body;
  if (!page?.classList.contains("room-page")) return;

  const suspects = {
    kangWoojin: {
      name: "강우진",
      image: "assets/characters/kang-woojin.png",
      alt: "강우진 인물 사진",
      greeting: "안녕하세요. 강우진입니다. 축구부 연습 끝나고 바로 불려와서 조금 당황했어요. 어떤 걸 확인하면 될까요?"
    },
    seoHarin: {
      name: "서하린",
      image: "assets/characters/ai-tech-girl.png",
      alt: "서하린 인물 사진",
      greeting: "안녕하세요. 서하린입니다. 제가 시스템 로그를 본 건 맞지만, 시험지를 유출했다는 뜻은 아니에요. 어떤 기록부터 확인할까요?"
    },
    choiDaniel: {
      name: "최다니엘",
      image: "assets/characters/alibi-black-boy.png",
      alt: "최다니엘 인물 사진",
      greeting: "안녕하세요. 최다니엘입니다. 제가 교무실 근처 복도에 있었던 건 맞지만, 교무실 안에 들어간 건 아니에요. 어떤 장면을 확인하고 싶으세요?"
    }
  };

  const teams = ["승우", "연수", "은혁", "영준", "혜빈", "윤지", "가빈", "채희"];
  const teamDisplayIds = Object.fromEntries(teams.map((team, index) => [team, String(index + 1)]));
  const evidenceRewardCredits = 2;
  const evidenceCatalog = {
    39275: { room: "방송실", roomId: "broadcast", index: 1, evidence: "방송실 장비 점검표", person: "서하린", image: "assets/evidence-crops/broadcast-1.png", position: "center" },
    26547: { room: "방송실", roomId: "broadcast", index: 2, evidence: "AI 자료 열람 기록", person: "서하린", image: "assets/evidence-crops/broadcast-2.png", position: "center" },
    65927: { room: "미술실", roomId: "art", index: 1, evidence: "기말고사 유의사항 포스터 파일", person: "서하린", image: "assets/evidence-crops/art-1.png", position: "center" },
    40018: { room: "미술실", roomId: "art", index: 2, evidence: "삭제된 AI 프롬프트 기록", person: "강우진", image: "assets/evidence-crops/art-2.png", position: "center" },
    91648: { room: "교무실", roomId: "office", index: 1, evidence: "CCTV에 찍힌 강우진의 태블릿", person: "강우진", image: "assets/evidence-crops/office-1.png", position: "center" },
    11582: { room: "교무실", roomId: "office", index: 2, evidence: "책상 위 기말고사 문제지", person: "강우진", image: "assets/evidence-crops/office-2.png", position: "center" },
    79610: { room: "과학실", roomId: "science", index: 1, evidence: "실험 보고서 제출 기록", person: "최다니엘", image: "assets/evidence-crops/science-1.png", position: "center" },
    61408: { room: "과학실", roomId: "science", index: 2, evidence: "과학실 분실물함 기록", person: "최다니엘", image: "assets/evidence-crops/science-2.png", position: "center" },
    87143: { room: "체육관", roomId: "gym", index: 1, evidence: "전교 1등 전 여자친구의 메시지", person: "강우진", image: "assets/evidence-crops/gym-1.png", position: "center" },
    13450: { room: "체육관", roomId: "gym", index: 2, evidence: "CCTV에 찍힌 최다니엘의 USB", person: "최다니엘", image: "assets/evidence-crops/gym-2.png", position: "center" }
  };

  const state = {
    roomId: page.dataset.roomId || "",
    roomName: page.dataset.roomName || "교실",
    user: sessionStorage.getItem("kit-auth-user") || "",
    role: sessionStorage.getItem("kit-auth-role") || "",
    team: sessionStorage.getItem("kit-auth-team") || "",
    classId: sessionStorage.getItem("kit-class-section") || localStorage.getItem("kit-last-class-section") || "class-a",
    accessCode: sessionStorage.getItem("class-access-code") || "",
    teacherCode: sessionStorage.getItem("kit-teacher-access-code") || "",
    credits: 0,
    count: 0,
    requesting: false,
    evidenceTeam: "",
    histories: {},
    evidenceStates: {},
    messages: {},
    currentSuspect: "kangWoojin"
  };

  const nodes = {
    creditCount: document.querySelector("[data-credit-count]"),
    logCount: document.querySelector("[data-log-count]"),
    teamLabel: document.querySelector("[data-team-label]"),
    roomLabel: document.querySelector("[data-room-label]"),
    apiStatus: document.querySelector("[data-api-status]"),
    evidenceForm: document.querySelector("[data-evidence-form]"),
    evidenceInput: document.querySelector("[data-evidence-code]"),
    evidenceMessage: document.querySelector("[data-evidence-message]"),
    evidenceSection: document.querySelector("[data-evidence-form]")?.closest(".side-section") || null,
    roomMain: document.querySelector(".room-main"),
    sceneFrame: document.querySelector(".scene-frame"),
    evidenceTeamSelect: null,
    evidenceTotalLabel: null,
    evidenceTotalCount: null,
    evidenceReveal: null,
    resetCreditsButton: null,
    suspectSelect: document.querySelector("[data-suspect-select]"),
    suspectPreview: null,
    suspectImage: null,
    suspectCaption: null,
    chatState: document.querySelector("[data-chat-state]"),
    messages: document.querySelector("[data-chat-messages]"),
    chatForm: document.querySelector("[data-chat-form]"),
    chatInput: document.querySelector("[data-chat-input]"),
    tokenCounter: document.querySelector("[data-token-counter]"),
    chatSubmit: document.querySelector("[data-chat-submit]")
  };
  const tokenEstimator = window.KitTokenEstimator || {
    DEFAULT_CHAT_TOKEN_LIMIT: 120,
    estimateTokens: (text) => Math.ceil(String(text || "").trim().length / 2) || 0
  };
  const chatTokenLimit = tokenEstimator.DEFAULT_CHAT_TOKEN_LIMIT || 120;
  const chatMaxInputChars = 800;

  function encoded(value) {
    return encodeURIComponent(String(value || ""));
  }

  function safeHeaderValue(value) {
    const text = String(value || "").trim().replace(/[\r\n]/g, "");
    return /[^\u0000-\u00ff]/.test(text) ? encodeURIComponent(text) : text;
  }

  function cleanCode(value) {
    return String(value || "").replace(/[^a-z0-9]/gi, "").toUpperCase();
  }

  function setText(node, text) {
    if (node) node.textContent = text;
  }

  function teamIdFor(team) {
    return teamDisplayIds[team] || String(team || "").trim();
  }

  function teamLabelFor(team) {
    const id = teamIdFor(team);
    return id ? `${id}번` : "학생";
  }

  function ensureTokenCounter() {
    if (!nodes.chatInput) return;
    nodes.chatInput.maxLength = chatMaxInputChars;
    nodes.chatInput.dataset.tokenLimit = String(chatTokenLimit);
    if (!nodes.tokenCounter) {
      const counter = document.createElement("span");
      counter.className = "token-counter";
      counter.dataset.tokenCounter = "";
      nodes.chatInput.after(counter);
      nodes.tokenCounter = counter;
    }
    updateTokenCounter();
  }

  function updateTokenCounter() {
    if (!nodes.chatInput || !nodes.tokenCounter) return;
    const limit = Number(nodes.chatInput.dataset.tokenLimit || chatTokenLimit);
    const count = tokenEstimator.estimateTokens(nodes.chatInput.value);
    nodes.tokenCounter.textContent = `${count}/${limit} 예상 토큰`;
    nodes.tokenCounter.classList.toggle("is-warn", count >= Math.floor(limit * 0.8) && count <= limit);
    nodes.tokenCounter.classList.toggle("is-full", count > limit);
    nodes.tokenCounter.title = "실제 모델 토큰과 완전히 같지는 않은 예상값입니다.";
  }

  function isOverTokenLimit() {
    return tokenEstimator.estimateTokens(nodes.chatInput?.value || "") > chatTokenLimit;
  }

  function setApiStatus(text, type = "") {
    setText(nodes.apiStatus, text);
    nodes.apiStatus?.classList.toggle("status-ok", type === "ok");
    nodes.apiStatus?.classList.toggle("status-bad", type === "bad");
  }

  function setEvidenceMessage(text, type = "") {
    setText(nodes.evidenceMessage, text);
    nodes.evidenceMessage?.classList.toggle("is-ok", type === "ok");
    nodes.evidenceMessage?.classList.toggle("is-bad", type === "bad");
  }

  function setChatState(text) {
    setText(nodes.chatState, text);
  }

  function ensureSuspect(suspectId) {
    const id = suspects[suspectId] ? suspectId : "kangWoojin";
    if (!state.messages[id]) {
      state.messages[id] = [{ role: "bot", text: suspects[id].greeting }];
    }
    if (!state.histories[id]) state.histories[id] = [];
    if (!state.evidenceStates[id]) state.evidenceStates[id] = null;
    return id;
  }

  function addMessage(suspectId, role, text) {
    const id = ensureSuspect(suspectId);
    state.messages[id].push({ role, text });
    if (id === state.currentSuspect) renderMessages();
  }

  function renderMessages() {
    if (!nodes.messages) return;
    const suspectId = ensureSuspect(state.currentSuspect);
    nodes.messages.textContent = "";

    state.messages[suspectId].forEach((message) => {
      const row = document.createElement("div");
      row.className = `message message--${message.role === "user" ? "user" : "bot"}`;

      const name = document.createElement("div");
      name.className = "message__name";
      name.textContent = message.role === "user" ? "조사단" : suspects[suspectId].name;

      const bubble = document.createElement("div");
      bubble.className = "message__bubble";
      bubble.textContent = message.text;

      row.append(name, bubble);
      nodes.messages.append(row);
    });

    nodes.messages.scrollTop = nodes.messages.scrollHeight;
  }

  function ensureSuspectPreview() {
    if (nodes.suspectPreview) return;
    const chatCard = document.querySelector(".chat-card");
    const chatHead = chatCard?.querySelector(".chat-head");
    if (!chatCard || !chatHead) return;

    const figure = document.createElement("figure");
    figure.className = "suspect-preview";
    figure.setAttribute("data-suspect-preview", "");

    const image = document.createElement("img");
    image.setAttribute("data-suspect-image", "");
    image.decoding = "async";

    const caption = document.createElement("figcaption");
    caption.setAttribute("data-suspect-caption", "");

    figure.append(image, caption);
    chatHead.after(figure);

    nodes.suspectPreview = figure;
    nodes.suspectImage = image;
    nodes.suspectCaption = caption;
  }

  function renderSuspectPreview() {
    ensureSuspectPreview();
    const suspectId = ensureSuspect(state.currentSuspect);
    const suspect = suspects[suspectId];
    if (nodes.suspectImage) {
      nodes.suspectImage.src = suspect.image;
      nodes.suspectImage.alt = suspect.alt;
    }
    setText(nodes.suspectCaption, suspect.name);
  }

  function placeTeacherEvidenceTools() {
    if (state.role !== "teacher" || !nodes.evidenceSection || !nodes.roomMain) return;
    if (nodes.evidenceSection.closest(".room-control-panel")) return;

    const panel = document.createElement("section");
    panel.className = "room-control-panel";
    panel.setAttribute("aria-label", "증거 코드 및 질문권 관리");
    nodes.evidenceSection.classList.add("room-control-panel__section");
    panel.append(nodes.evidenceSection);
    (nodes.sceneFrame || nodes.roomMain.lastElementChild)?.after(panel);
  }

  function removeTeacherEvidenceCodeTools() {
    if (state.role !== "teacher" && page.dataset.auth !== "teacher") return;

    nodes.evidenceSection?.remove();
    nodes.evidenceSection = null;
    nodes.evidenceForm = null;
    nodes.evidenceInput = null;
    nodes.evidenceMessage = null;
    nodes.evidenceTeamSelect = null;
    nodes.evidenceTotalLabel = null;
    nodes.evidenceTotalCount = null;
    nodes.evidenceReveal = null;
    nodes.resetCreditsButton = null;
  }

  function applyCredits(data = {}, team = state.team) {
    state.credits = Math.max(0, Number(data.credits) || 0);
    state.count = Math.max(0, Number(data.count ?? state.count) || 0);
    setText(nodes.creditCount, `${state.credits}개`);
    setText(nodes.logCount, `${state.count}회`);
    setEvidenceTotal(team, state.credits);
    updateControls();
  }

  function applyUsage(usage) {
    if (!usage) return;
    if (usage.count !== undefined) {
      state.count = Math.max(0, Number(usage.count) || 0);
      setText(nodes.logCount, `${state.count}회`);
    }
  }

  function updateControls() {
    const isTeacher = state.role === "teacher";
    const activeTeam = evidenceTeam();
    const noTeam = state.role === "student" && !activeTeam;
    const creditRequired = state.role === "student";
    const noCredits = creditRequired && state.credits <= 0;
    const chatLocked = state.requesting || noTeam || noCredits;
    const overTokenLimit = isOverTokenLimit();
    const canRedeemCode = (state.role === "student" && state.team) || (isTeacher && state.evidenceTeam);

    if (nodes.chatInput) {
      nodes.chatInput.disabled = chatLocked;
      nodes.chatInput.placeholder = noTeam
        ? "팀 선택이 필요합니다"
        : noCredits
          ? "질문권이 필요합니다"
          : `${suspects[state.currentSuspect].name}에게 질문`;
      updateTokenCounter();
    }
    if (nodes.chatSubmit) nodes.chatSubmit.disabled = chatLocked || overTokenLimit;
    if (nodes.suspectSelect) nodes.suspectSelect.disabled = state.requesting;

    const codeLocked = state.requesting || !canRedeemCode;
    if (nodes.evidenceInput) nodes.evidenceInput.disabled = codeLocked;
    if (nodes.evidenceTeamSelect) nodes.evidenceTeamSelect.disabled = state.requesting;
    const codeButton = nodes.evidenceForm?.querySelector("button");
    if (codeButton) codeButton.disabled = codeLocked;
    if (nodes.resetCreditsButton) nodes.resetCreditsButton.disabled = state.requesting || !activeTeam || state.credits <= 0;
  }

  function evidenceTeam() {
    return state.role === "teacher" ? state.evidenceTeam : state.team;
  }

  function evidenceStorageKey(team = evidenceTeam()) {
    return `kit-evidence-cards:${state.classId}:${team || state.user || "guest"}`;
  }

  function evidenceFromResponse(code, evidence = {}) {
    const clean = cleanCode(code);
    const catalog = evidenceCatalog[clean] || Object.values(evidenceCatalog).find((item) => {
      return item.room === evidence.room && item.evidence === evidence.evidence;
    }) || {};

    return {
      code: clean,
      room: evidence.room || catalog.room || state.roomName,
      roomId: catalog.roomId || state.roomId,
      index: Number(catalog.index) || Number(evidence.index) || 1,
      evidence: catalog.evidence || evidence.evidence || "증거카드",
      person: evidence.person || catalog.person || "",
      image: catalog.image || "",
      position: catalog.position || "center",
      at: new Date().toISOString()
    };
  }

  function loadEvidenceCards(team = evidenceTeam()) {
    try {
      const saved = JSON.parse(localStorage.getItem(evidenceStorageKey(team)) || "[]");
      return Array.isArray(saved) ? saved.filter((card) => card?.code && card?.evidence) : [];
    } catch {
      return [];
    }
  }

  function saveEvidenceCards(cards, team = evidenceTeam()) {
    localStorage.setItem(evidenceStorageKey(team), JSON.stringify(cards));
  }

  function evidenceCardsFromLogs(logs = []) {
    return logs
      .filter((entry) => entry?.code && entry?.evidence)
      .map((entry) => evidenceFromResponse(entry.code, {
        room: entry.room,
        evidence: entry.evidence,
        person: entry.person
      }));
  }

  async function syncEvidenceCardsWithServer(team = evidenceTeam()) {
    if (!team) return null;

    try {
      const response = await fetch(`/api/evidence-code?team=${encoded(team)}&classId=${encoded(state.classId)}`, {
        cache: "no-store",
        headers: {
          "x-kit-role": "student",
          "x-kit-class": state.classId,
          "x-kit-team": encoded(team),
          "x-kit-user": encoded(state.user)
        }
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !Array.isArray(data.evidenceLogs)) return null;

      const cards = evidenceCardsFromLogs(data.evidenceLogs);
      saveEvidenceCards(cards, team);
      if (team === evidenceTeam()) renderEvidenceReveal(cards);
      return cards;
    } catch {
      return null;
    }
  }

  function renderEvidenceReveal(cards = loadEvidenceCards()) {
    if (!nodes.evidenceReveal) return;
    const list = Array.isArray(cards) ? cards : cards ? [cards] : [];
    nodes.evidenceReveal.textContent = "";
    nodes.evidenceReveal.hidden = false;

    const title = document.createElement("h3");
    title.textContent = "획득한 증거카드";
    nodes.evidenceReveal.append(title);

    if (!list.length) {
      const empty = document.createElement("p");
      empty.className = "obtained-evidence-empty";
      empty.textContent = "아직 획득한 증거카드가 없습니다.";
      nodes.evidenceReveal.append(empty);
      return;
    }

    list.forEach((card) => {
      const body = document.createElement("article");
      body.className = "obtained-evidence-card";

      const image = document.createElement("img");
      image.src = card.image;
      image.alt = `${card.room} 증거 카드 ${card.index}`;
      image.style.objectPosition = card.position || "center";

      const info = document.createElement("div");
      const meta = document.createElement("span");
      meta.textContent = `${card.room} · 증거 카드 ${card.index}`;
      const text = document.createElement("strong");
      text.textContent = card.evidence;
      const person = document.createElement("em");
      person.textContent = card.person ? `관련 인물: ${card.person}` : "관련 인물: 확인 필요";

      info.append(meta, text, person);
      body.append(image, info);
      nodes.evidenceReveal.append(body);
    });
  }

  function storeEvidenceCard(code, evidence, team = evidenceTeam()) {
    const card = evidenceFromResponse(code, evidence);
    const cards = [
      card,
      ...loadEvidenceCards(team).filter((item) => item.code !== card.code)
    ].slice(0, 10);
    saveEvidenceCards(cards, team);
    renderEvidenceReveal(cards);
    return card;
  }

  function setEvidenceTotal(team, credits) {
    const label = team ? `${teamLabelFor(team)} 총 질문권` : "총 질문권";
    const value = credits === null || credits === undefined || Number.isNaN(Number(credits))
      ? "확인 중"
      : `${Math.max(0, Number(credits) || 0)}개`;
    setText(nodes.evidenceTotalLabel, label);
    setText(nodes.evidenceTotalCount, value);
    if (team && (state.role === "teacher" || team === state.team)) setText(nodes.teamLabel, teamIdFor(team));
    if (state.role === "teacher") {
      if (credits !== null && credits !== undefined && !Number.isNaN(Number(credits))) {
        state.credits = Math.max(0, Number(credits) || 0);
      }
      setText(nodes.creditCount, value);
    }
  }

  async function refreshEvidenceTotal(team = evidenceTeam()) {
    if (!team) {
      setEvidenceTotal("", null);
      return null;
    }

    setEvidenceTotal(team, null);
    try {
      const response = await fetch(`/api/credits?team=${encoded(team)}&classId=${encoded(state.classId)}`, {
        headers: {
          "x-kit-role": "student",
          "x-kit-class": state.classId,
          "x-kit-team": encoded(team),
          "x-kit-user": encoded(state.user)
        }
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "총 질문권 확인 실패");
      setEvidenceTotal(team, data.credits);
      state.count = Math.max(0, Number(data.count ?? state.count) || 0);
      setText(nodes.logCount, `${state.count}회`);
      updateControls();
      return data;
    } catch (error) {
      setText(nodes.evidenceTotalCount, "확인 실패");
      if (state.role === "teacher") setText(nodes.creditCount, "확인 실패");
      return null;
    }
  }

  async function refreshCredits() {
    if (!state.team) {
      if (state.role === "teacher") {
        await refreshEvidenceTotal(state.evidenceTeam);
      } else {
        setText(nodes.creditCount, "팀 없음");
        setEvidenceTotal("", null);
      }
      setText(nodes.logCount, "0회");
      updateControls();
      return;
    }

    try {
      const creditRole = state.role === "teacher" ? "student" : state.role;
      const response = await fetch(`/api/credits?team=${encoded(state.team)}&classId=${encoded(state.classId)}`, {
        headers: {
          "x-kit-role": creditRole,
          "x-kit-class": state.classId,
          "x-kit-team": encoded(state.team),
          "x-kit-user": encoded(state.user)
        }
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "질문권 확인 실패");
      applyCredits(data);
    } catch (error) {
      setText(nodes.creditCount, "확인 실패");
      setEvidenceMessage(error.message || "질문권을 확인하지 못했습니다.", "bad");
      updateControls();
    }
  }

  async function checkApiStatus() {
    try {
      const response = await fetch("/api/status", { cache: "no-store" });
      if (!response.ok) throw new Error("API unavailable");
      const data = await response.json().catch(() => ({}));
      if (data.provider === "openai" && data.hasOpenAiKey) {
        setApiStatus("ChatGPT 준비됨", "ok");
      } else if (data.provider === "openai") {
        setApiStatus("OpenAI 키 필요", "bad");
      } else {
        setApiStatus(data.provider || "준비됨", "ok");
      }
    } catch {
      setApiStatus("확인 필요", "bad");
    }
  }

  async function submitEvidenceCode(event) {
    event.preventDefault();
    const code = cleanCode(nodes.evidenceInput?.value);
    if (nodes.evidenceInput) nodes.evidenceInput.value = code;
    if (!code) {
      setEvidenceMessage("증거 코드를 입력하세요.", "bad");
      return;
    }

    state.requesting = true;
    updateControls();
    setEvidenceMessage("증거 코드 확인 중...", "");
    const targetTeam = evidenceTeam();

    try {
      const response = await fetch("/api/evidence-code", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-kit-role": "student",
          "x-kit-class": state.classId,
          "x-kit-team": encoded(targetTeam),
          "x-kit-user": encoded(state.user)
        },
        body: JSON.stringify({
          code,
          room: state.roomId,
          roomName: state.roomName,
          role: "student",
          classId: state.classId,
          team: targetTeam,
          user: state.user
        })
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        if (data.code === "ALREADY_REDEEMED" && data.evidence) {
          const card = storeEvidenceCard(code, data.evidence, targetTeam);
          const personText = card.person ? ` · 관련 인물: ${card.person}` : "";
          setEvidenceMessage(`이미 사용한 코드입니다. ${card.room} 증거 카드 ${card.index}${personText}`, "bad");
          if (nodes.evidenceInput) nodes.evidenceInput.value = "";
          return;
        }
        const message = data.code === "ALREADY_REDEEMED"
          ? "이미 사용한 증거 코드입니다."
          : data.code === "INVALID_EVIDENCE_CODE"
            ? "증거 코드가 맞지 않습니다."
            : data.error || "증거 코드를 확인하지 못했습니다.";
        throw new Error(message);
      }

      const card = storeEvidenceCard(code, data.evidence, targetTeam);
      const personText = card.person ? ` · 관련 인물: ${card.person}` : "";
      setEvidenceMessage(`${teamLabelFor(targetTeam)} 질문권 ${Number(data.added || evidenceRewardCredits)}개 추가 · ${card.room} 증거 카드 ${card.index}${personText}`, "ok");
      if (nodes.evidenceInput) nodes.evidenceInput.value = "";
      setEvidenceTotal(targetTeam, data.credits);
      if (state.role === "student") {
        applyCredits({ credits: data.credits, count: state.count });
      }
    } catch (error) {
      setEvidenceMessage(error.message || "증거 코드를 확인하지 못했습니다.", "bad");
      if (state.role === "student") await refreshCredits();
    } finally {
      state.requesting = false;
      updateControls();
    }
  }

  async function resetTeamCredits() {
    if (state.role !== "teacher") {
      setEvidenceMessage("받은 질문권 초기화는 선생님 계정에서만 가능합니다.", "bad");
      return;
    }

    const targetTeam = evidenceTeam();
    if (!targetTeam) {
      setEvidenceMessage("초기화할 팀을 선택하세요.", "bad");
      return;
    }
    const confirmed = window.confirm(`${teamLabelFor(targetTeam)}이 받은 질문권을 0개로 초기화할까요?`);
    if (!confirmed) return;

    state.requesting = true;
    updateControls();
    setEvidenceMessage("받은 질문권 초기화 중...", "");

    try {
      const response = await fetch("/api/credits", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-kit-role": state.role,
          "x-kit-class": state.classId,
          "x-kit-team": encoded(targetTeam),
          "x-kit-user": encoded(state.user)
        },
        body: JSON.stringify({
          action: "resetTeam",
          role: state.role,
          classId: state.classId,
          team: targetTeam,
          user: state.user
        })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "받은 질문권 초기화 실패");

      applyCredits({ credits: data.credits, count: data.count ?? state.count }, targetTeam);
      setEvidenceMessage(`${teamLabelFor(targetTeam)} 받은 질문권을 초기화했습니다.`, "ok");
    } catch (error) {
      setEvidenceMessage(error.message || "받은 질문권을 초기화하지 못했습니다.", "bad");
      await refreshCredits();
    } finally {
      state.requesting = false;
      updateControls();
    }
  }

  async function submitQuestion(event) {
    event.preventDefault();
    const suspectId = ensureSuspect(state.currentSuspect);
    const text = String(nodes.chatInput?.value || "").trim();
    if (!text || state.requesting) return;
    const tokenCount = tokenEstimator.estimateTokens(text);
    if (tokenCount > chatTokenLimit) {
      setChatState(`토큰 초과 ${tokenCount}/${chatTokenLimit}`);
      updateTokenCounter();
      return;
    }
    const targetTeam = evidenceTeam();

    if (state.role === "student" && !targetTeam) {
      setChatState("팀 선택 필요");
      updateControls();
      return;
    }

    if (state.role === "student" && state.credits <= 0) {
      setChatState("질문권 필요");
      updateControls();
      return;
    }

    if (nodes.chatInput) nodes.chatInput.value = "";
    updateTokenCounter();
    addMessage(suspectId, "user", text);
    addMessage(suspectId, "bot", "답변을 정리하고 있습니다...");
    const pending = state.messages[suspectId][state.messages[suspectId].length - 1];

    state.requesting = true;
    setChatState("응답 중");
    updateControls();

    let timeout = 0;
    try {
      const controller = new AbortController();
      timeout = window.setTimeout(() => controller.abort(), 30000);
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-kit-role": state.role,
          "x-kit-class": state.classId,
          "x-kit-team": encoded(targetTeam),
          "x-kit-user": encoded(state.user),
          "x-class-code": safeHeaderValue(state.accessCode),
          ...(state.role === "teacher" && state.teacherCode
            ? { "x-teacher-code": safeHeaderValue(state.teacherCode) }
            : {})
        },
        body: JSON.stringify({
          suspect: suspectId,
          message: text,
          history: state.histories[suspectId],
          evidenceState: state.evidenceStates[suspectId] || null,
          role: state.role,
          classId: state.classId,
          team: targetTeam,
          user: state.user
        }),
        signal: controller.signal
      });
      window.clearTimeout(timeout);
      timeout = 0;
      const data = await response.json().catch(() => ({}));
      if (data.evidenceState) state.evidenceStates[suspectId] = data.evidenceState;

      if (!response.ok) {
        if (data.code === "TEACHER_CODE_REQUIRED") {
          state.teacherCode = "";
          sessionStorage.removeItem("kit-teacher-access-code");
        }
        const message = data.code === "NO_CREDITS"
          ? "질문권이 부족합니다. 증거 코드를 입력해 질문권을 얻으세요."
          : data.code === "TEACHER_CODE_REQUIRED"
            ? "선생님 보안 코드가 필요합니다. 다시 입력해 주세요."
          : data.error || "답변을 받지 못했습니다.";
        throw new Error(message);
      }

      const reply = String(data.reply || "지금은 답변을 정리하기 어렵습니다. 질문을 다시 해 주세요.").trim();
      pending.text = reply;
      state.histories[suspectId].push(
        { role: "user", content: text },
        { role: "assistant", content: reply }
      );
      state.histories[suspectId] = state.histories[suspectId].slice(-6);
      if (data.credits) applyCredits({ credits: data.credits.remaining, count: state.count }, targetTeam);
      applyUsage(data.usage);
      setChatState("대기");
    } catch (error) {
      pending.text = error.name === "AbortError"
        ? "ChatGPT 응답이 30초 넘게 지연됐습니다. 잠시 후 다시 질문해 주세요."
        : error.message || "답변을 받지 못했습니다.";
      setChatState("확인 필요");
      await refreshCredits();
    } finally {
      if (timeout) window.clearTimeout(timeout);
      state.requesting = false;
      renderMessages();
      updateControls();
    }
  }

  function setup() {
    state.evidenceTeam = state.team || sessionStorage.getItem("kit-evidence-target-team") || teams[0];
    setText(nodes.teamLabel, state.team ? teamIdFor(state.team) : state.role === "teacher" ? "선생님" : "학생");
    setText(nodes.roomLabel, state.roomName);
    state.currentSuspect = ensureSuspect(nodes.suspectSelect?.value || "kangWoojin");
    removeTeacherEvidenceCodeTools();
    placeTeacherEvidenceTools();

    if (nodes.evidenceForm && !nodes.evidenceTotalCount) {
      const totalCard = document.createElement("div");
      totalCard.className = "credit-total-card";
      const totalLabel = document.createElement("span");
      const totalCount = document.createElement("strong");
      totalLabel.textContent = "총 질문권";
      totalCount.textContent = "확인 중";
      totalCard.append(totalLabel, totalCount);
      nodes.evidenceForm.after(totalCard);
      nodes.evidenceTotalLabel = totalLabel;
      nodes.evidenceTotalCount = totalCount;

      const reveal = document.createElement("div");
      reveal.className = "obtained-evidence";
      reveal.setAttribute("data-obtained-evidence", "");
      totalCard.after(reveal);
      nodes.evidenceReveal = reveal;
      renderEvidenceReveal(loadEvidenceCards());

      if (state.role === "teacher") {
        const resetButton = document.createElement("button");
        resetButton.className = "reset-credit-btn";
        resetButton.type = "button";
        resetButton.textContent = "받은 질문권 초기화";
        totalCard.after(resetButton);
        nodes.resetCreditsButton = resetButton;
        resetButton.addEventListener("click", resetTeamCredits);
      }
    }

    if (state.role === "teacher" && nodes.evidenceForm && !state.team) {
      const select = document.createElement("select");
      select.className = "team-select";
      select.setAttribute("aria-label", "질문권 적립 대상");
      teams.forEach((team) => {
        const option = document.createElement("option");
        option.value = team;
        option.textContent = teamLabelFor(team);
        select.append(option);
      });
      select.value = teams.includes(state.evidenceTeam) ? state.evidenceTeam : teams[0];
      state.evidenceTeam = select.value;
      select.addEventListener("change", () => {
        state.evidenceTeam = select.value;
        sessionStorage.setItem("kit-evidence-target-team", state.evidenceTeam);
        renderEvidenceReveal(loadEvidenceCards(state.evidenceTeam));
        syncEvidenceCardsWithServer(state.evidenceTeam);
        refreshEvidenceTotal(state.evidenceTeam);
      });
      nodes.evidenceTeamSelect = select;
      nodes.evidenceForm.classList.add("code-form--teacher");
      nodes.evidenceForm.prepend(select);
      setEvidenceMessage("선생님 계정은 적립할 팀을 먼저 선택하세요.", "");
    }

    nodes.suspectSelect?.addEventListener("change", () => {
      state.currentSuspect = ensureSuspect(nodes.suspectSelect.value);
      setChatState("대기");
      renderSuspectPreview();
      renderMessages();
      updateControls();
    });

    nodes.evidenceInput?.addEventListener("input", () => {
      nodes.evidenceInput.value = cleanCode(nodes.evidenceInput.value);
    });
    nodes.evidenceForm?.addEventListener("submit", submitEvidenceCode);
    ensureTokenCounter();
    nodes.chatInput?.addEventListener("input", updateTokenCounter);
    nodes.chatForm?.addEventListener("submit", submitQuestion);

    renderSuspectPreview();
    renderMessages();
    updateControls();
    if (nodes.evidenceReveal) {
      syncEvidenceCardsWithServer();
      window.setInterval(() => {
        syncEvidenceCardsWithServer();
      }, 15000);
    }
    refreshCredits();
    checkApiStatus();
  }

  document.addEventListener("DOMContentLoaded", setup);
})();
