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
    "승우": "1",
    "연수": "2",
    "은혁": "3",
    "영준": "4",
    "혜빈": "5",
    "윤지": "6",
    "가빈": "7",
    "채희": "8"
  };
  const safetyReplies = {
    sexualOrProfane: "그런 장난 섞인 말에는 대답 안 합니다. 사건이랑 상관없는 불쾌한 얘기는 하지 마세요.",
    aggressive: "때리거나 위협하자는 말은 하지 마세요. 그런 방식의 질문에는 답하지 않겠습니다.",
    technicalCrime: "그런 방법 같은 건 몰라요. 실제로 따라 할 수 있는 얘기는 하지 않겠습니다.",
    unsafe: "그런 질문에는 답하지 않겠습니다. 사건과 관련된 증거를 바탕으로 질문해 주세요."
  };
  const evidenceCatalog = {
    39275: { room: "방송실", roomId: "broadcast", index: 1, evidence: "방송실 장비 점검표", person: "서하린", image: "assets/evidence-crops/broadcast-1.png", position: "center" },
    26547: { room: "방송실", roomId: "broadcast", index: 2, evidence: "AI 자료 열람 기록", person: "서하린", image: "assets/evidence-crops/broadcast-2.png", position: "center" },
    65927: { room: "미술실", roomId: "art", index: 1, evidence: "기말고사 유의사항 포스터 파일", person: "서하린", image: "assets/evidence-crops/art-1.png", position: "center" },
    40018: { room: "미술실", roomId: "art", index: 2, evidence: "삭제된 AI 프롬프트 기록", person: "강우진", image: "assets/evidence-crops/art-2.png", position: "center" },
    91648: { room: "교무실", roomId: "office", index: 1, evidence: "CCTV에 찍힌 강우진의 태블릿", person: "강우진", image: "assets/evidence-crops/office-1.png", position: "center" },
    11582: { room: "교무실", roomId: "office", index: 2, evidence: "책상 위 기말고사 문제지", person: "강우진", image: "assets/evidence-crops/office-2.png", position: "center" },
    79610: { room: "과학실", roomId: "science", index: 1, evidence: "실험 보고서 제출 기록", person: "최다니엘", image: "assets/evidence-crops/science-1.png", position: "center" },
    61408: { room: "과학실", roomId: "science", index: 2, evidence: "과학실 분실물함 기록", person: "최다니엘", image: "assets/evidence-crops/science-2.png", position: "center" },
    87143: { room: "체육관", roomId: "gym", index: 1, evidence: "전교 1등 전 여자친구의 메시지", person: "강우진", image: "assets/evidence-crops/gym-1.png", position: "center" },
    13450: { room: "체육관", roomId: "gym", index: 2, evidence: "CCTV에 찍힌 최다니엘의 USB", person: "최다니엘", image: "assets/evidence-crops/gym-2.png", position: "center" }
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
    classId: sessionStorage.getItem("kit-class-section") || localStorage.getItem("kit-last-class-section") || "class-a",
    serverCredits: 0,
    redeeming: false,
    evidenceCards: [],
    selectedEvidenceCode: "",
    ethicsAnswers: {},
    ethicsServerSolved: [],
    ethicsCurrent: 1,
    ethicsUnlocked: false,
    ethicsSubmitting: false,
    claiming: false,
    submittingSimilarity: false,
    similaritySubmitCount: 0,
    similarityResubmitCost: 5
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
  const apiStatus = document.querySelector("[data-api-status]");
  const ethicsQuestions = Array.isArray(window.KitEthicsQuizQuestions) ? window.KitEthicsQuizQuestions : [];
  const ethicsOpenButton = document.querySelector("[data-student-ethics-open]");
  const ethicsForm = document.querySelector("[data-student-ethics-form]");
  const ethicsPasswordInput = document.querySelector("[data-student-ethics-password]");
  const ethicsNumberInput = document.querySelector("[data-student-ethics-number]");
  const ethicsSolvedSummary = document.querySelector("[data-student-ethics-solved]");
  const ethicsCard = document.querySelector("[data-student-ethics-card]");
  const ethicsModal = document.querySelector("[data-student-ethics-modal]");
  const ethicsResetButton = document.querySelector("[data-student-ethics-reset]");
  const ethicsAccessPassword = String.fromCharCode(107, 105, 116);
  const ethicsRewardCredits = 1;
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
  const similarityResubmitCost = 5;
  // 문장 틀: 빈칸을 이 순서로 조립한다. 고정 문구는 총 80자로, 빈칸 maxlength 합(410)과
  // 합쳐도 490자라 서버 500자 제한 안에 항상 들어온다.
  const similarityTemplate = (v) =>
    `범인은 ${v.culprit || ""}이다. 범인은 ${v.tool || ""}를 사용해 ${v.method || ""} 해서 시험 예상 문제가 유출되었다. 그 근거는 ${v.evidence || ""}이다. 범인에게 가장 부족했던 AI 윤리 역량은 ${v.competency || ""}이며, 그 이유는 ${v.reason || ""}`;

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
    return id ? `${id}번` : "학생";
  }

  function setCreditText(text) {
    creditCounts.forEach((node) => {
      node.textContent = text;
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

  function setSimilarityStatus(text, type = "") {
    if (!similarityStatus) return;
    similarityStatus.textContent = text;
    similarityStatus.classList.toggle("is-ok", type === "ok");
    similarityStatus.classList.toggle("is-bad", type === "bad");
  }

  function evidenceStorageKey() {
    return `kit-evidence-cards:${state.classId}:${state.team || state.user || "guest"}`;
  }


  function ethicsStorageKey() {
    return `kit-ethics-quiz:${state.classId}:${state.team || state.user || "guest"}`;
  }

  function ethicsUnlockStorageKey() {
    return `kit-ethics-quiz-unlocked:${state.classId}:${state.team || state.user || "guest"}`;
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

  // 윤리퀴즈 팝업 열기/닫기. 렌더는 그대로 ethicsCard에 그려지고, 이 두 함수가 모달 표시만 담당한다.
  function openEthicsModal() {
    if (ethicsModal) ethicsModal.hidden = false;
  }

  function closeEthicsModal() {
    if (ethicsModal) ethicsModal.hidden = true;
  }

  function closeStudentEthicsQuestion(nextNumber = "") {
    expireEthicsAccess();
    closeEthicsModal();
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
    const catalog = evidenceCatalog[clean] || Object.values(evidenceCatalog).find((item) => {
      return item.room === evidence.room && item.evidence === evidence.evidence;
    }) || {};

    return {
      code: clean,
      room: evidence.room || catalog.room || "교실",
      roomId: catalog.roomId || "",
      index: Number(catalog.index) || Number(evidence.index) || 1,
      evidence: catalog.evidence || evidence.evidence || "증거카드",
      person: evidence.person || catalog.person || "",
      image: catalog.image || "",
      position: catalog.position || "center",
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
            ...card,
            evidence: card.evidence
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
      .map((entry) => evidenceFromResponse(entry.code, {
        room: entry.room,
        evidence: entry.evidence,
        person: entry.person
      }));
  }

  function applySyncedEvidenceCards(cards = []) {
    state.evidenceCards = Array.isArray(cards) ? cards.slice(0, 10) : [];
    // 자동 선택하지 않는다. 좁은 오른쪽 칸에선 교실 사진(room-detail)이 펼쳐지면 세로가 넘치므로,
    // 로드 시엔 슬롯만 보여 스크롤 없이 들어가게 하고, 학생이 카드를 눌렀을 때만 사진을 편다.
    // (선택이 유효하면 유지, 무효가 되면 비운다.)
    if (state.selectedEvidenceCode && !state.evidenceCards.some((card) => card.code === state.selectedEvidenceCode)) {
      state.selectedEvidenceCode = "";
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
    // 선택된 카드가 없으면 안내를 영역 가운데에 두고(is-empty), 있으면 사진을 위에서부터 채운다.
    evidenceRoomDetail.classList.toggle("is-empty", !card);

    if (!card) {
      const empty = document.createElement("p");
      empty.className = "evidence-room-empty";
      empty.textContent = "카드를 누르면 교실 사진이 나와요.";
      evidenceRoomDetail.append(empty);
      return;
    }

    const roomCards = evidenceCardsForRoom(card);
    const hero = document.createElement("div");
    hero.className = "evidence-room-hero";

    const roomImage = document.createElement("img");
    roomImage.src = card.image;
    roomImage.alt = `${card.room} 교실 사진`;
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
      person.textContent = item.person ? `관련 인물: ${item.person}` : "관련 인물: 확인 필요";

      body.append(meta, name, person);
      row.append(thumb, body);
      list.append(row);
    });

    evidenceRoomDetail.append(hero, list);
  }

  // 증거는 총 10개. 처음부터 빈 슬롯 10개를 그려 두고, 획득한 것만 실제 카드로 채운다.
  // (초반에 오른쪽 칸이 비어 보이지 않게, 진행도도 한눈에 보이게 한다.)
  const evidenceSlotTotal = 10;

  function renderEvidenceBoard() {
    if (!evidenceBoard) return;
    evidenceBoard.textContent = "";

    const acquired = state.evidenceCards.slice(0, evidenceSlotTotal);
    if (evidenceBoardCount) evidenceBoardCount.textContent = `${acquired.length} / ${evidenceSlotTotal}`;

    if (!acquired.length) {
      state.selectedEvidenceCode = "";
    } else if (state.selectedEvidenceCode && !selectedEvidenceCard()) {
      state.selectedEvidenceCode = "";
    }

    // 1) 획득한 카드 → 실제 슬롯(클릭 가능)
    acquired.forEach((card) => {
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

      const label = document.createElement("span");
      label.className = "evidence-board-label";
      label.textContent = `${card.room} ${card.index}`;

      item.append(thumb, label);
      evidenceBoard.append(item);
    });

    // 2) 나머지는 빈 슬롯 — 힌트 없음, 클릭 불가(data-evidence-code-card 없음).
    for (let i = acquired.length; i < evidenceSlotTotal; i += 1) {
      const slot = document.createElement("div");
      slot.className = "evidence-slot";
      slot.setAttribute("aria-hidden", "true");
      evidenceBoard.append(slot);
    }

    renderEvidenceRoomDetail(acquired.length ? selectedEvidenceCard() : null);
  }

  // 이번 세션에 방금 획득한 증거키(roomId:index). 폴링 동기화 전이라도 즉시 "획득함"으로 표시.
  const sessionClaimedKeys = new Set();

  function isClaimOptionObtained(roomId, index) {
    if (sessionClaimedKeys.has(`${roomId}:${index}`)) return true;
    // 서버에 다시 묻지 않고 state.evidenceCards로만 대조 (폴링이 10초마다 갱신).
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
    state.claimGrant = null;
    state.claimOptions = [];
  }

  function renderClaimArea(grant, options) {
    if (!evidenceClaimArea || !grant) return;
    evidenceClaimArea.textContent = "";
    evidenceClaimArea.hidden = false;

    const head = document.createElement("div");
    head.className = "evidence-claim-head";
    const title = document.createElement("h3");
    title.textContent = `${grant.roomName || "교실"} 증거`;
    const close = document.createElement("button");
    close.type = "button";
    close.className = "evidence-claim-close";
    close.dataset.evidenceClaimClose = "1";
    close.textContent = "닫기";
    head.append(title, close);
    evidenceClaimArea.append(head);

    const list = Array.isArray(options) ? options : [];
    const available = list.filter((option) => !isClaimOptionObtained(grant.roomId, option.index));

    // 이미 두 증거를 모두 획득한 교실 (보드게임에서 같은 칸에 두 번 도착 등)에서는
    // 빈손으로 넘어가지 않도록 재방문 보너스 질문권을 받는 버튼을 보여준다.
    if (list.length && !available.length) {
      const done = document.createElement("p");
      done.className = "evidence-claim-empty";
      done.textContent = "이 교실의 증거는 모두 모았어요. 다시 질문권을 받아 가세요.";
      const bonusAmount = Number(state.claimRevisitBonus) || 0;
      const bonusButton = document.createElement("button");
      bonusButton.type = "button";
      bonusButton.className = "receive-credit-btn";
      bonusButton.dataset.revisitBonus = "1";
      bonusButton.dataset.claimRoom = grant.roomId;
      bonusButton.textContent = bonusAmount ? `질문권 ${bonusAmount}개 받기` : "질문권 받기";
      evidenceClaimArea.append(done, bonusButton);
      return;
    }

    const photo = document.createElement("img");
    photo.className = "evidence-claim-photo";
    photo.src = `assets/evidence-rooms/${grant.roomId}-masked.png`;
    photo.alt = `${grant.roomName || "교실"} 사진`;
    photo.decoding = "async";
    evidenceClaimArea.append(photo);

    // 한 승인에 증거는 하나만 선택할 수 있음을 명시 (선택하면 승인이 소거됨).
    const hint = document.createElement("p");
    hint.className = "evidence-claim-hint";
    hint.textContent = "증거 하나만 고를 수 있어요. 나머지 하나는 이 칸에 다시 도착했을 때 받을 수 있습니다.";
    evidenceClaimArea.append(hint);

    const optionsWrap = document.createElement("div");
    optionsWrap.className = "evidence-claim-options";
    list.forEach((option) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "evidence-claim-option";
      const obtained = isClaimOptionObtained(grant.roomId, option.index);
      button.disabled = obtained;
      // 증거는 이름만. 관련 인물은 카드를 받은 뒤에 알게 된다.
      button.textContent = obtained ? `${option.evidence} · 획득함` : option.evidence;
      if (!obtained) {
        button.dataset.claimIndex = String(option.index);
        button.dataset.claimRoom = grant.roomId;
      }
      optionsWrap.append(button);
    });
    evidenceClaimArea.append(optionsWrap);
  }

  async function openEvidenceClaim() {
    if (state.claiming) return;
    if (!state.team) {
      setClaimStatus("학생 팀 정보가 없습니다.", "bad");
      return;
    }
    state.claiming = true;
    if (evidenceClaimOpen) evidenceClaimOpen.disabled = true;
    setClaimStatus("승인을 확인하는 중...");

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
        setClaimStatus("아직 선생님이 승인하지 않았어요. 도착한 칸을 선생님께 말씀드리세요.", "bad");
        return;
      }

      state.claimGrant = data.grant;
      state.claimOptions = Array.isArray(data.options) ? data.options : [];
      // 재방문 보너스 액수는 서버(claim 응답)에서 받아 버튼 라벨에 쓴다.
      state.claimRevisitBonus = Number(data.revisitBonus) || 0;
      renderClaimArea(state.claimGrant, state.claimOptions);
      setClaimStatus(`${data.grant.roomName || "교실"} 조사가 승인되었습니다.`, "ok");
    } catch (error) {
      setClaimStatus(error.message || "승인을 확인하지 못했습니다.", "bad");
    } finally {
      state.claiming = false;
      if (evidenceClaimOpen) evidenceClaimOpen.disabled = false;
    }
  }

  async function pickEvidence(roomId, index) {
    if (state.claiming) return;
    if (!state.team) {
      setClaimStatus("학생 팀 정보가 없습니다.", "bad");
      return;
    }
    state.claiming = true;
    const optionButtons = evidenceClaimArea
      ? [...evidenceClaimArea.querySelectorAll(".evidence-claim-option")]
      : [];
    optionButtons.forEach((button) => { button.disabled = true; });
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
        // 실패 원인별 안내.
        if (data.code === "NO_GRANT") {
          closeEvidenceClaim();
          setClaimStatus("승인 시간이 지나서 닫혔어요. 선생님께 다시 말씀드리세요.", "bad");
        } else if (data.code === "ALREADY_REDEEMED") {
          sessionClaimedKeys.add(`${roomId}:${index}`);
          if (state.claimGrant) renderClaimArea(state.claimGrant, state.claimOptions);
          setClaimStatus("이미 가지고 있는 증거예요. 다른 증거를 골라 주세요.", "bad");
        } else {
          if (state.claimGrant) renderClaimArea(state.claimGrant, state.claimOptions);
          setClaimStatus(data.error || "증거를 받지 못했습니다.", "bad");
        }
        return;
      }

      // 받은 질문권 개수가 먼저 눈에 들어오도록 안내한다.
      sessionClaimedKeys.add(`${roomId}:${index}`);
      applyCredits(data.credits);
      const card = storeEvidenceCard(data.code, data.evidence);
      closeEvidenceClaim();
      setClaimStatus(`질문권 ${Number(data.added || evidenceRewardCredits)}개를 받았어요 · ${card.room} · ${card.evidence}`, "ok");
    } catch (error) {
      setClaimStatus(error.message || "증거를 받지 못했습니다.", "bad");
    } finally {
      state.claiming = false;
      optionButtons.forEach((button) => { button.disabled = false; });
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
        // 실패 원인별 안내.
        if (data.code === "NO_GRANT") {
          closeEvidenceClaim();
          setClaimStatus("승인 시간이 지나서 닫혔어요. 선생님께 다시 말씀드리세요.", "bad");
        } else if (data.code === "EVIDENCE_REMAINING") {
          if (state.claimGrant) renderClaimArea(state.claimGrant, state.claimOptions);
          setClaimStatus("아직 받을 수 있는 증거가 있습니다. 먼저 증거를 선택하세요.", "bad");
        } else if (data.code === "GRANT_ROOM_MISMATCH") {
          closeEvidenceClaim();
          setClaimStatus("승인된 방과 다릅니다. 선생님께 확인하세요.", "bad");
        } else {
          setClaimStatus(data.error || "보너스를 받지 못했습니다.", "bad");
        }
        return;
      }

      // 성공: 질문권 표시 갱신 후 영역을 닫고, 받은 개수를 안내한다.
      applyCredits(data.credits);
      closeEvidenceClaim();
      setClaimStatus(`질문권 ${Number(data.added || 0)}개를 받았어요 · 재방문 보너스`, "ok");
    } catch (error) {
      setClaimStatus(error.message || "보너스를 받지 못했습니다.", "bad");
    } finally {
      state.claiming = false;
      if (bonusButton) bonusButton.disabled = false;
    }
  }

  function similarityDraftKey() {
    return `kit-similarity-draft:${state.classId}:${state.team || state.user || "guest"}`;
  }

  function similarityBlankValues() {
    const values = {};
    similarityBlanks.forEach((el) => { values[el.dataset.similarityBlank] = String(el.value || "").trim(); });
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

  // 제출 기록이 아니라 작성 중인 초안만 팀별 localStorage에 저장한다(새로고침·재열람 대비).
  function saveSimilarityDraft() {
    try {
      localStorage.setItem(similarityDraftKey(), JSON.stringify(similarityBlankValues()));
    } catch {}
  }

  // 긴 칸(textarea)은 내용에 맞춰 높이를 늘려, 채운 내용이 잘리지 않고 다 보이게 한다.
  function autoGrowSimilarityBlank(el) {
    if (!el || el.tagName !== "TEXTAREA") return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }

  function autoGrowAllSimilarityBlanks() {
    similarityBlanks.forEach(autoGrowSimilarityBlank);
  }

  function loadSimilarityDraft() {
    let saved = {};
    try {
      saved = JSON.parse(localStorage.getItem(similarityDraftKey()) || "{}") || {};
    } catch {
      saved = {};
    }
    similarityBlanks.forEach((el) => {
      const key = el.dataset.similarityBlank;
      if (typeof saved[key] === "string") el.value = saved[key];
    });
    autoGrowAllSimilarityBlanks();
    updateSimilarityCounter();
  }

  function allSimilarityBlanksFilled() {
    return similarityBlanks.length > 0 && similarityBlanks.every((el) => String(el.value || "").trim().length > 0);
  }

  function openSimilarityModal() {
    if (!similarityModal) return;
    loadSimilarityDraft();
    hideSimilarityConfirm();
    setSimilarityStatus("");
    similarityModal.hidden = false;
    document.body.classList.add("lightbox-open");
    similarityBlanks[0]?.focus({ preventScroll: true });
    // 서버 기준으로 이미 보냈는지와 남은 질문권을 확인해 버튼 문구·잠금을 정한다.
    fetchSimilarityStatus();
    refreshCredits().then(updateSimilaritySubmitButton).catch(() => {});
  }

  function closeSimilarityModal() {
    if (!similarityModal) return;
    similarityModal.hidden = true;
    hideSimilarityConfirm();
    document.body.classList.remove("lightbox-open");
  }

  // 팝업을 열 때 1회 호출(폴링 아님). 팀의 제출 횟수를 받아 버튼 문구를 정한다.
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
    similaritySubmit.textContent = `다시 보내기 (질문권 ${cost}개)`;
    if (currentQuestionCredits() < cost) {
      similaritySubmit.disabled = true;
      setSimilarityStatus(`질문권이 ${cost}개 있어야 다시 보낼 수 있어요. 지금은 ${currentQuestionCredits()}개예요.`, "bad");
    } else {
      similaritySubmit.disabled = false;
    }
  }

  function showSimilarityConfirm(sentence) {
    if (!similarityConfirm) return;
    if (similarityConfirmSentence) similarityConfirmSentence.textContent = sentence;
    const isResubmit = state.similaritySubmitCount >= 1;
    if (similarityConfirmNotice) {
      if (isResubmit) {
        similarityConfirmNotice.textContent = `다시 보내면 질문권 ${state.similarityResubmitCost}개가 차감됩니다.`;
        similarityConfirmNotice.hidden = false;
      } else {
        similarityConfirmNotice.hidden = true;
      }
    }
    if (similarityConfirmSend) similarityConfirmSend.textContent = isResubmit ? `보내기 (질문권 ${state.similarityResubmitCost}개)` : "보내기";
    if (similarityForm) similarityForm.hidden = true;
    similarityConfirm.hidden = false;
    setSimilarityStatus("");
  }

  function hideSimilarityConfirm() {
    if (similarityConfirm) similarityConfirm.hidden = true;
    if (similarityForm) similarityForm.hidden = false;
  }

  // 폼 제출: 검증 후 확인 뷰로 넘어간다(여기서는 아직 보내지 않는다).
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
    if (state.similaritySubmitCount >= 1 && currentQuestionCredits() < state.similarityResubmitCost) {
      setSimilarityStatus(`질문권이 ${state.similarityResubmitCost}개 있어야 다시 보낼 수 있어요.`, "bad");
      return;
    }
    showSimilarityConfirm(sentence);
  }

  // 확인 뷰의 '보내기': 실제 전송. 연타 방지로 5개가 두 번 차감되지 않게 한다.
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
          setSimilarityStatus(`질문권이 ${data.needed || state.similarityResubmitCost}개 있어야 다시 보낼 수 있어요.`, "bad");
          return;
        }
        throw new Error(data.error || "전송 실패");
      }

      if (data.credits !== undefined) applyCredits(data.credits);
      state.similaritySubmitCount = Number(data.submitCount) || state.similaritySubmitCount + 1;
      hideSimilarityConfirm();
      updateSimilaritySubmitButton();
      const charged = Number(data.charged) || 0;
      // 초안은 남겨 둔다(다시 열어 수정·재전송 가능).
      setSimilarityStatus(charged ? `질문권 ${charged}개가 차감되고 전송됐어요.` : "선생님 화면으로 전송했어요.", "ok");
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
    similarityBlanks.forEach((el) => {
      el.addEventListener("input", () => {
        autoGrowSimilarityBlank(el);
        saveSimilarityDraft();
        updateSimilarityCounter();
      });
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

  function updateEvidenceControls() {
    const disabled = state.redeeming || !state.team;
    if (evidenceInput) evidenceInput.disabled = disabled;
    if (evidenceSubmit) {
      evidenceSubmit.disabled = disabled;
      evidenceSubmit.textContent = state.redeeming ? "확인 중" : "입력";
    }
  }

  function setRefreshBusy(isBusy) {
    refreshButtons.forEach((button) => {
      button.disabled = isBusy || state.requesting || state.redeeming;
      button.textContent = isBusy ? "받는 중..." : "질문권 받기";
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
        ? "질문권 받기를 눌러 확인하세요"
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

  function renderEthicsSolvedSummary() {
    if (!ethicsSolvedSummary) return;
    const attempted = ethicsAttemptedNumbers();
    ethicsSolvedSummary.textContent = attempted.length
      ? `푼 문제: ${attempted.map((number) => `${number}번`).join(", ")}`
      : "푼 문제: 없음";
  }

  function renderEthicsParagraphs(container, paragraphs = []) {
    paragraphs.forEach((text) => {
      container.append(createEthicsElement("p", "", text));
    });
  }

  function renderEthicsAccessGate(message = "윤리퀴즈 비밀번호를 입력한 뒤 시작하세요.") {
    if (!ethicsCard) return;
    ethicsCard.textContent = "";
    ethicsCard.hidden = false;

    const head = createEthicsElement("div", "student-ethics-head");
    const titleWrap = document.createElement("div");
    titleWrap.append(
      createEthicsElement("p", "student-ethics-kicker", "윤리퀴즈"),
      createEthicsElement("h2", "", "비밀번호 확인")
    );
    head.append(titleWrap, createEthicsElement("span", "student-ethics-meta", "잠김"));

    const status = createEthicsElement("p", "student-ethics-status is-bad", message);
    ethicsCard.append(head, status);
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
      ethicsCard.hidden = false;
      const status = createEthicsElement("p", "student-ethics-status is-bad", `문제 번호는 1~${maxEthicsQuestionNumber()} 사이로 입력하세요.`);
      ethicsCard.append(status);
      return;
    }

    state.ethicsCurrent = Number(question.number);
    if (ethicsNumberInput) ethicsNumberInput.value = String(question.number);
    ethicsCard.hidden = false;

    const answer = ethicsAnswerFor(question);
    const revealed = Boolean(answer.revealed);
    const correct = answer.value === question.answer;
    const locked = Boolean(answer.locked || answer.rewarded || (revealed && !correct));
    const alreadySolved = ethicsAttemptedNumbers().includes(Number(question.number));

    const head = createEthicsElement("div", "student-ethics-head");
    const titleWrap = document.createElement("div");
    titleWrap.append(
      createEthicsElement("p", "student-ethics-kicker", `${question.number}번 문제`),
      createEthicsElement("h2", "", question.topic)
    );
    head.append(titleWrap, createEthicsElement("span", "student-ethics-meta", alreadySolved ? "풀이 완료" : "미풀이"));

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
      renderEthicsParagraphs(section, question.background);
      copy.append(section);
    }

    const prompt = createEthicsElement("section", "student-ethics-section student-ethics-prompt");
    prompt.append(createEthicsElement("h3", "", question.options?.length === 2 ? "퀴즈 O/X" : "퀴즈"));
    prompt.append(createEthicsElement("p", "", question.prompt));
    copy.append(prompt);

    const options = createEthicsElement("section", "student-ethics-section");
    options.append(createEthicsElement("h3", "", "보기"));
    const optionList = createEthicsElement("div", "student-ethics-options");
    question.options.forEach((option) => {
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
      label.append(input, createEthicsElement("span", "", `${option.marker} ${option.text}`));
      optionList.append(label);
    });
    options.append(optionList);
    copy.append(options);

    const explanation = createEthicsElement("section", "student-ethics-section student-ethics-explanation");
    explanation.classList.toggle("is-visible", revealed);
    explanation.append(createEthicsElement("h3", "", "해설"));
    const correctOption = question.options.find((option) => option.id === question.answer);
    explanation.append(createEthicsElement("p", "", `정답: ${correctOption ? `${correctOption.marker} ${correctOption.text}` : question.answer}`));
    renderEthicsParagraphs(explanation, question.explanation);
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
        status.textContent = `정답입니다. 질문권 ${ethicsRewardCredits}개가 바로 반영되었습니다.`;
      } else {
        status.textContent = "정답입니다.";
      }
      status.classList.add("is-ok");
    } else if (revealed) {
      status.textContent = nextNumber ? "오답입니다. 이 문제는 다시 풀 수 없습니다." : "오답입니다. 모든 윤리퀴즈를 완료했습니다.";
      status.classList.add("is-bad");
    }
    submit.addEventListener("click", () => submitStudentEthicsAnswer(question));
    actions.append(submit, status);
    if (locked) {
      const next = createEthicsElement("button", "student-ethics-next", nextNumber && nextNumber !== Number(question.number) ? "다음 문제" : "닫기");
      next.type = "button";
      next.addEventListener("click", () => {
        closeStudentEthicsQuestion(nextNumber && nextNumber !== Number(question.number) ? nextNumber : "");
      });
      actions.append(next);
    }
    copy.append(actions);

    const layout = createEthicsElement("div", "student-ethics-question-layout");
    layout.append(source, copy);
    ethicsCard.append(head, layout);
    if (locked && !state.ethicsSubmitting) expireEthicsAccess();
    renderEthicsSolvedSummary();
  }

  async function submitStudentEthicsAnswer(question) {
    const answer = ethicsAnswerFor(question);
    const status = ethicsCard?.querySelector("[data-student-ethics-status]");
    if (answer.locked || answer.rewarded) {
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
      state.ethicsSubmitting = true;
      setEthicsAnswer(question, { revealed: true, rewarded: false, locked: true });
      renderStudentEthicsQuestion(question.number);
      state.ethicsSubmitting = false;
      expireEthicsAccess();
      updateEthicsNumberInputRange();
      return;
    }

    if (ethicsAnswerFor(question).rewarded) {
      setEthicsAnswer(question, { revealed: true });
      renderStudentEthicsQuestion(question.number);
      return;
    }

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
      updateEthicsNumberInputRange();
      renderEthicsSolvedSummary();
      if (ethicsCard && !ethicsCard.hidden) {
        renderStudentEthicsQuestion(state.ethicsCurrent);
      }
    });

    // 타일 클릭: 잠겨 있으면 비밀번호칸(메뉴)에 포커스만 준다. 풀려 있으면 모달을 연다.
    ethicsOpenButton?.addEventListener("click", () => {
      if (!state.ethicsUnlocked) {
        ethicsPasswordInput?.focus({ preventScroll: true });
        return;
      }
      renderStudentEthicsQuestion(selectedEthicsNumber());
      openEthicsModal();
    });

    // 시작 버튼: 비밀번호가 맞으면 모달을 연다. 틀리면 requireEthicsAccess가 메뉴 비밀번호칸을
    // 비우고 포커스하므로(모달은 열지 않음) 바로 다시 입력할 수 있다.
    ethicsForm?.addEventListener("submit", (event) => {
      event.preventDefault();
      if (!requireEthicsAccess()) return;
      renderStudentEthicsQuestion(selectedEthicsNumber());
      openEthicsModal();
    });

    // 팝업 닫기: ✕ 버튼과 ESC. (닫으면 접근이 만료돼 다음엔 비밀번호를 다시 입력한다 — 기존 동작)
    document.querySelector("[data-student-ethics-close]")?.addEventListener("click", () => {
      closeStudentEthicsQuestion();
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && ethicsModal && !ethicsModal.hidden) {
        closeStudentEthicsQuestion();
      }
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
      applyCredits(data.credits);
      setLogCount(data.count || 0);
      state.logs = Array.isArray(data.logs) ? data.logs : [];
      renderStudentLogs();
      await syncEvidenceCardsWithServer();
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
      setEvidenceMessage("증거 코드를 입력하세요.", "bad");
      return;
    }

    state.redeeming = true;
    setEvidenceMessage("증거 코드 확인 중...", "");
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
          const personText = card.person ? ` · 관련 인물: ${card.person}` : "";
          setEvidenceMessage(`이미 사용한 코드입니다. ${card.room} 증거 카드 ${card.index}${personText}`, "bad");
          if (evidenceInput) evidenceInput.value = "";
          return;
        }
        const message = data.code === "ALREADY_REDEEMED"
          ? "이미 사용한 증거 코드입니다."
          : data.code === "INVALID_EVIDENCE_CODE"
            ? "증거 코드가 맞지 않습니다."
            : data.error || "증거 코드를 확인하지 못했습니다.";
        throw new Error(message);
      }

      applyCredits(data.credits);
      const card = storeEvidenceCard(code, data.evidence);
      const personText = card.person ? ` · 관련 인물: ${card.person}` : "";
      setEvidenceMessage(`${teamLabelFor(state.team)} 질문권 ${Number(data.added || evidenceRewardCredits)}개 추가 · ${card.room} 증거 카드 ${card.index}${personText}`, "ok");
      if (evidenceInput) evidenceInput.value = "";
    } catch (error) {
      setEvidenceMessage(error.message || "증거 코드를 확인하지 못했습니다.", "bad");
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
        return "질문권이 0개입니다. 선생님이 질문권을 준 뒤 질문권 받기를 눌러주세요.";
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
      addMessage(panel, "bot", "질문권이 0개입니다. 선생님이 질문권을 준 뒤 질문권 받기를 눌러주세요.");
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
    node.textContent = teamIdFor(state.team) || "학생";
  });
  // 증거 보관함(오른쪽) 높이를 왼쪽 심문 영역에 정확히 맞춘다. 교실 사진이 커도 보관함은
  // 늘어나지 않고 안쪽(room-detail)에서만 스크롤된다. 왼쪽이 길어지거나 짧아지면 따라간다.
  // (폴링이 아니라 크기 변화에만 반응하는 ResizeObserver.)
  (function syncVaultHeightToContent() {
    const contentEl = document.querySelector(".student-content");
    const vaultEl = document.querySelector(".student-main > .evidence-vault-card");
    if (!contentEl || !vaultEl) return;
    const apply = () => {
      // 2단(오른쪽에 340px 칸)일 때만 맞춘다. 좁은 화면에서 세로로 쌓이면 해제.
      const stacked = getComputedStyle(vaultEl).position === "static";
      vaultEl.style.maxHeight = stacked ? "" : `${Math.round(contentEl.getBoundingClientRect().height)}px`;
    };
    if (typeof ResizeObserver === "function") {
      new ResizeObserver(apply).observe(contentEl);
    }
    window.addEventListener("resize", apply);
    // 초기 레이아웃(이미지 로드 등)이 안정된 뒤 다시 맞춘다.
    apply();
    requestAnimationFrame(apply);
    window.setTimeout(apply, 400);
    window.setTimeout(apply, 1200);
  })();

  setCreditText(state.team ? "받기 필요" : "학생 없음");
  setLogCount(0);
  loadEvidenceCards();
  renderEvidenceBoard();
  syncEvidenceCardsWithServer();
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

  // 선택 영역은 다시 그려질 때마다 버튼이 새로 생기므로 이벤트 위임으로 처리.
  evidenceClaimArea?.addEventListener("click", (event) => {
    if (event.target.closest("[data-evidence-claim-close]")) {
      closeEvidenceClaim();
      setClaimStatus("");
      return;
    }
    const bonus = event.target.closest("[data-revisit-bonus]");
    if (bonus) {
      claimRevisitBonus(bonus.dataset.claimRoom);
      return;
    }
    const option = event.target.closest("[data-claim-index]");
    if (!option) return;
    pickEvidence(option.dataset.claimRoom, Number(option.dataset.claimIndex));
  });

  refreshButtons.forEach((button) => {
    button.addEventListener("click", refreshCredits);
  });

  refreshApiStatus();
  window.setInterval(syncEvidenceCardsWithServer, 10000);
})();
