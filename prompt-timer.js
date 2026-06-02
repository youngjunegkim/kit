(function () {
  const display = document.querySelector("[data-countdown-display]");
  const toggle = document.querySelector("[data-countdown-toggle]");
  const reset = document.querySelector("[data-countdown-reset]");
  const timer = document.querySelector("[data-countdown]");
  const baseSeconds = Number(timer?.dataset.countdown || 30);
  let remaining = Math.max(1, baseSeconds) * 1000;
  let endsAt = 0;
  let running = false;
  let intervalId = 0;

  function render() {
    const totalSeconds = Math.max(0, Math.ceil(remaining / 1000));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    display.textContent = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }

  function stop() {
    running = false;
    toggle.textContent = "시작";
    clearInterval(intervalId);
  }

  function tick() {
    remaining = Math.max(0, endsAt - Date.now());
    render();
    if (remaining <= 0) stop();
  }

  toggle.addEventListener("click", () => {
    if (running) {
      remaining = Math.max(0, endsAt - Date.now());
      stop();
      render();
      return;
    }

    if (remaining <= 0) remaining = baseSeconds * 1000;
    running = true;
    toggle.textContent = "정지";
    endsAt = Date.now() + remaining;
    tick();
    intervalId = setInterval(tick, 150);
  });

  reset.addEventListener("click", () => {
    stop();
    remaining = baseSeconds * 1000;
    render();
  });

  render();
})();
