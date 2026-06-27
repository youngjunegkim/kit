(function () {
  const creditCounts = [...document.querySelectorAll("[data-credit-count]")];
  const teamLabels = [...document.querySelectorAll("[data-team-label]")];
  const logCounts = [...document.querySelectorAll("[data-log-count]")];
  const refreshButtons = [...document.querySelectorAll("[data-refresh-credits]")];
  const studentLogList = document.querySelector("[data-student-log-list]");
  if (!creditCounts.length && !teamLabels.length && !logCounts.length && !studentLogList && !refreshButtons.length) return;

  const team = sessionStorage.getItem("kit-auth-team") || "";
  const role = sessionStorage.getItem("kit-auth-role") || "";
  const classId = sessionStorage.getItem("kit-class-section") || localStorage.getItem("kit-last-class-section") || "class-a";

  function setCreditText(text) {
    creditCounts.forEach((node) => {
      node.textContent = text;
    });
  }

  function setLogCount(count) {
    logCounts.forEach((node) => {
      node.textContent = `${Number(count || 0)}회`;
    });
  }

  function setRefreshBusy(isBusy) {
    refreshButtons.forEach((button) => {
      button.disabled = isBusy;
      button.textContent = isBusy ? "받는 중..." : "질문권 받기";
    });
  }

  function formatLogTime(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return date.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });
  }

  function renderStudentLogs(logs) {
    if (!studentLogList) return;
    studentLogList.textContent = "";

    if (!logs.length) {
      const empty = document.createElement("p");
      empty.className = "student-log-empty";
      empty.textContent = "아직 질문 로그가 없습니다.";
      studentLogList.append(empty);
      return;
    }

    logs.slice(0, 12).forEach((entry) => {
      const item = document.createElement("article");
      item.className = "student-log-entry";

      const meta = document.createElement("span");
      meta.textContent = `${formatLogTime(entry.at)} · ${entry.count || 0}번째 질문`;

      const text = document.createElement("p");
      text.textContent = entry.message || "질문 내용 없음";

      item.append(meta, text);
      studentLogList.append(item);
    });
  }

  async function refreshCredits() {
    if (!team) {
      setCreditText("학생 없음");
      setLogCount(0);
      renderStudentLogs([]);
      return;
    }

    teamLabels.forEach((node) => {
      node.textContent = team;
    });

    try {
      setRefreshBusy(true);
      const response = await fetch(`/api/credits?team=${encodeURIComponent(team)}&classId=${encodeURIComponent(classId)}`, {
        headers: {
          "x-kit-role": role,
          "x-kit-class": classId,
          "x-kit-team": encodeURIComponent(team)
        }
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "sync failed");
      setCreditText(`${Number(data.credits || 0)}개`);
      setLogCount(data.count || 0);
      renderStudentLogs(Array.isArray(data.logs) ? data.logs : []);
    } catch {
      setCreditText("받기 실패");
    } finally {
      setRefreshBusy(false);
    }
  }

  teamLabels.forEach((node) => {
    node.textContent = team || "학생";
  });
  setCreditText(team ? "받기 필요" : "학생 없음");
  setLogCount(0);
  renderStudentLogs([]);

  refreshButtons.forEach((button) => {
    button.addEventListener("click", refreshCredits);
  });
})();
