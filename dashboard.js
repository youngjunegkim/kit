(function () {
  const classId = "class-a";
  const draftKey = `kit-student-question-credit-additions:${classId}`;
  const teams = ["january", "february", "march", "april", "may", "june", "july", "august"];
  const teamDisplayIds = Object.fromEntries(teams.map((team, index) => [team, String(index + 1)]));
  const emptyByTeam = Object.fromEntries(teams.map((team) => [team, 0]));
  const rooms = [
    { id: "broadcast", name: "방송실" },
    { id: "art", name: "미술실" },
    { id: "office", name: "교무실" },
    { id: "science", name: "과학실" },
    { id: "gym", name: "체육관" }
  ];
  const user = sessionStorage.getItem("kit-auth-user") || "";
  const role = sessionStorage.getItem("kit-auth-role") || "";
  let syncStatus = null;
  let remainingCredits = { ...emptyByTeam };
  let grantedCredits = { ...emptyByTeam };
  let questionCounts = { ...emptyByTeam };
  let questionLogs = [];
  let evidenceLogs = [];
  let evidenceRoomCounts = new Map();
  let evidenceGrants = {};
  let activeTeamCount = teams.length;
  let gameSession = null;
  let gameResults = [];

  function cleanScore(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) return 0;
    return Math.max(0, Math.round(number));
  }

  function cleanTeamMap(map = {}) {
    return Object.fromEntries(teams.map((team) => [team, cleanScore(map[team])]));
  }

  function teamIdFor(team) {
    return teamDisplayIds[team] || String(team || "").trim();
  }

  function teamLabelFor(team) {
    const id = teamIdFor(team);
    return id ? `${id}팀` : "학생";
  }

  function activeTeams() {
    return teams.slice(0, activeTeamCount);
  }

  function applyActiveTeamCount(value) {
    activeTeamCount = Math.min(teams.length, Math.max(1, Math.round(Number(value) || teams.length)));
    const active = new Set(activeTeams());
    document.querySelectorAll("[data-score-input]").forEach((input) => {
      const enabled = active.has(input.dataset.scoreInput);
      const row = input.closest(".team-row");
      if (row) row.hidden = !enabled;
      input.disabled = !enabled;
      if (!enabled) pendingAdds[input.dataset.scoreInput] = 0;
    });
    saveDraftAdds(pendingAdds);
    populateGrantSelects();
  }

  function applyTeamDisplayLabels() {
    teams.forEach((team) => {
      const input = document.querySelector(`[data-score-input="${team}"]`);
      const row = input?.closest(".team-row");
      const id = teamIdFor(team);
      const label = teamLabelFor(team);

      const badge = row?.querySelector(".team-badge");
      if (badge) badge.textContent = id;

      const name = row?.querySelector(".team-name");
      if (name) name.textContent = label;

      const meta = row?.querySelector(".team-meta");
      if (meta) meta.setAttribute("aria-label", `${label} 코인 현황`);

      if (input) input.setAttribute("aria-label", `${label} 추가할 코인`);
    });
  }

  function loadDraftAdds() {
    try {
      return cleanTeamMap(JSON.parse(localStorage.getItem(draftKey)) || {});
    } catch {
      return { ...emptyByTeam };
    }
  }

  function saveDraftAdds(additions) {
    localStorage.setItem(draftKey, JSON.stringify(additions));
  }

  function totalAdditions(additions = pendingAdds) {
    return Object.values(additions).reduce((sum, value) => sum + cleanScore(value), 0);
  }

  let pendingAdds = loadDraftAdds();

  function ensureSyncStatus() {
    if (syncStatus) return syncStatus;
    const scoreHead = document.querySelector(".score-head");
    if (!scoreHead) return null;
    syncStatus = document.createElement("p");
    syncStatus.className = "score-sync-status";
    syncStatus.textContent = "추가할 코인 수를 입력한 뒤 코인 추가를 누르세요.";
    scoreHead.insertAdjacentElement("afterend", syncStatus);
    return syncStatus;
  }

  function setSyncStatus(text, type = "") {
    const node = ensureSyncStatus();
    if (!node) return;
    node.textContent = text;
    node.classList.toggle("score-sync-status--ok", type === "ok");
    node.classList.toggle("score-sync-status--bad", type === "bad");
  }

  function authHeaders() {
    const headers = {
      "content-type": "application/json",
      "x-kit-user": user,
      "x-kit-role": role,
      "x-kit-class": classId
    };
    return headers;
  }

  async function requestCredits(url, options = {}) {
    const response = await fetch(url, {
      ...options,
      headers: {
        ...authHeaders(),
        ...(options.headers || {})
      }
    });
    const data = await response.json().catch(() => ({}));

    return { response, data };
  }

  function formatSessionDate(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "시작 전";
    return date.toLocaleString("ko-KR", {
      month: "numeric",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  }

  function setGameSessionStatus(text, type = "") {
    const node = document.getElementById("gameSessionStatus");
    if (!node) return;
    node.textContent = text;
    node.classList.toggle("is-ok", type === "ok");
    node.classList.toggle("is-bad", type === "bad");
  }

  function renderGameResults() {
    const list = document.getElementById("gameSessionResults");
    if (!list) return;
    list.replaceChildren();
    if (!gameResults.length) {
      const empty = document.createElement("p");
      empty.className = "game-result-empty";
      empty.textContent = "저장된 결과가 없습니다.";
      list.append(empty);
      return;
    }

    gameResults.forEach((result) => {
      const details = document.createElement("details");
      details.className = "game-result-entry";
      const summary = document.createElement("summary");
      const title = document.createElement("span");
      title.textContent = `${result.sessionNumber || 1}회차 · ${result.teamCount || result.teams?.length || 1}팀`;
      const date = document.createElement("span");
      date.textContent = formatSessionDate(result.savedAt);
      summary.append(title, date);

      const totals = result.totals || {};
      const total = document.createElement("p");
      total.className = "game-result-summary";
      total.textContent = `질문 ${cleanScore(totals.questions)}회 · 증거 ${cleanScore(totals.evidenceCards)}장 · 윤리퀴즈 ${cleanScore(totals.ethicsSolved)}개`;

      const teamList = document.createElement("div");
      teamList.className = "game-result-teams";
      (Array.isArray(result.teams) ? result.teams : []).forEach((team) => {
        const row = document.createElement("span");
        row.textContent = `${teamLabelFor(team.team)} · 코인 ${cleanScore(team.credits)}개 · 질문 ${cleanScore(team.questions)}회 · 증거 ${cleanScore(team.evidenceCards)}장 · 퀴즈 ${cleanScore(team.ethicsSolved)}개${team.finalNote ? " · 사건노트 제출" : ""}`;
        teamList.append(row);
      });
      details.append(summary, total, teamList);
      list.append(details);
    });
  }

  function applyGameSessionData(data = {}) {
    if (data.session && typeof data.session === "object") gameSession = data.session;
    if (Array.isArray(data.results)) gameResults = data.results;
    if (!gameSession) return;
    applyActiveTeamCount(gameSession.teamCount);
    const current = document.getElementById("gameSessionCurrent");
    const started = document.getElementById("gameSessionStarted");
    const select = document.getElementById("gameTeamCount");
    if (current) current.textContent = `${gameSession.number || 1}회차 · ${activeTeamCount}팀`;
    if (started) started.textContent = formatSessionDate(gameSession.startedAt);
    if (select) select.value = String(activeTeamCount);
    renderScores();
    renderQuestionStats();
    renderEvidenceLogs();
    renderGrants();
    renderEvidenceRoomCounts();
    renderGameResults();
  }

  async function fetchGameSessions() {
    const { response, data } = await requestCredits("/api/credits?gameSessions=1");
    if (!response.ok || !data.session) {
      throw new Error(data.error || "게임 회차 정보를 불러오지 못했습니다.");
    }
    applyGameSessionData(data);
    setGameSessionStatus(data.persistent ? "회차 정보를 불러왔습니다." : "공유 저장소가 연결되지 않았습니다.", data.persistent ? "ok" : "bad");
    return data;
  }

  async function postGameSession(action, extra = {}) {
    const { response, data } = await requestCredits("/api/credits", {
      method: "POST",
      body: JSON.stringify({ action, ...extra })
    });
    if (!response.ok || !data.ok) {
      throw new Error(data.error || "게임 회차를 처리하지 못했습니다.");
    }
    return data;
  }

  async function applyGameTeamCount() {
    const teamCount = cleanScore(document.getElementById("gameTeamCount")?.value);
    const data = await postGameSession("gameSessionTeamCount", { teamCount });
    applyGameSessionData(data);
    setGameSessionStatus(`${teamCount}팀으로 적용했습니다.`, "ok");
  }

  async function saveGameSessionResult() {
    const data = await postGameSession("gameSessionSave");
    applyGameSessionData(data);
    setGameSessionStatus(`${data.result?.sessionNumber || gameSession?.number || 1}회차 결과를 저장했습니다.`, "ok");
  }

  async function startNewGameSession() {
    const teamCount = cleanScore(document.getElementById("gameTeamCount")?.value);
    const currentNumber = gameSession?.number || 1;
    const prompt = gameSession?.startedAt
      ? `현재 ${currentNumber}회차 결과를 저장하고 ${teamCount}팀으로 새 게임을 시작할까요? 코인, 증거카드, 승인, 윤리퀴즈 진행과 사건노트가 초기화됩니다.`
      : `${teamCount}팀으로 ${currentNumber}회차 게임을 시작할까요? 기존 진행 데이터가 있다면 결과로 저장한 뒤 초기화됩니다.`;
    const confirmed = window.confirm(prompt);
    if (!confirmed) return;
    const data = await postGameSession("gameSessionNew", { teamCount });
    applyGameSessionData({ session: data.session, results: data.history });
    remainingCredits = { ...emptyByTeam };
    grantedCredits = { ...emptyByTeam };
    questionCounts = { ...emptyByTeam };
    questionLogs = [];
    evidenceLogs = [];
    evidenceGrants = {};
    pendingAdds = { ...emptyByTeam };
    saveDraftAdds(pendingAdds);
    renderScores();
    renderQuestionStats();
    renderEvidenceLogs();
    renderGrants();
    renderEvidenceRoomCounts();
    setGameSessionStatus(`${data.session?.number || 1}회차 새 게임을 시작했습니다.`, "ok");
    setSyncStatus("새 게임 진행 데이터가 초기화되었습니다.", "ok");
  }

  function applyCreditData(data = {}) {
    remainingCredits = cleanTeamMap(data.credits || {});
    questionCounts = cleanTeamMap(data.counts || {});
    const fallbackGranted = Object.fromEntries(teams.map((team) => [
      team,
      cleanScore(remainingCredits[team] + questionCounts[team])
    ]));
    grantedCredits = cleanTeamMap({ ...fallbackGranted, ...(data.granted || {}) });
  }

  function setMetricText(attribute, team, text) {
    document.querySelectorAll(`[${attribute}="${team}"]`).forEach((node) => {
      node.textContent = text;
    });
  }

  function renderScores() {
    teams.forEach((team) => {
      const input = document.querySelector(`[data-score-input="${team}"]`);
      if (input && document.activeElement !== input) {
        input.value = pendingAdds[team] || "";
      }
      setMetricText("data-granted-count", team, `부여 ${grantedCredits[team] || 0}개`);
      setMetricText("data-used-count", team, `사용 ${questionCounts[team] || 0}개`);
      setMetricText("data-remaining-count", team, `남은 ${remainingCredits[team] || 0}개`);
    });
  }

  function formatLogTime(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return date.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });
  }

  function renderQuestionStats() {
    const usage = document.getElementById("questionUsage");
    if (usage) {
      usage.textContent = "";
      activeTeams().forEach((team) => {
        const row = document.createElement("div");
        row.className = "usage-row";

        const name = document.createElement("span");
        name.textContent = teamIdFor(team);

        const count = document.createElement("strong");
        count.textContent = `사용 ${questionCounts[team] || 0}개`;

        const detail = document.createElement("small");
        detail.textContent = `부여 ${grantedCredits[team] || 0}개 · 남은 ${remainingCredits[team] || 0}개`;

        row.append(name, count, detail);
        usage.append(row);
      });
    }

    const logList = document.getElementById("questionLogList");
    if (!logList) return;
    logList.textContent = "";

    const activeQuestionLogs = questionLogs.filter((entry) => activeTeams().includes(entry.team));
    if (!activeQuestionLogs.length) {
      const empty = document.createElement("p");
      empty.className = "log-empty";
      empty.textContent = "아직 질문 로그가 없습니다.";
      logList.append(empty);
      return;
    }

    activeQuestionLogs.slice(0, 16).forEach((entry) => {
      const item = document.createElement("article");
      item.className = "log-entry";

      const meta = document.createElement("div");
      meta.className = "log-entry__meta";
      meta.textContent = `${teamLabelFor(entry.team || entry.user)} · ${formatLogTime(entry.at)} · ${entry.count || 0}번째`;

      const text = document.createElement("p");
      text.textContent = entry.message || "질문 내용 없음";

      item.append(meta, text);
      logList.append(item);
    });
  }

  function renderEvidenceLogs() {
    const list = document.getElementById("evidenceRedeemList");
    if (!list) return;
    list.textContent = "";

    const activeLogs = evidenceLogs.filter((entry) => activeTeams().includes(entry.team));
    if (!activeLogs.length) {
      const empty = document.createElement("p");
      empty.className = "evidence-redeem-empty";
      empty.textContent = "아직 입력된 증거코드가 없습니다.";
      list.append(empty);
      return;
    }

    activeLogs.slice(0, 20).forEach((entry) => {
      const item = document.createElement("article");
      item.className = "evidence-redeem-entry";

      const meta = document.createElement("div");
      meta.className = "evidence-redeem-entry__meta";
      const rawDelta = entry.delta !== undefined ? Number(entry.delta) : Number(entry.added || 1);
      const delta = Number.isFinite(rawDelta) ? Math.round(rawDelta) : 0;
      const deltaText = delta > 0 ? `+${delta}개` : delta < 0 ? `${delta}개` : "변동 없음";
      meta.textContent = `${teamLabelFor(entry.team)} · ${formatLogTime(entry.at)} · ${deltaText}`;

      const text = document.createElement("p");
      text.textContent = entry.room === "황금열쇠"
        ? `${entry.evidence || "황금열쇠 카드"} 적용 · 코인 ${deltaText}`
        : `증거코드 입력 완료 · 코인 ${deltaText}`;

      item.append(meta, text);
      list.append(item);
    });
  }

  async function fetchScores() {
    const { response, data } = await requestCredits("/api/credits");
    if (!response.ok || !data.credits) {
      throw new Error(data.error || "코인 현황 불러오기 실패");
    }
    applyCreditData(data);
    questionLogs = Array.isArray(data.logs) ? data.logs : [];
    await fetchEvidenceLogs();
    renderScores();
    renderQuestionStats();
    setSyncStatus(data.persistent ? "코인 현황을 불러왔습니다." : "공유 저장소 미연결: Vercel에 Upstash 환경변수가 필요합니다.", data.persistent ? "ok" : "bad");
  }

  async function fetchEvidenceLogs() {
    const { response, data } = await requestCredits("/api/evidence-code");
    if (!response.ok) {
      throw new Error(data.error || "증거코드 입력 기록 불러오기 실패");
    }
    evidenceLogs = Array.isArray(data.evidenceLogs) ? data.evidenceLogs : [];
    applyGrants(data);
    renderEvidenceLogs();
    renderEvidenceRoomCounts();
    return data;
  }

  async function publishScores() {
    const amounts = cleanTeamMap(pendingAdds);
    teams.slice(activeTeamCount).forEach((team) => { amounts[team] = 0; });
    const total = totalAdditions(amounts);
    if (!total) {
      setSyncStatus("추가할 코인 수를 입력하세요.");
      return;
    }

    setSyncStatus("코인을 추가하는 중입니다...");
    const { response, data } = await requestCredits("/api/credits", {
      method: "POST",
      body: JSON.stringify({
        action: "addAll",
        amounts
      })
    });
    if (!response.ok) {
      throw new Error(data.error || "코인 추가 실패");
    }
    applyCreditData(data);
    questionLogs = Array.isArray(data.logs) ? data.logs : questionLogs;
    pendingAdds = { ...emptyByTeam };
    saveDraftAdds(pendingAdds);
    renderScores();
    renderQuestionStats();
    setSyncStatus(
      data.persistent
        ? `코인 ${total}개 추가 완료. 학생은 코인 받기를 누르면 반영됩니다.`
        : `임시 추가 완료(${total}개): 여러 기기 공유에는 Upstash 환경변수가 필요합니다.`,
      data.persistent ? "ok" : "bad"
    );
  }

  async function resetServerScores() {
    const { response, data } = await requestCredits("/api/credits", {
      method: "POST",
      body: JSON.stringify({ action: "reset" })
    });
    if (!response.ok) {
      throw new Error(data.error || "코인 초기화 실패");
    }
    applyCreditData(data);
    questionLogs = Array.isArray(data.logs) ? data.logs : questionLogs;
    pendingAdds = { ...emptyByTeam };
    saveDraftAdds(pendingAdds);
    renderScores();
    renderQuestionStats();
    setSyncStatus(data.persistent ? "부여한 코인과 남은 코인이 초기화됨" : "임시 초기화됨: Vercel에 Upstash 환경변수가 필요합니다.", data.persistent ? "ok" : "bad");
  }

  async function clearServerLogs() {
    const { response, data } = await requestCredits("/api/credits", {
      method: "POST",
      body: JSON.stringify({ action: "clearLogs" })
    });
    if (!response.ok) {
      throw new Error(data.error || "로그 삭제 실패");
    }
    applyCreditData(data);
    questionLogs = Array.isArray(data.logs) ? data.logs : [];
    renderScores();
    renderQuestionStats();
    setSyncStatus(data.persistent ? "질문 로그 삭제됨" : "임시 로그 삭제됨: Vercel에 Upstash 환경변수가 필요합니다.", data.persistent ? "ok" : "bad");
  }

  async function clearEvidenceLogs() {
    const confirmed = window.confirm("이번 반의 학생용 증거카드, 증거코드 입력 기록, 승인 대기와 증거카드 획득 횟수, 해당 증거코드로 받은 코인을 모두 초기화할까요? 다음 게임을 시작하기 전 사용하는 기능입니다.");
    if (!confirmed) return;

    const { response, data } = await requestCredits("/api/evidence-code", {
      method: "POST",
      body: JSON.stringify({
        action: "clear",
        resetCredits: true
      })
    });
    if (!response.ok) {
      throw new Error(data.error || "증거코드 입력 초기화 실패");
    }

    evidenceLogs = [];
    applyGrants(data);
    renderEvidenceLogs();
    renderEvidenceRoomCounts();
    if (data.credits) {
      applyCreditData({ credits: data.credits, granted: data.granted, counts: questionCounts });
      renderScores();
      renderQuestionStats();
    } else {
      await fetchScores();
    }
    setSyncStatus(`증거카드 획득 기록 ${data.removed || 0}건, 승인 대기 ${data.clearedGrants || 0}팀과 해당 코인을 초기화했습니다. 학생은 코인 받기/증거 받기를 누르면 화면이 비워집니다.`, data.persistent ? "ok" : "bad");
  }

  function startScoreSync() {
    fetchScores().catch((error) => {
      renderScores();
      setSyncStatus(error.message || "코인 현황 불러오기 실패", "bad");
    });
  }

  function populateGrantSelects() {
    const teamSelect = document.getElementById("grantTeamSelect");
    if (teamSelect) {
      const selected = teamSelect.value;
      teamSelect.replaceChildren();
      activeTeams().forEach((team) => {
        const option = document.createElement("option");
        option.value = team;
        option.textContent = teamLabelFor(team);
        teamSelect.append(option);
      });
      if (activeTeams().includes(selected)) teamSelect.value = selected;
    }

    const roomSelect = document.getElementById("grantRoomSelect");
    if (roomSelect && !roomSelect.options.length) {
      rooms.forEach((room) => {
        const option = document.createElement("option");
        option.value = room.id;
        option.textContent = room.name;
        roomSelect.append(option);
      });
    }
  }

  function setGrantStatus(text, type = "") {
    const node = document.getElementById("grantStatus");
    if (!node) return;
    node.textContent = text;
    node.classList.toggle("is-ok", type === "ok");
    node.classList.toggle("is-bad", type === "bad");
  }

  function roomNameFor(roomId) {
    return rooms.find((room) => room.id === roomId)?.name || String(roomId || "");
  }

  function evidenceRoomCountKey(team, room) {
    return `${team}\u0000${room}`;
  }

  function evidenceRoomCountFor(team, roomId) {
    const room = roomNameFor(roomId);
    return evidenceRoomCounts.get(evidenceRoomCountKey(team, room))?.count || 0;
  }

  function updateGrantSubmitState(showMessage = false) {
    const submit = document.getElementById("grantSubmit");
    const team = document.getElementById("grantTeamSelect")?.value || "";
    const roomId = document.getElementById("grantRoomSelect")?.value || "";
    if (!submit) return;

    const complete = Boolean(team && roomId && evidenceRoomCountFor(team, roomId) >= 2);
    submit.disabled = requesting || complete;
    submit.classList.toggle("is-room-complete", complete);
    submit.title = complete ? "이 교실의 증거카드 2개를 모두 획득했습니다." : "";

    if (showMessage) {
      setGrantStatus(
        complete ? `${teamLabelFor(team)} · ${roomNameFor(roomId)} 증거카드 2개 획득 완료. 더 이상 승인할 수 없습니다.` : "",
        complete ? "bad" : ""
      );
    }
  }

  function formatRelativeTime(at) {
    const ms = Date.now() - Number(at || 0);
    if (!Number.isFinite(ms) || ms < 60000) return "방금";
    const minutes = Math.floor(ms / 60000);
    if (minutes < 60) return `${minutes}분 전`;
    return `${Math.floor(minutes / 60)}시간 전`;
  }

  function renderGrants() {
    const list = document.getElementById("evidenceGrantList");
    if (!list) return;
    list.textContent = "";

    const active = activeTeams()
      .map((team) => ({ team, grant: evidenceGrants[team] }))
      .filter((entry) => entry.grant && entry.grant.roomId);

    if (!active.length) {
      const empty = document.createElement("p");
      empty.className = "evidence-grant-empty";
      empty.textContent = "아직 승인된 팀이 없습니다.";
      list.append(empty);
      return;
    }

    active.forEach(({ team, grant }) => {
      const item = document.createElement("article");
      item.className = "evidence-grant-entry";

      const meta = document.createElement("div");
      meta.className = "evidence-grant-entry__meta";
      meta.textContent = `${teamLabelFor(team)} · ${grant.roomName || roomNameFor(grant.roomId)} · ${formatRelativeTime(grant.at)}`;

      const revoke = document.createElement("button");
      revoke.className = "reset-btn";
      revoke.type = "button";
      revoke.textContent = "취소";
      revoke.dataset.revokeTeam = team;

      item.append(meta, revoke);
      list.append(item);
    });
  }

  function renderEvidenceRoomCounts() {
    const list = document.getElementById("evidenceRoomCountList");
    if (!list) return;
    list.textContent = "";

    const roomOrder = Object.fromEntries(rooms.map((room, index) => [room.name, index]));
    evidenceRoomCounts = new Map();
    evidenceLogs.forEach((entry) => {
      const team = String(entry.team || "").trim();
      const room = String(entry.room || "").trim();
      if (!activeTeams().includes(team) || roomOrder[room] === undefined) return;
      if (String(entry.code || "").startsWith("REVISIT") || entry.evidence === "재방문 보너스") return;
      const key = evidenceRoomCountKey(team, room);
      const current = evidenceRoomCounts.get(key) || { team, room, count: 0 };
      current.count += 1;
      evidenceRoomCounts.set(key, current);
    });

    const summaries = [...evidenceRoomCounts.values()].sort((left, right) => (
      teams.indexOf(left.team) - teams.indexOf(right.team) ||
      roomOrder[left.room] - roomOrder[right.room]
    ));

    if (!summaries.length) {
      const empty = document.createElement("p");
      empty.className = "evidence-grant-empty";
      empty.textContent = "아직 획득한 증거카드가 없습니다.";
      list.append(empty);
      updateGrantSubmitState();
      return;
    }

    summaries.forEach((entry) => {
      const item = document.createElement("article");
      item.className = "evidence-room-count-entry";
      const complete = entry.count >= 2;
      item.classList.toggle("is-complete", complete);
      if (complete) item.setAttribute("aria-label", `${teamLabelFor(entry.team)} ${entry.room} 증거카드 2개 획득 완료`);

      const route = document.createElement("strong");
      route.textContent = `${teamLabelFor(entry.team)} · ${entry.room}`;

      const count = document.createElement("span");
      count.className = "evidence-room-count-entry__count";
      count.textContent = `${entry.count}번`;

      item.append(route, count);
      list.append(item);
    });
    updateGrantSubmitState();
  }

  function applyGrants(data = {}) {
    if (data && data.grants && typeof data.grants === "object") {
      evidenceGrants = data.grants;
      renderGrants();
    }
  }

  async function fetchGrants() {
    const { response, data } = await requestCredits("/api/evidence-code");
    if (!response.ok) {
      throw new Error(data.error || "승인 현황 불러오기 실패");
    }
    evidenceLogs = Array.isArray(data.evidenceLogs) ? data.evidenceLogs : evidenceLogs;
    applyGrants(data);
    renderEvidenceRoomCounts();
    return data;
  }

  async function grantEvidence() {
    const team = document.getElementById("grantTeamSelect")?.value || "";
    const roomId = document.getElementById("grantRoomSelect")?.value || "";
    if (!team || !roomId) {
      setGrantStatus("팀과 장소를 선택하세요.", "bad");
      return;
    }
    if (evidenceRoomCountFor(team, roomId) >= 2) {
      updateGrantSubmitState(true);
      return;
    }

    const { response, data } = await requestCredits("/api/evidence-code", {
      method: "POST",
      body: JSON.stringify({ action: "grant", team, roomId })
    });
    if (!response.ok) {
      setGrantStatus(data.error || "승인 실패", "bad");
      return;
    }
    setGrantStatus(`${teamLabelFor(team)} · ${roomNameFor(roomId)} 승인 완료. 최신 현황은 새로고침을 눌러 확인하세요.`, "ok");
  }

  async function revokeEvidence(team) {
    const { response, data } = await requestCredits("/api/evidence-code", {
      method: "POST",
      body: JSON.stringify({ action: "revoke", team })
    });
    if (!response.ok) {
      setGrantStatus(data.error || "승인 취소 실패", "bad");
      return;
    }
    applyGrants(data);
    setGrantStatus(`${teamLabelFor(team)} 승인을 취소했습니다.`, "ok");
  }

  let requesting = false;
  const actionButtons = [
    "publishScores",
    "resetScores",
    "refreshQuestionStats",
    "clearQuestionLogs",
    "refreshEvidenceLogs",
    "clearEvidenceLogs",
    "grantSubmit",
    "refreshGrants",
    "applyGameTeamCount",
    "saveGameResult",
    "startNewGame"
  ].map((id) => document.getElementById(id)).filter(Boolean);

  function setRequesting(value) {
    requesting = value;
    actionButtons.forEach((button) => {
      button.disabled = value;
    });
    if (!value) updateGrantSubmitState();
  }

  async function runExclusive(button, task) {
    if (requesting) return;
    setRequesting(true);
    const originalLabel = button ? button.textContent : "";
    if (button) button.textContent = "처리 중...";
    try {
      await task();
    } finally {
      if (button) button.textContent = originalLabel;
      setRequesting(false);
    }
  }

  document.querySelectorAll("[data-score-input]").forEach((input) => {
    input.addEventListener("input", () => {
      const team = input.dataset.scoreInput;
      pendingAdds[team] = cleanScore(input.value);
      saveDraftAdds(pendingAdds);
      setSyncStatus(totalAdditions() ? "추가 대기 중. 코인 추가를 누르면 학생에게 더해집니다." : "추가할 코인 수를 입력하세요.");
    });

    input.addEventListener("blur", () => {
      input.value = pendingAdds[input.dataset.scoreInput] || "";
    });
  });

  document.getElementById("resetScores")?.addEventListener("click", (event) => {
    runExclusive(event.currentTarget, () =>
      resetServerScores().catch((error) => {
        remainingCredits = { ...emptyByTeam };
        grantedCredits = { ...emptyByTeam };
        pendingAdds = { ...emptyByTeam };
        saveDraftAdds(pendingAdds);
        renderScores();
        setSyncStatus(error.message || "코인 초기화 실패", "bad");
      })
    );
  });

  document.getElementById("publishScores")?.addEventListener("click", (event) => {
    runExclusive(event.currentTarget, () =>
      publishScores().catch((error) => {
        setSyncStatus(error.message || "코인 추가 실패", "bad");
      })
    );
  });

  document.getElementById("applyGameTeamCount")?.addEventListener("click", (event) => {
    runExclusive(event.currentTarget, () =>
      applyGameTeamCount().catch((error) => {
        setGameSessionStatus(error.message || "팀 수 적용에 실패했습니다.", "bad");
      })
    );
  });

  document.getElementById("saveGameResult")?.addEventListener("click", (event) => {
    runExclusive(event.currentTarget, () =>
      saveGameSessionResult().catch((error) => {
        setGameSessionStatus(error.message || "결과 저장에 실패했습니다.", "bad");
      })
    );
  });

  document.getElementById("startNewGame")?.addEventListener("click", (event) => {
    runExclusive(event.currentTarget, () =>
      startNewGameSession().catch((error) => {
        setGameSessionStatus(error.message || "새 게임 시작에 실패했습니다.", "bad");
      })
    );
  });

  document.getElementById("refreshQuestionStats")?.addEventListener("click", (event) => {
    runExclusive(event.currentTarget, () =>
      fetchScores().catch((error) => {
        setSyncStatus(error.message || "현황 새로고침 실패", "bad");
      })
    );
  });

  document.getElementById("clearQuestionLogs")?.addEventListener("click", (event) => {
    runExclusive(event.currentTarget, () =>
      clearServerLogs().catch((error) => {
        setSyncStatus(error.message || "로그 삭제 실패", "bad");
      })
    );
  });

  document.getElementById("refreshEvidenceLogs")?.addEventListener("click", (event) => {
    runExclusive(event.currentTarget, () =>
      fetchEvidenceLogs().then(() => {
        setSyncStatus("증거코드 입력 기록을 불러왔습니다.", "ok");
      }).catch((error) => {
        setSyncStatus(error.message || "증거코드 입력 기록 불러오기 실패", "bad");
      })
    );
  });

  document.getElementById("clearEvidenceLogs")?.addEventListener("click", (event) => {
    runExclusive(event.currentTarget, () =>
      clearEvidenceLogs().catch((error) => {
        setSyncStatus(error.message || "증거코드 입력 초기화 실패", "bad");
      })
    );
  });

  document.getElementById("grantSubmit")?.addEventListener("click", (event) => {
    runExclusive(event.currentTarget, () =>
      grantEvidence().catch((error) => {
        setGrantStatus(error.message || "승인 실패", "bad");
      })
    );
  });

  ["grantTeamSelect", "grantRoomSelect"].forEach((id) => {
    document.getElementById(id)?.addEventListener("change", () => updateGrantSubmitState(true));
  });

  document.getElementById("refreshGrants")?.addEventListener("click", (event) => {
    runExclusive(event.currentTarget, () =>
      fetchGrants().then(() => {
        setGrantStatus("승인 현황을 새로고침했습니다.", "ok");
      }).catch((error) => {
        setGrantStatus(error.message || "승인 현황 불러오기 실패", "bad");
      })
    );
  });

  document.getElementById("evidenceGrantList")?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-revoke-team]");
    if (!button) return;
    const team = button.dataset.revokeTeam;
    if (!window.confirm(`${teamLabelFor(team)} 승인을 취소할까요?`)) return;
    runExclusive(button, () =>
      revokeEvidence(team).catch((error) => {
        setGrantStatus(error.message || "승인 취소 실패", "bad");
      })
    );
  });

  applyTeamDisplayLabels();
  populateGrantSelects();
  renderScores();
  renderQuestionStats();
  renderEvidenceLogs();
  renderGrants();
  renderEvidenceRoomCounts();
  renderGameResults();
  fetchGameSessions().catch((error) => {
    setGameSessionStatus(error.message || "게임 회차 정보를 불러오지 못했습니다.", "bad");
  });
  startScoreSync();

  const stopwatchDisplay = document.getElementById("stopwatchDisplay");
  const stopwatchToggle = document.getElementById("stopwatchToggle");
  const stopwatchReset = document.getElementById("stopwatchReset");
  let stopwatchRunning = false;
  let stopwatchStartedAt = 0;
  let stopwatchElapsed = 0;
  let stopwatchFrame = 0;

  function formatStopwatch(milliseconds) {
    const totalTenths = Math.floor(milliseconds / 100);
    const tenths = totalTenths % 10;
    const totalSeconds = Math.floor(totalTenths / 10);
    const seconds = totalSeconds % 60;
    const minutes = Math.floor(totalSeconds / 60);
    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}.${tenths}`;
  }

  function drawStopwatch() {
    const elapsed = stopwatchRunning ? stopwatchElapsed + Date.now() - stopwatchStartedAt : stopwatchElapsed;
    stopwatchDisplay.textContent = formatStopwatch(elapsed);
    if (stopwatchRunning) {
      stopwatchFrame = requestAnimationFrame(drawStopwatch);
    }
  }

  stopwatchToggle.addEventListener("click", () => {
    if (stopwatchRunning) {
      stopwatchElapsed += Date.now() - stopwatchStartedAt;
      stopwatchRunning = false;
      stopwatchToggle.textContent = "시작";
      cancelAnimationFrame(stopwatchFrame);
      drawStopwatch();
      return;
    }

    stopwatchRunning = true;
    stopwatchStartedAt = Date.now();
    stopwatchToggle.textContent = "정지";
    drawStopwatch();
  });

  stopwatchReset.addEventListener("click", () => {
    stopwatchRunning = false;
    stopwatchElapsed = 0;
    stopwatchToggle.textContent = "시작";
    cancelAnimationFrame(stopwatchFrame);
    drawStopwatch();
  });

  const timerDisplay = document.getElementById("timerDisplay");
  const timerMinutes = document.getElementById("timerMinutes");
  const timerSeconds = document.getElementById("timerSeconds");
  const timerToggle = document.getElementById("timerToggle");
  const timerReset = document.getElementById("timerReset");
  let timerRunning = false;
  let timerEndsAt = 0;
  let timerRemaining = readTimerInput();
  let timerId = 0;

  function clampInput(input, max) {
    input.value = Math.min(max, Math.max(0, cleanScore(input.value)));
  }

  function readTimerInput() {
    const minutes = Math.min(99, cleanScore(timerMinutes.value));
    const seconds = Math.min(59, cleanScore(timerSeconds.value));
    return (minutes * 60 + seconds) * 1000;
  }

  function formatTimer(milliseconds) {
    const totalSeconds = Math.max(0, Math.ceil(milliseconds / 1000));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }

  function renderTimer(milliseconds) {
    timerDisplay.textContent = formatTimer(milliseconds);
  }

  function tickTimer() {
    timerRemaining = Math.max(0, timerEndsAt - Date.now());
    renderTimer(timerRemaining);

    if (timerRemaining <= 0) {
      timerRunning = false;
      timerToggle.textContent = "시작";
      clearInterval(timerId);
    }
  }

  function pauseTimer() {
    timerRemaining = Math.max(0, timerEndsAt - Date.now());
    timerRunning = false;
    timerToggle.textContent = "시작";
    clearInterval(timerId);
    renderTimer(timerRemaining);
  }

  timerToggle.addEventListener("click", () => {
    if (timerRunning) {
      pauseTimer();
      return;
    }

    timerRemaining = timerRemaining > 0 ? timerRemaining : readTimerInput();
    if (timerRemaining <= 0) return;

    timerRunning = true;
    timerEndsAt = Date.now() + timerRemaining;
    timerToggle.textContent = "정지";
    tickTimer();
    timerId = setInterval(tickTimer, 250);
  });

  timerReset.addEventListener("click", () => {
    timerRunning = false;
    timerToggle.textContent = "시작";
    clearInterval(timerId);
    clampInput(timerMinutes, 99);
    clampInput(timerSeconds, 59);
    timerRemaining = readTimerInput();
    renderTimer(timerRemaining);
  });

  [timerMinutes, timerSeconds].forEach((input) => {
    input.addEventListener("input", () => {
      if (input === timerMinutes) clampInput(input, 99);
      if (input === timerSeconds) clampInput(input, 59);
      if (!timerRunning) {
        timerRemaining = readTimerInput();
        renderTimer(timerRemaining);
      }
    });
  });

  drawStopwatch();
  renderTimer(timerRemaining);
})();
