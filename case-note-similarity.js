(function () {
  const STORAGE_KEY = "kit-case-note-similarity-v1";
  const standardNote = "범인은 강우진이다. 강우진은 기말고사 전날 교무실 보안 PC 앞에서 시험지 USB를 훔치거나 시험지 일부를 확보한 뒤, 학교 학습 도우미 AI에 입력했다. 그는 AI에게 실제 시험과 비슷한 예상 문제를 만들게 했고, 그 결과물이 자동 추천 기능을 통해 2학년 전체 학생에게 퍼졌다. 강우진은 시험 성적에 대한 압박과 전교 1등이던 전 여자친구에게 다시 인정받고 싶은 마음 때문에 범행을 저질렀다.";

  const rubric = [
    {
      id: "culprit",
      label: "범인 지목",
      max: 22,
      checks: [
        { label: "강우진을 범인으로 지목", points: 22, patterns: [/강\s*우\s*진/, /우진/] }
      ]
    },
    {
      id: "acquisition",
      label: "시험지 확보 경로",
      max: 18,
      checks: [
        { label: "교무실 또는 보안 PC 언급", points: 6, patterns: [/교무실/, /보안\s*pc/i, /보안\s*피시/, /교무실.*pc/i] },
        { label: "시험지, USB, 시험 정보 언급", points: 6, patterns: [/시험지/, /문제지/, /usb/i, /유에스비/, /비공개\s*시험/, /시험\s*정보/] },
        { label: "훔침, 확보, 촬영, 가져감 등 확보 행위", points: 6, patterns: [/훔치/, /가져/, /확보/, /촬영/, /사진/, /빼내/, /얻었/, /봤다/, /보았다/, /몰래/] }
      ]
    },
    {
      id: "aiInput",
      label: "AI 입력",
      max: 18,
      checks: [
        { label: "학교 학습 도우미 AI 또는 AI 언급", points: 8, patterns: [/학습\s*도우미/, /학교\s*ai/i, /ai/i, /인공지능/] },
        { label: "입력, 넣음, 업로드, 요청 언급", points: 7, patterns: [/입력/, /넣/, /업로드/, /전달/, /요청/, /활용/, /사용/] },
        { label: "시험지 내용을 바탕으로 했다는 점", points: 3, patterns: [/시험지.*기반/, /기반.*시험지/, /시험지.*내용/, /실제\s*시험/, /자료를\s*바탕/] }
      ]
    },
    {
      id: "generated",
      label: "예상 문제 생성",
      max: 14,
      checks: [
        { label: "실제 시험과 비슷하거나 유사함", points: 7, patterns: [/비슷/, /유사/, /닮/, /같은\s*유형/, /비슷한\s*유형/] },
        { label: "예상 문제를 만들거나 변형함", points: 7, patterns: [/예상\s*문제/, /기말.*예상/, /문제.*만들/, /만들게/, /생성/, /바꾸/, /변형/] }
      ]
    },
    {
      id: "spread",
      label: "유출 경로",
      max: 14,
      checks: [
        { label: "자동 추천 기능 또는 자료 목록", points: 8, patterns: [/자동\s*추천/, /추천\s*기능/, /추천\s*자료/, /자료\s*목록/, /공개\s*범위/] },
        { label: "2학년 전체 학생에게 퍼짐", points: 6, patterns: [/2\s*학년/, /이\s*학년/, /전체\s*학생/, /전교생/, /퍼졌/, /퍼짐/, /유출/, /공개/, /공유/] }
      ]
    },
    {
      id: "motive",
      label: "동기",
      max: 14,
      checks: [
        { label: "시험 성적 압박", points: 6, patterns: [/성적/, /점수/, /시험\s*압박/, /압박/, /기말고사.*잘/, /시험.*잘/] },
        { label: "전교 1등 전 여자친구에게 인정받고 싶은 마음", points: 8, patterns: [/전\s*여자친구/, /전여친/, /여친/, /전교\s*1\s*등/, /인정/, /다르게\s*봐/, /다시\s*봐/, /재회/] }
      ]
    }
  ];

  const defaultTeams = ["1팀", "2팀", "3팀", "4팀"];

  const elements = {
    standardNote: document.querySelector("[data-standard-note]"),
    rubricList: document.querySelector("[data-rubric-list]"),
    teamList: document.querySelector("[data-team-list]"),
    rankingList: document.querySelector("[data-ranking-list]"),
    teamCount: document.querySelector("[data-team-count]"),
    applyTeamCount: document.querySelector("[data-apply-team-count]"),
    addTeam: document.querySelector("[data-add-team]"),
    scoreAll: document.querySelector("[data-score-all]"),
    exportCsv: document.querySelector("[data-export-csv]"),
    resetAll: document.querySelector("[data-reset-all]"),
    teamTotal: document.querySelector("[data-team-total]"),
    averageScore: document.querySelector("[data-average-score]"),
    reportStatus: document.querySelector("[data-report-status]"),
    readAllReports: document.querySelector("[data-read-all-reports]"),
    reportList: document.querySelector("[data-report-list]")
  };

  const state = {
    teams: defaultTeams.map((name, index) => createTeam(name, index + 1)),
    reports: [],
    isMeasuring: false,
    speakingKey: "",
    speechUtterance: null,
    speechAudio: null,
    speechAudioUrl: "",
    speechSessionId: 0
  };

  function createTeam(name, number) {
    return {
      id: `team-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      name: name || `${number || state.teams.length + 1}팀`,
      note: "",
      result: null
    };
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

  function scoreNote(note) {
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
    return {
      score: Math.round(adjusted),
      rawScore,
      penalty,
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
        name: String(team.name || `${index + 1}팀`),
        note: String(team.note || ""),
        result: team.result || null
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
        result: team.result
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
      const result = team.result || scoreNote(team.note);
      const score = team.note.trim() ? result.score : 0;
      const displayScore = animate && team.note.trim() ? 0 : score;
      const measuringClass = animate && team.note.trim() ? " is-measuring" : "";
      return `
        <article class="team-card${measuringClass}" data-team-card="${team.id}" data-score-target="${score}">
          <div class="team-card__main">
            <div class="team-card__top">
              <input class="team-name-input" type="text" value="${escapeHtml(team.name)}" aria-label="${index + 1}번째 팀 이름" data-team-name>
              <button class="remove-team-btn" type="button" data-remove-team>삭제</button>
            </div>
            <textarea class="team-note-input" aria-label="${escapeHtml(team.name)} 사건노트" placeholder="예: 범인은 OOO이라고 생각합니다. 시험지 내용을 AI에 입력해 예상 문제가 퍼졌다..." data-team-note>${escapeHtml(team.note)}</textarea>
          </div>
          <div class="team-card__score">
            <div class="score-badge">
              <strong data-score-text>${displayScore}%</strong>
              <span>유사도</span>
            </div>
            <div class="score-bar" style="--score-width: ${displayScore}%"><span data-score-bar></span></div>
            <div class="breakdown" data-breakdown>
              ${renderBreakdown(result)}
            </div>
          </div>
        </article>
      `;
    }).join("");
  }

  function renderBreakdown(result) {
    return result.details.map((item) => `
      <div class="breakdown-row">
        <span>${escapeHtml(item.label)}</span>
        <b>${item.score}/${item.max}</b>
      </div>
    `).join("") + (result.penalty.reason ? `
      <div class="breakdown-row">
        <span>${escapeHtml(result.penalty.reason)}</span>
        <b>-</b>
      </div>
    ` : "");
  }

  function sortedTeams() {
    return state.teams
      .map((team, index) => ({
        ...team,
        index,
        result: team.result || scoreNote(team.note),
        hasNote: Boolean(team.note.trim())
      }))
      .sort((a, b) => {
        const scoreDiff = (b.hasNote ? b.result.score : -1) - (a.hasNote ? a.result.score : -1);
        if (scoreDiff) return scoreDiff;
        return a.index - b.index;
      });
  }

  function renderRanking() {
    const scored = sortedTeams();
    const notes = scored.filter((team) => team.hasNote);
    const average = notes.length
      ? Math.round(notes.reduce((sum, team) => sum + team.result.score, 0) / notes.length)
      : 0;

    elements.teamTotal.textContent = `${state.teams.length}팀`;
    elements.averageScore.textContent = `${average}%`;

    if (!scored.length) {
      elements.rankingList.innerHTML = `<li class="empty-ranking">팀을 추가한 뒤 사건노트를 입력하세요.</li>`;
      return;
    }

    let rank = 0;
    let previousScore = null;
    let seen = 0;
    elements.rankingList.innerHTML = scored.map((team) => {
      seen += 1;
      const score = team.hasNote ? team.result.score : 0;
      if (previousScore !== score) {
        rank = seen;
        previousScore = score;
      }
      return `
        <li class="ranking-item">
          <span class="rank-number">${team.hasNote ? rank : "-"}</span>
          <div>
            <div class="ranking-name">${escapeHtml(team.name || `${team.index + 1}팀`)}</div>
            <div class="ranking-note">${team.hasNote ? strongestCategory(team.result) : "사건노트 미입력"}</div>
          </div>
          <strong class="ranking-score">${team.hasNote ? `${score}%` : "-"}</strong>
        </li>
      `;
    }).join("");
  }

  function strongestCategory(result) {
    const sorted = [...result.details].sort((a, b) => (b.score / b.max) - (a.score / a.max));
    const best = sorted[0];
    if (!best || best.score === 0) return "핵심 단서 부족";
    return `${best.label} ${best.score}/${best.max}`;
  }

  function rankedTeams() {
    let rank = 0;
    let previousScore = null;
    let seen = 0;
    return sortedTeams().map((team) => {
      seen += 1;
      const score = team.hasNote ? team.result.score : 0;
      if (previousScore !== score) {
        rank = seen;
        previousScore = score;
      }
      return {
        ...team,
        score,
        rank: team.hasNote ? rank : null
      };
    });
  }

  function reportPayload() {
    return rankedTeams()
      .filter((team) => team.hasNote)
      .map((team) => ({
        name: team.name || `${team.index + 1}팀`,
        rank: team.rank,
        score: team.score,
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
    return `${team.name}은 ${team.score}%로 측정되었습니다. 기준 항목 중 '${strong?.label || "핵심 단서"}' 점수가 가장 높아 사건 흐름이 잘 맞았고, '${weak?.label || "부족한 단서"}' 항목 보완 여부가 순위 차이를 만들었습니다.`;
  }

  function fallbackReports(teams) {
    return teams.map((team) => ({
      name: team.name,
      rank: team.rank,
      score: team.score,
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
    return `${rankText}${report.name}. 유사도 ${report.score}퍼센트. ${report.report}`;
  }

  function KoreanVoice() {
    if (!speechSupported()) return null;
    const voices = window.speechSynthesis.getVoices();
    return voices.find((voice) => /^ko(-|_)?/i.test(voice.lang))
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
    utterance.rate = 0.94;
    utterance.pitch = 1.05;
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
          <strong>${escapeHtml(report.rank ? `${report.rank}위 · ` : "")}${escapeHtml(report.name)} · ${escapeHtml(report.score)}%</strong>
          ${escapeHtml(report.report)}
        </div>
        <button class="report-voice-btn" type="button" data-read-report="${index}" aria-label="${escapeHtml(report.name)} 리포트 듣기">재생</button>
      </article>
    `).join("");
    updateSpeechButtons();
  }

  async function fetchCaseNoteReports() {
    const teams = reportPayload();
    if (!teams.length) {
      state.reports = [];
      renderReports([], "입력된 사건노트가 없어 리포트를 만들 수 없습니다.");
      saveState();
      return;
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
          report: String(report.report || localReportFor(team)).slice(0, 360)
        };
      });
      state.reports = merged;
      saveState();
      renderReports(merged, data.source === "openai"
        ? "ChatGPT가 팀별 유사도 판정 근거를 완성했습니다."
        : "ChatGPT 응답이 불안정해 로컬 판정 기준으로 정리했습니다.");
    } catch (error) {
      const fallback = fallbackReports(teams);
      state.reports = fallback;
      saveState();
      renderReports(fallback, "ChatGPT 연결이 되지 않아 로컬 판정 기준으로 임시 리포트를 표시합니다.");
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
        card.querySelector("[data-score-text]").textContent = `${target}%`;
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
          if (scoreText) scoreText.textContent = `${target}%`;
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
      team.result = scoreNote(team.note);
    });
    saveState();
  }

  function syncFromDom() {
    [...elements.teamList.querySelectorAll("[data-team-card]")].forEach((card) => {
      const team = state.teams.find((item) => item.id === card.dataset.teamCard);
      if (!team) return;
      team.name = card.querySelector("[data-team-name]")?.value.trim() || team.name;
      team.note = card.querySelector("[data-team-note]")?.value || "";
      team.result = scoreNote(team.note);
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
      renderReports([], "팀별 유사도 막대를 계산하고 있습니다...");
      renderTeams({ animate: true });
      await animateScoreBars();
      renderRanking();
      await fetchCaseNoteReports();
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
    const rows = [["순위", "팀", "유사도", "범인", "확보 경로", "AI 입력", "예상 문제", "유출 경로", "동기", "사건노트"]];
    let rank = 0;
    let previousScore = null;
    let seen = 0;
    sortedTeams().forEach((team) => {
      seen += 1;
      const score = team.note.trim() ? team.result.score : 0;
      if (previousScore !== score) {
        rank = seen;
        previousScore = score;
      }
      const detailMap = Object.fromEntries(team.result.details.map((item) => [item.id, `${item.score}/${item.max}`]));
      rows.push([
        team.note.trim() ? rank : "",
        team.name,
        team.note.trim() ? `${score}%` : "",
        detailMap.culprit,
        detailMap.acquisition,
        detailMap.aiInput,
        detailMap.generated,
        detailMap.spread,
        detailMap.motive,
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
      syncFromDom();
      state.reports = [];
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
