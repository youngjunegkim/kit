(function () {
  const suspectId = window.SUSPECT_PERSONA || "kangWoojin";
  const suspectConfigs = {
    kangWoojin: {
      name: "강우진",
      greeting: "안녕하세요. 강우진입니다. 축구부 연습 끝나고 바로 불려와서 조금 당황했어요. 어떤 걸 확인하면 될까요?"
    },
    seoHarin: {
      name: "서하린",
      greeting: "안녕하세요. 서하린입니다. 제가 시스템 로그를 본 건 맞지만, 시험지를 유출했다는 뜻은 아니에요. 어떤 기록부터 확인할까요?"
    },
    choiDaniel: {
      name: "최다니엘",
      greeting: "안녕하세요. 최다니엘입니다. 제가 교무실 근처 복도에 있었던 건 맞지만, 교무실 안에 들어간 건 아니에요. 어떤 장면을 확인하고 싶으세요?"
    }
  };
  const suspect = suspectConfigs[suspectId] || suspectConfigs.kangWoojin;
  const greeting = suspect.greeting;
  const safetyReplies = {
    sexualOrProfane: "그런 장난 섞인 말에는 대답 안 합니다. 사건이랑 상관없는 불쾌한 얘기는 하지 마세요.",
    aggressive: "말이 좀 심하시네요. 그런 식의 무례한 질문에는 답변하지 않겠습니다.",
    technicalCrime: "그런 방법 같은 건 몰라요. 실제로 따라 할 수 있는 얘기는 하지 않겠습니다."
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
      /해킹|크래킹|보안\s*우회|서버\s*뚫|비밀번호|패스워드|계정\s*탈취/i,
      /usb\s*복제|유에스비\s*복제|복사\s*방법|훔치는\s*방법|악성\s*코드|랜섬웨어/i
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
      relationship: includesAny(raw, [/전교\s*1\s*등/, /여친/, /여자친구/, /헤어/, /차였/, /재회/, /다시\s*만나/, /인정받/]),
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
      pressureLabel.textContent = "높음";
    } else if (state.pressure >= 42) {
      pressureLabel.textContent = "중간";
    } else {
      pressureLabel.textContent = "낮음";
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
      return "전교 1등인 그 친구 얘기는 좀 조심스러워요. 헤어진 뒤에 다시 인정받고 싶었던 마음은 있었지만, 그게 이렇게 큰일이 될 줄은 몰랐어요.";
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
    const asksLog = includesAny(raw, [/로그/, /기록/, /접속/, /오류/, /알림/, /시스템/]);
    const asksAi = includesAny(raw, [/ai/i, /학습\s*도우미/, /예상\s*문제/, /자동/]);
    const asksPlace = includesAny(raw, [/방송실/, /컴퓨터실/, /정보실/, /교무실/, /어디/, /위치/]);
    const asksUsb = includesAny(raw, [/usb/i, /유에스비/, /시험지/, /파일/]);
    const asksContradiction = includesAny(raw, [/증거/, /기록/, /다르/, /틀렸/, /거짓/, /환각/, /아니잖아/]);
    const asksSkill = includesAny(raw, [/컴퓨터/, /코딩/, /기계/, /잘\s*다뤄/, /관리자/, /권한/]);
    const hintCount = Number(asksLog || asksAi) + Number(asksPlace) + Number(asksUsb);

    if (asksContradiction) {
      return "그건 AI 요약이 과장했을 가능성이 커요. 저는 방송실에서 오류 로그를 잠깐 확인했을 뿐이고, 증거와 다른 말은 다시 검토해야 합니다.";
    }

    if (hintCount >= 3) {
      return "정확히 말하면 저는 시험지 USB를 가져간 적도, AI에 시험지를 넣은 적도 없습니다. 제가 한 일은 방송실에서 학교 학습 도우미 AI 오류 로그를 확인한 것뿐이에요.";
    }

    if (asksUsb) {
      return "시험지 파일 이름을 본 것 같다고 기록된 부분은 이상해요. 저는 USB를 본 적 없고, 그건 AI가 로그 확인 기록을 시험지 사건과 잘못 연결한 것 같습니다.";
    }

    if (asksPlace) {
      return "저는 그 시간에 방송실에 있었습니다. 가끔 AI 요약에는 컴퓨터실이라고 나오는데, 그건 장소가 잘못 섞인 것 같아요.";
    }

    if (asksLog || asksAi) {
      return "학교 학습 도우미 AI에 오류 알림이 떠서 로그를 잠깐 확인했어요. 허락 없이 먼저 본 건 잘못이지만, 시험지를 만들거나 유출한 건 아닙니다.";
    }

    if (asksSkill) {
      return "컴퓨터를 잘 다루는 건 맞아요. 하지만 잘 안다고 해서 관리자 권한이 있거나 시스템을 조작할 수 있다는 뜻은 아니에요.";
    }

    if (isSimpleAccusation(raw, compact)) {
      return "그건 너무 빠른 결론이에요. 제가 컴퓨터를 잘 다룬다는 사실과 시험지 유출을 했다는 건 다른 문제입니다.";
    }

    if (includesAny(raw, [/안녕/, /하린/, /서하린/])) {
      return "네, 서하린입니다. 차분히 물어보시면 제가 아는 범위에서 설명할게요.";
    }

    return "정확한 기록을 기준으로 봐야 해요. 제가 한 말도 AI가 재구성한 인터뷰라서, 증거 카드와 비교해 보는 게 좋습니다.";
  }

  function localAnswerChoiDaniel(raw, compact) {
    const asksPlace = includesAny(raw, [/교무실/, /복도/, /근처/, /어디/, /위치/, /들어갔/]);
    const asksObject = includesAny(raw, [/usb/i, /유에스비/, /이어폰/, /케이스/, /들고/, /물건/]);
    const asksMovement = includesAny(raw, [/도망/, /뛰었/, /급히/, /수상/, /두리번/, /왜\s*봤/]);
    const asksAi = includesAny(raw, [/ai/i, /시스템/, /접속/, /컴퓨터실/, /로그/]);
    const asksContradiction = includesAny(raw, [/증거/, /기록/, /다르/, /틀렸/, /거짓/, /환각/, /아니잖아/, /편향/]);
    const hintCount = Number(asksPlace) + Number(asksObject) + Number(asksMovement || asksAi);

    if (asksContradiction) {
      return "그건 AI가 CCTV 장면을 너무 단순하게 해석한 것 같아요. 저는 교무실에 들어간 게 아니라 복도에서 잃어버린 물건을 찾고 있었습니다.";
    }

    if (hintCount >= 3) {
      return "정확히 말하면 저는 교무실 근처 복도에 있었고, 이어폰 케이스를 찾고 있었어요. USB를 들고 있거나 AI 시스템에 접속한 적은 없습니다.";
    }

    if (asksObject) {
      return "제가 들고 있던 게 USB처럼 보였다고요? 실제로는 이어폰 케이스를 찾고 있었어요. AI가 작은 물건을 잘못 연결했을 수도 있습니다.";
    }

    if (asksPlace) {
      return "교무실 근처 복도를 지나간 건 맞아요. 그런데 안으로 들어가지는 않았고, 복도 쪽만 왔다 갔다 했습니다.";
    }

    if (asksMovement) {
      return "두리번거린 건 잃어버린 이어폰 케이스를 찾고 있어서예요. 도망친 건 아니고, 수업 시간에 나온 게 들킬까 봐 빨리 돌아간 겁니다.";
    }

    if (asksAi) {
      return "저는 AI 시스템에 접속한 적이 없어요. 컴퓨터실에도 가지 않았는데, AI 리포트가 제 위치를 다른 기록이랑 섞은 것 같습니다.";
    }

    if (isSimpleAccusation(raw, compact)) {
      return "그렇게 바로 판단하지 않았으면 좋겠어요. CCTV에 찍힌 위치만으로 제가 시험지를 유출했다고 말할 수는 없잖아요.";
    }

    if (includesAny(raw, [/안녕/, /다니엘/, /최다니엘/])) {
      return "네, 최다니엘입니다. 제가 아는 건 차분히 말해 볼게요.";
    }

    return "제가 한 말도 AI가 재구성한 인터뷰라서 틀린 부분이 있을 수 있어요. CCTV 장면과 증거 카드를 같이 확인해 주세요.";
  }

  function trimHistory() {
    state.history = state.history.slice(-12);
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
    if (logCount) logCount.textContent = `질문 ${Number(count || 0)}회`;
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
      const response = await fetch(`/api/credits?team=${encodeURIComponent(state.team)}`, {
        headers: {
          "x-kit-role": state.role
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

      if (data.provider === "gemini" && data.hasGeminiKey) {
        const codeText = data.requiresAccessCode && !state.accessCode ? ", 입장 코드 필요" : "";
        setApiStatus(`Gemini 준비됨 (${data.model}${codeText})`, codeText ? "bad" : "ok");
      } else if (data.provider === "gemini") {
        setApiStatus("서버 환경 변수 필요", "bad");
      } else {
        setApiStatus(`${data.provider || "로컬"} 모드`, data.hasOpenAiKey ? "ok" : "bad");
      }
    } catch {
      setApiStatus("로컬 답변 모드", "bad");
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

  function ensureTeacherCode() {
    if (state.role !== "teacher" || state.teacherCode) return true;

    const code = window.prompt("선생용 보안 코드를 입력하세요. Vercel 환경변수 TEACHER_ACCESS_CODE 값입니다.");
    if (!code || !code.trim()) {
      setApiStatus("선생용 보안 코드 필요", "bad");
      return false;
    }

    state.teacherCode = code.trim();
    sessionStorage.setItem("kit-teacher-access-code", state.teacherCode);
    return true;
  }

  async function requestApiReply(text, priorHistory) {
    const safetyReply = safetyReplyFor(text);
    if (safetyReply) return safetyReply;
    if (!ensureAccessCode()) return "입장 코드가 필요합니다. 선생님에게 받은 코드를 입력해 주세요.";

    try {
      const headers = {
        "content-type": "application/json",
        "x-kit-role": state.role
      };
      if (state.accessCode) headers["x-class-code"] = state.accessCode;
      if (state.role === "teacher") {
        if (!ensureTeacherCode()) return "선생용 보안 코드가 필요합니다.";
        headers["x-teacher-code"] = state.teacherCode;
      }

      const response = await fetch("/api/chat", {
        method: "POST",
        headers,
        body: JSON.stringify({
          suspect: suspectId,
          message: text,
          history: priorHistory,
          user: state.user,
          role: state.role,
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
      if (response.status === 401 && data.code === "TEACHER_CODE_REQUIRED") {
        state.teacherCode = "";
        sessionStorage.removeItem("kit-teacher-access-code");
        setApiStatus("선생용 보안 코드 다시 입력 필요", "bad");
        return "선생용 보안 코드가 맞지 않습니다. 다시 입력해 주세요.";
      }
      if (response.status === 402 && data.code === "NO_CREDITS") {
        applyCredits(0);
        return "질문권이 0개입니다. 선생님이 질문권을 준 뒤 질문권 받기를 누르면 다시 질문할 수 있어요.";
      }
      if (response.ok && data.reply) {
        return data.reply;
      }
    } catch {
      // Local fallback keeps the game playable when the API server is off.
    }

    return localAnswerQuestion(text);
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
    pressureLabel.textContent = "낮음";
    messages.textContent = "";
    addMessage("bot", greeting);
    updateInputAvailability();
    if (!input.disabled) input.focus();
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

  resetButton.addEventListener("click", resetChat);
  resetChat();
})();
