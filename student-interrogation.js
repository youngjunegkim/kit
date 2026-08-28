(function () {
  const panels = [...document.querySelectorAll("[data-suspect-panel]")].map((panel) => ({
    root: panel,
    suspect: panel.dataset.suspect || "kangWoojin",
    name: panel.dataset.suspectName || "용의자",
    messages: panel.querySelector("[data-chat-messages]"),
    form: panel.querySelector("[data-chat-form]"),
    input: panel.querySelector("[data-chat-input]"),
    submit: panel.querySelector("[data-chat-submit]"),
    counter: panel.querySelector("[data-token-counter]"),
    state: panel.querySelector("[data-chat-state]"),
    history: [],
    evidenceState: null,
    waiting: false
  }));

  if (!panels.length) return;

  const cardLightbox = document.querySelector("[data-card-lightbox]");
  const cardLightboxImage = document.querySelector("[data-card-lightbox-image]");
  const closeCardButton = document.querySelector("[data-close-card]");
  const tokenEstimator = window.KitTokenEstimator || {
    DEFAULT_CHAT_TOKEN_LIMIT: 120,
    estimateTokens: (text) => Math.ceil(String(text || "").trim().length / 2) || 0
  };
  const chatTokenLimit = tokenEstimator.DEFAULT_CHAT_TOKEN_LIMIT || 120;
  const chatMaxInputChars = 800;
  const similaritySentenceLimit = 500;

  const greetings = {
    kangWoojin: "안녕하세요. 강우진입니다. 무슨 일 때문에 저를 부른 건지부터 말해 주세요.",
    seoHarin: "안녕하세요. 서하린입니다. 사건과 관련해서 궁금한 증거를 말해 주세요.",
    choiDaniel: "안녕하세요. 최다니엘입니다. 사건과 관련해서 궁금한 증거를 말해 주세요."
  };
  const suspectNames = {
    kangWoojin: "강우진",
    seoHarin: "서하린",
    choiDaniel: "최다니엘"
  };
  const teamDisplayIds = {
    january: "1",
    february: "2",
    march: "3",
    april: "4",
    may: "5",
    june: "6",
    july: "7",
    august: "8"
  };
  const safetyReplies = {
    sexualOrProfane: "그런 장난 섞인 말에는 대답 안 합니다. 사건이랑 상관없는 불쾌한 얘기는 하지 마세요.",
    aggressive: "때리거나 위협하자는 말은 하지 마세요. 그런 방식의 질문에는 답하지 않겠습니다.",
    technicalCrime: "그런 방법 같은 건 몰라요. 실제로 따라 할 수 있는 얘기는 하지 않겠습니다.",
    unsafe: "그런 질문에는 답하지 않겠습니다. 사건과 관련된 증거를 바탕으로 질문해 주세요."
  };
  const evidenceShopRoomOrder = ["broadcast", "art", "office", "science", "gym"];
  const evidenceCatalog = {
    39275: { room: "방송실", roomId: "broadcast", index: 1, evidence: "방송실 장비 점검표", person: "서하린", image: "assets/evidence-cards/broadcast-equipment-checklist.png", position: "center" },
    26547: { room: "방송실", roomId: "broadcast", index: 2, evidence: "AI 자료 열람 기록", person: "서하린", image: "assets/evidence-cards/broadcast-ai-access-log.png", position: "center" },
    65927: { room: "미술실", roomId: "art", index: 1, evidence: "기말고사 유의사항 포스터 파일", person: "서하린", image: "assets/evidence-cards/art-exam-notice-poster.png", position: "center" },
    40018: { room: "미술실", roomId: "art", index: 2, evidence: "삭제된 AI 프롬프트 기록", person: "강우진", image: "assets/evidence-cards/art-deleted-ai-prompt.png", position: "center" },
    91648: { room: "교무실", roomId: "office", index: 1, evidence: "CCTV에 찍힌 강우진의 태블릿", person: "강우진", image: "assets/evidence-cards/office-woojin-tablet-cctv.png", position: "center" },
    11582: { room: "교무실", roomId: "office", index: 2, evidence: "책상 위 기말고사 문제지", person: "강우진", image: "assets/evidence-cards/office-final-exam-paper.png", position: "center" },
    79610: { room: "과학실", roomId: "science", index: 1, evidence: "실험 보고서 제출 기록", person: "최다니엘", image: "assets/evidence-cards/science-report-submission.png", position: "center" },
    61408: { room: "과학실", roomId: "science", index: 2, evidence: "과학실 분실물함 기록", person: "최다니엘", image: "assets/evidence-cards/science-lost-usb-record.png", position: "center" },
    87143: { room: "체육관", roomId: "gym", index: 1, evidence: "전교 1등 전 여자친구의 메시지", person: "강우진", image: "assets/evidence-cards/gym-ex-girlfriend-message.png", position: "center" },
    13450: { room: "체육관", roomId: "gym", index: 2, evidence: "CCTV에 찍힌 최다니엘의 USB", person: "최다니엘", image: "assets/evidence-cards/gym-daniel-usb-cctv-full.png", position: "center" }
  };

  const state = {
    credits: 0,
    count: 0,
    logs: [],
    requesting: false,
    requiresAccessCode: false,
    accessCode: sessionStorage.getItem("class-access-code") || "",
    user: sessionStorage.getItem("kit-auth-user") || "",
    role: sessionStorage.getItem("kit-auth-role") || "",
    team: sessionStorage.getItem("kit-auth-team") || "",
    classId: "class-a",
    serverCredits: 0,
    redeeming: false,
    evidenceCards: [],
    selectedEvidenceCode: "",
    shopOpen: false,
    shopLoading: false,
    shopPurchasing: false,
    shopCards: [],
    shopCredits: 0,
    shopUnitCost: 5,
    shopMaxCards: 3,
    shopPurchasedCount: 0,
    shopSelectedIds: new Set(),
    ethicsAnswers: {},
    ethicsServerSolved: [],
    ethicsCurrent: 1,
    ethicsUnlocked: false,
    ethicsSubmitting: false,
    ethicsTimerId: null,
    ethicsTimerQuestion: null,
    ethicsTimerDeadline: 0,
    claiming: false,
    claimGrant: null,
    claimOptions: [],
    claimRevisitBonus: 0,
    submittingSimilarity: false,
    similaritySubmitCount: 0,
    similarityResubmitCost: 5,
    similarityFreeResubmits: 0
  };

  const creditCounts = [...document.querySelectorAll("[data-credit-count]")];
  const teamLabels = [...document.querySelectorAll("[data-team-label]")];
  const logCounts = [...document.querySelectorAll("[data-log-count]")];
  const refreshButtons = [...document.querySelectorAll("[data-refresh-credits]")];
  const evidenceForm = document.querySelector("[data-evidence-form]");
  const evidenceInput = document.querySelector("[data-evidence-code]");
  const evidenceSubmit = document.querySelector("[data-evidence-submit]");
  const evidenceMessage = document.querySelector("[data-evidence-message]");
  const studentLogList = document.querySelector("[data-student-log-list]");
  const evidenceBoard = document.querySelector("[data-evidence-board]");
  const evidenceBoardCount = document.querySelector("[data-evidence-board-count]");
  const evidenceRoomDetail = document.querySelector("[data-evidence-room-detail]");
  const evidenceClaimOpen = document.querySelector("[data-evidence-claim-open]");
  const evidenceClaimStatus = document.querySelector("[data-evidence-claim-status]");
  const evidenceClaimArea = document.querySelector("[data-evidence-claim]");
  const evidenceShopOpenButton = document.querySelector("[data-evidence-shop-open]");
  const evidenceShopModal = document.querySelector("[data-evidence-shop-modal]");
  const evidenceShopCloseButtons = [...document.querySelectorAll("[data-evidence-shop-close]")];
  const evidenceShopCredits = document.querySelector("[data-evidence-shop-credits]");
  const evidenceShopPrice = document.querySelector("[data-evidence-shop-price]");
  const evidenceShopRemaining = document.querySelector("[data-evidence-shop-remaining]");
  const evidenceShopList = document.querySelector("[data-evidence-shop-list]");
  const evidenceShopStatus = document.querySelector("[data-evidence-shop-status]");
  const evidenceShopTotal = document.querySelector("[data-evidence-shop-total]");
  const evidenceShopPurchase = document.querySelector("[data-evidence-shop-purchase]");
  const caseNoteArea = document.querySelector("[data-note-key='case']");
  const caseNoteStatus = document.querySelector("[data-note-status='case']");
  const clearCaseNote = document.querySelector("[data-clear-note='case']");
  const apiStatus = document.querySelector("[data-api-status]");
  const ethicsQuestionOrder = [4, 11, 14, 1, 5, 6, 7, 8, 9, 10, 2, 12, 13, 3, 15];
  const ethicsQuestions = [];

  function syncStudentEthicsQuestionOrder() {
    const source = Array.isArray(window.KitEthicsQuizQuestions) ? window.KitEthicsQuizQuestions : [];
    const baseByNumber = new Map(source
      .filter((question) => Number(question?.number) >= 1 && Number(question?.number) <= 15)
      .map((question) => [Number(question.number), question]));
    const orderedBase = ethicsQuestionOrder
      .map((sourceNumber, index) => {
        const question = baseByNumber.get(sourceNumber);
        return question ? { ...question, number: index + 1, sourceNumber } : null;
      })
      .filter(Boolean);
    const customQuestions = source
      .filter((question) => Number(question?.number) > 15)
      .map((question) => ({ ...question }));
    ethicsQuestions.splice(0, ethicsQuestions.length, ...orderedBase, ...customQuestions);
  }

  syncStudentEthicsQuestionOrder();
  const ethicsOpenButton = document.querySelector("[data-student-ethics-open]");
  const ethicsForm = document.querySelector("[data-student-ethics-form]");
  const ethicsPasswordInput = document.querySelector("[data-student-ethics-password]");
  const ethicsNumberInput = document.querySelector("[data-student-ethics-number]");
  const ethicsSolvedSummary = document.querySelector("[data-student-ethics-solved]");
  const ethicsCard = document.querySelector("[data-student-ethics-card]");
  const ethicsResetButton = document.querySelector("[data-student-ethics-reset]");
  const ethicsAccessPassword = String.fromCharCode(107, 105, 116);
  const ethicsRewardCredits = 1;
  const ethicsQuizTimeLimitMs = 30 * 1000;
  const evidenceRewardCredits = 1;
  const similarityForm = document.querySelector("[data-similarity-form]");
  const similarityOpenBtn = document.querySelector("[data-similarity-open]");
  const similarityModal = document.querySelector("[data-similarity-modal]");
  const similarityCloseBtn = document.querySelector("[data-similarity-close]");
  const similarityBlanks = [...document.querySelectorAll("[data-similarity-blank]")];
  const similarityCount = document.querySelector("[data-similarity-count]");
  const similaritySubmit = document.querySelector("[data-similarity-submit]");
  const similarityStatus = document.querySelector("[data-similarity-status]");
  const similarityConfirm = document.querySelector("[data-similarity-confirm]");
  const similarityConfirmSentence = document.querySelector("[data-similarity-confirm-sentence]");
  const similarityConfirmNotice = document.querySelector("[data-similarity-confirm-notice]");
  const similarityConfirmSend = document.querySelector("[data-similarity-confirm-send]");
  const similarityConfirmCancel = document.querySelector("[data-similarity-confirm-cancel]");
  const goldenModal = document.querySelector("[data-golden-modal]");
  const goldenKicker = document.querySelector("[data-golden-kicker]");
  const goldenTitle = document.querySelector("[data-golden-title]");
  const goldenCode = document.querySelector("[data-golden-code]");
  const goldenMeaning = document.querySelector("[data-golden-meaning]");
  const goldenPopup = document.querySelector("[data-golden-popup]");
  const goldenDelta = document.querySelector("[data-golden-delta]");
  const goldenConfirmBtn = document.querySelector("[data-golden-confirm]");
  const goldenPopupQueue = [];
  let goldenPopupOpen = false;
  const similarityTemplate = (v) =>
    `범인은 ${v.culprit || ""}이다. 범인은 ${v.tool || ""}를 사용해 ${v.method || ""} 해서 시험 예상 문제가 유출되었다. 그 근거는 ${v.evidence || ""}이다. 범인에게 가장 부족했던 AI 윤리 역량은 ${v.competency || ""}이며, 그 이유는 ${v.reason || ""}.`;

  function normalize(text) {
    return String(text || "").toLowerCase().replace(/\s+/g, "");
  }

  function includesAny(text, patterns) {
    return patterns.some((pattern) => pattern.test(text));
  }

  function safetyReplyFor(message) {
    const raw = String(message || "");
    const compact = normalize(raw);
    const sexualOrProfane = [
      /섹스|성관계|야한|음란|노출|키스|스킨십|가슴|엉덩이|자위|포르노|19금/i,
      /씨발|시발|ㅅㅂ|병신|ㅂㅅ|좆|존나|개새|꺼져|닥쳐|미친놈|미친년/i
    ];
    const aggressive = [
      /죽어|죽일|패버|때리|때려|맞자|맞을래|맞아야|한\s*대|폭행|괴롭히|왕따|따돌림|혐오|찐따|장애인|못생긴/i,
      /꺼지라고|입\s*닫아|협박/i
    ];
    const technicalCrime = [
      /해킹|크래킹|보안\s*우회|서버\s*뚫|비밀번호|패스워드|계정\s*탈취|관리자\s*권한/i,
      /usb\s*복제|유에스비\s*복제|복사\s*방법|훔치는\s*방법|악성\s*코드|랜섬웨어/i,
      /기록\s*삭제\s*방법|로그\s*삭제\s*방법|cctv\s*(삭제|지우|없애)|증거\s*(인멸|없애|삭제)/i
    ];
    const unsafe = [
      /자살|자해|죽고\s*싶|목\s*매|손목|투신/i,
      /전화번호|집\s*주소|주소\s*알려|주민등록|민증|개인정보|카톡\s*아이디|인스타\s*아이디/i,
      /성희롱|몰카|도촬|스토킹|괴롭히는\s*법|왕따\s*시키|따돌리는\s*법/i
    ];

    if (includesAny(raw, sexualOrProfane) || includesAny(compact, sexualOrProfane)) return safetyReplies.sexualOrProfane;
    if (includesAny(raw, aggressive) || includesAny(compact, aggressive)) return safetyReplies.aggressive;
    if (includesAny(raw, technicalCrime) || includesAny(compact, technicalCrime)) return safetyReplies.technicalCrime;
    if (includesAny(raw, unsafe) || includesAny(compact, unsafe)) return safetyReplies.unsafe;
    return "";
  }

  function teamIdFor(team) {
    return teamDisplayIds[team] || String(team || "").trim();
  }

  function teamLabelFor(team) {
    const id = teamIdFor(team);
    return id ? `${id}팀` : "학생";
  }

  function setCreditText(text) {
    creditCounts.forEach((node) => {
      const value = String(text || "").trim();
      node.textContent = /^coin\s*:/i.test(value) ? value : `coin: ${value}`;
    });
  }

  function setLogCount(count) {
    state.count = Number(count || 0);
    logCounts.forEach((node) => {
      node.textContent = `${state.count}회`;
    });
  }

  function setApiStatus(text, type = "") {
    if (!apiStatus) return;
    apiStatus.textContent = text;
    apiStatus.classList.toggle("status-ok", type === "ok");
    apiStatus.classList.toggle("status-bad", type === "bad");
  }

  function cleanCode(value) {
    return String(value || "").replace(/[^a-z0-9]/gi, "").toUpperCase();
  }

  function safeHeaderValue(value) {
    const text = String(value || "").trim().replace(/[\r\n]/g, "");
    return /[^\u0000-\u00ff]/.test(text) ? encodeURIComponent(text) : text;
  }

  function setEvidenceMessage(text, type = "") {
    if (!evidenceMessage) return;
    evidenceMessage.textContent = text;
    evidenceMessage.classList.toggle("is-ok", type === "ok");
    evidenceMessage.classList.toggle("is-bad", type === "bad");
  }

  function setNodeText(node, text) {
    if (node) node.textContent = text || "";
  }

  function setHighlightedText(node, text, highlights = []) {
    if (!node) return;
    const value = String(text || "");
    const marker = (Array.isArray(highlights) ? highlights : [])
      .map((item) => String(item || "").trim())
      .filter(Boolean)
      .find((item) => value.includes(item));
    node.textContent = "";
    if (!marker) {
      node.textContent = value;
      return;
    }

    let start = 0;
    let index = value.indexOf(marker, start);
    while (index >= 0) {
      if (index > start) node.append(document.createTextNode(value.slice(start, index)));
      const emphasis = document.createElement("strong");
      emphasis.className = "golden-modal__emphasis";
      emphasis.textContent = marker;
      node.append(emphasis);
      start = index + marker.length;
      index = value.indexOf(marker, start);
    }
    if (start < value.length) node.append(document.createTextNode(value.slice(start)));
  }

  function formatCoinDelta(delta) {
    const value = Math.round(Number(delta) || 0);
    if (value > 0) return `코인 +${value}개`;
    if (value < 0) return `코인 ${value}개`;
    return "코인 변동 없음";
  }

  function pulseCreditDisplay(delta) {
    const value = Math.round(Number(delta) || 0);
    if (!value) return;
    creditCounts.forEach((node) => {
      const target = node.closest(".credit-pill") || node;
      target.classList.remove("is-credit-up", "is-credit-down");
      void target.offsetWidth;
      target.classList.add(value > 0 ? "is-credit-up" : "is-credit-down");
      window.setTimeout(() => target.classList.remove("is-credit-up", "is-credit-down"), 950);
    });
  }

  function renderGoldenPopup(payload = {}) {
    if (!goldenModal) return;
    const delta = Math.round(Number(payload.delta ?? payload.selfDelta) || 0);
    const isBad = payload.tone === "bad" || delta < 0;
    const sourceText = payload.sourceTeam && payload.sourceTeam !== state.team
      ? `${teamLabelFor(payload.sourceTeam)} 황금열쇠 영향`
      : "AI 윤리 황금열쇠";
    const titleText = payload.title || "황금열쇠 카드";
    const conceptText = payload.concept ? ` · ${payload.concept}` : "";
    const codeText = payload.code ? `코드 ${payload.code}${conceptText}` : `황금열쇠${conceptText}`;
    const currentText = payload.credits !== undefined ? ` · 현재 ${Math.max(0, Number(payload.credits) || 0)}개` : "";

    setNodeText(goldenKicker, sourceText);
    setNodeText(goldenTitle, titleText);
    setNodeText(goldenCode, codeText);
    setNodeText(goldenMeaning, payload.ethicsMeaning || "이 카드의 AI 윤리 개념을 확인하세요.");
    setHighlightedText(goldenPopup, payload.popup || payload.message || "황금열쇠 효과가 적용되었습니다.", payload.popupHighlights);
    setNodeText(goldenDelta, `${formatCoinDelta(delta)}${currentText}`);
    goldenModal.classList.toggle("is-bad", isBad);
    goldenModal.classList.toggle("is-good", !isBad);
    goldenModal.hidden = false;
    goldenPopupOpen = true;
    document.body.classList.add("golden-modal-open");
    goldenConfirmBtn?.focus({ preventScroll: true });
  }

  function showNextGoldenPopup() {
    if (goldenPopupOpen || !goldenPopupQueue.length) return;
    renderGoldenPopup(goldenPopupQueue.shift());
  }

  function queueGoldenPopup(payload = {}) {
    if (!payload || typeof payload !== "object") return;
    goldenPopupQueue.push(payload);
    showNextGoldenPopup();
  }

  function closeGoldenPopup() {
    if (!goldenModal) return;
    goldenModal.hidden = true;
    goldenPopupOpen = false;
    document.body.classList.remove("golden-modal-open");
    window.setTimeout(showNextGoldenPopup, 80);
  }

  function consumeGoldenNoticesFromResponse(data = {}) {
    const notices = Array.isArray(data.goldenNotices) ? data.goldenNotices : [];
    notices.forEach((notice) => {
      queueGoldenPopup({
        ...notice,
        message: notice.popup,
        selfDelta: notice.delta
      });
      pulseCreditDisplay(notice.delta);
    });
  }

  function setSimilarityStatus(text, type = "") {
    if (!similarityStatus) return;
    similarityStatus.textContent = text;
    similarityStatus.classList.toggle("is-ok", type === "ok");
    similarityStatus.classList.toggle("is-bad", type === "bad");
  }

  function evidenceStorageKey() {
    return `kit-evidence-cards:${state.classId}:${state.team || state.user || "guest"}`;
  }

  function noteStorageKey() {
    return `kit-case-note:${state.classId}:${state.team || state.user || "guest"}`;
  }

  function ethicsStorageKey() {
    return `kit-ethics-quiz:${state.classId}:${state.team || state.user || "guest"}`;
  }

  function ethicsUnlockStorageKey() {
    return `kit-ethics-quiz-unlocked:${state.classId}:${state.team || state.user || "guest"}`;
  }

  function ethicsTimerStorageKey() {
    return `kit-ethics-quiz-timer:${state.classId}:${state.team || state.user || "guest"}`;
  }

  function gameSessionMarkerKey() {
    return `kit-game-session:${state.classId}:${state.team || state.user || "guest"}`;
  }

  function syncLocalGameSession(session = {}) {
    const sessionId = String(session.id || "").trim();
    if (!sessionId) return false;
    const previousSessionId = localStorage.getItem(gameSessionMarkerKey()) || "";
    const shouldReset = (previousSessionId && previousSessionId !== sessionId) ||
      (!previousSessionId && Number(session.number) > 1);
    localStorage.setItem(gameSessionMarkerKey(), sessionId);
    if (!shouldReset) return false;

    localStorage.removeItem(evidenceStorageKey());
    localStorage.removeItem(noteStorageKey());
    localStorage.removeItem(ethicsStorageKey());
    localStorage.removeItem(similarityDraftKey());
    state.evidenceCards = [];
    state.selectedEvidenceCode = "";
    state.ethicsAnswers = {};
    state.ethicsServerSolved = [];
    sessionClaimedKeys.clear();
    resetEthicsTimer();
    if (caseNoteArea) caseNoteArea.value = "";
    similarityBlanks.forEach((element) => restoreSimilarityBlankValue(element, ""));
    renderEvidenceBoard();
    renderEthicsSolvedSummary();
    updateEthicsNumberInputRange();
    autoGrowAllSimilarityBlanks();
    updateSimilarityCounter();
    return true;
  }

  function loadEthicsUnlockState() {
    state.ethicsUnlocked = false;
    sessionStorage.removeItem(ethicsUnlockStorageKey());
  }

  function unlockEthicsQuiz() {
    state.ethicsUnlocked = true;
    sessionStorage.removeItem(ethicsUnlockStorageKey());
    if (ethicsPasswordInput) ethicsPasswordInput.value = "";
  }

  function expireEthicsAccess() {
    state.ethicsUnlocked = false;
    sessionStorage.removeItem(ethicsUnlockStorageKey());
    if (ethicsPasswordInput) ethicsPasswordInput.value = "";
  }

  function stopEthicsTimerTicking() {
    if (state.ethicsTimerId) {
      window.clearInterval(state.ethicsTimerId);
      state.ethicsTimerId = null;
    }
  }

  function resetEthicsTimer() {
    stopEthicsTimerTicking();
    state.ethicsTimerQuestion = null;
    state.ethicsTimerDeadline = 0;
    sessionStorage.removeItem(ethicsTimerStorageKey());
  }

  function closeStudentEthicsQuestion(nextNumber = "") {
    stopEthicsTimerTicking();
    expireEthicsAccess();
    document.body.classList.remove("student-ethics-open");
    if (ethicsCard) {
      ethicsCard.hidden = true;
      ethicsCard.textContent = "";
    }
    updateEthicsNumberInputRange();
    if (ethicsNumberInput && nextNumber && Number(nextNumber) === firstUnsolvedEthicsNumber()) {
      ethicsNumberInput.value = String(nextNumber);
    }
    renderEthicsSolvedSummary();
    ethicsPasswordInput?.focus({ preventScroll: true });
  }

  function loadEthicsAnswers() {
    try {
      const saved = JSON.parse(localStorage.getItem(ethicsStorageKey()) || "{}");
      state.ethicsAnswers = saved && typeof saved === "object" ? saved : {};
    } catch {
      state.ethicsAnswers = {};
    }
  }

  function saveEthicsAnswers() {
    localStorage.setItem(ethicsStorageKey(), JSON.stringify(state.ethicsAnswers));
  }

  function ethicsQuestionByNumber(number) {
    return ethicsQuestions.find((question) => Number(question.number) === Number(number)) || null;
  }

  function maxEthicsQuestionNumber() {
    return ethicsQuestions.reduce((max, question) => Math.max(max, Number(question.number) || 0), 0) || 15;
  }

  function updateEthicsNumberInputRange() {
    if (!ethicsNumberInput) return;
    const maxNumber = maxEthicsQuestionNumber();
    const nextNumber = firstUnsolvedEthicsNumber();
    ethicsNumberInput.type = "text";
    ethicsNumberInput.readOnly = true;
    ethicsNumberInput.inputMode = "numeric";
    ethicsNumberInput.min = "1";
    ethicsNumberInput.max = String(maxNumber);
    ethicsNumberInput.placeholder = nextNumber ? `${nextNumber}` : "완료";
    ethicsNumberInput.value = nextNumber ? String(nextNumber) : "";
  }

  function ethicsAnswerFor(question) {
    return state.ethicsAnswers[String(question?.number || "")] || { value: "", revealed: false, rewarded: false, locked: false };
  }

  function setEthicsAnswer(question, patch) {
    const key = String(question.number);
    state.ethicsAnswers[key] = { ...ethicsAnswerFor(question), ...patch };
    saveEthicsAnswers();
  }

  function isEthicsCorrect(question) {
    return ethicsAnswerFor(question).value === question.answer;
  }

  function ethicsSolvedNumbers() {
    const solved = new Set(state.ethicsServerSolved.map(Number).filter(Boolean));
    ethicsQuestions.forEach((question) => {
      const answer = ethicsAnswerFor(question);
      if ((answer.rewarded || answer.revealed) && answer.value === question.answer) {
        solved.add(Number(question.number));
      }
    });
    return [...solved].sort((a, b) => a - b);
  }

  function ethicsAttemptedNumbers() {
    const attempted = new Set(state.ethicsServerSolved.map(Number).filter(Boolean));
    ethicsQuestions.forEach((question) => {
      const answer = ethicsAnswerFor(question);
      if (answer.revealed || answer.locked || answer.rewarded) {
        attempted.add(Number(question.number));
      }
    });
    return [...attempted].sort((a, b) => a - b);
  }

  function firstUnsolvedEthicsNumber() {
    const attempted = new Set(ethicsAttemptedNumbers());
    const question = ethicsQuestions.find((item) => !attempted.has(Number(item.number)));
    return question ? Number(question.number) : null;
  }

  function sequentialEthicsNumber(number) {
    return Number(number) || firstUnsolvedEthicsNumber() || 1;
  }

  function selectedEthicsNumber() {
    return Number(ethicsNumberInput?.value || "") || firstUnsolvedEthicsNumber() || state.ethicsCurrent || 1;
  }

  function ethicsSequenceGateMessage(number) {
    if (state.ethicsSubmitting) return "";

    const requested = Number(number) || firstUnsolvedEthicsNumber() || 1;
    const nextNumber = firstUnsolvedEthicsNumber();
    if (!nextNumber) return "모든 윤리퀴즈를 완료했습니다.";
    if (requested === nextNumber) return "";

    if (ethicsAttemptedNumbers().includes(requested)) {
      return `${requested}번은 이미 풀이가 끝나 다시 열람할 수 없습니다. 현재 풀 차례는 ${nextNumber}번입니다.`;
    }
    return `윤리퀴즈는 순서대로 풀어야 합니다. 현재 풀 차례는 ${nextNumber}번입니다.`;
  }

  function nextUnsolvedEthicsNumberAfter(currentNumber) {
    const attempted = new Set(ethicsAttemptedNumbers());
    const current = Number(currentNumber) || 0;
    const afterCurrent = ethicsQuestions.find((item) => Number(item.number) > current && !attempted.has(Number(item.number)));
    if (afterCurrent) return Number(afterCurrent.number);
    return firstUnsolvedEthicsNumber();
  }

  function unsyncedEthicsCreditBonus() {
    return ethicsQuestions.reduce((total, question) => {
      const answer = ethicsAnswerFor(question);
      if (answer.rewarded && !answer.serverRewarded && answer.value === question.answer) {
        return total + ethicsRewardCredits;
      }
      return total;
    }, 0);
  }

  function evidenceFromResponse(code, evidence = {}) {
    const clean = cleanCode(code);
    const catalog = evidenceCatalog[clean] || {};

    return {
      code: clean,
      room: evidence.room || catalog.room || "교실",
      roomId: evidence.roomId || catalog.roomId || "",
      index: Number(evidence.index) || Number(catalog.index) || 1,
      evidence: evidence.evidence || catalog.evidence || "증거카드",
      person: evidence.person || catalog.person || "",
      image: evidence.image || catalog.image || "",
      position: evidence.position || catalog.position || "center",
      at: new Date().toISOString()
    };
  }

  function loadEvidenceCards() {
    try {
      const saved = JSON.parse(localStorage.getItem(evidenceStorageKey()) || "[]");
      state.evidenceCards = Array.isArray(saved)
        ? saved
          .filter((card) => card?.code && card?.evidence)
          .map((card) => ({
            ...evidenceFromResponse(card.code, card),
            at: card.at || new Date().toISOString()
          }))
        : [];
    } catch {
      state.evidenceCards = [];
    }
  }

  function saveEvidenceCards() {
    localStorage.setItem(evidenceStorageKey(), JSON.stringify(state.evidenceCards));
  }

  function evidenceCardsFromLogs(logs = []) {
    return logs
      .filter((entry) => entry?.code && entry?.evidence)
      .map((entry) => evidenceFromResponse(entry.code, entry));
  }

  function applySyncedEvidenceCards(cards = []) {
    state.evidenceCards = Array.isArray(cards) ? cards.slice(0, 10) : [];
    if (!state.evidenceCards.some((card) => card.code === state.selectedEvidenceCode)) {
      state.selectedEvidenceCode = state.evidenceCards[0]?.code || "";
    }
    saveEvidenceCards();
    renderEvidenceBoard();
  }

  async function syncEvidenceCardsWithServer() {
    if (!state.team) return null;

    try {
      const response = await fetch(`/api/evidence-code?team=${encodeURIComponent(state.team)}&classId=${encodeURIComponent(state.classId)}`, {
        cache: "no-store",
        headers: {
          "x-kit-role": "student",
          "x-kit-class": state.classId,
          "x-kit-team": encodeURIComponent(state.team),
          "x-kit-user": encodeURIComponent(state.user)
        }
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !Array.isArray(data.evidenceLogs)) return null;

      const cards = evidenceCardsFromLogs(data.evidenceLogs);
      applySyncedEvidenceCards(cards);
      return cards;
    } catch {
      return null;
    }
  }

  function storeEvidenceCard(code, evidence) {
    const card = evidenceFromResponse(code, evidence);
    state.evidenceCards = [
      card,
      ...state.evidenceCards.filter((item) => item.code !== card.code)
    ].slice(0, 10);
    state.selectedEvidenceCode = card.code;
    saveEvidenceCards();
    renderEvidenceBoard();
    return card;
  }

  function setEvidenceShopStatus(text, type = "") {
    if (!evidenceShopStatus) return;
    evidenceShopStatus.textContent = text || "";
    evidenceShopStatus.classList.toggle("is-ok", type === "ok");
    evidenceShopStatus.classList.toggle("is-bad", type === "bad");
  }

  function evidenceShopRemainingCount() {
    return Math.max(0, state.shopMaxCards - state.shopPurchasedCount);
  }

  function evidenceShopSelectionLimit() {
    const affordable = Math.floor(Math.max(0, state.shopCredits) / Math.max(1, state.shopUnitCost));
    return Math.max(0, Math.min(evidenceShopRemainingCount(), affordable));
  }

  function renderEvidenceShop() {
    if (!evidenceShopList) return;

    const selectedCount = state.shopSelectedIds.size;
    const remaining = evidenceShopRemainingCount();
    const selectionLimit = evidenceShopSelectionLimit();
    if (evidenceShopCredits) evidenceShopCredits.textContent = `${Math.max(0, state.shopCredits)}개`;
    if (evidenceShopPrice) evidenceShopPrice.textContent = `1장 · ${state.shopUnitCost}코인`;
    if (evidenceShopRemaining) {
      evidenceShopRemaining.textContent = `${remaining}장 · 누적 ${state.shopPurchasedCount}/${state.shopMaxCards}`;
    }
    if (evidenceShopTotal) {
      evidenceShopTotal.textContent = `${selectedCount}장 · ${selectedCount * state.shopUnitCost}코인`;
    }
    if (evidenceShopPurchase) {
      evidenceShopPurchase.disabled = state.shopLoading || state.shopPurchasing || selectedCount < 1 || selectedCount > selectionLimit;
      evidenceShopPurchase.textContent = state.shopPurchasing ? "구매 중" : "구매";
    }

    evidenceShopList.textContent = "";
    if (state.shopLoading) {
      const loading = document.createElement("p");
      loading.className = "evidence-shop-empty";
      loading.textContent = "상점 정보를 불러오는 중입니다.";
      evidenceShopList.append(loading);
      return;
    }

    if (!remaining) {
      const limitMessage = document.createElement("p");
      limitMessage.className = "evidence-shop-empty";
      limitMessage.textContent = "상점 구매 한도 3장을 모두 사용했습니다.";
      evidenceShopList.append(limitMessage);
      return;
    }

    if (!state.shopCards.length) {
      const empty = document.createElement("p");
      empty.className = "evidence-shop-empty";
      empty.textContent = "구매할 수 있는 증거카드가 없습니다.";
      evidenceShopList.append(empty);
      return;
    }

    const grouped = state.shopCards.reduce((rooms, card) => {
      const key = card.roomId || card.room;
      if (!rooms.has(key)) rooms.set(key, { name: card.room, cards: [] });
      rooms.get(key).cards.push(card);
      return rooms;
    }, new Map());

    grouped.forEach((group) => {
      const section = document.createElement("section");
      section.className = "evidence-shop-room";

      const head = document.createElement("div");
      head.className = "evidence-shop-room__head";
      const title = document.createElement("h3");
      title.textContent = group.name;
      const count = document.createElement("span");
      count.textContent = `${group.cards.length}장`;
      head.append(title, count);

      const cards = document.createElement("div");
      cards.className = "evidence-shop-room__cards";
      group.cards.forEach((card) => {
        const selected = state.shopSelectedIds.has(card.id);
        const disabled = state.shopPurchasing || (!selected && selectedCount >= selectionLimit);
        const label = document.createElement("label");
        label.className = "evidence-shop-card";
        label.classList.toggle("is-selected", selected);
        label.classList.toggle("is-disabled", disabled);

        const cardBack = document.createElement("span");
        cardBack.className = "evidence-shop-card__back";
        cardBack.setAttribute("aria-hidden", "true");
        const cardBackMark = document.createElement("strong");
        cardBackMark.textContent = "?";
        cardBack.append(cardBackMark);

        const copy = document.createElement("span");
        copy.className = "evidence-shop-card__copy";
        const meta = document.createElement("span");
        meta.textContent = `${card.room} · 증거 카드 ${card.index}`;
        const name = document.createElement("strong");
        name.textContent = `증거카드 ${card.index}`;
        const person = document.createElement("em");
        person.textContent = "구매 후 공개";
        copy.append(meta, name, person);

        const input = document.createElement("input");
        input.type = "checkbox";
        input.checked = selected;
        input.disabled = disabled;
        input.dataset.evidenceShopId = card.id;
        input.setAttribute("aria-label", `${card.room} 증거카드 ${card.index} 선택`);
        input.addEventListener("change", selectEvidenceShopCard);

        label.append(cardBack, copy, input);
        cards.append(label);
      });

      section.append(head, cards);
      evidenceShopList.append(section);
    });
  }

  function closeEvidenceShop() {
    if (!evidenceShopModal || state.shopPurchasing) return;
    evidenceShopModal.hidden = true;
    state.shopOpen = false;
    state.shopSelectedIds.clear();
    document.body.classList.remove("evidence-shop-open");
    evidenceShopOpenButton?.focus({ preventScroll: true });
  }

  async function openEvidenceShop() {
    if (!evidenceShopModal || state.shopLoading || state.shopPurchasing) return;
    if (!state.team) {
      setEvidenceMessage("학생 팀 정보가 없습니다.", "bad");
      return;
    }

    state.shopOpen = true;
    state.shopLoading = true;
    state.shopSelectedIds.clear();
    evidenceShopModal.hidden = false;
    document.body.classList.add("evidence-shop-open");
    setEvidenceShopStatus("");
    renderEvidenceShop();
    evidenceShopCloseButtons[0]?.focus({ preventScroll: true });

    try {
      const response = await fetch(`/api/evidence-code?action=shop&team=${encodeURIComponent(state.team)}&classId=${encodeURIComponent(state.classId)}`, {
        cache: "no-store",
        headers: {
          "x-kit-role": "student",
          "x-kit-class": state.classId,
          "x-kit-team": encodeURIComponent(state.team),
          "x-kit-user": encodeURIComponent(state.user)
        }
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "상점 정보를 불러오지 못했습니다.");

      applyCredits(data.credits);
      state.shopCredits = Math.max(0, Number(data.credits) || 0);
      state.shopUnitCost = Math.max(1, Number(data.unitCost) || 5);
      state.shopMaxCards = Math.max(1, Number(data.maxCards) || 3);
      state.shopPurchasedCount = Math.max(0, Number(data.purchasedCount) || 0);
      state.shopCards = (Array.isArray(data.cards) ? data.cards : [])
        .map((card) => ({
          id: String(card.id || ""),
          room: String(card.room || "교실"),
          roomId: String(card.roomId || ""),
          index: Math.max(1, Number(card.index) || 1)
        }))
        .filter((card) => card.id && card.roomId)
        .sort((a, b) => {
          const roomDelta = evidenceShopRoomOrder.indexOf(a.roomId) - evidenceShopRoomOrder.indexOf(b.roomId);
          return roomDelta || a.index - b.index;
        });
      if (evidenceShopRemainingCount() > 0 && state.shopCards.length && state.shopCredits < state.shopUnitCost) {
        setEvidenceShopStatus(`증거카드 1장을 구매하려면 코인 ${state.shopUnitCost}개가 필요합니다.`, "bad");
      }
    } catch (error) {
      state.shopCards = [];
      setEvidenceShopStatus(error.message || "상점 정보를 불러오지 못했습니다.", "bad");
    } finally {
      state.shopLoading = false;
      renderEvidenceShop();
      updateControls();
    }
  }

  function selectEvidenceShopCard(event) {
    const input = event.currentTarget;
    if (!input || state.shopLoading || state.shopPurchasing) return;
    const cardId = String(input.dataset.evidenceShopId || "").trim();
    if (!cardId) return;

    if (input.checked) {
      if (state.shopSelectedIds.size >= evidenceShopSelectionLimit()) {
        input.checked = false;
        setEvidenceShopStatus(`현재는 최대 ${evidenceShopSelectionLimit()}장까지 선택할 수 있습니다.`, "bad");
      } else {
        state.shopSelectedIds.add(cardId);
        setEvidenceShopStatus("");
      }
    } else {
      state.shopSelectedIds.delete(cardId);
      setEvidenceShopStatus("");
    }
    renderEvidenceShop();
  }

  async function purchaseEvidenceShopCards() {
    if (state.shopPurchasing || !state.shopSelectedIds.size) return;
    const cardIds = [...state.shopSelectedIds];
    const total = cardIds.length * state.shopUnitCost;
    state.shopPurchasing = true;
    setEvidenceShopStatus(`증거카드 ${cardIds.length}장을 구매하는 중입니다.`);
    renderEvidenceShop();

    try {
      const response = await fetch("/api/evidence-code", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-kit-role": "student",
          "x-kit-class": state.classId,
          "x-kit-team": encodeURIComponent(state.team),
          "x-kit-user": encodeURIComponent(state.user)
        },
        body: JSON.stringify({
          action: "shop-purchase",
          cardIds,
          role: "student",
          classId: state.classId,
          team: state.team,
          user: state.user
        })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.ok) {
        if (data.credits !== undefined) {
          applyCredits(data.credits);
          state.shopCredits = Math.max(0, Number(data.credits) || 0);
        }
        throw new Error(data.error || "증거카드를 구매하지 못했습니다.");
      }

      applyCredits(data.credits);
      state.shopCredits = Math.max(0, Number(data.credits) || 0);
      state.shopPurchasedCount = Math.max(0, Number(data.purchasedCount) || state.shopPurchasedCount + cardIds.length);
      const purchasedCards = Array.isArray(data.cards) ? data.cards : [];
      purchasedCards.forEach((card) => storeEvidenceCard(card.code, card));
      const purchasedIds = new Set(purchasedCards.map((card) => String(card.id || "")));
      state.shopCards = state.shopCards.filter((card) => !purchasedIds.has(card.id));
      state.shopSelectedIds.clear();
      pulseCreditDisplay(-Math.max(0, Number(data.charged) || total));
      setEvidenceShopStatus(`증거카드 ${purchasedCards.length}장을 구매했습니다.`, "ok");
    } catch (error) {
      setEvidenceShopStatus(error.message || "증거카드를 구매하지 못했습니다.", "bad");
    } finally {
      state.shopPurchasing = false;
      renderEvidenceShop();
      updateControls();
    }
  }

  function setupEvidenceShop() {
    evidenceShopOpenButton?.addEventListener("click", openEvidenceShop);
    evidenceShopCloseButtons.forEach((button) => button.addEventListener("click", closeEvidenceShop));
    evidenceShopModal?.addEventListener("click", (event) => {
      if (event.target === evidenceShopModal) closeEvidenceShop();
    });
    evidenceShopPurchase?.addEventListener("click", purchaseEvidenceShopCards);
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && state.shopOpen) closeEvidenceShop();
    });
  }

  function selectedEvidenceCard() {
    return state.evidenceCards.find((card) => card.code === state.selectedEvidenceCode) || null;
  }

  function evidenceCardsForRoom(card) {
    if (!card) return [];
    return state.evidenceCards.filter((item) => {
      if (card.roomId && item.roomId) return item.roomId === card.roomId;
      return item.room === card.room;
    });
  }

  function renderEvidenceRoomDetail(card = selectedEvidenceCard()) {
    if (!evidenceRoomDetail) return;
    evidenceRoomDetail.textContent = "";

    if (!card) {
      const empty = document.createElement("p");
      empty.className = "evidence-room-empty";
      empty.textContent = "증거카드를 누르면 교실 사진과 해당 교실에서 얻은 증거만 표시됩니다.";
      evidenceRoomDetail.append(empty);
      return;
    }

    const roomCards = evidenceCardsForRoom(card);
    const hero = document.createElement("div");
    hero.className = "evidence-room-hero";

    const roomImage = document.createElement("img");
    roomImage.src = card.image;
    roomImage.alt = `${card.room} 증거 카드 ${card.index}`;
    roomImage.decoding = "async";
    roomImage.style.objectPosition = "center";

    const titleRow = document.createElement("div");
    titleRow.className = "evidence-room-title";

    const title = document.createElement("h3");
    title.textContent = card.room;

    const count = document.createElement("span");
    count.textContent = `${roomCards.length}개`;

    titleRow.append(title, count);
    hero.append(roomImage, titleRow);

    const list = document.createElement("div");
    list.className = "evidence-room-list";

    roomCards.forEach((item) => {
      const row = document.createElement("article");
      row.className = "evidence-room-card";

      const thumb = document.createElement("img");
      thumb.src = item.image;
      thumb.alt = `${item.room} 증거 카드 ${item.index}`;
      thumb.decoding = "async";
      thumb.style.objectPosition = item.position || "center";

      const body = document.createElement("div");
      const meta = document.createElement("span");
      meta.textContent = `${item.room} · 증거 카드 ${item.index}`;
      const name = document.createElement("strong");
      name.textContent = item.evidence;
      const person = document.createElement("em");
      person.textContent = `관련 인물: ${item.person || "미상"}`;

      body.append(meta, name, person);
      row.append(thumb, body);
      list.append(row);
    });

    evidenceRoomDetail.append(hero, list);
  }

  function renderEvidenceBoard() {
    if (!evidenceBoard) return;
    evidenceBoard.textContent = "";
    const maxEvidenceSlots = 10;
    const evidenceCount = Math.min(maxEvidenceSlots, state.evidenceCards.length);
    if (evidenceBoardCount) evidenceBoardCount.textContent = `${evidenceCount} / ${maxEvidenceSlots}`;

    function appendEmptySlots(count) {
      for (let index = 0; index < count; index += 1) {
        const slot = document.createElement("span");
        slot.className = "evidence-board-slot";
        slot.setAttribute("aria-hidden", "true");
        evidenceBoard.append(slot);
      }
    }

    if (!state.evidenceCards.length) {
      state.selectedEvidenceCode = "";
      appendEmptySlots(maxEvidenceSlots);
      renderEvidenceRoomDetail(null);
      return;
    }

    if (state.selectedEvidenceCode && !selectedEvidenceCard()) {
      state.selectedEvidenceCode = "";
    }

    state.evidenceCards.forEach((card) => {
      const item = document.createElement("button");
      item.type = "button";
      item.className = "evidence-board-card";
      item.dataset.evidenceCodeCard = card.code;
      item.classList.toggle("is-active", card.code === state.selectedEvidenceCode);

      const thumb = document.createElement("img");
      thumb.className = "evidence-board-thumb";
      thumb.src = card.image;
      thumb.alt = `${card.room} 증거 카드 ${card.index}`;
      thumb.style.objectPosition = card.position || "center";

      const body = document.createElement("div");
      body.className = "evidence-board-body";

      const meta = document.createElement("span");
      meta.textContent = `${card.room} · 증거 카드 ${card.index}`;

      const title = document.createElement("strong");
      title.textContent = card.evidence;
      const person = document.createElement("em");
      person.textContent = `관련 인물: ${card.person || "미상"}`;

      body.append(meta, title, person);
      item.append(thumb, body);
      evidenceBoard.append(item);
    });
    appendEmptySlots(Math.max(0, maxEvidenceSlots - evidenceCount));

    renderEvidenceRoomDetail();
  }

  const sessionClaimedKeys = new Set();

  function isClaimOptionObtained(roomId, index) {
    if (sessionClaimedKeys.has(`${roomId}:${index}`)) return true;
    return state.evidenceCards.some((card) => card.roomId === roomId && Number(card.index) === Number(index));
  }

  function setClaimStatus(text, type = "") {
    if (!evidenceClaimStatus) return;
    evidenceClaimStatus.textContent = text || "";
    evidenceClaimStatus.classList.toggle("is-ok", type === "ok");
    evidenceClaimStatus.classList.toggle("is-bad", type === "bad");
  }

  function closeEvidenceClaim() {
    if (evidenceClaimArea) {
      evidenceClaimArea.hidden = true;
      evidenceClaimArea.textContent = "";
    }
    document.body.classList.remove("evidence-claim-open");
    state.claimGrant = null;
    state.claimOptions = [];
  }

  function pickedClaimButton(roomId, index) {
    if (!evidenceClaimArea) return null;
    return [...evidenceClaimArea.querySelectorAll("[data-claim-index]")].find((button) => {
      return button.dataset.claimRoom === String(roomId || "") &&
        Number(button.dataset.claimIndex) === Number(index);
    }) || null;
  }

  function revealPickedClaimCard(roomId, index, card) {
    const selected = pickedClaimButton(roomId, index);
    if (!selected || !card) return;

    const front = selected.querySelector("[data-claim-card-front]");
    if (front) {
      front.textContent = "";
      const image = document.createElement("img");
      image.src = card.image;
      image.alt = `${card.room} 증거 카드 ${card.index}`;
      image.decoding = "async";
      image.style.objectPosition = card.position || "center";

      const meta = document.createElement("span");
      meta.textContent = `${card.room} · 증거 카드 ${card.index}`;
      const title = document.createElement("strong");
      title.textContent = card.evidence;
      const person = document.createElement("em");
      person.textContent = `관련 인물: ${card.person || "미상"}`;

      front.append(image, meta, title, person);
    }

    selected.classList.add("is-flipped", "is-picked");
    selected.disabled = true;
    [...evidenceClaimArea.querySelectorAll(".evidence-claim-option")].forEach((button) => {
      if (button !== selected) button.classList.add("is-muted");
      button.disabled = true;
    });
  }

  function renderClaimArea(grant, options) {
    if (!evidenceClaimArea || !grant) return;
    evidenceClaimArea.textContent = "";
    evidenceClaimArea.hidden = false;
    document.body.classList.add("evidence-claim-open");

    const panel = document.createElement("div");
    panel.className = "evidence-claim-panel";

    const head = document.createElement("div");
    head.className = "evidence-claim-head";
    const title = document.createElement("h3");
    title.textContent = `${grant.roomName || "교실"} 증거`;
    const close = document.createElement("button");
    close.type = "button";
    close.className = "evidence-claim-close";
    close.dataset.evidenceClaimClose = "1";
    close.setAttribute("aria-label", "닫기");
    close.textContent = "X";
    head.append(title, close);
    panel.append(head);

    const list = Array.isArray(options) ? options : [];
    const available = list.filter((option) => !isClaimOptionObtained(grant.roomId, option.index));

    if (list.length && !available.length) {
      const done = document.createElement("p");
      done.className = "evidence-claim-empty";
      done.textContent = "이 교실의 증거는 모두 모았습니다. 다시 도착했다면 보너스 코인을 받을 수 있습니다.";
      const bonusAmount = Number(state.claimRevisitBonus) || 0;
      const bonusButton = document.createElement("button");
      bonusButton.type = "button";
      bonusButton.className = "receive-credit-btn";
      bonusButton.dataset.revisitBonus = "1";
      bonusButton.dataset.claimRoom = grant.roomId;
      bonusButton.textContent = bonusAmount ? `코인 ${bonusAmount}개 받기` : "코인 받기";
      panel.append(done, bonusButton);
      evidenceClaimArea.append(panel);
      return;
    }

    const hint = document.createElement("p");
    hint.className = "evidence-claim-hint";
    hint.textContent = "증거카드 2장 중 하나만 선택할 수 있습니다. 선택한 카드만 크게 공개됩니다.";
    panel.append(hint);

    const optionsWrap = document.createElement("div");
    optionsWrap.className = "evidence-claim-options evidence-claim-deck";
    list.forEach((option) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "evidence-claim-option evidence-claim-flip-card";
      const obtained = isClaimOptionObtained(grant.roomId, option.index);
      button.disabled = obtained;
      button.setAttribute("aria-label", `${grant.roomName || "교실"} ${option.index}번 증거카드 선택`);
      if (!obtained) {
        button.dataset.claimIndex = String(option.index);
        button.dataset.claimRoom = grant.roomId;
      }

      const inner = document.createElement("span");
      inner.className = "evidence-claim-flip-card__inner";

      const back = document.createElement("span");
      back.className = "evidence-claim-flip-card__face evidence-claim-flip-card__back";
      const room = document.createElement("span");
      room.className = "evidence-claim-flip-card__room";
      room.textContent = grant.roomName || "교실";
      const label = document.createElement("strong");
      label.textContent = `${option.index}번 증거카드`;
      const cue = document.createElement("em");
      cue.textContent = obtained ? "이미 확인한 카드" : "선택해서 확인";
      back.append(room, label, cue);

      const front = document.createElement("span");
      front.className = "evidence-claim-flip-card__face evidence-claim-flip-card__front";
      front.dataset.claimCardFront = "1";
      front.textContent = "확인 중...";

      inner.append(back, front);
      button.append(inner);
      optionsWrap.append(button);
    });
    panel.append(optionsWrap);
    evidenceClaimArea.append(panel);
  }

  async function openEvidenceClaim() {
    if (state.claiming) return;
    if (!state.team) {
      setClaimStatus("학생 팀 정보가 없습니다.", "bad");
      return;
    }
    state.claiming = true;
    if (evidenceClaimOpen) evidenceClaimOpen.disabled = true;
    setClaimStatus("증거카드 정보를 확인하는 중...");

    try {
      await syncEvidenceCardsWithServer();
      setClaimStatus("승인을 확인하는 중...");
      const response = await fetch("/api/evidence-code", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-kit-role": "student",
          "x-kit-class": state.classId,
          "x-kit-team": encodeURIComponent(state.team),
          "x-kit-user": encodeURIComponent(state.user)
        },
        body: JSON.stringify({
          action: "claim",
          role: "student",
          classId: state.classId,
          team: state.team,
          user: state.user
        })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "승인을 확인하지 못했습니다.");

      if (!data.grant) {
        closeEvidenceClaim();
        setClaimStatus("아직 선생님이 승인한 증거 조사가 없습니다.", "bad");
        return;
      }

      state.claimGrant = data.grant;
      state.claimOptions = Array.isArray(data.options) ? data.options : [];
      state.claimRevisitBonus = Number(data.revisitBonus) || 0;
      renderClaimArea(state.claimGrant, state.claimOptions);
      setClaimStatus(`${data.grant.roomName || "교실"} 조사가 승인되었습니다.`, "ok");
    } catch (error) {
      setClaimStatus(error.message || "승인을 확인하지 못했습니다.", "bad");
    } finally {
      state.claiming = false;
      if (evidenceClaimOpen) evidenceClaimOpen.disabled = false;
      updateControls();
    }
  }

  async function pickEvidence(roomId, index) {
    if (state.claiming) return;
    if (!state.team) {
      setClaimStatus("학생 팀 정보가 없습니다.", "bad");
      return;
    }
    state.claiming = true;
    let completed = false;
    const optionButtons = evidenceClaimArea ? [...evidenceClaimArea.querySelectorAll(".evidence-claim-option")] : [];
    optionButtons.forEach((button) => { button.disabled = true; });
    pickedClaimButton(roomId, index)?.classList.add("is-loading");
    setClaimStatus("증거를 받는 중...");

    try {
      const response = await fetch("/api/evidence-code", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-kit-role": "student",
          "x-kit-class": state.classId,
          "x-kit-team": encodeURIComponent(state.team),
          "x-kit-user": encodeURIComponent(state.user)
        },
        body: JSON.stringify({
          action: "pick",
          roomId,
          index,
          role: "student",
          classId: state.classId,
          team: state.team,
          user: state.user
        })
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        if (data.code === "NO_GRANT") {
          closeEvidenceClaim();
          setClaimStatus("승인 시간이 지나서 닫혔습니다. 선생님께 다시 요청하세요.", "bad");
        } else if (data.code === "ALREADY_REDEEMED") {
          sessionClaimedKeys.add(`${roomId}:${index}`);
          if (state.claimGrant) renderClaimArea(state.claimGrant, state.claimOptions);
          setClaimStatus("이미 가지고 있는 증거입니다. 다른 증거를 고르세요.", "bad");
        } else {
          if (state.claimGrant) renderClaimArea(state.claimGrant, state.claimOptions);
          setClaimStatus(data.error || "증거를 받지 못했습니다.", "bad");
        }
        return;
      }

      sessionClaimedKeys.add(`${roomId}:${index}`);
      applyCredits(data.credits);
      const card = storeEvidenceCard(data.code, data.evidence);
      revealPickedClaimCard(roomId, index, card);
      completed = true;
      setClaimStatus(`코인 ${Number(data.added || evidenceRewardCredits)}개를 받았습니다 · ${card.room} 증거 카드 ${card.index}. X를 누르면 원래 화면으로 돌아갑니다.`, "ok");
    } catch (error) {
      setClaimStatus(error.message || "증거를 받지 못했습니다.", "bad");
    } finally {
      state.claiming = false;
      pickedClaimButton(roomId, index)?.classList.remove("is-loading");
      if (!completed) {
        optionButtons.forEach((button) => {
          button.disabled = !button.dataset.claimIndex;
        });
      }
      updateControls();
    }
  }

  async function claimRevisitBonus(roomId) {
    if (state.claiming) return;
    if (!state.team) {
      setClaimStatus("학생 팀 정보가 없습니다.", "bad");
      return;
    }
    state.claiming = true;
    const bonusButton = evidenceClaimArea ? evidenceClaimArea.querySelector("[data-revisit-bonus]") : null;
    if (bonusButton) bonusButton.disabled = true;
    setClaimStatus("보너스를 받는 중...");

    try {
      const response = await fetch("/api/evidence-code", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-kit-role": "student",
          "x-kit-class": state.classId,
          "x-kit-team": encodeURIComponent(state.team),
          "x-kit-user": encodeURIComponent(state.user)
        },
        body: JSON.stringify({
          action: "revisit",
          roomId,
          role: "student",
          classId: state.classId,
          team: state.team,
          user: state.user
        })
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        if (data.code === "NO_GRANT") {
          closeEvidenceClaim();
          setClaimStatus("승인 시간이 지나서 닫혔습니다. 선생님께 다시 요청하세요.", "bad");
        } else if (data.code === "EVIDENCE_REMAINING") {
          if (state.claimGrant) renderClaimArea(state.claimGrant, state.claimOptions);
          setClaimStatus("아직 받을 수 있는 증거가 남아 있습니다. 먼저 증거를 선택하세요.", "bad");
        } else if (data.code === "GRANT_ROOM_MISMATCH") {
          closeEvidenceClaim();
          setClaimStatus("승인된 방과 다릅니다. 선생님께 확인하세요.", "bad");
        } else {
          setClaimStatus(data.error || "보너스를 받지 못했습니다.", "bad");
        }
        return;
      }

      applyCredits(data.credits);
      closeEvidenceClaim();
      setClaimStatus(`코인 ${Number(data.added || 0)}개를 받았습니다 · 재방문 보너스`, "ok");
    } catch (error) {
      setClaimStatus(error.message || "보너스를 받지 못했습니다.", "bad");
    } finally {
      state.claiming = false;
      if (bonusButton) bonusButton.disabled = false;
    }
  }

  function setupCaseNote() {
    if (!caseNoteArea) return;
    caseNoteArea.value = localStorage.getItem(noteStorageKey()) || "";
    const setStatus = (text) => {
      if (caseNoteStatus) caseNoteStatus.textContent = text;
    };
    caseNoteArea.addEventListener("input", () => {
      localStorage.setItem(noteStorageKey(), caseNoteArea.value);
      setStatus("자동 저장");
    });
    clearCaseNote?.addEventListener("click", () => {
      caseNoteArea.value = "";
      localStorage.removeItem(noteStorageKey());
      setStatus("비움");
      caseNoteArea.focus();
    });
  }

  function similarityDraftKey() {
    return `kit-similarity-draft:${state.classId}:${state.team || state.user || "guest"}`;
  }

  function similarityBlankValues() {
    const values = {};
    similarityBlanks.forEach((element) => {
      values[element.dataset.similarityBlank] = String(element.value || "").trim();
    });
    return values;
  }

  function assembleSimilaritySentence() {
    return similarityTemplate(similarityBlankValues()).replace(/\s+/g, " ").trim();
  }

  function updateSimilarityCounter() {
    if (!similarityCount) return;
    const length = assembleSimilaritySentence().length;
    similarityCount.textContent = `${length}/${similaritySentenceLimit}`;
    similarityCount.classList.toggle("is-bad", length > similaritySentenceLimit);
  }

  function saveSimilarityDraft() {
    try {
      localStorage.setItem(similarityDraftKey(), JSON.stringify(similarityBlankValues()));
    } catch {}
  }

  function autoGrowSimilarityBlank(element) {
    if (!element || element.tagName !== "TEXTAREA") return;
    element.style.height = "auto";
    element.style.height = `${element.scrollHeight}px`;
  }

  function autoGrowAllSimilarityBlanks() {
    similarityBlanks.forEach(autoGrowSimilarityBlank);
  }

  function restoreSimilarityBlankValue(element, value) {
    if (element.tagName === "SELECT") {
      const hasOption = [...element.options].some((option) => option.value === value);
      element.value = hasOption ? value : "";
      return;
    }
    element.value = value;
  }

  function loadSimilarityDraft() {
    let saved = {};
    try {
      saved = JSON.parse(localStorage.getItem(similarityDraftKey()) || "{}") || {};
    } catch {
      saved = {};
    }
    similarityBlanks.forEach((element) => {
      const key = element.dataset.similarityBlank;
      if (typeof saved[key] === "string") restoreSimilarityBlankValue(element, saved[key]);
    });
    autoGrowAllSimilarityBlanks();
    updateSimilarityCounter();
  }

  function allSimilarityBlanksFilled() {
    return similarityBlanks.length > 0 && similarityBlanks.every((element) => String(element.value || "").trim().length > 0);
  }

  function hideSimilarityConfirm() {
    if (similarityConfirm) similarityConfirm.hidden = true;
    if (similarityForm) similarityForm.hidden = false;
  }

  function openSimilarityModal() {
    if (!similarityModal) return;
    loadSimilarityDraft();
    hideSimilarityConfirm();
    setSimilarityStatus("");
    similarityModal.hidden = false;
    document.body.classList.add("lightbox-open");
    similarityBlanks[0]?.focus({ preventScroll: true });
    fetchSimilarityStatus();
    refreshCredits().then(updateSimilaritySubmitButton).catch(() => {});
  }

  function closeSimilarityModal() {
    if (!similarityModal) return;
    similarityModal.hidden = true;
    hideSimilarityConfirm();
    document.body.classList.remove("lightbox-open");
  }

  async function fetchSimilarityStatus() {
    if (!state.team) return;
    try {
      const response = await fetch(`/api/similarity-sentences?team=${encodeURIComponent(state.team)}&classId=${encodeURIComponent(state.classId)}`, {
        cache: "no-store",
        headers: {
          "x-kit-role": "student",
          "x-kit-class": state.classId,
          "x-kit-team": encodeURIComponent(state.team),
          "x-kit-user": encodeURIComponent(state.user)
        }
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) return;
      state.similaritySubmitCount = Number(data.submitCount) || 0;
      if (Number(data.resubmitCost) > 0) state.similarityResubmitCost = Number(data.resubmitCost);
      state.similarityFreeResubmits = Math.max(0, Number(data.freeResubmits) || 0);
      updateSimilaritySubmitButton();
    } catch {}
  }

  function updateSimilaritySubmitButton() {
    if (!similaritySubmit) return;
    const isResubmit = state.similaritySubmitCount >= 1;
    const cost = state.similarityResubmitCost;
    if (!isResubmit) {
      similaritySubmit.textContent = "전송";
      similaritySubmit.disabled = false;
      return;
    }
    if (state.similarityFreeResubmits > 0) {
      similaritySubmit.textContent = `다시 보내기 (무료 ${state.similarityFreeResubmits}회)`;
      similaritySubmit.disabled = false;
      return;
    }
    similaritySubmit.textContent = `다시 보내기 (코인 ${cost}개)`;
    if (currentQuestionCredits() < cost) {
      similaritySubmit.disabled = true;
      setSimilarityStatus(`코인이 ${cost}개 있어야 다시 보낼 수 있습니다. 지금은 ${currentQuestionCredits()}개입니다.`, "bad");
    } else {
      similaritySubmit.disabled = false;
    }
  }

  function showSimilarityConfirm(sentence) {
    if (!similarityConfirm) return;
    if (similarityConfirmSentence) similarityConfirmSentence.textContent = sentence;
    const isResubmit = state.similaritySubmitCount >= 1;
    const isFree = isResubmit && state.similarityFreeResubmits > 0;
    if (similarityConfirmNotice) {
      if (isFree) {
        similarityConfirmNotice.textContent = "책임성 카드 효과로 이번 재전송은 무료입니다.";
        similarityConfirmNotice.hidden = false;
      } else if (isResubmit) {
        similarityConfirmNotice.textContent = `다시 보내면 코인 ${state.similarityResubmitCost}개가 차감됩니다.`;
        similarityConfirmNotice.hidden = false;
      } else {
        similarityConfirmNotice.hidden = true;
      }
    }
    if (similarityConfirmSend) similarityConfirmSend.textContent = isFree ? "보내기 (무료)" : isResubmit ? `보내기 (코인 ${state.similarityResubmitCost}개)` : "보내기";
    if (similarityForm) similarityForm.hidden = true;
    similarityConfirm.hidden = false;
    setSimilarityStatus("");
  }

  function reviewSimilaritySentence(event) {
    event.preventDefault();
    if (state.submittingSimilarity) return;
    if (!state.team) {
      setSimilarityStatus("학생 팀 정보가 없습니다.", "bad");
      return;
    }
    if (!allSimilarityBlanksFilled()) {
      setSimilarityStatus("빈칸을 모두 채워 주세요.", "bad");
      return;
    }
    const sentence = assembleSimilaritySentence();
    if (sentence.length > similaritySentenceLimit) {
      setSimilarityStatus(`${similaritySentenceLimit}자 이하로 줄여 주세요.`, "bad");
      return;
    }
    if (state.similaritySubmitCount >= 1 && state.similarityFreeResubmits <= 0 && currentQuestionCredits() < state.similarityResubmitCost) {
      setSimilarityStatus(`코인이 ${state.similarityResubmitCost}개 있어야 다시 보낼 수 있습니다.`, "bad");
      return;
    }
    showSimilarityConfirm(sentence);
  }

  async function sendSimilaritySentence() {
    if (state.submittingSimilarity) return;
    if (!state.team) {
      setSimilarityStatus("학생 팀 정보가 없습니다.", "bad");
      return;
    }
    const sentence = assembleSimilaritySentence();

    state.submittingSimilarity = true;
    if (similarityConfirmSend) similarityConfirmSend.disabled = true;
    setSimilarityStatus("선생님 화면으로 전송 중입니다...");

    try {
      await refreshCredits();
      const remainingCredits = currentQuestionCredits();
      const response = await fetch("/api/similarity-sentences", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-kit-role": "student",
          "x-kit-class": state.classId,
          "x-kit-team": encodeURIComponent(state.team),
          "x-kit-user": encodeURIComponent(state.user)
        },
        body: JSON.stringify({
          classId: state.classId,
          team: state.team,
          user: state.user,
          sentence,
          remainingCredits
        })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.ok) {
        if (data.code === "INSUFFICIENT_CREDITS") {
          if (data.credits !== undefined) applyCredits(data.credits);
          hideSimilarityConfirm();
          updateSimilaritySubmitButton();
          setSimilarityStatus(`코인이 ${data.needed || state.similarityResubmitCost}개 있어야 다시 보낼 수 있습니다.`, "bad");
          return;
        }
        throw new Error(data.error || "전송 실패");
      }

      if (data.credits !== undefined) applyCredits(data.credits);
      state.similaritySubmitCount = Number(data.submitCount) || state.similaritySubmitCount + 1;
      if (data.freeResubmits !== undefined) {
        state.similarityFreeResubmits = Math.max(0, Number(data.freeResubmits) || 0);
      }
      hideSimilarityConfirm();
      updateSimilaritySubmitButton();
      const charged = Number(data.charged) || 0;
      const sentMessage = data.freeUsed
        ? "책임성 카드 무료권으로 전송했습니다."
        : charged ? `코인 ${charged}개가 차감되고 전송됐습니다.` : "선생님 화면으로 전송했습니다.";
      setSimilarityStatus(sentMessage, "ok");
    } catch (error) {
      hideSimilarityConfirm();
      setSimilarityStatus(error.message || "전송하지 못했습니다.", "bad");
    } finally {
      state.submittingSimilarity = false;
      if (similarityConfirmSend) similarityConfirmSend.disabled = false;
    }
  }

  function setupSimilaritySentenceForm() {
    updateSimilarityCounter();
    similarityBlanks.forEach((element) => {
      const handleChange = () => {
        autoGrowSimilarityBlank(element);
        saveSimilarityDraft();
        updateSimilarityCounter();
      };
      element.addEventListener("input", handleChange);
      element.addEventListener("change", handleChange);
    });
    similarityOpenBtn?.addEventListener("click", openSimilarityModal);
    similarityCloseBtn?.addEventListener("click", closeSimilarityModal);
    similarityModal?.addEventListener("click", (event) => {
      if (event.target === similarityModal) closeSimilarityModal();
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && similarityModal && !similarityModal.hidden) closeSimilarityModal();
    });
    similarityForm?.addEventListener("submit", reviewSimilaritySentence);
    similarityConfirmSend?.addEventListener("click", sendSimilaritySentence);
    similarityConfirmCancel?.addEventListener("click", hideSimilarityConfirm);
  }

  function setupGoldenPopup() {
    goldenConfirmBtn?.addEventListener("click", closeGoldenPopup);
  }

  function updateEvidenceControls() {
    const disabled = state.redeeming || state.claiming || state.shopPurchasing || !state.team;
    if (evidenceInput) evidenceInput.disabled = disabled;
    if (evidenceSubmit) {
      evidenceSubmit.disabled = disabled;
      evidenceSubmit.textContent = state.redeeming ? "확인 중" : "입력";
    }
    if (evidenceClaimOpen) {
      evidenceClaimOpen.disabled = disabled;
      evidenceClaimOpen.textContent = state.claiming ? "받는 중" : "받기";
    }
    if (evidenceShopOpenButton) {
      evidenceShopOpenButton.disabled = disabled || state.shopLoading;
    }
    updateSimilaritySubmitButton();
  }

  function setRefreshBusy(isBusy) {
    refreshButtons.forEach((button) => {
      button.disabled = isBusy || state.requesting || state.redeeming || state.claiming;
      button.textContent = isBusy ? "받는 중..." : "코인 받기";
    });
  }

  function setPanelState(panel, text) {
    if (panel.state) panel.state.textContent = text;
  }

  function openCardLightbox(image) {
    if (!cardLightbox || !cardLightboxImage || !image) return;
    cardLightboxImage.src = image.currentSrc || image.src;
    cardLightboxImage.alt = image.alt || "";
    cardLightbox.hidden = false;
    document.body.classList.add("lightbox-open");
    closeCardButton?.focus({ preventScroll: true });
  }

  function closeCardLightbox() {
    if (!cardLightbox || !cardLightboxImage) return;
    cardLightbox.hidden = true;
    cardLightboxImage.removeAttribute("src");
    document.body.classList.remove("lightbox-open");
  }

  function setupCardLightbox() {
    if (!cardLightbox || !cardLightboxImage) return;

    panels.forEach((panel) => {
      const card = panel.root.querySelector(".suspect-card");
      const image = card?.querySelector("img");
      if (!card || !image) return;

      card.tabIndex = 0;
      card.setAttribute("role", "button");
      card.setAttribute("aria-label", "Open suspect card");
      card.addEventListener("click", () => openCardLightbox(image));
      card.addEventListener("keydown", (event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        openCardLightbox(image);
      });
    });

    closeCardButton?.addEventListener("click", closeCardLightbox);
    cardLightbox.addEventListener("click", (event) => {
      if (event.target === cardLightbox) closeCardLightbox();
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && !cardLightbox.hidden) closeCardLightbox();
    });
  }

  function ensureTokenCounter(panel) {
    if (!panel.input) return;
    panel.input.maxLength = chatMaxInputChars;
    panel.input.dataset.tokenLimit = String(chatTokenLimit);
    if (!panel.counter) {
      const counter = document.createElement("span");
      counter.className = "token-counter";
      counter.dataset.tokenCounter = "";
      panel.input.after(counter);
      panel.counter = counter;
    }
    updateTokenCounter(panel);
  }

  function updateTokenCounter(panel) {
    if (!panel.input || !panel.counter) return;
    const limit = Number(panel.input.dataset.tokenLimit || chatTokenLimit);
    const count = tokenEstimator.estimateTokens(panel.input.value);
    panel.counter.textContent = `${count}/${limit} 예상 토큰`;
    panel.counter.classList.toggle("is-warn", count >= Math.floor(limit * 0.8) && count <= limit);
    panel.counter.classList.toggle("is-full", count > limit);
    panel.counter.title = "실제 모델 토큰과 완전히 같지는 않은 예상값입니다.";
  }

  function isOverTokenLimit(input) {
    return tokenEstimator.estimateTokens(input?.value || "") > chatTokenLimit;
  }

  function updateControls() {
    const locked = state.role === "student" && state.credits <= 0;
    panels.forEach((panel) => {
      const overTokenLimit = isOverTokenLimit(panel.input);
      const inputDisabled = locked || state.requesting || panel.waiting;
      panel.input.disabled = inputDisabled;
      panel.submit.disabled = inputDisabled || overTokenLimit;
      updateTokenCounter(panel);
      panel.input.placeholder = locked
        ? "코인 받기를 눌러 확인하세요"
        : `${panel.name}에게 질문하기`;
    });
    setRefreshBusy(false);
    updateEvidenceControls();
  }

  function addMessage(panel, role, text, options = {}) {
    const row = document.createElement("div");
    row.className = `message message--${role}`;
    if (options.pending) row.dataset.pending = "true";

    const name = document.createElement("div");
    name.className = "message__name";
    name.textContent = role === "bot" ? panel.name : "조사단";

    const bubble = document.createElement("div");
    bubble.className = "message__bubble";
    bubble.textContent = text;

    row.append(name, bubble);
    panel.messages.append(row);
    panel.messages.scrollTop = panel.messages.scrollHeight;
    return { row, bubble };
  }

  function formatLogTime(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return date.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });
  }

  function renderStudentLogs() {
    if (!studentLogList) return;
    studentLogList.textContent = "";

    if (!state.logs.length) {
      const empty = document.createElement("p");
      empty.className = "student-log-empty";
      empty.textContent = "아직 질문 로그가 없습니다.";
      studentLogList.append(empty);
      return;
    }

    state.logs.slice(0, 12).forEach((entry) => {
      const item = document.createElement("article");
      item.className = "student-log-entry";

      const meta = document.createElement("span");
      const suspect = suspectNames[entry.suspect] || "용의자";
      meta.textContent = `${formatLogTime(entry.at)} · ${suspect} · ${entry.count || 0}번째`;

      const text = document.createElement("p");
      text.textContent = entry.message || "질문 내용 없음";

      item.append(meta, text);
      studentLogList.append(item);
    });
  }

  function applyCredits(credits) {
    state.serverCredits = Math.max(0, Number(credits) || 0);
    state.credits = state.serverCredits + unsyncedEthicsCreditBonus();
    setCreditText(`${state.credits}개`);
    updateControls();
  }

  function currentQuestionCredits() {
    return Math.max(0, Math.floor(Number(state.credits) || 0));
  }

  function applyUsage(usage) {
    if (!usage) return;
    if (usage.count !== undefined) setLogCount(usage.count);
    if (usage.log) {
      state.logs = [usage.log, ...state.logs.filter((entry) => entry.id !== usage.log.id)].slice(0, 12);
      renderStudentLogs();
    }
  }

  function createEthicsElement(tag, className, text) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
  }

  function applyEthicsReveal(element, delay = 0) {
    if (!element) return element;
    const safeDelay = Math.max(0, Number(delay) || 0);
    element.classList.add("student-ethics-reveal");
    element.style.setProperty("--ethics-reveal-delay", `${safeDelay}ms`);
    return element;
  }

  function ethicsTimerRemainingMs(question) {
    if (state.ethicsTimerQuestion !== Number(question?.number || 0)) return 0;
    return Math.max(0, Number(state.ethicsTimerDeadline || 0) - Date.now());
  }

  function saveEthicsTimerState() {
    if (!state.ethicsTimerQuestion || !state.ethicsTimerDeadline) return;
    sessionStorage.setItem(ethicsTimerStorageKey(), JSON.stringify({
      question: state.ethicsTimerQuestion,
      deadline: state.ethicsTimerDeadline
    }));
  }

  function loadEthicsTimerState(number) {
    try {
      const saved = JSON.parse(sessionStorage.getItem(ethicsTimerStorageKey()) || "{}");
      if (Number(saved.question) !== Number(number) || !Number(saved.deadline)) return false;
      state.ethicsTimerQuestion = Number(saved.question);
      state.ethicsTimerDeadline = Number(saved.deadline);
      return true;
    } catch {
      return false;
    }
  }

  function updateEthicsTimerElement(element, question) {
    if (!element) return;
    const remaining = ethicsTimerRemainingMs(question);
    const seconds = Math.max(0, Math.ceil(remaining / 1000));
    element.textContent = `남은 시간 ${seconds}초`;
    element.classList.toggle("is-warn", seconds > 0 && seconds <= 10);
    element.classList.toggle("is-ended", seconds <= 0);
  }

  function createEthicsTimerElement(question) {
    const element = createEthicsElement("span", "student-ethics-timer", "");
    element.dataset.studentEthicsTimer = "";
    updateEthicsTimerElement(element, question);
    return element;
  }

  function markEthicsTimedOut(question) {
    const answer = ethicsAnswerFor(question);
    if (answer.locked || answer.rewarded || answer.revealed) {
      resetEthicsTimer();
      return;
    }

    const visible = ethicsCard && !ethicsCard.hidden && Number(state.ethicsCurrent) === Number(question.number);
    state.ethicsSubmitting = true;
    setEthicsAnswer(question, {
      revealed: true,
      rewarded: false,
      locked: true,
      timedOut: true
    });
    resetEthicsTimer();
    if (visible) renderStudentEthicsQuestion(question.number);
    state.ethicsSubmitting = false;
    expireEthicsAccess();
    updateEthicsNumberInputRange();
    renderEthicsSolvedSummary();
  }

  function startEthicsTimer(question) {
    const number = Number(question?.number || 0);
    if (!number) return 0;

    const now = Date.now();
    if (state.ethicsTimerQuestion !== number || !state.ethicsTimerDeadline) {
      stopEthicsTimerTicking();
      if (!loadEthicsTimerState(number)) {
        state.ethicsTimerQuestion = number;
        state.ethicsTimerDeadline = now + ethicsQuizTimeLimitMs;
        saveEthicsTimerState();
      }
    }

    if (state.ethicsTimerDeadline <= now) {
      markEthicsTimedOut(question);
      return 0;
    }

    stopEthicsTimerTicking();
    state.ethicsTimerId = window.setInterval(() => {
      const timer = ethicsCard?.querySelector("[data-student-ethics-timer]");
      updateEthicsTimerElement(timer, question);
      if (ethicsTimerRemainingMs(question) <= 0) {
        markEthicsTimedOut(question);
      }
    }, 250);

    return ethicsTimerRemainingMs(question);
  }

  function createEthicsCloseButton() {
    const button = createEthicsElement("button", "student-ethics-close", "X");
    button.type = "button";
    button.setAttribute("aria-label", "윤리퀴즈 닫기");
    button.addEventListener("click", () => closeStudentEthicsQuestion());
    return button;
  }

  function renderEthicsSolvedSummary() {
    if (!ethicsSolvedSummary) return;
    const attempted = ethicsAttemptedNumbers();
    ethicsSolvedSummary.textContent = attempted.length
      ? `푼 문제: ${attempted.map((number) => `${number}번`).join(", ")}`
      : "푼 문제: 없음";
  }

  function renderEthicsParagraphs(container, paragraphs = [], startDelay = 0) {
    paragraphs.forEach((text, index) => {
      container.append(applyEthicsReveal(createEthicsElement("p", "", text), startDelay + index * 45));
    });
  }

  function renderEthicsAccessGate(message = "윤리퀴즈 비밀번호를 입력한 뒤 시작하세요.") {
    if (!ethicsCard) return;
    document.body.classList.add("student-ethics-open");
    ethicsCard.textContent = "";
    ethicsCard.hidden = false;

    const panel = createEthicsElement("div", "student-ethics-modal-panel");
    const head = createEthicsElement("div", "student-ethics-head");
    const titleWrap = document.createElement("div");
    titleWrap.append(
      createEthicsElement("p", "student-ethics-kicker", "윤리퀴즈"),
      createEthicsElement("h2", "", "비밀번호 확인")
    );
    head.append(titleWrap, createEthicsElement("span", "student-ethics-meta", "잠김"), createEthicsCloseButton());

    const status = createEthicsElement("p", "student-ethics-status is-bad", message);
    panel.append(head, status);
    ethicsCard.append(panel);
  }

  function requireEthicsAccess() {
    if (state.ethicsUnlocked) return true;

    const password = String(ethicsPasswordInput?.value || "").trim();
    if (password === ethicsAccessPassword) {
      unlockEthicsQuiz();
      return true;
    }

    renderEthicsAccessGate(password ? "비밀번호가 맞지 않습니다." : "윤리퀴즈 비밀번호를 입력한 뒤 시작하세요.");
    if (ethicsPasswordInput) {
      ethicsPasswordInput.value = "";
      ethicsPasswordInput.focus({ preventScroll: true });
    }
    return false;
  }

  function renderStudentEthicsQuestion(number = state.ethicsCurrent) {
    if (!ethicsCard) return;
    if (!state.ethicsUnlocked) {
      renderEthicsAccessGate();
      return;
    }

    const targetNumber = sequentialEthicsNumber(number);
    const sequenceMessage = ethicsSequenceGateMessage(targetNumber);
    if (sequenceMessage) {
      expireEthicsAccess();
      updateEthicsNumberInputRange();
      renderEthicsAccessGate(sequenceMessage);
      return;
    }

    const question = ethicsQuestionByNumber(targetNumber);
    ethicsCard.textContent = "";

    if (!ethicsQuestions.length || !question) {
      document.body.classList.add("student-ethics-open");
      ethicsCard.hidden = false;
      const status = createEthicsElement("p", "student-ethics-status is-bad", `문제 번호는 1~${maxEthicsQuestionNumber()} 사이로 입력하세요.`);
      const panel = createEthicsElement("div", "student-ethics-modal-panel");
      const head = createEthicsElement("div", "student-ethics-head");
      const titleWrap = document.createElement("div");
      titleWrap.append(
        createEthicsElement("p", "student-ethics-kicker", "윤리퀴즈"),
        createEthicsElement("h2", "", "문제 번호 확인")
      );
      head.append(titleWrap, createEthicsCloseButton());
      panel.append(head, status);
      ethicsCard.append(panel);
      return;
    }

    state.ethicsCurrent = Number(question.number);
    if (ethicsNumberInput) ethicsNumberInput.value = String(question.number);
    document.body.classList.add("student-ethics-open");
    ethicsCard.hidden = false;

    const answer = ethicsAnswerFor(question);
    const revealed = Boolean(answer.revealed);
    const correct = answer.value === question.answer;
    const locked = Boolean(answer.locked || answer.rewarded || (revealed && !correct));
    const alreadySolved = ethicsAttemptedNumbers().includes(Number(question.number));
    const timedOut = Boolean(answer.timedOut);

    if (!locked && startEthicsTimer(question) <= 0) return;
    if (locked) resetEthicsTimer();

    const head = createEthicsElement("div", "student-ethics-head");
    const titleWrap = document.createElement("div");
    const titleKicker = createEthicsElement("p", "student-ethics-kicker", `${question.number}번 문제`);
    const title = applyEthicsReveal(createEthicsElement("h2", "", question.topic), 0);
    titleWrap.append(
      titleKicker,
      title
    );
    const headTools = createEthicsElement("div", "student-ethics-head-tools");
    if (!locked) headTools.append(createEthicsTimerElement(question));
    headTools.append(createEthicsElement("span", "student-ethics-meta", alreadySolved ? "풀이 완료" : "미풀이"), createEthicsCloseButton());
    head.append(titleWrap, headTools);

    const source = createEthicsElement("figure", "student-ethics-source");
    if (question.sourceImage) {
      const image = document.createElement("img");
      image.src = question.sourceImage;
      image.alt = `${question.number}번 문제 자료 이미지`;
      image.decoding = "async";
      image.loading = "lazy";
      source.append(image, createEthicsElement("span", "", `PDF에서 가져온 ${question.number}번 자료`));
    } else {
      source.append(createEthicsElement("span", "student-ethics-source-empty", "추가 자료 이미지가 없습니다."));
    }

    const copy = createEthicsElement("div", "student-ethics-copy");
    if (question.background?.length) {
      const section = createEthicsElement("section", "student-ethics-section");
      section.append(createEthicsElement("h3", "", "배경설명"));
      renderEthicsParagraphs(section, question.background, 70);
      copy.append(section);
    }

    const prompt = createEthicsElement("section", "student-ethics-section student-ethics-prompt");
    prompt.append(createEthicsElement("h3", "", question.options?.length === 2 ? "퀴즈 O/X" : "퀴즈"));
    prompt.append(applyEthicsReveal(createEthicsElement("p", "", question.prompt), 130));
    copy.append(prompt);

    const options = createEthicsElement("section", "student-ethics-section");
    options.append(createEthicsElement("h3", "", "보기"));
    const optionList = createEthicsElement("div", "student-ethics-options");
    question.options.forEach((option, index) => {
      const label = createEthicsElement("label", "student-ethics-option");
      const input = document.createElement("input");
      input.type = "radio";
      input.name = `student-ethics-${question.number}`;
      input.value = option.id;
      input.checked = answer.value === option.id;
      input.disabled = locked;
      input.addEventListener("change", () => {
        if (locked) return;
        setEthicsAnswer(question, { value: option.id, revealed: false });
        renderStudentEthicsQuestion(question.number);
      });
      label.classList.toggle("is-selected", answer.value === option.id);
      label.classList.toggle("is-correct", revealed && option.id === question.answer);
      label.classList.toggle("is-wrong", revealed && answer.value === option.id && option.id !== question.answer);
      label.classList.toggle("is-locked", locked);
      const optionText = applyEthicsReveal(createEthicsElement("span", "", `${option.marker} ${option.text}`), 180 + index * 38);
      label.append(input, optionText);
      optionList.append(label);
    });
    options.append(optionList);
    copy.append(options);

    const explanation = createEthicsElement("section", "student-ethics-section student-ethics-explanation");
    explanation.classList.toggle("is-visible", revealed);
    explanation.append(createEthicsElement("h3", "", "해설"));
    const correctOption = question.options.find((option) => option.id === question.answer);
    explanation.append(applyEthicsReveal(createEthicsElement("p", "", `정답: ${correctOption ? `${correctOption.marker} ${correctOption.text}` : question.answer}`), 80));
    renderEthicsParagraphs(explanation, question.explanation, 130);
    copy.append(explanation);

    const actions = createEthicsElement("div", "student-ethics-actions");
    const submit = createEthicsElement("button", "student-ethics-submit", locked ? "풀이 완료" : "정답 확인");
    submit.type = "button";
    submit.disabled = locked;
    const status = createEthicsElement("div", "student-ethics-status");
    status.dataset.studentEthicsStatus = "";
    const nextNumber = nextUnsolvedEthicsNumberAfter(question.number);
    if (revealed && correct) {
      if (answer.rewarded && !nextNumber) {
        status.textContent = "정답입니다. 모든 윤리퀴즈를 완료했습니다.";
      } else if (answer.rewarded) {
        status.textContent = `정답입니다. 코인 ${ethicsRewardCredits}개가 바로 반영되었습니다.`;
      } else {
        status.textContent = "정답입니다.";
      }
      status.classList.add("is-ok");
    } else if (timedOut) {
      status.textContent = "시간이 종료되었습니다. 이 문제는 다시 풀 수 없습니다.";
      status.classList.add("is-bad");
    } else if (revealed) {
      status.textContent = nextNumber ? "오답입니다. 이 문제는 다시 풀 수 없습니다." : "오답입니다. 모든 윤리퀴즈를 완료했습니다.";
      status.classList.add("is-bad");
    }
    submit.addEventListener("click", () => submitStudentEthicsAnswer(question));
    actions.append(submit, status);
    if (locked) {
      const next = createEthicsElement("button", "student-ethics-next", "닫기");
      next.type = "button";
      next.addEventListener("click", () => {
        closeStudentEthicsQuestion();
      });
      actions.append(next);
    }
    copy.append(actions);

    const layout = createEthicsElement("div", "student-ethics-question-layout");
    layout.append(source, copy);
    const panel = createEthicsElement("div", "student-ethics-modal-panel");
    panel.append(head, layout);
    ethicsCard.append(panel);
    if (locked && !state.ethicsSubmitting) expireEthicsAccess();
    renderEthicsSolvedSummary();
  }

  async function submitStudentEthicsAnswer(question) {
    const answer = ethicsAnswerFor(question);
    const status = ethicsCard?.querySelector("[data-student-ethics-status]");
    if (answer.locked || answer.rewarded) {
      resetEthicsTimer();
      if (status) {
        status.textContent = answer.value === question.answer
          ? "이미 푼 문제입니다."
          : "오답 처리된 문제라 다시 풀 수 없습니다.";
        status.className = answer.value === question.answer ? "student-ethics-status is-ok" : "student-ethics-status is-bad";
      }
      return;
    }
    if (!answer.value) {
      if (status) {
        status.textContent = "보기를 선택하세요.";
        status.className = "student-ethics-status is-bad";
      }
      return;
    }

    if (answer.value !== question.answer) {
      resetEthicsTimer();
      state.ethicsSubmitting = true;
      setEthicsAnswer(question, { revealed: true, rewarded: false, locked: true });
      renderStudentEthicsQuestion(question.number);
      state.ethicsSubmitting = false;
      expireEthicsAccess();
      updateEthicsNumberInputRange();
      return;
    }

    if (ethicsAnswerFor(question).rewarded) {
      resetEthicsTimer();
      setEthicsAnswer(question, { revealed: true });
      renderStudentEthicsQuestion(question.number);
      return;
    }

    resetEthicsTimer();
    state.ethicsSubmitting = true;
    setEthicsAnswer(question, { revealed: true, rewarded: true, serverRewarded: false });
    applyCredits(state.serverCredits);
    renderEthicsSolvedSummary();
    renderStudentEthicsQuestion(question.number);

    try {
      const response = await fetch("/api/ethics-quiz", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-kit-role": "student",
          "x-kit-class": state.classId,
          "x-kit-team": encodeURIComponent(state.team),
          "x-kit-user": encodeURIComponent(state.user)
        },
        body: JSON.stringify({
          team: state.team,
          user: state.user,
          classId: state.classId,
          question: question.number,
          questionId: question.customId || "",
          answer: answer.value
        })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data.correct === false) throw new Error(data.error || "sync failed");

      if (Array.isArray(data.solved)) state.ethicsServerSolved = data.solved;
      setEthicsAnswer(question, { revealed: true, rewarded: true, serverRewarded: true });
      if (data.credits !== undefined) applyCredits(data.credits);
      renderEthicsSolvedSummary();
      updateEthicsNumberInputRange();
      if (ethicsCard && !ethicsCard.hidden) renderStudentEthicsQuestion(question.number);
    } catch {
      if (ethicsCard && !ethicsCard.hidden) renderStudentEthicsQuestion(question.number);
    } finally {
      state.ethicsSubmitting = false;
      expireEthicsAccess();
      updateEthicsNumberInputRange();
    }
  }

  async function syncEthicsSolvedWithServer() {
    if (!state.team) {
      renderEthicsSolvedSummary();
      return;
    }

    try {
      const response = await fetch(`/api/ethics-quiz?team=${encodeURIComponent(state.team)}&classId=${encodeURIComponent(state.classId)}`, {
        cache: "no-store",
        headers: {
          "x-kit-role": "student",
          "x-kit-class": state.classId,
          "x-kit-team": encodeURIComponent(state.team),
          "x-kit-user": encodeURIComponent(state.user)
        }
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "sync failed");
      state.ethicsServerSolved = Array.isArray(data.solved) ? data.solved : [];
      state.ethicsServerSolved.forEach((number) => {
        const question = ethicsQuestionByNumber(number);
        if (question) {
          const current = ethicsAnswerFor(question);
          setEthicsAnswer(question, { value: current.value || question.answer, rewarded: true, serverRewarded: true, revealed: true });
        }
      });
      renderEthicsSolvedSummary();
      updateEthicsNumberInputRange();
      if (data.credits !== undefined) applyCredits(data.credits);
    } catch {
      renderEthicsSolvedSummary();
      updateEthicsNumberInputRange();
    }
  }

  async function resetStudentEthicsQuiz() {
    const password = window.prompt("윤리퀴즈 풀이 기록을 초기화하려면 비밀번호를 입력하세요.");
    if (password === null) return;
    if (password !== ethicsAccessPassword) {
      window.alert("비밀번호가 맞지 않습니다.");
      return;
    }

    state.ethicsAnswers = {};
    state.ethicsServerSolved = [];
    resetEthicsTimer();
    localStorage.removeItem(ethicsStorageKey());
    applyCredits(state.serverCredits);
    renderEthicsSolvedSummary();
    updateEthicsNumberInputRange();
    if (ethicsCard) {
      ethicsCard.hidden = true;
      ethicsCard.textContent = "";
    }

    try {
      await fetch("/api/ethics-quiz", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-kit-role": "student",
          "x-kit-class": state.classId,
          "x-kit-team": encodeURIComponent(state.team),
          "x-kit-user": encodeURIComponent(state.user)
        },
        body: JSON.stringify({
          action: "reset",
          password: ethicsAccessPassword,
          team: state.team,
          user: state.user,
          classId: state.classId
        })
      });
    } catch {
      // Local reset is enough for offline/static-server classroom use.
    }
  }

  function setupStudentEthicsQuiz() {
    loadEthicsUnlockState();
    loadEthicsAnswers();
    renderEthicsSolvedSummary();
    updateEthicsNumberInputRange();

    window.addEventListener("kit-ethics-questions-updated", () => {
      syncStudentEthicsQuestionOrder();
      updateEthicsNumberInputRange();
      renderEthicsSolvedSummary();
      if (ethicsCard && !ethicsCard.hidden) {
        renderStudentEthicsQuestion(state.ethicsCurrent);
      }
    });

    ethicsOpenButton?.addEventListener("click", () => {
      if (!state.ethicsUnlocked) {
        renderEthicsAccessGate();
        ethicsPasswordInput?.focus({ preventScroll: true });
        return;
      }
      renderStudentEthicsQuestion(selectedEthicsNumber());
    });

    ethicsForm?.addEventListener("submit", (event) => {
      event.preventDefault();
      if (!requireEthicsAccess()) {
        return;
      }
      renderStudentEthicsQuestion(selectedEthicsNumber());
    });

    ethicsResetButton?.addEventListener("click", resetStudentEthicsQuiz);

    syncEthicsSolvedWithServer();
  }

  async function refreshCredits() {
    if (!state.team) {
      setCreditText("학생 없음");
      setLogCount(0);
      state.logs = [];
      renderStudentLogs();
      updateControls();
      return;
    }

    try {
      setRefreshBusy(true);
      const response = await fetch(`/api/credits?team=${encodeURIComponent(state.team)}&classId=${encodeURIComponent(state.classId)}`, {
        headers: {
          "x-kit-role": state.role,
          "x-kit-class": state.classId,
          "x-kit-team": encodeURIComponent(state.team),
          "x-kit-user": encodeURIComponent(state.user)
        }
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "sync failed");
      syncLocalGameSession(data.session);
      applyCredits(data.credits);
      setLogCount(data.count || 0);
      state.logs = Array.isArray(data.logs) ? data.logs : [];
      renderStudentLogs();
      consumeGoldenNoticesFromResponse(data);
    } catch {
      setCreditText("받기 실패");
    } finally {
      setRefreshBusy(false);
      updateControls();
    }
  }

  async function submitEvidenceCode(event) {
    event.preventDefault();
    const code = cleanCode(evidenceInput?.value);
    if (evidenceInput) evidenceInput.value = code;

    if (!state.team) {
      setEvidenceMessage("학생 팀 정보가 없습니다.", "bad");
      updateEvidenceControls();
      return;
    }
    if (!code) {
      setEvidenceMessage("황금열쇠 코드를 입력하세요.", "bad");
      return;
    }

    state.redeeming = true;
    setEvidenceMessage("황금열쇠 코드 확인 중...", "");
    updateControls();

    try {
      const response = await fetch("/api/evidence-code", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-kit-role": "student",
          "x-kit-class": state.classId,
          "x-kit-team": encodeURIComponent(state.team),
          "x-kit-user": encodeURIComponent(state.user)
        },
        body: JSON.stringify({
          code,
          role: "student",
          classId: state.classId,
          team: state.team,
          user: state.user
        })
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        if (data.code === "ALREADY_REDEEMED" && data.evidence) {
          const card = storeEvidenceCard(code, data.evidence);
          setEvidenceMessage(`이미 사용한 코드입니다. ${card.room} 증거 카드 ${card.index}`, "bad");
          if (evidenceInput) evidenceInput.value = "";
          return;
        }
        if (data.code === "ALREADY_REDEEMED_GOLDEN") {
          setEvidenceMessage("이미 사용한 황금열쇠 코드입니다.", "bad");
          if (evidenceInput) evidenceInput.value = "";
          return;
        }
        const message = data.code === "ALREADY_REDEEMED"
          ? "이미 사용한 황금열쇠 코드입니다."
          : data.code === "INVALID_EVIDENCE_CODE"
            ? "황금열쇠 코드가 맞지 않습니다."
            : data.error || "황금열쇠 코드를 확인하지 못했습니다.";
        throw new Error(message);
      }

      if (data.kind === "golden") {
        if (data.credits !== undefined) applyCredits(data.credits);
        pulseCreditDisplay(data.selfDelta);
        if (data.freeResubmits !== undefined && data.freeResubmits !== null) {
          state.similarityFreeResubmits = Math.max(0, Number(data.freeResubmits) || 0);
          updateSimilaritySubmitButton();
        }
        queueGoldenPopup({
          ...data,
          delta: data.selfDelta,
          popup: data.popup || data.message
        });
        setEvidenceMessage(data.message || "황금열쇠 효과가 적용되었습니다.", data.tone === "bad" ? "bad" : "ok");
        if (evidenceInput) evidenceInput.value = "";
        return;
      }

      applyCredits(data.credits);
      const card = storeEvidenceCard(code, data.evidence);
      setEvidenceMessage(`${teamLabelFor(state.team)} 코인 ${Number(data.added || evidenceRewardCredits)}개 추가 · ${card.room} 증거 카드 ${card.index}`, "ok");
      if (evidenceInput) evidenceInput.value = "";
    } catch (error) {
      setEvidenceMessage(error.message || "황금열쇠 코드를 확인하지 못했습니다.", "bad");
      await refreshCredits();
    } finally {
      state.redeeming = false;
      updateControls();
    }
  }

  async function refreshApiStatus() {
    try {
      const response = await fetch("/api/status");
      const data = await response.json().catch(() => ({}));
      state.requiresAccessCode = Boolean(data.requiresAccessCode);

      if (data.provider === "openai" && data.hasOpenAiKey) {
        setApiStatus(data.requiresAccessCode && !state.accessCode ? "코드 필요" : "ChatGPT 준비됨", data.requiresAccessCode && !state.accessCode ? "bad" : "ok");
      } else if (data.provider === "openai") {
        setApiStatus("OpenAI 키 필요", "bad");
      } else {
        setApiStatus(data.provider || "로컬", data.hasOpenAiKey ? "ok" : "");
      }
    } catch {
      setApiStatus("연결 실패", "bad");
    }
  }

  function ensureAccessCode() {
    if (!state.requiresAccessCode || state.accessCode) return true;

    const code = window.prompt("입장 코드를 입력하세요.");
    if (!code || !code.trim()) {
      setApiStatus("코드 필요", "bad");
      return false;
    }

    state.accessCode = code.trim();
    sessionStorage.setItem("class-access-code", state.accessCode);
    setApiStatus("준비됨", "ok");
    return true;
  }

  function clearAccessCode() {
    state.accessCode = "";
    sessionStorage.removeItem("class-access-code");
  }

  async function requestReply(panel, text, priorHistory) {
    const safetyReply = safetyReplyFor(text);
    if (safetyReply) return safetyReply;
    if (!ensureAccessCode()) return "입장 코드가 필요합니다. 선생님에게 받은 코드를 입력해 주세요.";

    try {
      const headers = {
        "content-type": "application/json",
        "x-kit-role": state.role,
        "x-kit-class": state.classId,
        "x-kit-team": encodeURIComponent(state.team),
        "x-kit-user": encodeURIComponent(state.user)
      };
      if (state.accessCode) headers["x-class-code"] = safeHeaderValue(state.accessCode);

      const response = await fetch("/api/chat", {
        method: "POST",
        headers,
        body: JSON.stringify({
          suspect: panel.suspect,
          message: text,
          history: priorHistory,
          evidenceState: panel.evidenceState || null,
          user: state.user,
          role: state.role,
          classId: state.classId,
          team: state.team
        })
      });

      const data = await response.json().catch(() => ({}));
      if (data.evidenceState) panel.evidenceState = data.evidenceState;
      if (data.credits) applyCredits(data.credits.remaining);
      if (data.usage) applyUsage(data.usage);

      if (response.status === 401 && data.requiresAccessCode) {
        clearAccessCode();
        setApiStatus("코드 필요", "bad");
        return "입장 코드가 맞지 않습니다. 다시 입력해 주세요.";
      }
      if (response.status === 402 && data.code === "NO_CREDITS") {
        applyCredits(0);
        return "코인이 0개입니다. 선생님이 코인을 준 뒤 코인 받기를 눌러주세요.";
      }
      if (response.status === 413 && data.code === "MESSAGE_TOKEN_LIMIT") {
        return data.error || "질문이 너무 깁니다. 조금 줄여서 다시 질문해 주세요.";
      }
      if (response.ok && data.reply) return data.reply;

      const errorText = data.error || "AI 응답을 받지 못했습니다.";
      setApiStatus("응답 실패", "bad");
      if (data.code === "LOW_QUALITY_REPLY") {
        return "AI가 질문에 맞는 답변을 만들지 못했습니다. 같은 증거를 조금 더 구체적으로 다시 질문해 주세요.";
      }
      return `AI 오류가 발생했습니다. 잠시 후 다시 시도해 주세요. (${errorText})`;
    } catch {
      setApiStatus("연결 실패", "bad");
      return "AI에 연결하지 못했습니다. 서버 상태를 확인한 뒤 다시 시도해 주세요.";
    }
  }

  function trimHistory(panel) {
    panel.history = panel.history.slice(-6);
  }

  async function submitQuestion(panel) {
    const text = panel.input.value.trim();
    if (!text || state.requesting || panel.waiting) return;
    const tokenCount = tokenEstimator.estimateTokens(text);
    if (tokenCount > chatTokenLimit) {
      setPanelState(panel, `토큰 초과 ${tokenCount}/${chatTokenLimit}`);
      updateTokenCounter(panel);
      return;
    }
    if (state.role === "student" && state.credits <= 0) {
      addMessage(panel, "bot", "코인이 0개입니다. 선생님이 코인을 준 뒤 코인 받기를 눌러주세요.");
      updateControls();
      return;
    }

    state.requesting = true;
    panel.waiting = true;
    setPanelState(panel, "응답 중");
    updateControls();
    addMessage(panel, "user", text);
    panel.input.value = "";
    updateTokenCounter(panel);

    const priorHistory = panel.history.slice();
    panel.history.push({ role: "user", content: text });
    trimHistory(panel);

    const pending = addMessage(panel, "bot", "...");
    try {
      const reply = await requestReply(panel, text, priorHistory);
      pending.bubble.textContent = reply;
      delete pending.row.dataset.pending;
      panel.history.push({ role: "assistant", content: reply });
      trimHistory(panel);
    } finally {
      panel.waiting = false;
      state.requesting = false;
      setPanelState(panel, "대기");
      updateControls();
      if (!panel.input.disabled) panel.input.focus();
    }
  }

  teamLabels.forEach((node) => {
    node.textContent = teamLabelFor(state.team);
  });
  setCreditText(state.team ? "받기 필요" : "학생 없음");
  setLogCount(0);
  loadEvidenceCards();
  renderEvidenceBoard();
  setupCaseNote();
  setupSimilaritySentenceForm();
  setupStudentEthicsQuiz();
  renderStudentLogs();

  panels.forEach((panel) => {
    ensureTokenCounter(panel);
    panel.input?.addEventListener("input", () => updateTokenCounter(panel));
    const greeting = greetings[panel.suspect] || greetings.kangWoojin;
    panel.history = [{ role: "assistant", content: greeting }];
    addMessage(panel, "bot", greeting);
    panel.form.addEventListener("submit", (event) => {
      event.preventDefault();
      submitQuestion(panel);
    });
  });
  updateControls();

  setupCardLightbox();
  setupGoldenPopup();
  setupEvidenceShop();

  evidenceBoard?.addEventListener("click", (event) => {
    const item = event.target.closest("[data-evidence-code-card]");
    if (!item) return;
    state.selectedEvidenceCode = item.dataset.evidenceCodeCard || "";
    renderEvidenceBoard();
  });

  evidenceInput?.addEventListener("input", () => {
    evidenceInput.value = cleanCode(evidenceInput.value);
  });
  evidenceForm?.addEventListener("submit", submitEvidenceCode);
  evidenceClaimOpen?.addEventListener("click", openEvidenceClaim);
  evidenceClaimArea?.addEventListener("click", (event) => {
    const close = event.target.closest("[data-evidence-claim-close]");
    if (close) {
      closeEvidenceClaim();
      setClaimStatus("");
      return;
    }
    const bonus = event.target.closest("[data-revisit-bonus]");
    if (bonus) {
      claimRevisitBonus(bonus.dataset.claimRoom || "");
      return;
    }
    const option = event.target.closest("[data-claim-index]");
    if (option) {
      pickEvidence(option.dataset.claimRoom || "", option.dataset.claimIndex || "");
    }
  });

  refreshButtons.forEach((button) => {
    button.addEventListener("click", refreshCredits);
  });

  refreshApiStatus();
})();
