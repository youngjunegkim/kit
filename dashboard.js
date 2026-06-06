(function () {
  const scoreKey = "kit-student-question-credits";
  const teams = ["승우", "연수", "은혁", "영준", "혜빈", "윤지", "가빈", "채희"];
  const baseScores = Object.fromEntries(teams.map((team) => [team, 0]));
  const syncIntervalMs = 1500;
  const user = sessionStorage.getItem("kit-auth-user") || "";
  const role = sessionStorage.getItem("kit-auth-role") || "";
  let syncTimer = 0;
  let saveTimer = 0;
  let syncStatus = null;
  let questionCounts = { ...baseScores };
  let questionLogs = [];

  function loadScores() {
    try {
      return { ...baseScores, ...JSON.parse(localStorage.getItem(scoreKey)) };
    } catch {
      return { ...baseScores };
    }
  }

  function saveScores(scores) {
    localStorage.setItem(scoreKey, JSON.stringify(scores));
  }

  function cleanScore(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) return 0;
    return Math.max(0, Math.round(number));
  }

  let scores = loadScores();

  function ensureSyncStatus() {
    if (syncStatus) return syncStatus;
    const scoreHead = document.querySelector(".score-head");
    if (!scoreHead) return null;
    syncStatus = document.createElement("p");
    syncStatus.className = "score-sync-status";
    syncStatus.textContent = "질문권 동기화 준비 중";
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
    return {
      "content-type": "application/json",
      "x-kit-user": user,
      "x-kit-role": role
    };
  }

  function renderScores() {
    teams.forEach((team) => {
      const input = document.querySelector(`[data-score-input="${team}"]`);
      if (input && document.activeElement !== input) {
        input.value = scores[team];
      }
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
        name.textContent = team;

        const count = document.createElement("strong");
        count.textContent = `${questionCounts[team] || 0}회`;

        row.append(name, count);
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
      meta.textContent = `${entry.team || entry.user || "학생"} · ${formatLogTime(entry.at)} · ${entry.count || 0}번째`;

      const text = document.createElement("p");
      text.textContent = entry.message || "질문 내용 없음";

      item.append(meta, text);
      logList.append(item);
    });
  }

  async function fetchScores() {
    const response = await fetch("/api/credits", {
      headers: authHeaders()
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.credits) {
      throw new Error(data.error || "질문권 동기화 실패");
    }
    scores = { ...baseScores, ...data.credits };
    questionCounts = { ...baseScores, ...(data.counts || {}) };
    questionLogs = Array.isArray(data.logs) ? data.logs : [];
    saveScores(scores);
    renderScores();
    renderQuestionStats();
    setSyncStatus(data.persistent ? "질문권 실시간 동기화 중" : "임시 동기화 중: DB 환경변수 필요", data.persistent ? "ok" : "bad");
  }

  async function updateScore(team, credits) {
    const response = await fetch("/api/credits", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({
        action: "set",
        team,
        credits
      })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.error || "질문권 저장 실패");
    }
    scores = { ...baseScores, ...(data.allCredits || scores), [team]: data.credits };
    questionCounts = { ...baseScores, ...(data.counts || questionCounts) };
    questionLogs = Array.isArray(data.logs) ? data.logs : questionLogs;
    saveScores(scores);
    renderScores();
    renderQuestionStats();
    setSyncStatus(data.persistent ? "질문권 저장됨" : "임시 저장됨: DB 환경변수 필요", data.persistent ? "ok" : "bad");
  }

  async function resetServerScores() {
    const response = await fetch("/api/credits", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ action: "reset" })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.error || "질문권 초기화 실패");
    }
    scores = { ...baseScores, ...(data.credits || {}) };
    questionCounts = { ...baseScores, ...(data.counts || questionCounts) };
    questionLogs = Array.isArray(data.logs) ? data.logs : questionLogs;
    saveScores(scores);
    renderScores();
    renderQuestionStats();
    setSyncStatus(data.persistent ? "질문권 초기화됨" : "임시 초기화됨: DB 환경변수 필요", data.persistent ? "ok" : "bad");
  }

  async function clearServerLogs() {
    const response = await fetch("/api/credits", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ action: "clearLogs" })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.error || "로그 삭제 실패");
    }
    questionCounts = { ...baseScores, ...(data.counts || {}) };
    questionLogs = Array.isArray(data.logs) ? data.logs : [];
    renderQuestionStats();
    setSyncStatus(data.persistent ? "질문 로그 삭제됨" : "임시 로그 삭제됨: DB 환경변수 필요", data.persistent ? "ok" : "bad");
  }

  function queueScoreUpdate(team, credits) {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      updateScore(team, credits).catch((error) => {
        setSyncStatus(error.message || "질문권 저장 실패", "bad");
      });
    }, 280);
  }

  function startScoreSync() {
    fetchScores().catch((error) => {
      renderScores();
      setSyncStatus(error.message || "질문권 동기화 실패", "bad");
    });
    syncTimer = window.setInterval(() => {
      if (document.querySelector(".score-input:focus")) return;
      fetchScores().catch(() => {});
    }, syncIntervalMs);
  }

  document.querySelectorAll("[data-score-input]").forEach((input) => {
    input.addEventListener("input", () => {
      const team = input.dataset.scoreInput;
      scores[team] = cleanScore(input.value);
      saveScores(scores);
      queueScoreUpdate(team, scores[team]);
    });

    input.addEventListener("blur", () => {
      input.value = scores[input.dataset.scoreInput];
    });
  });

  document.getElementById("resetScores").addEventListener("click", () => {
    resetServerScores().catch((error) => {
      scores = { ...baseScores };
      saveScores(scores);
      renderScores();
      setSyncStatus(error.message || "질문권 초기화 실패", "bad");
    });
  });

  document.getElementById("clearQuestionLogs")?.addEventListener("click", () => {
    clearServerLogs().catch((error) => {
      setSyncStatus(error.message || "로그 삭제 실패", "bad");
    });
  });

  renderScores();
  renderQuestionStats();
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
