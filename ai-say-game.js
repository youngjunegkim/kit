(function () {
  const state = {
    waiting: false,
    accessCode: sessionStorage.getItem("class-access-code") || "",
    teacherCode: sessionStorage.getItem("kit-teacher-access-code") || "",
    role: sessionStorage.getItem("kit-auth-role") || "",
    user: sessionStorage.getItem("kit-auth-user") || "",
    team: sessionStorage.getItem("kit-auth-team") || ""
  };

  const roomName = document.body.dataset.roomName || "AI로 말해요";
  const canonicalOrigin = "https://kit-six-tau.vercel.app";
  const apiOrigin = /\.vercel\.app$/i.test(window.location.hostname) && window.location.origin !== canonicalOrigin
    ? canonicalOrigin
    : "";
  const input = document.querySelector("[data-prompt-input]");
  const countEl = document.querySelector("[data-prompt-count]");
  const warningEl = document.querySelector("[data-warning]");
  const generateButton = document.querySelector("[data-generate-button]");
  const statusEl = document.querySelector("[data-api-status]");
  const stageEl = document.querySelector("[data-image-stage]");
  const emptyEl = document.querySelector("[data-empty-state]");
  const imageEl = document.querySelector("[data-generated-image]");
  const captionEl = document.querySelector("[data-result-caption]");
  const form = document.querySelector("[data-prompt-form]");

  const timer = {
    display: document.querySelector("[data-countdown-display]"),
    toggle: document.querySelector("[data-countdown-toggle]"),
    reset: document.querySelector("[data-countdown-reset]"),
    baseMs: Number(document.querySelector("[data-countdown]")?.dataset.countdown || 30) * 1000,
    remainingMs: 30000,
    endsAt: 0,
    running: false,
    intervalId: 0
  };
  timer.remainingMs = timer.baseMs;

  function setStatus(text, tone) {
    statusEl.textContent = text;
    statusEl.classList.toggle("is-ok", tone === "ok");
    statusEl.classList.toggle("is-bad", tone === "bad");
  }

  function validatePrompt() {
    const value = input.value.trim();
    countEl.textContent = `${input.value.length}/900`;

    if (value.length < 8) {
      warningEl.textContent = "조금 더 자세히 써 주세요.";
      generateButton.disabled = true;
      return false;
    }

    warningEl.textContent = "";
    generateButton.disabled = state.waiting;
    return true;
  }

  function renderTimer() {
    const totalSeconds = Math.max(0, Math.ceil(timer.remainingMs / 1000));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    timer.display.textContent = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }

  function stopTimer() {
    timer.running = false;
    timer.toggle.textContent = "시작";
    clearInterval(timer.intervalId);
  }

  function tickTimer() {
    timer.remainingMs = Math.max(0, timer.endsAt - Date.now());
    renderTimer();
    if (timer.remainingMs <= 0) stopTimer();
  }

  function toggleTimer() {
    if (timer.running) {
      timer.remainingMs = Math.max(0, timer.endsAt - Date.now());
      stopTimer();
      renderTimer();
      return;
    }
    if (timer.remainingMs <= 0) timer.remainingMs = timer.baseMs;
    timer.running = true;
    timer.toggle.textContent = "정지";
    timer.endsAt = Date.now() + timer.remainingMs;
    tickTimer();
    timer.intervalId = setInterval(tickTimer, 150);
  }

  function resetTimer() {
    stopTimer();
    timer.remainingMs = timer.baseMs;
    renderTimer();
  }

  function ensureAccessCode() {
    if (state.accessCode) return true;
    const code = window.prompt("입장 코드를 입력하세요.");
    if (!code || !code.trim()) return false;
    state.accessCode = code.trim();
    sessionStorage.setItem("class-access-code", state.accessCode);
    return true;
  }

  function ensureTeacherCode() {
    if (state.role !== "teacher" || state.teacherCode) return true;
    const code = window.prompt("이미지 생성을 위해 선생님 보안 코드를 입력하세요.");
    if (!code || !code.trim()) return false;
    state.teacherCode = code.trim();
    sessionStorage.setItem("kit-teacher-access-code", state.teacherCode);
    return true;
  }

  function authHeaders() {
    const headers = {
      "content-type": "application/json",
      "x-kit-role": state.role || "teacher"
    };
    if (state.accessCode) headers["x-class-code"] = state.accessCode;
    if (state.teacherCode) headers["x-teacher-code"] = state.teacherCode;
    return headers;
  }

  function apiUrl(path) {
    return `${apiOrigin}${path}`;
  }

  function generationModelLabel(data) {
    const model = data.model || "unknown";
    let provider = data.provider || "";

    if (provider === "pollinations") provider = "Pollinations";
    if (!provider && data.requestFormat === "imagen-predict") provider = "Google Imagen";
    if (!provider && /^gemini/i.test(model)) provider = "Gemini";
    if (!provider) provider = "이미지 모델";

    const translated = data.translationProvider === "gemini" ? " + Gemini 번역" : "";
    return `${provider} / ${model}${translated}`;
  }

  async function refreshApiStatus() {
    try {
      const response = await fetch(apiUrl("/api/status"));
      const data = await response.json().catch(() => ({}));
      if (data.hasAvailableImageModel) {
        setStatus(data.availableImageModels?.[0]?.model || data.imageModel || "Gemini 준비됨", "ok");
      } else if (data.freeImageFallback) {
        setStatus(`${data.freeImageProvider || "무료"} 생성 준비됨`, "ok");
      } else if (data.hasGeminiImageKey || data.hasGeminiKey) {
        setStatus("이미지 모델 확인 필요", "bad");
      } else {
        setStatus("Gemini 이미지 키 없음", "bad");
      }
    } catch {
      setStatus("상태 확인 실패", "bad");
    }
  }

  async function generateImage(event) {
    event.preventDefault();
    if (!validatePrompt()) return;
    if (!ensureTeacherCode()) {
      captionEl.textContent = "이미지 생성을 하려면 선생님 보안 코드가 필요합니다.";
      setStatus("코드 필요", "bad");
      return;
    }

    const prompt = input.value.trim();
    state.waiting = true;
    validatePrompt();
    stageEl.classList.add("is-loading");
    emptyEl.hidden = false;
    imageEl.hidden = true;
    captionEl.textContent = "이미지를 생성하고 있습니다.";
    generateButton.textContent = "생성 중";

    try {
      const response = await fetch(apiUrl("/api/generate-image"), {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          prompt,
          room: roomName,
          user: state.user,
          role: state.role || "teacher",
          team: state.team
        })
      });

      const data = await response.json().catch(() => ({}));
      if (response.status === 401 && data.requiresAccessCode) {
        sessionStorage.removeItem("class-access-code");
        state.accessCode = "";
        if (ensureAccessCode()) {
          await generateImage(event);
          return;
        }
      }
      if (response.status === 401 && data.code === "TEACHER_CODE_REQUIRED") {
        sessionStorage.removeItem("kit-teacher-access-code");
        state.teacherCode = "";
        if (ensureTeacherCode()) {
          await generateImage(event);
          return;
        }
      }
      if (!response.ok) {
        throw new Error(data.error || "이미지 생성에 실패했습니다.");
      }
      if (!data.imageDataUrl) {
        throw new Error("이미지 데이터가 비어 있습니다.");
      }

      imageEl.src = data.imageDataUrl;
      imageEl.hidden = false;
      emptyEl.hidden = true;
      captionEl.textContent = `생성 모델: ${generationModelLabel(data)}`;
      setStatus("생성 완료", "ok");
    } catch (error) {
      emptyEl.hidden = false;
      imageEl.hidden = true;
      captionEl.textContent = error.message || "이미지 생성에 실패했습니다.";
      setStatus("생성 실패", "bad");
    } finally {
      state.waiting = false;
      stageEl.classList.remove("is-loading");
      generateButton.textContent = "이미지 생성";
      validatePrompt();
    }
  }

  input.addEventListener("input", validatePrompt);
  form.addEventListener("submit", generateImage);
  timer.toggle.addEventListener("click", toggleTimer);
  timer.reset.addEventListener("click", resetTimer);

  renderTimer();
  validatePrompt();
  refreshApiStatus();
})();
