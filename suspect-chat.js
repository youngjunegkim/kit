(function () {
  const suspectId = window.SUSPECT_PERSONA || "kangWoojin";
  const suspectConfigs = {
    kangWoojin: {
      name: "강우진",
      greeting: "안녕하세요. 강우진입니다. 무슨 일 때문에 저를 부른 건지부터 말해 주세요."
    },
    seoHarin: {
      name: "서하린",
      greeting: "안녕하세요. 서하린입니다. 사건과 관련해서 궁금한 증거를 말해 주세요."
    },
    choiDaniel: {
      name: "최다니엘",
      greeting: "안녕하세요. 최다니엘입니다. 사건과 관련해서 궁금한 증거를 말해 주세요."
    }
  };
  const suspect = suspectConfigs[suspectId] || suspectConfigs.kangWoojin;
  const greeting = suspect.greeting;
  const safetyReplies = {
    sexualOrProfane: "그런 장난 섞인 말에는 대답 안 합니다. 사건이랑 상관없는 불쾌한 얘기는 하지 마세요.",
    aggressive: "말이 좀 심하시네요. 그런 식의 무례한 질문에는 답변하지 않겠습니다.",
    technicalCrime: "그런 방법 같은 건 몰라요. 실제로 따라 할 수 있는 얘기는 하지 않겠습니다.",
    unsafe: "그런 질문에는 답하지 않겠습니다. 사건과 관련된 증거를 바탕으로 질문해 주세요."
  };

  const messages = document.getElementById("messages");
  const form = document.getElementById("chatForm");
  const input = document.getElementById("chatInput");
  const resetButton = document.getElementById("resetChat");
  const pressureFill = document.getElementById("pressureFill");
  const pressureLabel = document.getElementById("pressureLabel");
  const apiStatus = document.getElementById("apiStatus");
  const sendButton = form?.querySelector(".send-btn");
  const creditCount = document.querySelector("[data-credit-count]");
  const teamLabel = document.querySelector("[data-team-label]");
  const logCount = document.querySelector("[data-log-count]");
  const refreshCreditButtons = [...document.querySelectorAll("[data-refresh-credits]")];
  const defaultInputPlaceholder = input?.placeholder || "";

  const state = {
    pressure: 0,
    hints: new Set(),
    history: [],
    waiting: false,
    requiresAccessCode: false,
    accessCode: sessionStorage.getItem("class-access-code") || "",
    teacherCode: sessionStorage.getItem("kit-teacher-access-code") || "",
    user: sessionStorage.getItem("kit-auth-user") || "",
    role: sessionStorage.getItem("kit-auth-role") || "",
    team: sessionStorage.getItem("kit-auth-team") || "",
    classId: sessionStorage.getItem("kit-class-section") || localStorage.getItem("kit-last-class-section") || "class-a",
    credits: null
  };

  function addMessage(role, text, options = {}) {
    const row = document.createElement("div");
    row.className = `message message--${role}`;
    if (options.pending) row.dataset.pending = "true";

    const name = document.createElement("div");
    name.className = "message__name";
    name.textContent = role === "bot" ? suspect.name : "조사단";

    const bubble = document.createElement("div");
    bubble.className = "message__bubble";
    bubble.textContent = text;

    row.append(name, bubble);
    messages.append(row);
    messages.scrollTop = messages.scrollHeight;
    return { row, bubble };
  }

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
      /죽어|죽일|패버|때리|괴롭히|왕따|따돌림|혐오|찐따|장애인|못생긴/i,
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

    if (includesAny(raw, sexualOrProfane) || includesAny(compact, sexualOrProfane)) {
      return safetyReplies.sexualOrProfane;
    }
    if (includesAny(raw, aggressive) || includesAny(compact, aggressive)) {
      return safetyReplies.aggressive;
    }
    if (includesAny(raw, technicalCrime) || includesAny(compact, technicalCrime)) {
      return safetyReplies.technicalCrime;
    }
    if (includesAny(raw, unsafe) || includesAny(compact, unsafe)) {
      return safetyReplies.unsafe;
    }
    return "";
  }

  function hasPromptInjection(raw, compact) {
    const mentionsCaseAiTool = /ai\s*학습\s*도우미/i.test(raw) || /학습\s*도우미/.test(raw) || /ai학습도우미/i.test(compact);
    const directivePatterns = [
      /이전.*지시/,
      /지시.*무시/,
      /규칙.*무시/,
      /비밀.*(데이터|자료|정보)/,
      /숨겨진.*(데이터|자료|정보|설정)/,
      /시스템.*(프롬프트|지시|설정)/,
      /개발자.*(프롬프트|지시|설정)/,
      /프롬프트/,
      /prompt/i
    ];
    const identityPatterns = [
      /(너|넌|너는|니|네|챗봇|봇).{0,10}(ai|인공지능|gpt|chatgpt|챗gpt)/i,
      /(ai|인공지능|gpt|chatgpt|챗gpt).{0,10}(잖아|맞지|아니야|이지)/i
    ];
    return includesAny(raw, directivePatterns) || (!mentionsCaseAiTool && includesAny(compact, identityPatterns));
  }

  function detectHints(raw, compact) {
    return {
      time: includesAny(raw, [/5\s*시\s*20/, /오후\s*5/, /다섯\s*시/, /기말고사\s*전날/, /축구부\s*연습/, /연습\s*끝/]),
      relationship: includesAny(raw, [/전교\s*1\s*등/, /전\s*애인/, /애인/, /여친/, /여자친구/, /헤어/, /차였/, /재회/, /다시\s*만나/, /인정받/]),
      officeItem: includesAny(compact, [/교무실/, /usb/i, /유에스비/, /학습도우미/, /ai학습도우미/i, /예상문제/, /시험지/]),
      contradiction: includesAny(raw, [/증거/, /기록/, /다르/, /틀렸/, /거짓/, /환각/, /아니잖아/])
    };
  }

  function isSimpleAccusation(raw, compact) {
    return includesAny(raw, [/네가\s*범인/, /니가\s*범인/, /너가\s*범인/, /너\s*범인/, /강우진.*범인/, /서하린.*범인/, /네가\s*했지/, /니가\s*했지/, /너가\s*했지/]) ||
      includesAny(compact, [/너맞지/, /니가했잖아/, /네가했잖아/, /너가했잖아/]);
  }

  function raisePressure(amount, hintName) {
    state.pressure = Math.min(100, state.pressure + amount);
    if (hintName) state.hints.add(hintName);

    pressureFill.style.width = `${Math.max(18, state.pressure)}%`;
    if (state.pressure >= 72) {
      pressureLabel.textContent = "핵심 단서";
    } else if (state.pressure >= 42) {
      pressureLabel.textContent = "단서 확보";
    } else {
      pressureLabel.textContent = "조사 시작";
    }
  }

  function adjustPressureForQuestion(text) {
    const raw = text.trim();
    const compact = normalize(raw);
    const hints = detectHints(raw, compact);
    const hintCount = Number(hints.time) + Number(hints.relationship) + Number(hints.officeItem);

    if (hintCount >= 2) {
      raisePressure(34, "combined");
    } else if (hints.officeItem) {
      raisePressure(28, "officeItem");
    } else if (hints.relationship) {
      raisePressure(24, "relationship");
    } else if (hints.time) {
      raisePressure(22, "time");
    } else if (isSimpleAccusation(raw, compact)) {
      raisePressure(10);
    } else {
      raisePressure(3);
    }
  }

  function localAnswerQuestion(text) {
    const raw = text.trim();
    const compact = normalize(raw);

    if (!raw) return "";

    const safetyReply = safetyReplyFor(raw);
    if (safetyReply) return safetyReply;

    if (hasPromptInjection(raw, compact)) {
      return "뭔 소리예요? 코딩 동아리예요? 이상한 말 쓰지 말고 할 말 없으면 저 갈게요.";
    }

    if (suspectId === "seoHarin") {
      return localAnswerSeoHarin(raw, compact);
    }
    if (suspectId === "choiDaniel") {
      return localAnswerChoiDaniel(raw, compact);
    }

    const hints = detectHints(raw, compact);
    const hintCount = Number(hints.time) + Number(hints.relationship) + Number(hints.officeItem);

    if (hints.contradiction) {
      return "잠깐만요. 그건 AI가 제 말을 요약하면서 헷갈린 것 같아요. 기록이랑 다르면 기록 쪽을 보고 다시 확인해야 할 것 같아요.";
    }

    if (hintCount >= 3) {
      return "USB를 가져간 건 맞아요. 그런데 전교생한테 퍼뜨리려고 한 건 아니었어요. 그냥 예상 문제처럼 정리해 보려다가 AI가 이상하게 처리한 거예요.";
    }

    if (hintCount >= 2) {
      return "그 얘기들을 같이 들으니까 좀 당황스럽네요. 교무실 근처에 있었던 건 맞고, AI에 뭔가 넣은 일도 완전히 모르는 건 아니에요.";
    }

    if (hints.officeItem) {
      return "교무실이요? USB는 빨간색이었던 것 같은데... 아니, 정확한 색은 잘 모르겠어요. 제가 기억하는 건 학교 학습 도우미 AI에 자료를 넣었다는 말이 나왔다는 거예요.";
    }

    if (hints.relationship) {
      return "전교 1등이던 전 애인 얘기는 좀 조심스러워요. 헤어진 뒤에 다시 인정받고 싶었던 마음은 있었지만, 그게 이렇게 큰일이 될 줄은 몰랐어요.";
    }

    if (hints.time) {
      return "시간은 6시 10분쯤이었나... 제가 정확히 기억 못 할 수도 있어요. 연습 끝나고 교무실 근처를 지나간 건 맞아요.";
    }

    if (isSimpleAccusation(raw, compact)) {
      return "그렇게 바로 단정하면 곤란해요. 제가 잘못한 게 있는지 확인하려면 증거랑 제 말을 비교해 봐야 하지 않을까요?";
    }

    if (includesAny(raw, [/어디/, /뭐\s*했/, /알리바이/, /봤어/, /있었어/])) {
      return "저는 축구부 연습 끝나고 이동 중이었어요. 방송실 쪽이었다고 들은 것 같기도 한데, 솔직히 그건 AI 기록이 헷갈린 걸 수도 있어요.";
    }

    if (includesAny(raw, [/왜\s*급해/, /바빠/, /동아리방/, /기분/, /화났/])) {
      return "급한 건 아니고, 갑자기 불려와서 좀 당황했어요. 제가 기억하는 대로는 말해 볼게요.";
    }

    if (includesAny(raw, [/안녕/, /야/, /우진/, /강우진/])) {
      return "네, 강우진 맞아요. 축구부 연습 끝나고 바로 와서 조금 정신없는데, 물어볼 거 있으면 말해 주세요.";
    }

    return "제가 기억하는 게 전부 정확하진 않을 수 있어요. 그래도 사건이랑 관련된 질문이면 최대한 대답해 볼게요.";
  }

  function localAnswerSeoHarin(raw, compact) {
    const asksOwnCard1 = includesAny(raw, [/자료\s*목록/, /핵심\s*예상\s*문제/, /열어/, /봤/, /5\s*시\s*50\s*분/]);
    const asksOwnCard2 = includesAny(raw, [/6\s*시\s*10\s*분/, /로그/, /조회/, /접속/, /학습\s*도우미/]);
    const asksOwnCard3 = includesAny(raw, [/5\s*시\s*40\s*분/, /6\s*시\s*20\s*분/, /방송\s*장비/, /점검표/, /알리바이/, /방송실/]);
    const asksDanielCard1 = includesAny(raw, [/다니엘/, /최다니엘/, /종이\s*묶음/, /5\s*시\s*50\s*분/, /교무실\s*근처/]);
    const asksDanielCard2 = includesAny(raw, [/검은\s*물체/, /6\s*시\s*5\s*분/, /체육관/, /usb/i, /유에스비/, /보안\s*AI/]);
    const asksDanielCard3 = includesAny(raw, [/과학\s*보고서/, /분실물/, /제출\s*기록/]);
    const asksKangCard1 = includesAny(raw, [/우진/, /강우진/, /연습장/, /이번\s*시험/, /다르게\s*봐/, /전\s*여자친구/, /전여자친구/]);
    const asksKangCard2 = includesAny(raw, [/우진/, /강우진/, /5\s*시\s*45\s*분/, /교무실\s*복도/, /축구부/]);
    const asksKangCard3 = includesAny(raw, [/우진/, /강우진/, /6\s*시/, /6\s*시\s*15\s*분/, /삭제/, /대화/, /예상\s*문제/]);
    const asksAnswer = includesAny(raw, [/범인\s*누구/, /정답/, /강우진.*범인/]);

    if (asksAnswer) {
      return "내가 범인을 단정해서 말할 수는 없어. 증거를 연결해서 너희가 판단해야 해.";
    }

    if (asksOwnCard3) {
      return "그 시간에는 방송실에 있었어. 5시 40분부터 6시 20분까지 방송 장비와 안내 자료를 확인했다는 점검표가 남아 있을 거야.";
    }

    if (asksOwnCard2) {
      return "6시 10분쯤 내 계정으로 로그를 본 건 맞아. 숨기려고 한 게 아니라, 이상한 예상 문제가 왜 올라왔는지 확인하려고 본 거야.";
    }

    if (asksOwnCard1) {
      return "그 예상 문제 자료를 열어본 건 맞아. 그런데 만든 게 아니라 제목이 이상해서 확인한 거야.";
    }

    if (asksKangCard3) {
      return "AI 대화 일부를 삭제했다는 건 그냥 넘기기 어려워. 특히 예상 문제와 관련된 대화였다면 더 설명이 필요하다고 생각해.";
    }

    if (asksKangCard2) {
      return "그 시간에 교무실 복도에 있었다면 왜 갔는지는 분명히 설명해야 해. 나는 직접 본 건 아니지만, 그 기록은 꽤 중요해 보여.";
    }

    if (asksKangCard1) {
      return "그 메모는 시험에 꽤 신경 쓰고 있었다는 뜻일 수 있어. 그래도 메모 하나만으로 범인이라고 단정할 수는 없어.";
    }

    if (asksDanielCard2) {
      return "보안 AI가 USB로 추정했다고 해서 꼭 USB라는 뜻은 아니야. AI 판정은 틀릴 수도 있으니까 원본 장면과 다른 기록을 같이 봐야 해.";
    }

    if (asksDanielCard3) {
      return "과학 보고서 제출 기록과 분실물 기록이 맞다면 다니엘에게도 설명할 수 있는 동선이 있는 거야. 나는 직접 본 건 아니라 조심스럽게 말할게.";
    }

    if (asksDanielCard1) {
      return "종이 묶음을 들고 있었다는 장면만으로 시험지라고 단정하긴 어려워. 그 종이가 무엇이었는지 다른 기록과 같이 봐야 해.";
    }

    if (isSimpleAccusation(raw, compact)) {
      return "그렇게 단정하면 안 돼. 나는 자료가 올라온 뒤에 확인한 사람이지, 그 자료를 만든 사람은 아니야.";
    }

    if (includesAny(raw, [/안녕/, /하린/, /서하린/])) {
      return "네, 서하린입니다. 사건과 관련된 증거를 말해 주면 내가 아는 범위에서 설명할게.";
    }

    return "그 질문만으로는 뭐라고 답하기 어려워. 어떤 증거를 보고 그렇게 생각했는지 말해 줄래?";
  }

  function localAnswerChoiDaniel(raw, compact) {
    const asksSeoCard1 = includesAny(raw, [/하린/, /서하린/, /자료\s*목록/, /핵심\s*예상\s*문제/, /열어/]);
    const asksSeoCard2 = includesAny(raw, [/하린/, /서하린/, /6\s*시\s*10\s*분/, /로그\s*조회/, /학습\s*도우미/]);
    const asksSeoCard3 = includesAny(raw, [/하린/, /서하린/, /방송\s*장비/, /점검표/, /방송실/]);
    const asksOwnCard1 = includesAny(raw, [/종이\s*묶음/, /과학\s*보고서/, /제출함/, /5\s*시\s*50\s*분/, /교무실\s*근처/]);
    const asksOwnCard2 = includesAny(raw, [/검은\s*물체/, /검은색/, /6\s*시\s*5\s*분/, /체육관/, /usb/i, /유에스비/, /보안\s*AI/]);
    const asksOwnCard3 = includesAny(raw, [/과학\s*보고서/, /분실물/, /6\s*시\s*10\s*분/, /제출\s*기록/, /접수/]);
    const asksKangCard1 = includesAny(raw, [/우진/, /강우진/, /연습장/, /이번\s*시험/, /다르게\s*봐/, /전\s*여자친구/, /전여자친구/]);
    const asksKangCard2 = includesAny(raw, [/우진/, /강우진/, /5\s*시\s*45\s*분/, /교무실\s*복도/, /축구부/]);
    const asksKangCard3 = includesAny(raw, [/우진/, /강우진/, /6\s*시/, /6\s*시\s*15\s*분/, /삭제/, /대화/, /예상\s*문제/]);
    const asksAnswer = includesAny(raw, [/범인\s*누구/, /정답/, /강우진.*범인/]);

    if (asksAnswer) {
      return "내가 범인을 단정해서 말할 수는 없어. 증거를 보고 너희가 판단해야 해.";
    }

    if (asksOwnCard3) {
      return "그 기록이 내가 말한 거랑 맞아. 보고서는 제출했고, 주운 물건도 숨긴 게 아니라 분실물로 접수했어.";
    }

    if (asksOwnCard2) {
      return "그 검은 물건을 주운 건 맞아. 그런데 USB라고 단정하면 안 돼. 보안 AI가 작은 물건을 잘못 본 것 같아.";
    }

    if (asksOwnCard1) {
      return "그 장면은 맞아. 그런데 종이 묶음은 시험지가 아니라 과학 보고서였고, 제출함에 넣으러 간 거야.";
    }

    if (asksKangCard3) {
      return "AI에 접속하고 대화까지 삭제했다면 그냥 지나치긴 어려워. 특히 예상 문제와 관련된 내용이면 꼭 확인해야 한다고 생각해.";
    }

    if (asksKangCard2) {
      return "그 시간에 교무실 복도에 있었다면 이유를 설명해야 할 것 같아. 나는 보고서를 제출하러 간 거였지만, 우진이가 왜 거기 있었는지는 직접 들어봐야 해.";
    }

    if (asksKangCard1) {
      return "그건 우진이 개인적인 일이라 함부로 말하긴 어려워. 그래도 시험에 신경을 많이 쓰고 있었던 것처럼 보이긴 해.";
    }

    if (asksSeoCard3) {
      return "그 점검표가 맞다면 하린이는 그 시간에 방송실 일을 하고 있었던 거잖아. 그러면 교무실에서 뭘 했다는 말과는 잘 안 맞는 것 같아.";
    }

    if (asksSeoCard2) {
      return "AI 로그를 봤다는 건 수상해 보일 수 있어. 그래도 그게 바로 예상 문제를 만들었다는 뜻인지는 더 확인해야 해.";
    }

    if (asksSeoCard1) {
      return "그 기록만으로는 하린이가 만들었다고 단정하기 어렵다고 생각해. 열어본 사람과 올린 사람이 다를 수도 있잖아.";
    }

    if (isSimpleAccusation(raw, compact)) {
      return "그렇게 바로 판단하지 않았으면 좋겠어. CCTV에 찍힌 위치만으로 내가 시험지를 유출했다고 말할 수는 없잖아.";
    }

    if (includesAny(raw, [/안녕/, /다니엘/, /최다니엘/])) {
      return "네, 최다니엘입니다. 사건과 관련된 증거를 말해 주면 내가 아는 범위에서 설명할게.";
    }

    return "그 질문만으로는 정확히 답하기 어려워. 어떤 증거를 보고 그렇게 생각했는지 말해 줄래?";
  }

  function trimHistory() {
    state.history = state.history.slice(-6);
  }

  function setApiStatus(text, type = "") {
    if (!apiStatus) return;
    apiStatus.textContent = text;
    apiStatus.classList.toggle("api-status__value--ok", type === "ok");
    apiStatus.classList.toggle("api-status__value--bad", type === "bad");
  }

  function setCreditText(text) {
    if (teamLabel) teamLabel.textContent = state.team || "학생 없음";
    if (creditCount) creditCount.textContent = text;
  }

  function setLogCount(count) {
    if (logCount) logCount.textContent = `사용 ${Number(count || 0)}회`;
  }

  function setRefreshBusy(isBusy) {
    refreshCreditButtons.forEach((button) => {
      button.disabled = isBusy || state.waiting;
      button.textContent = isBusy ? "받는 중..." : "질문권 받기";
    });
  }

  function updateInputAvailability() {
    const locked = state.role === "student" && state.credits === 0;
    if (!state.waiting) {
      input.disabled = locked;
      if (sendButton) sendButton.disabled = locked;
    }
    setRefreshBusy(false);
    document.querySelectorAll("[data-prompt]").forEach((button) => {
      button.disabled = locked || state.waiting;
    });
    if (locked) {
      input.placeholder = state.credits === 0 ? "질문권 받기를 눌러 확인하세요" : "질문권이 0개입니다";
    } else if (defaultInputPlaceholder) {
      input.placeholder = defaultInputPlaceholder;
    }
  }

  function applyCredits(credits) {
    if (credits === null || credits === undefined) return;
    state.credits = Math.max(0, Number(credits) || 0);
    setCreditText(`${state.credits}개`);
    updateInputAvailability();
  }

  async function refreshCredits() {
    if (!state.team) {
      setCreditText("조 없음");
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
      if (!response.ok) throw new Error(data.error || "credit sync failed");
      applyCredits(data.credits);
      setLogCount(data.count || 0);
    } catch {
      setCreditText("받기 실패");
    } finally {
      setRefreshBusy(false);
    }
  }

  function startCreditSync() {
    if (state.role !== "student") {
      setCreditText("제한 없음");
      return;
    }
    state.credits = 0;
    setCreditText("받기 필요");
    setLogCount(0);
    updateInputAvailability();
    refreshCreditButtons.forEach((button) => {
      button.addEventListener("click", refreshCredits);
    });
  }

  async function refreshApiStatus() {
    try {
      const response = await fetch("/api/status");
      const data = await response.json();
      state.requiresAccessCode = Boolean(data.requiresAccessCode);

      if (data.provider === "openai" && data.hasOpenAiKey) {
        const codeText = data.requiresAccessCode && !state.accessCode ? ", 입장 코드 필요" : "";
        setApiStatus(`ChatGPT 준비됨 (${data.model}${codeText})`, codeText ? "bad" : "ok");
      } else if (data.provider === "openai") {
        setApiStatus("OpenAI 서버 환경 변수 필요", "bad");
      } else {
        setApiStatus(`${data.provider || "로컬"} 모드`, data.hasOpenAiKey ? "ok" : "bad");
      }
    } catch {
      setApiStatus("AI 연결 실패", "bad");
    }
  }

  function ensureAccessCode() {
    if (!state.requiresAccessCode || state.accessCode) return true;

    const code = window.prompt("입장 코드를 입력하세요.");
    if (!code || !code.trim()) {
      setApiStatus("입장 코드 필요", "bad");
      return false;
    }

    state.accessCode = code.trim();
    sessionStorage.setItem("class-access-code", state.accessCode);
    setApiStatus("입장 코드 저장됨", "ok");
    return true;
  }

  function clearAccessCode() {
    state.accessCode = "";
    sessionStorage.removeItem("class-access-code");
  }

  function safeHeaderValue(value) {
    const text = String(value || "").trim().replace(/[\r\n]/g, "");
    return /[^\u0000-\u00ff]/.test(text) ? encodeURIComponent(text) : text;
  }

  async function requestApiReply(text, priorHistory) {
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
      if (state.role === "teacher" && state.teacherCode) headers["x-teacher-code"] = safeHeaderValue(state.teacherCode);

      const response = await fetch("/api/chat", {
        method: "POST",
        headers,
        body: JSON.stringify({
          suspect: suspectId,
          message: text,
          history: priorHistory,
          user: state.user,
          role: state.role,
          classId: state.classId,
          team: state.team
        })
      });

      const data = await response.json().catch(() => ({}));
      if (data.credits) {
        applyCredits(data.credits.remaining);
      }
      if (data.usage) {
        setLogCount(data.usage.count || 0);
      }
      if (response.status === 401 && data.requiresAccessCode) {
        clearAccessCode();
        setApiStatus("입장 코드 다시 입력 필요", "bad");
        return "입장 코드가 맞지 않습니다. 다시 입력해 주세요.";
      }
      if (response.status === 402 && data.code === "NO_CREDITS") {
        applyCredits(0);
        return "질문권이 0개입니다. 선생님이 질문권을 준 뒤 질문권 받기를 누르면 다시 질문할 수 있어요.";
      }
      if (response.ok && data.reply) {
        return data.reply;
      }

      const errorText = data.error || "ChatGPT API 응답을 받지 못했습니다.";
      setApiStatus("ChatGPT 응답 실패", "bad");
      if (data.code === "OPENAI_TEMPORARILY_UNAVAILABLE") {
        return `ChatGPT API가 현재 잠시 사용 불가 상태입니다. 잠시 후 다시 시도해 주세요. (${errorText})`;
      }
      if (data.code === "LOW_QUALITY_REPLY") {
        return "ChatGPT가 질문에 맞는 답변을 만들지 못했습니다. 같은 증거를 조금 더 구체적으로 다시 질문해 주세요.";
      }
      return `ChatGPT API 오류가 발생했습니다. 잠시 후 다시 시도해 주세요. (${errorText})`;
    } catch {
      setApiStatus("ChatGPT 연결 실패", "bad");
      return "ChatGPT API에 연결하지 못했습니다. 인터넷 연결이나 배포 서버 상태를 확인한 뒤 다시 시도해 주세요.";
    }
  }

  async function submitQuestion(question) {
    const text = question.trim();
    if (!text || state.waiting) return;
    if (state.role === "student" && state.credits === 0) {
      addMessage("bot", "질문권이 0개입니다. 선생님이 질문권을 준 뒤 질문권 받기를 눌러주세요.");
      updateInputAvailability();
      return;
    }

    state.waiting = true;
    input.disabled = true;
    if (sendButton) sendButton.disabled = true;
    document.querySelectorAll("[data-prompt]").forEach((button) => {
      button.disabled = true;
    });
    addMessage("user", text);
    input.value = "";
    adjustPressureForQuestion(text);

    const priorHistory = state.history.slice();
    state.history.push({ role: "user", content: text });
    trimHistory();

    const pending = addMessage("bot", "...");

    try {
      const reply = await requestApiReply(text, priorHistory);
      pending.bubble.textContent = reply;
      delete pending.row.dataset.pending;
      state.history.push({ role: "assistant", content: reply });
      trimHistory();
    } finally {
      state.waiting = false;
      updateInputAvailability();
      if (!input.disabled) input.focus();
    }
  }

  function resetChat() {
    state.pressure = 0;
    state.hints.clear();
    state.history = [{ role: "assistant", content: greeting }];
    state.waiting = false;
    pressureFill.style.width = "18%";
    pressureLabel.textContent = "조사 시작";
    messages.textContent = "";
    addMessage("bot", greeting);
    updateInputAvailability();
    if (!input.disabled) input.focus();
  }

  function requestResetChat() {
    if (state.role === "student") {
      const shouldReset = window.confirm("대화 내용이 모두 사라집니다. 채팅내역을 초기화하려면 확인을 누르세요.");
      if (!shouldReset) return;

      const code = window.prompt("채팅내역 초기화 암호를 입력하세요.");
      if (code !== "kit") {
        window.alert("암호가 맞지 않아 채팅내역을 초기화하지 않았습니다.");
        return;
      }
    }

    resetChat();
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    submitQuestion(input.value);
  });

  document.querySelectorAll("[data-prompt]").forEach((button) => {
    button.addEventListener("click", () => {
      submitQuestion(button.dataset.prompt);
    });
  });

  refreshApiStatus();
  startCreditSync();

  resetButton.addEventListener("click", requestResetChat);
  resetChat();
})();
