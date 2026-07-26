(function () {
  const classId = sessionStorage.getItem("kit-class-section") || localStorage.getItem("kit-last-class-section") || "class-a";
  const STORAGE_KEY = `kit-case-note-similarity-v1:${classId}`;
  const standardNote = [
    "범인은 강우진이고, 사건 장소는 교무실이다.",
    "범인은 학교 학습 도우미 AI를 사용해 교무실에서 기말고사 문제지를 태블릿으로 촬영한 뒤, 그 내용을 기반으로 비슷한 유형의 기말 예상 문제지를 만드는 방식으로 범행을 저지르다가 시험 예상 문제가 유출되었다.",
    "그 근거는 전 여자친구에 의한 시험 압박, 오후 6시에 학교 학습 도우미 AI에 접속, 교무실 복도 앞에서 태블릿을 들고 있는 모습이 찍힌 CCTV, 오후 6시 15분에 \"기말고사 문제지를 기반으로 비슷한 유형의 기말 예상 문제지를 만들어줘\"라는 AI 대화 기록 일부이다.",
    "범인에게 가장 부족했던 AI 윤리 역량은 주체성이다."
  ].join("\n");

  const rubric = [
    {
      id: "culprit",
      label: "범인 지목",
      max: 16,
      checks: [
        { label: "강우진을 범인으로 지목", points: 16, patterns: [/강\s*우\s*진/, /우진/] }
      ]
    },
    {
      id: "place",
      label: "사건 장소",
      max: 10,
      checks: [
        { label: "사건 장소를 교무실로 제시", points: 10, patterns: [/교무실/] }
      ]
    },
    {
      id: "method",
      label: "범행 방식",
      max: 22,
      checks: [
        { label: "학교 학습 도우미 AI 사용", points: 5, patterns: [/학습\s*도우미/, /학교\s*ai/i, /ai/i, /인공지능/] },
        { label: "기말고사 문제지를 태블릿으로 촬영", points: 5, patterns: [/(태블릿|테블릿).*(촬영|찍)/, /(촬영|찍).*(태블릿|테블릿)/, /문제지.*사진/, /시험지.*사진/] },
        { label: "교무실 기말고사 문제지 기반", points: 6, patterns: [/교무실.*(기말|시험|문제지)/, /(기말|시험|문제지).*교무실/, /문제지.*기반/, /기반.*문제지/, /문제지.*봤/, /문제지.*보았/] },
        { label: "비슷한 유형의 기말 예상 문제 생성", points: 6, patterns: [/비슷한\s*유형/, /비슷.*문제/, /유사.*문제/, /기말.*예상/, /예상\s*문제/, /문제.*만들/, /만들어줘/, /생성/] }
      ]
    },
    {
      id: "leak",
      label: "유출 결과",
      max: 8,
      checks: [
        { label: "시험 예상 문제가 유출됨", points: 8, patterns: [/유출/, /퍼졌/, /노출/, /공개/, /공유/, /새어\s*나/] }
      ]
    },
    {
      id: "evidence",
      label: "근거 제시",
      max: 26,
      checks: [
        { label: "전 여자친구에 의한 시험 압박", points: 6, patterns: [/전\s*여자친구/, /전여친/, /여친/, /시험\s*압박/, /압박/, /성적/, /점수/] },
        { label: "오후 6시 학교 학습 도우미 AI 접속", points: 6, patterns: [/6\s*시.*(ai|학습\s*도우미|접속)/i, /(ai|학습\s*도우미|접속).*6\s*시/i] },
        { label: "교무실 복도 앞 태블릿 CCTV", points: 6, patterns: [/교무실.*(복도|앞).*cctv/i, /cctv.*교무실/i, /복도.*cctv/i, /(태블릿|테블릿).*cctv/i, /cctv.*(태블릿|테블릿)/i] },
        { label: "오후 6시 15분 AI 대화 기록", points: 8, patterns: [/6\s*시\s*15\s*분/i, /6:15/, /18:15/, /대화\s*기록/, /기록\s*일부/, /문제지.*만들어줘/, /비슷한\s*유형.*만들/] }
      ]
    },
    {
      id: "ethics",
      label: "AI 윤리 역량",
      max: 18,
      checks: [
        { label: "부족한 AI 윤리 역량을 주체성으로 제시", points: 18, patterns: [/주체성/] }
      ]
    }
  ];

  const defaultTeams = ["1팀", "2팀", "3팀", "4팀"];
  const studentTeamIds = {
    "승우": "1",
    "연수": "2",
    "은혁": "3",
    "영준": "4",
    "혜빈": "5",
    "윤지": "6",
    "가빈": "7",
    "채희": "8"
  };
  const elements = {
    standardNote: document.querySelector("[data-standard-note]"),
    rubricList: document.querySelector("[data-rubric-list]"),
    teamList: document.querySelector("[data-team-list]"),
    rankingList: document.querySelector("[data-ranking-list]"),
    teamCount: document.querySelector("[data-team-count]"),
    applyTeamCount: document.querySelector("[data-apply-team-count]"),
    addTeam: document.querySelector("[data-add-team]"),
    scoreAll: document.querySelector("[data-score-all]"),
    importStudentSentences: document.querySelector("[data-import-student-sentences]"),
    clearStudentSentences: document.querySelector("[data-clear-student-sentences]"),
    studentSentenceStatus: document.querySelector("[data-student-sentence-status]"),
    exportCsv: document.querySelector("[data-export-csv]"),
    resetAll: document.querySelector("[data-reset-all]"),
    teamTotal: document.querySelector("[data-team-total]"),
    averageScore: document.querySelector("[data-average-score]"),
    reportStatus: document.querySelector("[data-report-status]"),
    readAllReports: document.querySelector("[data-read-all-reports]"),
    reportList: document.querySelector("[data-report-list]"),
    revealStage: document.querySelector("[data-reveal-stage]"),
    revealEyebrow: document.querySelector("[data-reveal-eyebrow]"),
    revealTitle: document.querySelector("[data-reveal-title]"),
    revealScore: document.querySelector("[data-reveal-score]"),
    revealBar: document.querySelector("[data-reveal-bar]"),
    revealSummary: document.querySelector("[data-reveal-summary]"),
    revealReport: document.querySelector("[data-reveal-report]"),
    revealProgress: document.querySelector("[data-reveal-progress]"),
    revealNext: document.querySelector("[data-reveal-next]"),
    revealClose: document.querySelector("[data-reveal-close]")
  };

  const state = {
    teams: defaultTeams.map((name, index) => createTeam(name, index + 1)),
    reports: [],
    isMeasuring: false,
    speakingKey: "",
    speechUtterance: null,
    speechAudio: null,
    speechAudioUrl: "",
    speechSessionId: 0,
    revealReports: [],
    revealIndex: 0,
    revealAnimating: false
  };

  function createTeam(name, number) {
    return {
      id: `team-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      name: name || `${number || state.teams.length + 1}팀`,
      note: "",
      result: null,
      remainingCredits: 0
    };
  }

  function currentClassId() {
    return classId;
  }

  function setStudentSentenceStatus(text, type = "") {
    if (!elements.studentSentenceStatus) return;
    elements.studentSentenceStatus.textContent = text;
    elements.studentSentenceStatus.classList.toggle("is-ok", type === "ok");
    elements.studentSentenceStatus.classList.toggle("is-bad", type === "bad");
  }

  function teamKey(value) {
    const raw = String(value || "")
      .normalize("NFKC")
      .replace(/\s+/g, "")
      .toLowerCase();
    const koreanName = raw.replace(/팀$/, "").replace(/번$/, "");
    if (studentTeamIds[koreanName]) return studentTeamIds[koreanName];
    const numeric = koreanName.match(/^[1-8]$/)?.[0];
    return numeric || koreanName;
  }

  function teamDisplayName(value) {
    const key = teamKey(value);
    if (/^[1-8]$/.test(key)) return `${key}팀`;
    return String(value || "학생").trim();
  }

  function sentenceLabel(entry) {
    return teamDisplayName(entry.team || entry.user || "학생");
  }

  function cleanRemainingCredits(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) return 0;
    return Math.max(0, Math.round(number));
  }

  function latestSentenceEntries(entries = []) {
    const seen = new Set();
    const latest = [];
    entries.forEach((entry) => {
      const sentence = String(entry?.sentence || "").trim();
      const label = sentenceLabel(entry);
      const key = teamKey(label);
      if (!sentence || !key || seen.has(key)) return;
      seen.add(key);
      latest.push({ ...entry, sentence, label, remainingCredits: cleanRemainingCredits(entry.remainingCredits) });
    });
    return latest;
  }

  function targetTeamForSentence(entry) {
    const key = teamKey(entry.label);
    return state.teams.find((team) => teamKey(team.name) === key) ||
      state.teams.find((team) => !String(team.note || "").trim()) ||
      null;
  }

  async function importStudentSentences() {
    if (!elements.importStudentSentences) return;
    syncFromDom();
    elements.importStudentSentences.disabled = true;
    const clearWasDisabled = Boolean(elements.clearStudentSentences?.disabled);
    if (elements.clearStudentSentences) elements.clearStudentSentences.disabled = true;
    const originalText = elements.importStudentSentences.textContent;
    elements.importStudentSentences.textContent = "불러오는 중";
    setStudentSentenceStatus("학생 문장을 불러오는 중입니다.");

    try {
      const response = await fetch(`/api/similarity-sentences?classId=${encodeURIComponent(currentClassId())}`, {
        cache: "no-store",
        headers: {
          "x-kit-role": "teacher",
          "x-kit-class": currentClassId()
        }
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !Array.isArray(data.sentences)) {
        throw new Error(data.error || "학생 문장을 불러오지 못했습니다.");
      }

      const entries = latestSentenceEntries(data.sentences);
      if (!entries.length) {
        setStudentSentenceStatus("아직 학생이 보낸 문장이 없습니다.", "bad");
        return;
      }

      const willOverwrite = entries.some((entry) => {
        const target = state.teams.find((team) => teamKey(team.name) === teamKey(entry.label));
        return target && String(target.note || "").trim() && target.note.trim() !== entry.sentence;
      });
      if (willOverwrite && !window.confirm("같은 팀 이름의 기존 입력문을 학생이 보낸 문장으로 바꿀까요?")) {
        setStudentSentenceStatus("학생 문장 받기를 취소했습니다.", "bad");
        return;
      }

      let imported = 0;
      entries.forEach((entry) => {
        let team = targetTeamForSentence(entry);
        if (!team) {
          team = createTeam(entry.label, state.teams.length + 1);
          state.teams.push(team);
        }
        team.name = entry.label;
        team.note = entry.sentence;
        team.remainingCredits = cleanRemainingCredits(entry.remainingCredits);
        team.result = null;
        imported += 1;
      });

      state.reports = [];
      state.teams.forEach((team) => {
        team.result = null;
      });
      saveState();
      renderTeams();
      renderRanking();
      renderReports([], `학생 문장 ${imported}개와 남은 질문권 보너스를 입력칸에 반영했습니다. 유사도 측정을 누르기 전까지는 채점하지 않습니다.`);
      setStudentSentenceStatus(`학생 문장 ${imported}개를 받았습니다. 남은 질문권은 측정 시 1개당 1점으로 반영됩니다.`, "ok");
    } catch (error) {
      setStudentSentenceStatus(error.message || "학생 문장 받기에 실패했습니다.", "bad");
    } finally {
      elements.importStudentSentences.disabled = false;
      if (elements.clearStudentSentences) elements.clearStudentSentences.disabled = clearWasDisabled;
      elements.importStudentSentences.textContent = originalText;
    }
  }

  async function clearStudentSentences() {
    if (!elements.clearStudentSentences) return;
    if (!window.confirm("학생들이 보낸 유사도 측정 문장을 모두 초기화할까요? 입력칸에 이미 가져온 문장은 유지됩니다.")) return;

    elements.clearStudentSentences.disabled = true;
    const importWasDisabled = Boolean(elements.importStudentSentences?.disabled);
    if (elements.importStudentSentences) elements.importStudentSentences.disabled = true;
    const originalText = elements.clearStudentSentences.textContent;
    elements.clearStudentSentences.textContent = "초기화 중";
    setStudentSentenceStatus("학생 문장을 초기화하는 중입니다.");

    try {
      const response = await fetch("/api/similarity-sentences", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-kit-role": "teacher",
          "x-kit-class": currentClassId()
        },
        body: JSON.stringify({
          action: "clear",
          classId: currentClassId()
        })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || "학생 문장 초기화에 실패했습니다.");
      }

      const removed = data.removed || 0;
      const storageNote = data.persistent ? "" : " 공유 저장소가 연결되지 않아 현재 서버 기준으로 처리했습니다.";
      setStudentSentenceStatus(`학생 문장 ${removed}개를 초기화했습니다.${storageNote}`, data.persistent ? "ok" : "bad");
    } catch (error) {
      setStudentSentenceStatus(error.message || "학생 문장 초기화에 실패했습니다.", "bad");
    } finally {
      elements.clearStudentSentences.disabled = false;
      if (elements.importStudentSentences) elements.importStudentSentences.disabled = importWasDisabled;
      elements.clearStudentSentences.textContent = originalText;
    }
  }

  function normalize(text) {
    return String(text || "")
      .normalize("NFKC")
      .toLowerCase()
      .replace(/[“”"']/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function compact(text) {
    return normalize(text).replace(/\s+/g, "");
  }

  function hasAny(text, patterns) {
    return patterns.some((pattern) => pattern.test(text));
  }

  function checkMatches(note, check) {
    const raw = normalize(note);
    const tight = compact(note);
    return hasAny(raw, check.patterns) || hasAny(tight, check.patterns);
  }

  function wrongCulpritPenalty(note, hasKang) {
    const raw = normalize(note);
    const wrongName = /(서\s*하\s*린|하린|최\s*다\s*니\s*엘|다니엘)/;
    const wrongCulprit = /범인(은|이|은\s*아마|은\s*바로)?\s*(서\s*하\s*린|하린|최\s*다\s*니\s*엘|다니엘)|(서\s*하\s*린|하린|최\s*다\s*니\s*엘|다니엘)(이|가)?\s*범인/.test(raw);
    const negated = new RegExp(`${wrongName.source}.{0,8}범인.{0,8}아니|${wrongName.source}.{0,8}아니.{0,8}범인`).test(raw);
    if (negated) return { penalty: 0, cap: 100, reason: "" };
    if (!wrongCulprit) return { penalty: 0, cap: 100, reason: "" };
    if (hasKang) return { penalty: 5, cap: 100, reason: "다른 용의자를 함께 범인처럼 언급해 5점 감점" };
    return { penalty: 0, cap: 55, reason: "강우진이 아닌 다른 용의자를 범인으로 지목해 최고점 55점 제한" };
  }

  function roundScore(value) {
    const score = Math.max(0, Math.min(100, Number(value) || 0));
    return Math.round(score * 10) / 10;
  }

  function roundScoreUncapped(value) {
    const score = Math.max(0, Number(value) || 0);
    return Math.round(score * 10) / 10;
  }

  function formatScore(value) {
    const score = roundScoreUncapped(value);
    return Number.isInteger(score) ? String(score) : score.toFixed(1);
  }

  function questionCreditBonusFor(remainingCredits) {
    const credits = cleanRemainingCredits(remainingCredits);
    return {
      credits,
      score: credits,
      reason: credits ? `남은 질문권 ${credits}개 = +${credits}점` : "남은 질문권 보너스 없음"
    };
  }

  function scoreNote(note, remainingCredits = 0) {
    const details = rubric.map((item) => {
      let score = 0;
      const matches = [];
      const misses = [];
      item.checks.forEach((check) => {
        if (checkMatches(note, check)) {
          score += check.points;
          matches.push(check.label);
        } else {
          misses.push(check.label);
        }
      });
      return {
        id: item.id,
        label: item.label,
        score,
        max: item.max,
        matches,
        misses
      };
    });

    const hasKang = details.find((item) => item.id === "culprit")?.score > 0;
    const penalty = wrongCulpritPenalty(note, hasKang);
    const rawScore = details.reduce((sum, item) => sum + item.score, 0);
    const adjusted = Math.max(0, Math.min(100, Math.min(rawScore - penalty.penalty, penalty.cap)));
    const baseScore = Math.round(adjusted);
    const contentScore = roundScore(Math.min(penalty.cap, baseScore));
    const questionCreditBonus = questionCreditBonusFor(remainingCredits);
    const totalScore = contentScore + questionCreditBonus.score;
    const cappedTotal = penalty.cap < 100 ? Math.min(penalty.cap, totalScore) : totalScore;
    return {
      score: roundScoreUncapped(cappedTotal),
      contentScore,
      baseScore,
      rawScore,
      penalty,
      questionCreditBonus,
      details
    };
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function loadState() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "");
      if (!parsed || !Array.isArray(parsed.teams) || !parsed.teams.length) return;
      state.teams = parsed.teams.map((team, index) => ({
        id: String(team.id || `saved-${index}`),
        name: teamDisplayName(team.name || `${index + 1}팀`),
        note: String(team.note || ""),
        result: String(team.note || "").trim() && team.result ? team.result : null,
        remainingCredits: cleanRemainingCredits(team.remainingCredits)
      }));
      state.reports = Array.isArray(parsed.reports) ? parsed.reports : [];
    } catch {
      state.teams = defaultTeams.map((name, index) => createTeam(name, index + 1));
      state.reports = [];
    }
  }

  function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      teams: state.teams.map((team) => ({
        id: team.id,
        name: team.name,
        note: team.note,
        result: team.result,
        remainingCredits: cleanRemainingCredits(team.remainingCredits)
      })),
      reports: state.reports
    }));
  }

  function renderRubric() {
    elements.rubricList.innerHTML = rubric.map((item) => `
      <div class="rubric-item">
        <strong>${escapeHtml(item.label)}</strong>
        <span>${item.max}점</span>
      </div>
    `).join("");
  }

  function renderTeams(options = {}) {
    const animate = Boolean(options.animate);
    elements.teamCount.value = state.teams.length;
    elements.teamList.innerHTML = state.teams.map((team, index) => {
      const result = team.result || null;
      const hasResult = Boolean(team.note.trim() && result);
      const score = hasResult ? result.score : 0;
      const displayScore = animate && team.note.trim() ? 0 : score;
      const measuringClass = animate && team.note.trim() ? " is-measuring" : "";
      const scoreText = hasResult ? `${formatScore(displayScore)}%` : "미측정";
      const remainingCredits = cleanRemainingCredits(team.remainingCredits);
      return `
        <article class="team-card${measuringClass}" data-team-card="${team.id}" data-score-target="${score}">
          <div class="team-card__main">
            <div class="team-card__top">
              <input class="team-name-input" type="text" value="${escapeHtml(team.name)}" aria-label="${index + 1}번째 팀 이름" data-team-name>
              <button class="remove-team-btn" type="button" data-remove-team>삭제</button>
            </div>
            <textarea class="team-note-input" aria-label="${escapeHtml(team.name)} 사건노트" data-team-note>${escapeHtml(team.note)}</textarea>
          </div>
          <div class="team-card__score">
            <div class="score-badge">
              <strong data-score-text>${scoreText}</strong>
              <span>유사도</span>
            </div>
            <div class="score-bar" style="--score-width: ${displayScore}%"><span data-score-bar></span></div>
            <div class="question-credit-bonus" data-question-credit-bonus>
              남은 질문권 ${remainingCredits}개 · 측정 시 +${remainingCredits}점
            </div>
            <div class="breakdown" data-breakdown>
              ${renderBreakdown(hasResult ? result : null)}
            </div>
          </div>
        </article>
      `;
    }).join("");
  }

  function renderBreakdown(result) {
    if (!result) {
      return `
        <div class="breakdown-row">
          <span>유사도 측정을 누르면 채점됩니다.</span>
          <b>-</b>
        </div>
      `;
    }

    const penaltyRow = result.penalty.reason ? `
      <div class="breakdown-row">
        <span>${escapeHtml(result.penalty.reason)}</span>
        <b>-</b>
      </div>
    ` : "";
    const questionBonusRow = result.questionCreditBonus?.credits ? `
      <div class="breakdown-row breakdown-row--bonus">
        <span>${escapeHtml(result.questionCreditBonus.reason)}</span>
        <b>+${formatScore(result.questionCreditBonus.score)}</b>
      </div>
    ` : "";
    return result.details.map((item) => `
      <div class="breakdown-row">
        <span>${escapeHtml(item.label)}</span>
        <b>${item.score}/${item.max}</b>
      </div>
    `).join("") + penaltyRow + questionBonusRow;
  }

  function updateTeamCardResult(card, team) {
    if (!card || !team) return;
    const result = team.result || null;
    const hasResult = Boolean(team.note.trim() && result);
    const score = hasResult ? result.score : 0;
    card.dataset.scoreTarget = String(score);
    card.classList.remove("is-measuring");
    card.querySelector("[data-score-text]").textContent = hasResult ? `${formatScore(score)}%` : "미측정";
    card.querySelector(".score-bar")?.style.setProperty("--score-width", `${score}%`);
    const bonus = cleanRemainingCredits(team.remainingCredits);
    const bonusNode = card.querySelector("[data-question-credit-bonus]");
    if (bonusNode) bonusNode.textContent = `남은 질문권 ${bonus}개 · 측정 시 +${bonus}점`;
    const breakdown = card.querySelector("[data-breakdown]");
    if (breakdown) breakdown.innerHTML = renderBreakdown(hasResult ? result : null);
  }

  function contentScoreOf(source) {
    const value = Number(source?.contentScore);
    return Number.isFinite(value) ? value : 0;
  }

  function sortedTeams() {
    return state.teams
      .map((team, index) => ({
        ...team,
        index,
        result: team.result || null,
        hasNote: Boolean(team.note.trim()),
        hasResult: Boolean(team.note.trim() && team.result)
      }))
      .sort((a, b) => {
        const scoreDiff = (b.hasResult ? b.result.score : -1) - (a.hasResult ? a.result.score : -1);
        if (scoreDiff) return scoreDiff;
        const contentDiff = (b.hasResult ? contentScoreOf(b.result) : -1) - (a.hasResult ? contentScoreOf(a.result) : -1);
        if (contentDiff) return contentDiff;
        return a.index - b.index;
      });
  }

  function renderRanking() {
    const scored = rankedTeams();
    const notes = scored.filter((team) => team.hasResult);
    const average = notes.length
      ? Math.round(notes.reduce((sum, team) => sum + team.result.score, 0) / notes.length)
      : 0;

    elements.teamTotal.textContent = `${state.teams.length}팀`;
    elements.averageScore.textContent = notes.length ? `${formatScore(average)}%` : "미측정";

    if (!scored.length) {
      elements.rankingList.innerHTML = `<li class="empty-ranking">팀을 추가한 뒤 사건노트를 입력하세요.</li>`;
      return;
    }

    elements.rankingList.innerHTML = scored.map((team) => {
      const noteStatus = !team.hasNote ? "사건노트 미입력" : team.hasResult ? strongestCategory(team.result) : "유사도 미측정";
      return `
        <li class="ranking-item">
          <span class="rank-number">${team.hasResult ? team.rank : "-"}</span>
          <div>
            <div class="ranking-name">${escapeHtml(team.name || `${team.index + 1}팀`)}</div>
            <div class="ranking-note">${noteStatus}</div>
          </div>
          <strong class="ranking-score">${team.hasResult ? `${formatScore(team.score)}%` : "-"}</strong>
        </li>
      `;
    }).join("");
  }

  function strongestCategory(result) {
    const sorted = [...result.details].sort((a, b) => (b.score / b.max) - (a.score / a.max));
    const best = sorted[0];
    if (!best || best.score === 0) return "핵심 단서 부족";
    const creditBonus = result.questionCreditBonus?.credits ? ` · 질문권 +${formatScore(result.questionCreditBonus.score)}` : "";
    return `${best.label} ${best.score}/${best.max}${creditBonus}`;
  }

  function rankedTeams() {
    let rank = 0;
    let previousScore = null;
    let previousContentScore = null;
    let seen = 0;
    return sortedTeams().map((team) => {
      const score = team.hasResult ? team.result.score : 0;
      if (team.hasResult) {
        seen += 1;
        const contentScore = contentScoreOf(team.result);
        if (previousScore !== score || previousContentScore !== contentScore) {
          rank = seen;
          previousScore = score;
          previousContentScore = contentScore;
        }
      }
      return {
        ...team,
        score,
        rank: team.hasResult ? rank : null
      };
    });
  }

  function reportPayload() {
    return rankedTeams()
      .filter((team) => team.hasResult)
      .map((team) => ({
        name: team.name || `${team.index + 1}팀`,
        rank: team.rank,
        score: team.score,
        contentScore: team.result.contentScore,
        remainingCredits: cleanRemainingCredits(team.remainingCredits),
        questionCreditBonus: team.result.questionCreditBonus || questionCreditBonusFor(team.remainingCredits),
        note: team.note,
        details: team.result.details.map((detail) => ({
          label: detail.label,
          score: detail.score,
          max: detail.max,
          matches: detail.matches,
          misses: detail.misses
        }))
      }));
  }

  function localReportFor(team) {
    const sorted = [...team.details].sort((a, b) => (b.score / Math.max(1, b.max)) - (a.score / Math.max(1, a.max)));
    const strong = sorted[0];
    const weak = [...team.details].sort((a, b) => (a.score / Math.max(1, a.max)) - (b.score / Math.max(1, b.max)))[0];
    if (!team.note.trim()) return "사건노트가 비어 있어 아직 판정할 근거가 없습니다.";
    const questionBonus = team.questionCreditBonus?.credits
      ? ` 남은 질문권 ${team.questionCreditBonus.credits}개를 질문권 보너스 +${formatScore(team.questionCreditBonus.score)}점으로 반영했습니다.`
      : " 남은 질문권 보너스는 없습니다.";
    return `${team.name}은 사건노트 ${formatScore(team.contentScore ?? team.score)}점에 질문권 보너스를 반영해 최종 ${formatScore(team.score)}%로 측정되었습니다. 기준 항목 중 '${strong?.label || "핵심 단서"}' 점수가 가장 높았고, '${weak?.label || "부족한 단서"}' 항목 보완 여부가 순위 차이를 만들었습니다.${questionBonus}`;
  }

  function fallbackReports(teams) {
    return teams.map((team) => ({
      name: team.name,
      rank: team.rank,
      score: team.score,
      contentScore: team.contentScore,
      report: localReportFor(team)
    }));
  }

  function setReportStatus(text) {
    if (elements.reportStatus) elements.reportStatus.textContent = text;
  }

  function speechSupported() {
    return "speechSynthesis" in window && "SpeechSynthesisUtterance" in window;
  }

  function audioPlaybackSupported() {
    return typeof Audio !== "undefined" && typeof URL !== "undefined";
  }

  function reportSpeechText(report) {
    const rankText = report.rank ? `${report.rank}위. ` : "";
    return `기티 평가 시작. ${rankText}${report.name}. 유사도 ${formatScore(report.score)}퍼센트. ${report.report}`;
  }

  function revealSpeechText(report, index, total) {
    const lead = total <= 1
      ? "기티 최종 판정입니다."
      : index === 0
        ? "두구두구, 꼴등팀부터 공개합니다."
        : report.rank === 1
          ? "이번엔 최종 1등 후보를 확인합니다."
          : "다음 팀 판정입니다.";
    const rankText = report.rank ? `${report.rank}위, ` : "";
    const comment = report.report || "기티가 판정 근거를 정리하지 못했습니다.";
    return `${lead} ${rankText}${report.name}. 유사도는 ${formatScore(report.score)}퍼센트입니다. 기티 평가. ${comment}`;
  }

  function KoreanVoice() {
    if (!speechSupported()) return null;
    const voices = window.speechSynthesis.getVoices();
    const koreanVoices = voices.filter((voice) => /^ko(-|_)?/i.test(voice.lang) || /Korean|한국/i.test(voice.name));
    return koreanVoices.find((voice) => /SunHi|Yuna|Sora|Heami|Natural|Online|Google|Microsoft/i.test(voice.name))
      || koreanVoices[0]
      || voices.find((voice) => /Korean|한국/i.test(voice.name))
      || null;
  }

  function updateSpeechButtons() {
    const supported = audioPlaybackSupported() || speechSupported();
    const hasReports = Boolean(state.reports?.length);
    if (elements.readAllReports) {
      elements.readAllReports.disabled = !supported || !hasReports;
      elements.readAllReports.textContent = state.speakingKey === "all" ? "읽기 정지" : "기티가 읽기";
      elements.readAllReports.setAttribute("aria-pressed", String(state.speakingKey === "all"));
    }

    elements.reportList?.querySelectorAll("[data-read-report]").forEach((button) => {
      const key = `report-${button.dataset.readReport}`;
      const isSpeaking = state.speakingKey === key;
      button.disabled = !supported;
      button.textContent = isSpeaking ? "정지" : "재생";
      button.setAttribute("aria-pressed", String(isSpeaking));
      button.closest(".report-card")?.classList.toggle("is-speaking", isSpeaking);
    });
  }

  function stopSpeech() {
    state.speechSessionId += 1;
    if (speechSupported()) window.speechSynthesis.cancel();
    if (state.speechAudio) {
      state.speechAudio.pause();
      state.speechAudio.src = "";
    }
    if (state.speechAudioUrl) URL.revokeObjectURL(state.speechAudioUrl);
    state.speechAudio = null;
    state.speechAudioUrl = "";
    state.speechUtterance = null;
    state.speakingKey = "";
    updateSpeechButtons();
  }

  function clearSpeechAfter(key, sessionId) {
    if (sessionId !== undefined && state.speechSessionId !== sessionId) return;
    if (state.speakingKey && state.speakingKey !== key) return;
    if (state.speechAudioUrl) URL.revokeObjectURL(state.speechAudioUrl);
    state.speechAudio = null;
    state.speechAudioUrl = "";
    state.speechUtterance = null;
    state.speakingKey = "";
    updateSpeechButtons();
  }

  function speakWithBrowserVoice(text, key, sessionId) {
    if (!speechSupported()) {
      setReportStatus("이 브라우저에서는 음성 읽기를 지원하지 않습니다.");
      updateSpeechButtons();
      return;
    }
    if (sessionId === undefined) {
      stopSpeech();
      sessionId = state.speechSessionId + 1;
      state.speechSessionId = sessionId;
    }

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "ko-KR";
    utterance.rate = 1;
    utterance.pitch = 1.18;
    utterance.volume = 1;
    const voice = KoreanVoice();
    if (voice) utterance.voice = voice;
    state.speakingKey = key;
    state.speechUtterance = utterance;
    updateSpeechButtons();

    utterance.onstart = () => {
      if (state.speechSessionId !== sessionId) return;
      state.speakingKey = key;
      state.speechUtterance = utterance;
      updateSpeechButtons();
    };
    utterance.onend = () => {
      clearSpeechAfter(key, sessionId);
    };
    utterance.onerror = () => {
      clearSpeechAfter(key, sessionId);
      setReportStatus("기티 음성 읽기를 시작하지 못했습니다. 브라우저 음성 설정을 확인하세요.");
    };

    window.speechSynthesis.speak(utterance);
  }

  async function gitiVoiceUrl(text) {
    if (window.location.protocol === "file:") {
      throw new Error("TTS API requires an http page.");
    }

    const response = await fetch("/api/tts", {
      method: "POST",
      headers: {
        "content-type": "application/json; charset=utf-8",
        "x-kit-role": "teacher"
      },
      body: JSON.stringify({
        role: "teacher",
        voice: "shimmer",
        text
      })
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      throw new Error(errorText || "TTS request failed.");
    }

    const blob = await response.blob();
    if (!blob.size) throw new Error("Empty TTS audio.");
    return URL.createObjectURL(blob);
  }

  async function speakReport(text, key) {
    if (state.speakingKey === key) {
      stopSpeech();
      return;
    }

    stopSpeech();
    const sessionId = state.speechSessionId + 1;
    state.speechSessionId = sessionId;
    state.speakingKey = key;
    updateSpeechButtons();
    setReportStatus("기티 목소리를 준비하고 있습니다...");

    try {
      const audioUrl = await gitiVoiceUrl(text);
      if (state.speechSessionId !== sessionId || state.speakingKey !== key) {
        URL.revokeObjectURL(audioUrl);
        return;
      }

      const audio = new Audio(audioUrl);
      state.speechAudio = audio;
      state.speechAudioUrl = audioUrl;
      audio.onended = () => clearSpeechAfter(key, sessionId);
      audio.onerror = () => {
        if (state.speechSessionId !== sessionId) return;
        clearSpeechAfter(key, sessionId);
        setReportStatus("기티 음성을 재생하지 못해 기본 음성으로 읽습니다.");
        speakWithBrowserVoice(text, key, sessionId);
      };
      await audio.play();
      if (state.speechSessionId !== sessionId || state.speakingKey !== key) {
        audio.pause();
        audio.src = "";
        return;
      }
      setReportStatus("기티가 리포트를 읽고 있습니다.");
      updateSpeechButtons();
    } catch (error) {
      if (state.speechSessionId !== sessionId || state.speakingKey !== key) return;
      if (state.speechAudio) {
        state.speechAudio.pause();
        state.speechAudio.src = "";
      }
      if (state.speechAudioUrl) URL.revokeObjectURL(state.speechAudioUrl);
      state.speechAudio = null;
      state.speechAudioUrl = "";
      if (speechSupported()) {
        setReportStatus("기티 전용 음성 연결이 되지 않아 기본 음성으로 읽습니다.");
        speakWithBrowserVoice(text, key, sessionId);
        return;
      }
      clearSpeechAfter(key, sessionId);
      setReportStatus("기티 음성을 만들지 못했습니다. 서버 API 키와 브라우저 음성 설정을 확인하세요.");
    }
  }

  function renderReports(reports = state.reports, statusText) {
    if (typeof statusText === "string") setReportStatus(statusText);
    if (!elements.reportList) return;

    if (!reports || !reports.length) {
      stopSpeech();
      elements.reportList.innerHTML = `
        <p class="report-empty">유사도 측정을 누르면 탐정 캐릭터가 팀별 판정 근거를 정리합니다.</p>
      `;
      updateSpeechButtons();
      return;
    }

    elements.reportList.innerHTML = reports.map((report, index) => `
      <article class="report-card">
        <img class="report-card__avatar" src="assets/characters/detective-note-mascot.png" alt="" aria-hidden="true">
        <div class="report-card__bubble">
          <strong>${escapeHtml(report.rank ? `${report.rank}위 · ` : "")}${escapeHtml(report.name)} · ${escapeHtml(formatScore(report.score))}%</strong>
          ${escapeHtml(report.report)}
        </div>
        <button class="report-voice-btn" type="button" data-read-report="${index}" aria-label="${escapeHtml(report.name)} 리포트 듣기">재생</button>
      </article>
    `).join("");
    updateSpeechButtons();
  }

  function delay(ms) {
    return new Promise((resolve) => window.setTimeout(resolve, ms));
  }

  function revealOrder(reports = state.reports) {
    const ranked = [...(reports || [])]
      .filter((report) => report && report.name)
      .map((report, index) => ({
        ...report,
        rank: Number(report.rank) || index + 1,
        score: roundScoreUncapped(report.score)
      }))
      .sort((a, b) => {
        const rankDiff = a.rank - b.rank;
        if (rankDiff) return rankDiff;
        const scoreDiff = b.score - a.score;
        if (scoreDiff) return scoreDiff;
        const contentDiff = contentScoreOf(b) - contentScoreOf(a);
        if (contentDiff) return contentDiff;
        return String(a.name).localeCompare(String(b.name), "ko");
      });

    if (ranked.length <= 2) return ranked;
    return [
      ...ranked.slice(2).reverse(),
      ranked[0],
      ranked[1]
    ];
  }

  function revealEyebrowFor(report, index, total) {
    const remaining = total - index;
    if (total <= 1) return "기티 최종 판정";
    if (remaining === 2 && report.rank === 1) return "최종 두 팀 · 1등팀 먼저 공개";
    if (index === 0) return "꼴등팀부터 공개";
    if (report.rank === 1) return "최종 1등 공개";
    return "하위 순위부터 공개";
  }

  function setRevealText(node, text) {
    if (node) node.textContent = text;
  }

  function openRevealLoading() {
    if (!elements.revealStage) return;
    elements.revealStage.hidden = false;
    document.body.classList.add("reveal-open");
    setRevealText(elements.revealEyebrow, "기티 분석 중");
    setRevealText(elements.revealTitle, "사건노트 유사도 측정");
    setRevealText(elements.revealScore, "0%");
    elements.revealBar?.style.setProperty("--reveal-score", "0%");
    setRevealText(elements.revealSummary, "각 팀의 사건노트를 기준 사건노트와 대조하고 있습니다.");
    setRevealText(elements.revealReport, "잠시만 기다려 주세요. 기티가 단서의 연결을 확인하고 있습니다.");
    setRevealText(elements.revealProgress, "준비 중");
    if (elements.revealNext) {
      elements.revealNext.disabled = true;
      elements.revealNext.textContent = "분석 중";
    }
  }

  function animateRevealScore(targetScore) {
    const target = Math.max(0, Number(targetScore) || 0);
    const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
    if (reduceMotion) {
      setRevealText(elements.revealScore, `${formatScore(target)}%`);
      elements.revealBar?.style.setProperty("--reveal-score", `${target}%`);
      return Promise.resolve();
    }

    return new Promise((resolve) => {
      const duration = 1500 + Math.min(target * 8, 700);
      const startedAt = performance.now();

      function frame(now) {
        const progress = Math.min(1, (now - startedAt) / duration);
        const eased = 1 - Math.pow(1 - progress, 3);
        const current = Math.round(target * eased);
        setRevealText(elements.revealScore, `${current}%`);
        elements.revealBar?.style.setProperty("--reveal-score", `${target * eased}%`);
        if (progress < 1) {
          requestAnimationFrame(frame);
          return;
        }
        setRevealText(elements.revealScore, `${formatScore(target)}%`);
        elements.revealBar?.style.setProperty("--reveal-score", `${target}%`);
        resolve();
      }

      requestAnimationFrame(frame);
    });
  }

  async function showRevealReport(index) {
    const report = state.revealReports[index];
    if (!report) return;

    stopSpeech();
    state.revealIndex = index;
    state.revealAnimating = true;
    if (elements.revealNext) elements.revealNext.disabled = true;

    const total = state.revealReports.length;
    setRevealText(elements.revealEyebrow, revealEyebrowFor(report, index, total));
    setRevealText(elements.revealTitle, `${report.rank}위 · ${report.name}`);
    setRevealText(elements.revealScore, "0%");
    elements.revealBar?.style.setProperty("--reveal-score", "0%");
    setRevealText(elements.revealSummary, `${report.name}팀의 사건노트를 기준 사건노트와 비교하는 중입니다.`);
    setRevealText(elements.revealReport, "기티가 핵심 단서와 빠진 단서를 확인하고 있습니다...");
    setRevealText(elements.revealProgress, `${index + 1} / ${total}`);

    await delay(420);
    await animateRevealScore(report.score);

    setRevealText(elements.revealSummary, `${report.name}팀 유사도 ${formatScore(report.score)}%`);
    setRevealText(elements.revealReport, report.report || "기티가 판정 근거를 정리하지 못했습니다.");

    const speechText = revealSpeechText(report, index, total);
    if (elements.revealNext) {
      elements.revealNext.disabled = false;
      elements.revealNext.textContent = index >= total - 1 ? "전체 결과 보기" : "다음 팀 공개";
    }
    state.revealAnimating = false;
    speakReport(speechText, `reveal-${index}`).catch(() => {});
  }

  async function openRevealPresentation(reports = state.reports) {
    const ordered = revealOrder(reports);
    if (!ordered.length || !elements.revealStage) return false;

    state.revealReports = ordered;
    state.revealIndex = 0;
    elements.revealStage.hidden = false;
    document.body.classList.add("reveal-open");
    await showRevealReport(0);
    return true;
  }

  function closeReveal(showReports = true) {
    if (state.revealAnimating) return;
    stopSpeech();
    if (elements.revealStage) elements.revealStage.hidden = true;
    document.body.classList.remove("reveal-open");
    state.revealReports = [];
    state.revealIndex = 0;
    if (showReports && state.reports?.length) {
      renderTeams();
      renderRanking();
      renderReports(state.reports, "기티 발표가 끝났습니다. 팀별 리포트를 확인할 수 있습니다.");
    }
  }

  async function revealNext() {
    if (state.revealAnimating) return;
    if (state.revealIndex >= state.revealReports.length - 1) {
      closeReveal(true);
      return;
    }
    await showRevealReport(state.revealIndex + 1);
  }

  async function fetchCaseNoteReports(options = {}) {
    const shouldRender = options.render !== false;
    const teams = reportPayload();
    if (!teams.length) {
      state.reports = [];
      if (shouldRender) renderReports([], "입력된 사건노트가 없어 리포트를 만들 수 없습니다.");
      saveState();
      return [];
    }

    setReportStatus("탐정이 팀별 판정 근거를 정리하고 있습니다...");
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 45000);

    try {
      const response = await fetch("/api/case-note-report", {
        method: "POST",
        headers: {
          "content-type": "application/json; charset=utf-8",
          "x-kit-role": "teacher"
        },
        body: JSON.stringify({
          role: "teacher",
          standardNote,
          teams
        }),
        signal: controller.signal
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "리포트 생성 실패");

      const reports = Array.isArray(data.reports) ? data.reports : [];
      const merged = teams.map((team, index) => {
        const report = reports.find((item) => item.name === team.name) || reports[index] || {};
        return {
          name: team.name,
          rank: team.rank,
          score: team.score,
          contentScore: team.contentScore,
          report: String(report.report || localReportFor(team)).slice(0, 360)
        };
      });
      state.reports = merged;
      saveState();
      if (shouldRender) {
        renderReports(merged, data.source === "openai"
          ? "ChatGPT가 팀별 유사도 판정 근거를 완성했습니다."
          : "ChatGPT 응답이 불안정해 로컬 판정 기준으로 정리했습니다.");
      }
      return merged;
    } catch (error) {
      const fallback = fallbackReports(teams);
      state.reports = fallback;
      saveState();
      if (shouldRender) {
        renderReports(fallback, "ChatGPT 연결이 되지 않아 로컬 판정 기준으로 임시 리포트를 표시합니다.");
      }
      return fallback;
    } finally {
      window.clearTimeout(timer);
    }
  }

  function animateScoreBars() {
    const cards = [...elements.teamList.querySelectorAll("[data-team-card]")];
    if (!cards.length) return Promise.resolve();

    const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
    if (reduceMotion) {
      cards.forEach((card) => {
        const target = Number(card.dataset.scoreTarget || 0);
        card.querySelector("[data-score-text]").textContent = `${formatScore(target)}%`;
        card.querySelector(".score-bar")?.style.setProperty("--score-width", `${target}%`);
        card.classList.remove("is-measuring");
      });
      return Promise.resolve();
    }

    return Promise.all(cards.map((card, index) => new Promise((resolve) => {
      const target = Number(card.dataset.scoreTarget || 0);
      const scoreText = card.querySelector("[data-score-text]");
      const scoreBar = card.querySelector(".score-bar");
      const delay = index * 160;
      const duration = 1000 + Math.min(target * 9, 700);

      window.setTimeout(() => {
        const startedAt = performance.now();
        function frame(now) {
          const progress = Math.min(1, (now - startedAt) / duration);
          const eased = 1 - Math.pow(1 - progress, 3);
          const current = Math.round(target * eased);
          if (scoreText) scoreText.textContent = `${current}%`;
          if (scoreBar) scoreBar.style.setProperty("--score-width", `${target * eased}%`);
          if (progress < 1) {
            requestAnimationFrame(frame);
            return;
          }
          if (scoreText) scoreText.textContent = `${formatScore(target)}%`;
          if (scoreBar) scoreBar.style.setProperty("--score-width", `${target}%`);
          card.classList.remove("is-measuring");
          resolve();
        }
        requestAnimationFrame(frame);
      }, delay);
    })));
  }

  function calculateAll() {
    syncFromDom();
    state.teams.forEach((team) => {
      team.result = team.note.trim() ? scoreNote(team.note, team.remainingCredits) : null;
    });
    saveState();
  }

  function syncFromDom() {
    [...elements.teamList.querySelectorAll("[data-team-card]")].forEach((card) => {
      const team = state.teams.find((item) => item.id === card.dataset.teamCard);
      if (!team) return;
      const nextName = card.querySelector("[data-team-name]")?.value.trim() || team.name;
      const nextNote = card.querySelector("[data-team-note]")?.value || "";
      const noteChanged = nextNote !== team.note;
      team.name = nextName;
      team.note = nextNote;
      if (noteChanged) team.result = null;
    });
    saveState();
  }

  async function scoreAll() {
    if (state.isMeasuring) return;
    state.isMeasuring = true;
    const originalText = elements.scoreAll.textContent;
    elements.scoreAll.disabled = true;
    elements.scoreAll.textContent = "측정 중";

    try {
      calculateAll();
      state.reports = [];
      saveState();
      openRevealLoading();
      renderReports([], "기티가 발표 순서를 정리하고 있습니다...");
      renderTeams({ animate: true });
      const reports = await fetchCaseNoteReports({ render: false });
      const didReveal = await openRevealPresentation(reports);
      if (!didReveal) {
        closeReveal(false);
        renderTeams();
        renderRanking();
        renderReports(reports, reports.length
          ? "기티가 팀별 리포트를 정리했습니다."
          : "입력된 사건노트가 없어 리포트를 만들 수 없습니다.");
      }
    } finally {
      elements.scoreAll.disabled = false;
      elements.scoreAll.textContent = originalText;
      state.isMeasuring = false;
    }
  }

  function setTeamCount(count) {
    const nextCount = Math.max(1, Math.min(30, Number(count) || 1));
    syncFromDom();

    if (nextCount < state.teams.length) {
      const removed = state.teams.slice(nextCount);
      const hasContent = removed.some((team) => team.note.trim());
      if (hasContent && !window.confirm(`${state.teams.length - nextCount}개 팀을 삭제할까요? 삭제한 팀의 사건노트도 사라집니다.`)) {
        elements.teamCount.value = state.teams.length;
        return;
      }
      state.teams = state.teams.slice(0, nextCount);
    }

    while (state.teams.length < nextCount) {
      state.teams.push(createTeam(`${state.teams.length + 1}팀`, state.teams.length + 1));
    }

    state.reports = [];
    saveState();
    renderTeams();
    renderRanking();
    renderReports([], "팀 구성이 바뀌었습니다. 다시 유사도를 측정하세요.");
  }

  function addTeam() {
    syncFromDom();
    state.teams.push(createTeam(`${state.teams.length + 1}팀`, state.teams.length + 1));
    state.reports = [];
    saveState();
    renderTeams();
    renderRanking();
    renderReports([], "팀이 추가되었습니다. 다시 유사도를 측정하세요.");
  }

  function removeTeam(id) {
    if (state.teams.length <= 1) return;
    syncFromDom();
    const team = state.teams.find((item) => item.id === id);
    if (team?.note.trim() && !window.confirm(`${team.name}을 삭제할까요? 입력한 사건노트도 사라집니다.`)) return;
    state.teams = state.teams.filter((item) => item.id !== id);
    state.reports = [];
    saveState();
    renderTeams();
    renderRanking();
    renderReports([], "팀이 삭제되었습니다. 다시 유사도를 측정하세요.");
  }

  function exportCsv() {
    calculateAll();
    renderTeams();
    renderRanking();
    const rows = [["순위", "팀", "최종 유사도", "사건노트 점수", "남은 질문권", "질문권 보너스", "범인", "사건 장소", "범행 방식", "유출 결과", "근거 제시", "AI 윤리 역량", "사건노트"]];
    let rank = 0;
    let previousScore = null;
    let seen = 0;
    sortedTeams().forEach((team) => {
      seen += 1;
      const score = team.hasResult ? team.result.score : 0;
      if (team.hasResult && previousScore !== score) {
        rank = seen;
        previousScore = score;
      }
      const detailMap = team.hasResult
        ? Object.fromEntries(team.result.details.map((item) => [item.id, `${item.score}/${item.max}`]))
        : {};
      rows.push([
        team.hasResult ? rank : "",
        team.name,
        team.hasResult ? `${formatScore(score)}%` : "",
        team.hasResult ? `${formatScore(team.result.contentScore ?? score)}점` : "",
        team.hasResult ? `${cleanRemainingCredits(team.remainingCredits)}개` : "",
        team.hasResult && team.result.questionCreditBonus?.score ? `+${formatScore(team.result.questionCreditBonus.score)}점` : "",
        detailMap.culprit,
        detailMap.place,
        detailMap.method,
        detailMap.leak,
        detailMap.evidence,
        detailMap.ethics,
        team.note
      ]);
    });

    const csv = rows.map((row) => row.map((cell) => `"${String(cell || "").replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([`\ufeff${csv}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "사건노트_유사도_순위.csv";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  function resetAll() {
    if (!window.confirm("모든 팀 이름, 사건노트, 점수를 초기화할까요?")) return;
    state.teams = defaultTeams.map((name, index) => createTeam(name, index + 1));
    state.reports = [];
    saveState();
    renderTeams();
    renderRanking();
    renderReports([], "전체 입력을 초기화했습니다.");
  }

  function bindEvents() {
    elements.applyTeamCount.addEventListener("click", () => setTeamCount(elements.teamCount.value));
    elements.addTeam.addEventListener("click", addTeam);
    elements.scoreAll.addEventListener("click", scoreAll);
    elements.importStudentSentences?.addEventListener("click", importStudentSentences);
    elements.clearStudentSentences?.addEventListener("click", clearStudentSentences);
    elements.exportCsv.addEventListener("click", exportCsv);
    elements.resetAll.addEventListener("click", resetAll);
    elements.readAllReports?.addEventListener("click", () => {
      const reports = state.reports || [];
      if (!reports.length) return;
      speakReport(reports.map(reportSpeechText).join(" "), "all");
    });
    elements.reportList?.addEventListener("click", (event) => {
      const button = event.target.closest("[data-read-report]");
      if (!button) return;
      const report = state.reports[Number(button.dataset.readReport)];
      if (!report) return;
      speakReport(reportSpeechText(report), `report-${button.dataset.readReport}`);
    });
    elements.revealNext?.addEventListener("click", revealNext);
    elements.revealClose?.addEventListener("click", () => closeReveal(Boolean(state.reports?.length)));
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && elements.revealStage && !elements.revealStage.hidden) {
        closeReveal(Boolean(state.reports?.length));
      }
    });
    window.speechSynthesis?.addEventListener?.("voiceschanged", updateSpeechButtons);

    elements.teamCount.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        setTeamCount(elements.teamCount.value);
      }
    });

    elements.teamList.addEventListener("click", (event) => {
      const button = event.target.closest("[data-remove-team]");
      if (!button) return;
      const card = button.closest("[data-team-card]");
      removeTeam(card?.dataset.teamCard);
    });

    elements.teamList.addEventListener("input", (event) => {
      if (!event.target.matches("[data-team-name], [data-team-note]")) return;
      const card = event.target.closest("[data-team-card]");
      syncFromDom();
      state.reports = [];
      const team = state.teams.find((item) => item.id === card?.dataset.teamCard);
      updateTeamCardResult(card, team);
      renderRanking();
      renderReports([], "사건노트가 수정되었습니다. 다시 유사도를 측정하세요.");
    });
  }

  function init() {
    if (elements.standardNote) elements.standardNote.textContent = standardNote;
    renderRubric();
    loadState();
    renderTeams();
    renderRanking();
    renderReports();
    bindEvents();
  }

  init();
})();
