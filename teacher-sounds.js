(function () {
  const role = sessionStorage.getItem("kit-auth-role") || "";
  if (role !== "teacher") return;

  const mainFlag = "kit-teacher-main-sound";
  const roomFlag = "kit-teacher-room-sound";
  const sounds = {
    main: "assets/sounds/horror.wav",
    room: "assets/sounds/among.mp3"
  };
  const volumes = {
    main: 0.72,
    room: 0.82
  };

  let pendingType = "";
  let activeAudio = null;

  function pageName() {
    return window.location.pathname.split("/").pop().toLowerCase();
  }

  function shouldPlayOnLoad(type) {
    if (type === "main") return sessionStorage.getItem(mainFlag) === "1";
    if (type === "room") return pageName().startsWith("teacher-game-") && sessionStorage.getItem(roomFlag) === "1";
    return false;
  }

  function clearFlag(type) {
    sessionStorage.removeItem(type === "main" ? mainFlag : roomFlag);
  }

  function armUserGestureFallback(type) {
    pendingType = type;
    const playPending = () => {
      if (!pendingType) return;
      const nextType = pendingType;
      pendingType = "";
      playSound(nextType);
    };
    window.addEventListener("pointerdown", playPending, { once: true, capture: true });
    window.addEventListener("keydown", playPending, { once: true, capture: true });
  }

  async function playSound(type) {
    const source = sounds[type];
    if (!source) return false;
    try {
      activeAudio?.pause();
      const audio = new Audio(source);
      audio.volume = volumes[type] ?? 0.8;
      activeAudio = audio;
      await audio.play();
      return true;
    } catch {
      armUserGestureFallback(type);
      return false;
    }
  }

  function playLoadCue(type) {
    if (!shouldPlayOnLoad(type)) return;
    clearFlag(type);
    window.setTimeout(() => playSound(type), type === "main" ? 180 : 80);
  }

  function prepareRoomCue(event) {
    const link = event.target.closest?.('a[href^="teacher-game-"]');
    if (!link) return;
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    sessionStorage.setItem(roomFlag, "1");
  }

  document.addEventListener("click", prepareRoomCue, true);
  playLoadCue("main");
  playLoadCue("room");
})();
