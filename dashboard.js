(function () {
  const classKey = "kit-class-section";
  const classId = sessionStorage.getItem(classKey) || localStorage.getItem("kit-last-class-section") || "class-a";
  const draftKey = `kit-student-question-credit-additions:${classId}`;
  const teams = ["승우", "연수", "은혁", "영준", "혜빈", "윤지", "가빈", "채희"];
  const teamDisplayIds = Object.fromEntries(teams.map((team, index) => [team, String(index + 1)]));
  const emptyByTeam = Object.fromEntries(teams.map((team) => [team, 0]));
  const user = sessionStorage.getItem("kit-auth-user") || "";
  const role = sessionStorage.getItem("kit-auth-role") || "";
  let syncStatus = null;
  let remainingCredits = { ...emptyByTeam };
  let grantedCredits = { ...emptyByTeam };
  let questionCounts = { ...emptyByTeam };
  let questionLogs = [];
  let evidenceLogs = [];

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
    return id ? `${id}번` : "학생";
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
      if (name) name.textContent = id;

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
      teams.forEach((team) => {
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

    if (!questionLogs.length) {
      const empty = document.createElement("p");
      empty.className = "log-empty";
      empty.textContent = "아직 질문 로그가 없습니다.";
      logList.append(empty);
      return;
    }

    questionLogs.slice(0, 16).forEach((entry) => {
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

    if (!evidenceLogs.length) {
      const empty = document.createElement("p");
      empty.className = "evidence-redeem-empty";
      empty.textContent = "아직 입력된 증거코드가 없습니다.";
      list.append(empty);
      return;
    }

    evidenceLogs.slice(0, 20).forEach((entry) => {
      const item = document.createElement("article");
      item.className = "evidence-redeem-entry";

      const meta = document.createElement("div");
      meta.className = "evidence-redeem-entry__meta";
      meta.textContent = `${teamLabelFor(entry.team)} · ${formatLogTime(entry.at)} · +${entry.added || 1}개`;

      const text = document.createElement("p");
      text.textContent = "증거코드 입력 완료 · 코인 지급됨";

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
    renderEvidenceLogs();
    return data;
  }

  async function publishScores() {
    const amounts = cleanTeamMap(pendingAdds);
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
    const confirmed = window.confirm("학생들이 입력한 증거코드 기록과 해당 증거코드로 받은 코인을 초기화할까요?");
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
    renderEvidenceLogs();
    if (data.credits) {
      applyCreditData({ credits: data.credits, granted: data.granted, counts: questionCounts });
      renderScores();
      renderQuestionStats();
    } else {
      await fetchScores();
    }
    setSyncStatus(`증거코드 입력 ${data.removed || 0}건과 해당 코인을 초기화했습니다.`, data.persistent ? "ok" : "bad");
  }

  function startScoreSync() {
    fetchScores().catch((error) => {
      renderScores();
      setSyncStatus(error.message || "코인 현황 불러오기 실패", "bad");
    });
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

  document.getElementById("resetScores").addEventListener("click", () => {
    resetServerScores().catch((error) => {
      remainingCredits = { ...emptyByTeam };
      grantedCredits = { ...emptyByTeam };
      pendingAdds = { ...emptyByTeam };
      saveDraftAdds(pendingAdds);
      renderScores();
      setSyncStatus(error.message || "코인 초기화 실패", "bad");
    });
  });

  document.getElementById("publishScores")?.addEventListener("click", () => {
    publishScores().catch((error) => {
      setSyncStatus(error.message || "코인 추가 실패", "bad");
    });
  });

  document.getElementById("refreshQuestionStats")?.addEventListener("click", () => {
    fetchScores().catch((error) => {
      setSyncStatus(error.message || "현황 새로고침 실패", "bad");
    });
  });

  document.getElementById("clearQuestionLogs")?.addEventListener("click", () => {
    clearServerLogs().catch((error) => {
      setSyncStatus(error.message || "로그 삭제 실패", "bad");
    });
  });

  document.getElementById("refreshEvidenceLogs")?.addEventListener("click", () => {
    fetchEvidenceLogs().then(() => {
      setSyncStatus("증거코드 입력 기록을 불러왔습니다.", "ok");
    }).catch((error) => {
      setSyncStatus(error.message || "증거코드 입력 기록 불러오기 실패", "bad");
    });
  });

  document.getElementById("clearEvidenceLogs")?.addEventListener("click", () => {
    clearEvidenceLogs().catch((error) => {
      setSyncStatus(error.message || "증거코드 입력 초기화 실패", "bad");
    });
  });

  applyTeamDisplayLabels();
  renderScores();
  renderQuestionStats();
  renderEvidenceLogs();
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
