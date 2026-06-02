(function () {
  const scoreKey = "korea-middle-school-team-scores";
  const aScoreResetKey = "korea-middle-school-team-a-score-reset-20260602";
  const teams = ["A", "B", "C", "D"];
  const baseScores = { A: 0, B: 0, C: 0, D: 0 };

  function loadScores() {
    try {
      const scores = { ...baseScores, ...JSON.parse(localStorage.getItem(scoreKey)) };
      if (localStorage.getItem(aScoreResetKey) !== "1") {
        scores.A = 0;
        localStorage.setItem(scoreKey, JSON.stringify(scores));
        localStorage.setItem(aScoreResetKey, "1");
      }
      return scores;
    } catch {
      return { ...baseScores };
    }
  }

  const status = document.createElement("aside");
  status.className = "game-status";
  status.setAttribute("aria-label", "현재 시간과 조별 점수");
  status.innerHTML = `
    <div class="game-status__clock">
      <div class="analog-clock" data-clock>
        <div class="analog-clock__face">
          <div class="analog-clock__hand analog-clock__hand--hour"></div>
          <div class="analog-clock__hand analog-clock__hand--minute"></div>
          <div class="analog-clock__hand analog-clock__hand--second"></div>
          <div class="analog-clock__center"></div>
        </div>
        <div class="analog-clock__time" data-clock-time>00:00:00</div>
      </div>
    </div>
    <div class="game-status__scores">
      ${teams.map((team) => `
        <div class="game-status__score">
          <span class="game-status__team">${team}</span>
          <strong><span data-mini-score="${team}">0</span>점</strong>
        </div>
      `).join("")}
    </div>
  `;

  document.body.prepend(status);

  function renderScores() {
    const scores = loadScores();
    teams.forEach((team) => {
      const score = status.querySelector(`[data-mini-score="${team}"]`);
      score.textContent = scores[team];
    });
  }

  renderScores();
  window.addEventListener("storage", renderScores);
  setInterval(renderScores, 1000);
})();
