(function () {
  const accounts = {
    master: { password: "master1", role: "teacher", label: "선생용" },
    student: { password: "student1", role: "student", label: "학생용" }
  };

  const role = sessionStorage.getItem("kit-auth-role") || "";
  const user = sessionStorage.getItem("kit-auth-user") || "";
  const lastLoginKey = "kit-last-login-id";
  const fullscreenKey = "kit-fullscreen-start";

  function go(path) {
    window.location.href = path;
  }

  function homeFor(currentRole) {
    return currentRole === "teacher" ? "teacher.html" : "student.html";
  }

  function setupLogin() {
    const form = document.querySelector("[data-login-form]");
    if (!form) return;

    const panel = document.querySelector("[data-login-panel]");
    const message = document.querySelector("[data-login-message]");
    const submitButton = document.querySelector("[data-login-submit]");
    const submitText = document.querySelector("[data-submit-text]");
    const passwordToggle = document.querySelector("[data-password-toggle]");
    const fullscreenToggle = document.querySelector("[data-fullscreen-toggle]");
    const guide = document.querySelector("[data-student-guide]");
    const studentStart = document.querySelector("[data-student-start]");
    const userIdInput = form.elements.userId;
    const passwordInput = form.elements.password;
    let pendingPath = "";

    function setMessage(text, isOk) {
      if (!message) return;
      message.textContent = text;
      message.classList.toggle("is-ok", Boolean(isOk));
    }

    function setActiveRole(id) {
      document.querySelectorAll("[data-role-preset]").forEach((button) => {
        button.classList.toggle("is-active", button.dataset.rolePreset === id);
      });
    }

    function clearErrorState() {
      panel?.classList.remove("is-error");
      userIdInput.classList.remove("is-error");
      passwordInput.classList.remove("is-error");
      userIdInput.removeAttribute("aria-invalid");
      passwordInput.removeAttribute("aria-invalid");
    }

    function showError() {
      clearErrorState();
      setMessage("아이디 또는 비밀번호를 다시 확인하세요.", false);
      userIdInput.classList.add("is-error");
      passwordInput.classList.add("is-error");
      userIdInput.setAttribute("aria-invalid", "true");
      passwordInput.setAttribute("aria-invalid", "true");
      panel?.classList.add("is-error");
      window.setTimeout(() => panel?.classList.remove("is-error"), 260);
    }

    function lockLogin() {
      form.querySelectorAll("input, button").forEach((node) => {
        node.disabled = true;
      });
      document.querySelectorAll("[data-role-preset]").forEach((button) => {
        button.disabled = true;
      });
      submitButton?.classList.add("is-loading");
      if (submitText) submitText.textContent = "권한 확인 중";
    }

    function rememberLogin(id) {
      localStorage.setItem(lastLoginKey, id);
      localStorage.setItem(fullscreenKey, fullscreenToggle?.checked ? "1" : "0");
    }

    function requestFullscreenIfNeeded() {
      if (!fullscreenToggle?.checked) return;
      if (!document.fullscreenEnabled || document.fullscreenElement) return;
      document.documentElement.requestFullscreen().catch(() => {});
    }

    function completeLogin(account) {
      pendingPath = homeFor(account.role);
      sessionStorage.setItem("kit-auth-user", userIdInput.value.trim().toLowerCase());
      sessionStorage.setItem("kit-auth-role", account.role);
      rememberLogin(userIdInput.value.trim().toLowerCase());
      requestFullscreenIfNeeded();
      clearErrorState();
      lockLogin();
      setMessage(`${account.label} 계정 확인 완료.`, true);

      if (account.role === "student" && guide && studentStart) {
        window.setTimeout(() => {
          guide.hidden = false;
          studentStart.focus();
        }, 280);
        return;
      }

      window.setTimeout(() => go(pendingPath), 520);
    }

    document.querySelectorAll("[data-role-preset]").forEach((button) => {
      button.addEventListener("click", () => {
        const id = button.dataset.rolePreset || "";
        userIdInput.value = id;
        localStorage.setItem(lastLoginKey, id);
        setActiveRole(id);
        clearErrorState();
        setMessage("", false);
        passwordInput.focus();
      });
    });

    passwordToggle?.addEventListener("click", () => {
      const isHidden = passwordInput.type === "password";
      passwordInput.type = isHidden ? "text" : "password";
      passwordToggle.textContent = isHidden ? "숨김" : "보기";
      passwordToggle.setAttribute("aria-label", isHidden ? "비밀번호 숨기기" : "비밀번호 보기");
      passwordToggle.setAttribute("title", isHidden ? "비밀번호 숨기기" : "비밀번호 보기");
      passwordInput.focus();
    });

    userIdInput.addEventListener("keydown", (event) => {
      if (event.key !== "Enter") return;
      event.preventDefault();
      passwordInput.focus();
    });

    [userIdInput, passwordInput].forEach((input) => {
      input.addEventListener("input", () => {
        clearErrorState();
        setMessage("", false);
        if (input === userIdInput) setActiveRole(input.value.trim().toLowerCase());
      });
    });

    fullscreenToggle?.addEventListener("change", () => {
      localStorage.setItem(fullscreenKey, fullscreenToggle.checked ? "1" : "0");
    });

    studentStart?.addEventListener("click", () => {
      go(pendingPath || "student.html");
    });

    const lastLoginId = localStorage.getItem(lastLoginKey) || "student";
    userIdInput.value = lastLoginId;
    setActiveRole(lastLoginId);
    if (fullscreenToggle) fullscreenToggle.checked = localStorage.getItem(fullscreenKey) === "1";

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const id = userIdInput.value.trim().toLowerCase();
      const password = passwordInput.value.trim();
      const account = accounts[id];

      if (!account || account.password !== password) {
        showError();
        return;
      }

      completeLogin(account);
    });
  }

  function setupLogout() {
    document.querySelectorAll("[data-logout]").forEach((button) => {
      button.addEventListener("click", () => {
        sessionStorage.removeItem("kit-auth-user");
        sessionStorage.removeItem("kit-auth-role");
        go("school.html");
      });
    });
  }

  function setupHomeLinks() {
    document.querySelectorAll("[data-home-link]").forEach((link) => {
      link.setAttribute("href", homeFor(role));
    });
    document.querySelectorAll("[data-auth-label]").forEach((node) => {
      const account = accounts[user];
      node.textContent = account ? account.label : "";
    });
  }

  function guardPage() {
    const required = document.body?.dataset.auth || "";
    if (!required) return;

    if (!role) {
      go("school.html");
      return;
    }

    if (required === "teacher" && role !== "teacher") {
      go("student.html");
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    setupLogin();
    setupLogout();
    setupHomeLinks();
    guardPage();
  });
})();
