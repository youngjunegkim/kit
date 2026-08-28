(function () {
  const teacherAccount = { user: "master", password: "master1", role: "teacher", label: "선생님" };
  const studentTeams = ["january", "february", "march", "april", "may", "june", "july", "august"];

  const role = sessionStorage.getItem("kit-auth-role") || "";
  const user = sessionStorage.getItem("kit-auth-user") || "";
  const team = sessionStorage.getItem("kit-auth-team") || "";
  const lastLoginKey = "kit-last-login-id";
  const fullscreenKey = "kit-fullscreen-start";
  const teacherCodeKey = "kit-teacher-access-code";
  const teacherMainSoundKey = "kit-teacher-main-sound";
  const teacherRoomSoundKey = "kit-teacher-room-sound";
  const classKey = "kit-class-section";
  const classLabelKey = "kit-class-label";
  const lastClassKey = "kit-last-class-section";
  const defaultClassId = "class-a";

  function classLabelFor() {
    return "우리 반";
  }

  function teacherAccountIdForClass() {
    return "master";
  }

  function isTeacherAccountId(id) {
    return String(id || "").trim().toLowerCase() === "master";
  }

  function classIdForAccount() {
    return defaultClassId;
  }

  function currentClassId() {
    return defaultClassId;
  }

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
      const normalizedId = String(id || "").trim().toLowerCase();
      document.querySelectorAll("[data-role-preset]").forEach((button) => {
        const preset = button.dataset.rolePreset || "";
        const isActive = preset === "master"
          ? isTeacherAccountId(normalizedId)
          : Boolean(normalizedId) && !isTeacherAccountId(normalizedId);
        button.classList.toggle("is-active", isActive);
      });
    }

    function clearErrorState() {
      panel?.classList.remove("is-error");
      userIdInput.classList.remove("is-error");
      passwordInput.classList.remove("is-error");
      userIdInput.removeAttribute("aria-invalid");
      passwordInput.removeAttribute("aria-invalid");
    }

    function showError(text = "아이디 또는 비밀번호를 다시 확인하세요.") {
      clearErrorState();
      setMessage(text, false);
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

    function setLoginChecking(isChecking) {
      submitButton.disabled = isChecking;
      submitButton.classList.toggle("is-loading", isChecking);
      if (submitText) submitText.textContent = isChecking ? "권한 확인 중" : "입장";
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
      const classId = classIdForAccount();
      const loginId = String(account.user || userIdInput.value).trim().toLowerCase();
      sessionStorage.setItem("kit-auth-user", loginId);
      sessionStorage.setItem("kit-auth-role", account.role);
      sessionStorage.setItem("kit-auth-label", account.label);
      sessionStorage.setItem(classKey, classId);
      sessionStorage.setItem(classLabelKey, classLabelFor(classId));
      localStorage.setItem(lastClassKey, classId);
      if (account.team) {
        sessionStorage.setItem("kit-auth-team", account.team);
      } else {
        sessionStorage.removeItem("kit-auth-team");
      }
      if (account.role === "teacher") {
        sessionStorage.setItem(teacherCodeKey, passwordInput.value.trim());
        sessionStorage.setItem(teacherMainSoundKey, "1");
      } else {
        sessionStorage.removeItem(teacherCodeKey);
      }
      rememberLogin(loginId);
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
        const preset = button.dataset.rolePreset || "";
        const id = preset === "master" ? teacherAccountIdForClass() : preset;
        userIdInput.value = id;
        if (id) {
          localStorage.setItem(lastLoginKey, id);
        } else {
          localStorage.removeItem(lastLoginKey);
        }
        setActiveRole(id);
        clearErrorState();
        setMessage("", false);
        if (id) {
          passwordInput.focus();
        } else {
          userIdInput.focus();
        }
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
        if (input === userIdInput) {
          const id = input.value.trim().toLowerCase();
          setActiveRole(id);
        }
      });
    });

    fullscreenToggle?.addEventListener("change", () => {
      localStorage.setItem(fullscreenKey, fullscreenToggle.checked ? "1" : "0");
    });

    studentStart?.addEventListener("click", () => {
      go(pendingPath || "student.html");
    });

    localStorage.removeItem(lastLoginKey);
    userIdInput.value = "";
    setActiveRole("");
    if (fullscreenToggle) fullscreenToggle.checked = localStorage.getItem(fullscreenKey) === "1";

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const id = userIdInput.value.trim().toLowerCase();
      const password = passwordInput.value.trim();
      if (!id || !password) {
        showError();
        return;
      }

      if (isTeacherAccountId(id)) {
        if (password !== teacherAccount.password) {
          showError();
          return;
        }
        completeLogin(teacherAccount);
        return;
      }

      setLoginChecking(true);
      try {
        const response = await fetch("api/credits", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ action: "studentaccountlogin", id, password })
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || !data.account) {
          showError(data.error || "아이디 또는 비밀번호를 다시 확인하세요.");
          return;
        }
        completeLogin(data.account);
      } catch {
        showError("계정 확인 서버에 연결하지 못했습니다. 잠시 후 다시 시도하세요.");
      } finally {
        if (!pendingPath) setLoginChecking(false);
      }
    });
  }

  function setupStudentAccountAdmin() {
    const openButton = document.querySelector("[data-account-admin-open]");
    const modal = document.querySelector("[data-account-admin]");
    if (!openButton || !modal) return;

    const closeButtons = modal.querySelectorAll("[data-account-admin-close]");
    const unlockForm = modal.querySelector("[data-account-admin-unlock]");
    const editor = modal.querySelector("[data-account-admin-editor]");
    const list = modal.querySelector("[data-account-admin-list]");
    const saveButton = modal.querySelector("[data-account-admin-save]");
    const message = modal.querySelector("[data-account-admin-message]");
    const codeInput = unlockForm.elements.teacherCode;
    let teacherCode = "";
    let lastFocus = null;

    function setAdminMessage(text, isOk = false) {
      message.textContent = text;
      message.classList.toggle("is-ok", isOk);
    }

    function setAdminBusy(button, isBusy, busyText, idleText) {
      button.disabled = isBusy;
      button.textContent = isBusy ? busyText : idleText;
    }

    function closeAdmin() {
      modal.hidden = true;
      document.body.classList.remove("is-account-admin-open");
      teacherCode = "";
      codeInput.value = "";
      editor.hidden = true;
      unlockForm.hidden = false;
      list.replaceChildren();
      setAdminMessage("");
      lastFocus?.focus();
    }

    function renderAccounts(accounts) {
      list.replaceChildren();
      accounts.forEach((account) => {
        const row = document.createElement("div");
        row.className = "account-admin-row";
        row.dataset.team = account.team;

        const teamLabel = document.createElement("strong");
        teamLabel.textContent = `${account.label}팀`;

        const idLabel = document.createElement("label");
        idLabel.textContent = "아이디";
        const idInput = document.createElement("input");
        idInput.type = "text";
        idInput.value = account.id;
        idInput.maxLength = 24;
        idInput.autocomplete = "off";
        idInput.dataset.accountId = "";
        idLabel.append(idInput);

        const passwordLabel = document.createElement("label");
        passwordLabel.textContent = "새 비밀번호";
        const passwordInput = document.createElement("input");
        passwordInput.type = "password";
        passwordInput.placeholder = "변경할 때만 입력";
        passwordInput.maxLength = 64;
        passwordInput.autocomplete = "new-password";
        passwordInput.dataset.accountPassword = "";
        passwordLabel.append(passwordInput);

        row.append(teamLabel, idLabel, passwordLabel);
        list.append(row);
      });
    }

    async function loadAccounts() {
      const response = await fetch("api/credits?studentAccounts=1", {
        headers: {
          "x-kit-role": "teacher",
          "x-teacher-code": teacherCode
        }
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !Array.isArray(data.accounts)) {
        throw new Error(data.error || "학생 계정을 불러오지 못했습니다.");
      }
      renderAccounts(data.accounts);
      unlockForm.hidden = true;
      editor.hidden = false;
      setAdminMessage("아이디 또는 필요한 팀의 새 비밀번호를 수정한 뒤 저장하세요.");
      list.querySelector("input")?.focus();
    }

    openButton.addEventListener("click", () => {
      lastFocus = document.activeElement;
      modal.hidden = false;
      document.body.classList.add("is-account-admin-open");
      codeInput.focus();
    });

    closeButtons.forEach((button) => button.addEventListener("click", closeAdmin));
    modal.addEventListener("click", (event) => {
      if (event.target === modal) closeAdmin();
    });

    unlockForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      teacherCode = codeInput.value.trim();
      if (!teacherCode) {
        setAdminMessage("관리자 비밀번호를 입력하세요.");
        return;
      }
      const button = unlockForm.querySelector("button[type='submit']");
      setAdminBusy(button, true, "확인 중", "계정 불러오기");
      try {
        await loadAccounts();
      } catch (error) {
        teacherCode = "";
        setAdminMessage(error.message);
        codeInput.select();
      } finally {
        setAdminBusy(button, false, "확인 중", "계정 불러오기");
      }
    });

    saveButton.addEventListener("click", async () => {
      const accounts = [...list.querySelectorAll(".account-admin-row")].map((row) => ({
        team: row.dataset.team,
        id: row.querySelector("[data-account-id]").value,
        password: row.querySelector("[data-account-password]").value
      }));
      setAdminBusy(saveButton, true, "저장 중", "변경 저장");
      try {
        const response = await fetch("api/credits", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-kit-role": "teacher",
            "x-teacher-code": teacherCode
          },
          body: JSON.stringify({ action: "studentaccountupdate", accounts })
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || !data.ok) {
          throw new Error(data.error || "계정 변경 내용을 저장하지 못했습니다.");
        }
        renderAccounts(data.accounts);
        setAdminMessage("학생 계정 변경을 저장했습니다. 다음 로그인부터 적용됩니다.", true);
      } catch (error) {
        setAdminMessage(error.message);
      } finally {
        setAdminBusy(saveButton, false, "저장 중", "변경 저장");
      }
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && !modal.hidden) closeAdmin();
    });
  }

  function setupLogout() {
    document.querySelectorAll("[data-logout]").forEach((button) => {
      button.addEventListener("click", () => {
        const password = window.prompt("로그아웃하려면 비밀번호를 입력하세요.");
        if (password === null) return;
        if (password !== "kit") {
          window.alert("비밀번호가 맞지 않아 로그아웃하지 않았습니다.");
          return;
        }

        sessionStorage.removeItem("kit-auth-user");
        sessionStorage.removeItem("kit-auth-role");
        sessionStorage.removeItem("kit-auth-label");
        sessionStorage.removeItem("kit-auth-team");
        sessionStorage.removeItem(classKey);
        sessionStorage.removeItem(classLabelKey);
        sessionStorage.removeItem(teacherCodeKey);
        sessionStorage.removeItem(teacherMainSoundKey);
        sessionStorage.removeItem(teacherRoomSoundKey);
        go("school.html");
      });
    });
  }

  function setupHomeLinks() {
    document.querySelectorAll("[data-home-link]").forEach((link) => {
      link.setAttribute("href", homeFor(role));
    });
    document.querySelectorAll("[data-auth-label]").forEach((node) => {
      node.textContent = sessionStorage.getItem("kit-auth-label") || (role === "teacher" ? "선생님" : "");
    });
  }

  function guardPage() {
    const required = document.body?.dataset.auth || "";
    if (!required) return;

    if (!role) {
      go("school.html");
      return;
    }

    const classId = currentClassId();
    sessionStorage.setItem(classKey, classId);
    sessionStorage.setItem(classLabelKey, classLabelFor());
    localStorage.setItem(lastClassKey, classId);

    const invalidStudentSession = role === "student" && (
      !team ||
      !user ||
      !studentTeams.includes(team)
    );
    if (invalidStudentSession) {
      sessionStorage.removeItem("kit-auth-user");
      sessionStorage.removeItem("kit-auth-role");
      sessionStorage.removeItem("kit-auth-label");
      sessionStorage.removeItem("kit-auth-team");
      go("school.html");
      return;
    }

    if (required === "teacher" && role !== "teacher") {
      go("student.html");
      return;
    }

    if (required === "student" && role !== "student") {
      go("teacher.html");
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    setupLogin();
    setupStudentAccountAdmin();
    setupLogout();
    setupHomeLinks();
    guardPage();
  });
})();
