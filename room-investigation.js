(function () {
  const page = document.body;
  if (!page?.classList.contains("room-page")) return;

  const suspects = {
    kangWoojin: {
      name: "강우진",
      greeting: "안녕하세요. 강우진입니다. 축구부 연습 끝나고 바로 불려와서 조금 당황했어요. 어떤 걸 확인하면 될까요?"
    },
    seoHarin: {
      name: "서하린",
      greeting: "안녕하세요. 서하린입니다. 제가 시스템 로그를 본 건 맞지만, 시험지를 유출했다는 뜻은 아니에요. 어떤 기록부터 확인할까요?"
    },
    choiDaniel: {
      name: "최다니엘",
      greeting: "안녕하세요. 최다니엘입니다. 제가 교무실 근처 복도에 있었던 건 맞지만, 교무실 안에 들어간 건 아니에요. 어떤 장면을 확인하고 싶으세요?"
    }
  };

  const state = {
    roomId: page.dataset.roomId || "",
    roomName: page.dataset.roomName || "교실",
    user: sessionStorage.getItem("kit-auth-user") || "",
    role: sessionStorage.getItem("kit-auth-role") || "",
    team: sessionStorage.getItem("kit-auth-team") || "",
    accessCode: sessionStorage.getItem("class-access-code") || "",
    credits: 0,
    count: 0,
    requesting: false,
    histories: {},
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
    suspectSelect: document.querySelector("[data-suspect-select]"),
    chatState: document.querySelector("[data-chat-state]"),
    messages: document.querySelector("[data-chat-messages]"),
    chatForm: document.querySelector("[data-chat-form]"),
    chatInput: document.querySelector("[data-chat-input]"),
    chatSubmit: document.querySelector("[data-chat-submit]")
  };

  function encoded(value) {
    return encodeURIComponent(String(value || ""));
  }

  function cleanCode(value) {
    return String(value || "").replace(/[^a-z0-9]/gi, "").toUpperCase();
  }

  function setText(node, text) {
    if (node) node.textContent = text;
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

  function applyCredits(data = {}) {
    state.credits = Math.max(0, Number(data.credits) || 0);
    state.count = Math.max(0, Number(data.count ?? state.count) || 0);
    setText(nodes.creditCount, `${state.credits}개`);
    setText(nodes.logCount, `${state.count}회`);
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
    const isStudent = state.role === "student";
    const noStudentTeam = isStudent && !state.team;
    const noCredits = isStudent && state.credits <= 0;
    const chatLocked = state.requesting || noStudentTeam || noCredits;

    if (nodes.chatInput) {
      nodes.chatInput.disabled = chatLocked;
      nodes.chatInput.placeholder = noStudentTeam
        ? "학생 팀 정보가 필요합니다"
        : noCredits
          ? "증거 코드로 질문권을 얻으세요"
          : `${suspects[state.currentSuspect].name}에게 질문`;
    }
    if (nodes.chatSubmit) nodes.chatSubmit.disabled = chatLocked;
    if (nodes.suspectSelect) nodes.suspectSelect.disabled = state.requesting;

    const codeLocked = state.requesting || !isStudent || noStudentTeam;
    if (nodes.evidenceInput) nodes.evidenceInput.disabled = codeLocked;
    const codeButton = nodes.evidenceForm?.querySelector("button");
    if (codeButton) codeButton.disabled = codeLocked;
  }

  async function refreshCredits() {
    if (!state.team) {
      setText(nodes.creditCount, "팀 없음");
      setText(nodes.logCount, "0회");
      updateControls();
      return;
    }

    try {
      const response = await fetch(`/api/credits?team=${encoded(state.team)}`, {
        headers: {
          "x-kit-role": state.role,
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
      setApiStatus("준비됨", "ok");
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

    try {
      const response = await fetch("/api/evidence-code", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-kit-role": state.role,
          "x-kit-team": encoded(state.team),
          "x-kit-user": encoded(state.user)
        },
        body: JSON.stringify({
          code,
          room: state.roomId,
          roomName: state.roomName,
          role: state.role,
          team: state.team,
          user: state.user
        })
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        const message = data.code === "ALREADY_REDEEMED"
          ? "이미 사용한 증거 코드입니다."
          : data.code === "INVALID_EVIDENCE_CODE"
            ? "증거 코드가 맞지 않습니다."
            : data.error || "증거 코드를 확인하지 못했습니다.";
        throw new Error(message);
      }

      setEvidenceMessage(`${data.evidence.room} - ${data.evidence.evidence}: 질문권 3개 추가`, "ok");
      if (nodes.evidenceInput) nodes.evidenceInput.value = "";
      applyCredits({ credits: data.credits, count: state.count });
    } catch (error) {
      setEvidenceMessage(error.message || "증거 코드를 확인하지 못했습니다.", "bad");
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

    if (state.role === "student" && state.credits <= 0) {
      setChatState("질문권 필요");
      updateControls();
      return;
    }

    if (nodes.chatInput) nodes.chatInput.value = "";
    addMessage(suspectId, "user", text);
    addMessage(suspectId, "bot", "답변을 정리하고 있습니다...");
    const pending = state.messages[suspectId][state.messages[suspectId].length - 1];

    state.requesting = true;
    setChatState("응답 중");
    updateControls();

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-kit-role": state.role,
          "x-kit-team": encoded(state.team),
          "x-kit-user": encoded(state.user),
          "x-class-code": state.accessCode
        },
        body: JSON.stringify({
          suspect: suspectId,
          message: text,
          history: state.histories[suspectId],
          role: state.role,
          team: state.team,
          user: state.user
        })
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        const message = data.code === "NO_CREDITS"
          ? "질문권이 부족합니다. 증거 코드를 입력해 질문권을 얻으세요."
          : data.error || "답변을 받지 못했습니다.";
        throw new Error(message);
      }

      const reply = String(data.reply || "지금은 답변을 정리하기 어렵습니다. 질문을 다시 해 주세요.").trim();
      pending.text = reply;
      state.histories[suspectId].push(
        { role: "user", content: text },
        { role: "assistant", content: reply }
      );
      state.histories[suspectId] = state.histories[suspectId].slice(-12);
      if (data.credits) applyCredits({ credits: data.credits.remaining, count: state.count });
      applyUsage(data.usage);
      setChatState("대기");
    } catch (error) {
      pending.text = error.message || "답변을 받지 못했습니다.";
      setChatState("확인 필요");
      await refreshCredits();
    } finally {
      state.requesting = false;
      renderMessages();
      updateControls();
    }
  }

  function setup() {
    setText(nodes.teamLabel, state.team ? `${state.team}팀` : "학생");
    setText(nodes.roomLabel, state.roomName);
    state.currentSuspect = ensureSuspect(nodes.suspectSelect?.value || "kangWoojin");

    nodes.suspectSelect?.addEventListener("change", () => {
      state.currentSuspect = ensureSuspect(nodes.suspectSelect.value);
      setChatState("대기");
      renderMessages();
      updateControls();
    });

    nodes.evidenceInput?.addEventListener("input", () => {
      nodes.evidenceInput.value = cleanCode(nodes.evidenceInput.value);
    });
    nodes.evidenceForm?.addEventListener("submit", submitEvidenceCode);
    nodes.chatForm?.addEventListener("submit", submitQuestion);

    renderMessages();
    updateControls();
    refreshCredits();
    checkApiStatus();
  }

  document.addEventListener("DOMContentLoaded", setup);
})();
