(function () {
  let refreshBusy = false;

  function sessionAccount() {
    return {
      user: sessionStorage.getItem("kit-auth-user") || "",
      role: sessionStorage.getItem("kit-auth-role") || "",
      label: sessionStorage.getItem("kit-auth-label") || "",
      team: sessionStorage.getItem("kit-auth-team") || ""
    };
  }

  function hasPresenceUi() {
    return Boolean(document.querySelector("[data-presence-list], [data-presence-count], [data-refresh-presence]"));
  }

  function accountHeaders(account) {
    return {
      "content-type": "application/json",
      "x-kit-user": account.user,
      "x-kit-role": account.role,
      "x-kit-label": account.label || account.user,
      "x-kit-team": account.team || ""
    };
  }

  function roleText(role) {
    return role === "teacher" ? "선생님" : "학생";
  }

  function renderPresence(online = [], emptyText = "아직 접속 중인 계정이 없습니다.") {
    const visible = Array.isArray(online) ? online : [];
    document.querySelectorAll("[data-presence-count]").forEach((node) => {
      node.textContent = `${visible.length}명`;
    });

    document.querySelectorAll("[data-presence-list]").forEach((list) => {
      list.textContent = "";

      if (!visible.length) {
        const empty = document.createElement("p");
        empty.className = "presence-empty";
        empty.textContent = emptyText;
        list.append(empty);
        return;
      }

      visible.forEach((account) => {
        const row = document.createElement("div");
        row.className = "presence-row";

        const main = document.createElement("span");
        main.className = "presence-name";
        main.textContent = account.label || account.user;

        const meta = document.createElement("span");
        meta.className = "presence-role";
        meta.textContent = roleText(account.role);

        row.append(main, meta);
        list.append(row);
      });
    });
  }

  async function requestPresence(action = "touch") {
    const account = sessionAccount();
    if (!account.user || !account.role) return null;

    const response = await fetch("/api/presence", {
      method: "POST",
      headers: accountHeaders(account),
      body: JSON.stringify({ ...account, action }),
      keepalive: action === "leave",
      cache: "no-store"
    });
    return response.json();
  }

  function setPresenceButtonsBusy(isBusy) {
    refreshBusy = isBusy;
    document.querySelectorAll("[data-refresh-presence]").forEach((button) => {
      if (!button.dataset.defaultText) {
        button.dataset.defaultText = button.textContent.trim() || "접속중 인원 보기";
      }
      button.disabled = isBusy;
      button.textContent = isBusy ? "확인 중" : button.dataset.defaultText;
    });
  }

  async function refreshPresence() {
    if (refreshBusy) return;
    setPresenceButtonsBusy(true);
    try {
      const data = await requestPresence("touch");
      if (data?.online) renderPresence(data.online);
    } catch {
      renderPresence([], "접속 정보를 불러오지 못했습니다.");
    } finally {
      setPresenceButtonsBusy(false);
    }
  }

  function leavePresence() {
    const account = sessionAccount();
    if (!account.user || !account.role) return;

    const payload = JSON.stringify({ ...account, action: "leave" });
    if (navigator.sendBeacon) {
      const blob = new Blob([payload], { type: "application/json" });
      navigator.sendBeacon("/api/presence", blob);
      return;
    }

    fetch("/api/presence", {
      method: "POST",
      headers: accountHeaders(account),
      body: payload,
      keepalive: true
    }).catch(() => {});
  }

  function startPresence() {
    if (!hasPresenceUi()) return;
    const account = sessionAccount();
    if (!account.user || !account.role) return;

    renderPresence([], "접속 정보를 아직 불러오지 않았습니다.");

    document.querySelectorAll("[data-refresh-presence]").forEach((button) => {
      button.addEventListener("click", refreshPresence);
    });

    document.querySelectorAll("[data-logout]").forEach((button) => {
      button.addEventListener("click", leavePresence, { capture: true });
    });
  }

  document.addEventListener("DOMContentLoaded", startPresence);
})();
