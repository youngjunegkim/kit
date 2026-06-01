(function () {
  const clocks = document.querySelectorAll("[data-clock]");

  function pad(value) {
    return String(value).padStart(2, "0");
  }

  function updateClock(clock) {
    const now = new Date();
    const milliseconds = now.getMilliseconds();
    const seconds = now.getSeconds() + milliseconds / 1000;
    const minutes = now.getMinutes() + seconds / 60;
    const hours = (now.getHours() % 12) + minutes / 60;

    const hourHand = clock.querySelector(".analog-clock__hand--hour");
    const minuteHand = clock.querySelector(".analog-clock__hand--minute");
    const secondHand = clock.querySelector(".analog-clock__hand--second");
    const timeLabel = clock.querySelector("[data-clock-time]");

    hourHand.style.transform = `translateX(-50%) rotate(${hours * 30}deg)`;
    minuteHand.style.transform = `translateX(-50%) rotate(${minutes * 6}deg)`;
    secondHand.style.transform = `translateX(-50%) rotate(${seconds * 6}deg)`;
    timeLabel.textContent = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
  }

  function tick() {
    clocks.forEach(updateClock);
  }

  tick();
  setInterval(tick, 1000);
})();
