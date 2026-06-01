(function () {
  const scoreKey = "korea-middle-school-team-scores";
  const teams = ["A", "B", "C", "D"];
  const baseScores = { A: 0, B: 0, C: 0, D: 0 };

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

  function renderScores() {
    teams.forEach((team) => {
      const input = document.querySelector(`[data-score-input="${team}"]`);
      if (input && document.activeElement !== input) {
        input.value = scores[team];
      }
    });
  }

  document.querySelectorAll("[data-score-input]").forEach((input) => {
    input.addEventListener("input", () => {
      const team = input.dataset.scoreInput;
      scores[team] = cleanScore(input.value);
      saveScores(scores);
    });

    input.addEventListener("blur", () => {
      input.value = scores[input.dataset.scoreInput];
    });
  });

  document.getElementById("resetScores").addEventListener("click", () => {
    scores = { ...baseScores };
    saveScores(scores);
    renderScores();
  });

  renderScores();

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
