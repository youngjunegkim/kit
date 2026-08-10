(function () {
  const questions = [
    {
      number: 1,
      topic: "AI 재범 위험도 평가 및 판단의 편향성",
      type: "choice",
      background: [
        "해외 사법 기관에서 사용된 AI 재범 위험도 예측 프로그램 'C 시스템'은 피고인의 재범률을 평가했다. 비슷한 절도 사건으로 조사받은 두 피고인에 대해 C 시스템은 한 피고인에게는 낮은 위험 점수를, 다른 피고인에게는 높은 위험 점수를 매겼다."
      ],
      prompt: "C 시스템이 유사한 사건의 피고인들에게 서로 다른 재범 위험도 점수를 매긴 사례에서 가장 핵심적인 AI 윤리 쟁점은 무엇인가?",
      options: [
        { id: "1", marker: "①", text: "AI가 인간 판사보다 더 많은 정보를 빠르게 처리할 수 있는가" },
        { id: "2", marker: "②", text: "AI가 판단한 결과를 법원이 그대로 활용해도 되는가" },
        { id: "3", marker: "③", text: "AI의 판단 기준이 불투명하고, 과거 데이터의 편향이 사법적 불평등으로 이어질 수 있는가" },
        { id: "4", marker: "④", text: "AI가 범죄자의 미래 행동을 완벽하게 예측할 수 있는가" }
      ],
      answer: "3",
      explanation: [
        "핵심은 AI가 단순히 위험 점수를 냈다는 점이 아니라, 그 점수가 어떤 데이터와 기준으로 산출되었는지 알기 어렵다는 점이다.",
        "또한 편향된 과거 데이터가 특정 집단에게 불리한 판단으로 이어질 수 있으며, 사법 영역에서는 공정성을 해칠 수 있다."
      ]
    },
    {
      number: 2,
      topic: "AI 기반 군사 표적 판단의 책임성",
      type: "choice",
      background: [
        "분쟁 지역의 한 민간 초등학교가 공습 피해를 입었다. 이후 보도에서는 표적 선정 과정에서 AI 기반 표적 분석 시스템과 오래된 군사 데이터가 활용되었고, 학교가 군사시설로 잘못 분류되었을 가능성이 제기되었다."
      ],
      prompt: "이 사건에서 가장 중요한 민주주의적 쟁점은 무엇인가?",
      options: [
        { id: "1", marker: "①", text: "AI가 전쟁을 더 빠르고 효율적으로 만들 수 있는가" },
        { id: "2", marker: "②", text: "AI가 전쟁 비용을 줄이고 작전 시간을 단축할 수 있는가" },
        { id: "3", marker: "③", text: "AI가 개입한 군사 결정에서 책임을 누구에게 물을 수 있는가" },
        { id: "4", marker: "④", text: "AI가 사람보다 더 많은 데이터를 처리할 수 있는가" }
      ],
      answer: "3",
      explanation: [
        "AI 판단이 공격 결정에 영향을 주어 피해가 발생했을 때, 그 책임이 개발자, 군 지휘관, 국가 중 누구에게 있는지 불분명해진다.",
        "따라서 핵심 쟁점은 AI 군사 활용의 책임성, 투명성, 인간의 최종 판단이다."
      ]
    },
    {
      number: 3,
      topic: "생성형 AI 무단 학습과 창작자 권리",
      type: "choice",
      background: [
        "한 대형 웹툰 플랫폼 약관에 이용자 콘텐츠를 AI 연구에 활용할 수 있다는 조항이 알려지자 작가들과 독자들이 반발했다. 작가들은 동의 없는 작품 학습이 그림체 복제 및 생계 위협으로 이어진다고 주장했고, 독자들은 불매 운동에 참여했다."
      ],
      prompt: "웹툰 작품을 창작자의 동의 없이 생성형 AI 학습에 활용할 때 가장 핵심적인 윤리 문제는 무엇인가?",
      options: [
        { id: "1", marker: "①", text: "AI가 웹툰을 더 빠르게 만들 수 있다는 점이다." },
        { id: "2", marker: "②", text: "창작자의 동의와 권리를 무시하고 작품을 학습 데이터로 사용하는 점이다." },
        { id: "3", marker: "③", text: "독자들이 웹툰 플랫폼을 너무 많이 이용한다는 점이다." },
        { id: "4", marker: "④", text: "AI가 사람보다 그림을 더 잘 그릴 수 있다는 점이다." }
      ],
      answer: "2",
      explanation: [
        "웹툰 작품과 그림체에는 작가의 노력과 개성이 담겨 있다.",
        "이를 동의 없이 AI 학습에 사용하는 것은 창작자의 권리와 수익을 침해하며 창작 생태계의 공정성을 해친다."
      ]
    },
    {
      number: 4,
      topic: "배달 플랫폼 알고리즘과 노동 통제",
      type: "choice",
      background: [
        "플랫폼 알고리즘이 예상 배달 시간을 정하고, 지연 시 라이더에게 불이익을 주는 구조가 일반화되고 있다."
      ],
      prompt: "이러한 상황에서 가장 적절한 윤리적 비판은 무엇인가?",
      options: [
        { id: "1", marker: "①", text: "알고리즘이 배달 경로를 자동으로 계산해 인간의 판단이 불필요해졌다는 점이다." },
        { id: "2", marker: "②", text: "플랫폼이 효율성을 높이는 과정에서 노동자의 안전과 자율성을 약화시키고, 위험 책임을 개인에게 전가할 수 있다는 점이다." },
        { id: "3", marker: "③", text: "고객이 배달 시간을 정확히 알게 되어 음식점 경쟁이 심해질 수 있다는 점이다." },
        { id: "4", marker: "④", text: "AI가 주문량을 예측하지 못하면 플랫폼 수익이 감소할 수 있다는 점이다." }
      ],
      answer: "2",
      explanation: [
        "핵심은 알고리즘이 노동자의 행동을 통제하고 속도 경쟁을 강요한다는 점이다.",
        "안전사고가 발생해도 그 책임이 플랫폼이 아닌 라이더 개인에게 전가되는 구조적 문제가 존재한다."
      ]
    },
    {
      number: 5,
      topic: "주요 인공지능법(AI Act)과 고위험 AI",
      type: "choice",
      background: [
        "주요국의 인공지능법에서는 AI를 위험한 정도에 따라 분류한다. 특히 진학, 채용, 중요 자격 평가처럼 사람의 미래나 삶의 중요한 기회에 직접적인 영향을 주는 판단을 내리는 AI는 위험성이 높다고 보고 엄격하게 관리한다."
      ],
      prompt: "다음 중 학생의 학교생활 및 미래에 미치는 영향이 비교적 적어 위험성이 가장 낮은 AI 시스템은 무엇인가?",
      options: [
        { id: "1", marker: "①", text: "동아리 신입 부원 모집에서 지원서를 심사하고 합격·불합격을 결정하는 AI" },
        { id: "2", marker: "②", text: "학생의 수업 태도와 제출물을 평가하여 수행평가 점수를 매기는 AI" },
        { id: "3", marker: "③", text: "학생의 시청 기록을 분석하여 취향에 맞는 휴식용 동영상을 추천해 주는 AI" },
        { id: "4", marker: "④", text: "학생의 성적과 활동 기록을 분석해 특정 학과에 불합격할 확률을 예측하는 진학 상담 AI" }
      ],
      answer: "3",
      explanation: [
        "개인 취향에 맞는 영상을 추천해 주는 AI는 일상적인 편의를 제공하는 시스템으로, 학생의 중요한 권리나 미래를 침해할 위험이 상대적으로 낮다.",
        "반면 합격·불합격, 수행평가 점수, 진학 가능성 예측처럼 학생의 미래와 정당한 평가에 직접적인 영향을 주는 AI는 오류 발생 시 피해가 크므로 '고위험 AI'로 분류된다."
      ]
    },
    {
      number: 6,
      topic: "의료 AI와 데이터 편향",
      type: "choice",
      background: [
        "한 대형 병원에서는 추가 치료가 필요한 환자를 찾아내는 AI를 도입했다. 그런데 건강 상태가 똑같이 나쁜데도, AI는 특정 인종 집단 환자에게만 치료 혜택을 더 많이 주고 다른 인종 환자는 제외하는 차별적인 판단을 내렸다."
      ],
      prompt: "AI에 '인종' 정보를 직접 입력하지 않았는데도, 왜 이런 차별적인 결과가 나왔는가?",
      options: [
        { id: "1", marker: "①", text: "AI 프로그램이 해킹을 당해서 작동 오류가 발생했기 때문이다." },
        { id: "2", marker: "②", text: "차별과 불평등이 이미 담겨 있던 과거 의료 기록을 AI가 그대로 학습했기 때문이다." },
        { id: "3", marker: "③", text: "의사들이 AI의 판단을 무시하고 직접 특정 인종 환자를 제외했기 때문이다." },
        { id: "4", marker: "④", text: "특정 환자들이 AI의 치료 추천을 거절했기 때문이다." }
      ],
      answer: "2",
      explanation: [
        "AI는 사람이 직접 인종을 알려주지 않아도, 과거의 불평등했던 사회 기록을 학습하면서 사회에 존재하는 차별 패턴을 그대로 닮아가게 된다.",
        "따라서 학습 데이터 자체에 편향이 없는지 확인해야 한다."
      ]
    },
    {
      number: 7,
      topic: "유명인 목소리·이미지 무단 사용",
      type: "choice",
      background: [
        "한 AI 기업이 유명 영화 속 AI 비서를 연기한 배우의 목소리와 매우 유사한 AI 음성을 공개해 논란이 되었다. 해당 배우는 이전에 목소리 사용 제안을 공식 거절한 상태였다."
      ],
      prompt: "AI가 유명인의 목소리나 얼굴을 동의 없이 마음대로 만들어 상업적으로 사용할 때 발생할 수 있는 가장 큰 문제는 무엇인가?",
      options: [
        { id: "1", marker: "①", text: "AI의 인터넷 연결 속도가 느려진다는 점이다." },
        { id: "2", marker: "②", text: "당사자의 동의 없이 얼굴이나 목소리라는 개인의 특징을 상업적으로 빼앗아 쓴다는 점이다." },
        { id: "3", marker: "③", text: "사용자들이 AI 앱을 다운로드할 때 돈을 더 내야 한다는 점이다." },
        { id: "4", marker: "④", text: "AI가 사람의 말을 알아듣지 못하고 오류를 낸다는 점이다." }
      ],
      answer: "2",
      explanation: [
        "이름, 얼굴, 목소리처럼 '나를 나타내는 특징'은 본인이 직접 통제하고 허락할 권리가 있다.",
        "이를 동의 없이 AI 학습이나 상품에 쓰는 것은 개인의 권리와 정체성을 침해하는 일이다."
      ]
    },
    {
      number: 8,
      topic: "생성형 AI 환각 현상",
      type: "choice",
      background: [
        "법정에서 한 변호사가 생성형 AI가 찾아준 판례 6개를 제출했으나, 검증 결과 모두 실제로 존재하지 않는 가짜 판례로 밝혀져 법원으로부터 벌금을 부과받았다."
      ],
      prompt: "위 사례에서 나타난 생성형 AI의 문제점은 무엇인가?",
      options: [
        { id: "1", marker: "①", text: "딥페이크" },
        { id: "2", marker: "②", text: "환각 현상" },
        { id: "3", marker: "③", text: "블랙박스 문제" },
        { id: "4", marker: "④", text: "과적합" }
      ],
      answer: "2",
      explanation: [
        "'환각 현상(Hallucination)'은 AI가 틀리거나 존재하지 않는 정보를 마치 사실인 것처럼 정교하게 지어내는 현상을 뜻한다."
      ]
    },
    {
      number: 9,
      topic: "AI 주행 보조 사고와 기업 책임",
      type: "choice",
      background: [
        "AI 주행 보조 기능을 켠 차량이 사고를 내 인명 피해가 발생했다. 운전자는 휴대전화를 보느라 전방 주시를 소홀히 했으나, 피해자 측은 제조사가 기술의 한계와 위험성을 충분히 알리지 않았다고 주장했다."
      ],
      prompt: "최근 사법 기관은 이와 같은 사고에 대해 \"운전자 부주의만의 문제가 아니라 자동차 제조사에도 일부 책임이 있다\"고 판단하는 경향이 있다.",
      options: [
        { id: "O", marker: "O", text: "맞다" },
        { id: "X", marker: "X", text: "아니다" }
      ],
      answer: "O",
      explanation: [
        "법원은 운전자 과실뿐만 아니라, 주행 보조 기능의 명칭·홍보 방식이 기술 과신을 유발했는지, 그리고 제조사가 기술 한계를 충분히 안내했는지 종합하여 기업의 책임을 인정하고 있다."
      ]
    },
    {
      number: 10,
      topic: "생성형 AI의 물 소비와 환경 비용",
      type: "choice",
      background: [
        "우리가 대화형 생성형 AI 서비스와 대화할 때, 뒤에서는 대규모 데이터센터의 서버가 엄청난 열을 내며 작동한다. 이 열을 식히기 위해서는 대량의 냉각수(물)가 필요하다."
      ],
      prompt: "대화형 AI와 약 10~50문장 정도의 간단한 대화를 나눌 때, 서버를 식히기 위해 소비되는 물의 양은 대략 어느 정도인가?",
      options: [
        { id: "1", marker: "①", text: "한두 방울 (약 1ml)" },
        { id: "2", marker: "②", text: "종이컵 반 컵 (약 50ml)" },
        { id: "3", marker: "③", text: "생수 한 병 (약 500ml)" },
        { id: "4", marker: "④", text: "대형 양동이 한 가득 (약 10L)" }
      ],
      answer: "3",
      explanation: [
        "AI 서비스는 눈에 보이지 않지만, 한 번 검색하고 대화할 때마다 생수 한 병 분량의 물과 전기 같은 실제 지구 자원을 소비하고 있다."
      ]
    },
    {
      number: 11,
      topic: "AI 스마트 글래스 부정행위",
      type: "choice",
      background: [
        "시험장에서 안경에 초소형 카메라가 달린 AI 스마트 글래스를 이용해 시험지를 외부로 찍어 보내고 정답을 듣는 부정행위가 적발되었다."
      ],
      prompt: "이 사건이 보여주는 가장 중요한 AI 기술 윤리 문제는 무엇인가?",
      options: [
        { id: "1", marker: "①", text: "부정행위를 막기 위해 모든 안경 착용을 금지해야 한다는 점이다." },
        { id: "2", marker: "②", text: "AI 기술에 아직 기술적 결함이 많아 정답을 잘 못 맞춘다는 점이다." },
        { id: "3", marker: "③", text: "아무리 뛰어난 AI 기술이라도 사용자의 도덕성이 없으면 사회적 신뢰를 깨뜨리는 범죄 도구가 될 수 있다는 점이다." },
        { id: "4", marker: "④", text: "지필 시험 대신 컴퓨터 시험으로 모두 바꾸면 부정행위가 완전히 사라진다는 점이다." }
      ],
      answer: "3",
      explanation: [
        "기술 자체는 편리한 도구이지만, 그것을 사용하는 인간의 윤리적 책임감과 도덕성이 바탕이 되지 않으면 사회 전체의 공정성과 신뢰가 무너진다."
      ]
    },
    {
      number: 12,
      topic: "AI 글래스와 개인정보 침해",
      type: "choice",
      background: [
        "한 대학 연구팀의 실험에 따르면, 카메라가 달린 AI 안경을 쓰고 길가는 사람의 얼굴을 찍으면 AI가 인터넷(SNS, 뉴스 등)에 올라와 있는 사진과 글을 순식간에 연결해 그 사람의 이름과 연락처까지 찾아낼 수 있었다."
      ],
      prompt: "AI 안경이 얼굴만 보고 모르는 사람의 개인정보를 찾아낼 수 있었던 핵심 이유는 무엇인가?",
      options: [
        { id: "1", marker: "①", text: "AI 안경이 사람의 생각과 기억을 직접 읽어냈기 때문이다." },
        { id: "2", marker: "②", text: "국가의 비공개 비밀 안면인식 시스템이 해킹당했기 때문이다." },
        { id: "3", marker: "③", text: "인터넷에 흩어져 있던 공개 정보들을 AI가 아주 빠르게 연결하고 분석했기 때문이다." },
        { id: "4", marker: "④", text: "AI 렌즈가 신분증이나 주머니 속 소지품을 투시해 찍었기 때문이다." }
      ],
      answer: "3",
      explanation: [
        "인터넷에 따로따로 올려둔 정보들이 AI의 빠른 분석 능력으로 연결되면서 한 사람을 쉽게 추적할 수 있는 도구가 되었다.",
        "이는 내가 공개해 둔 정보라도 AI를 만나면 언제든 개인정보 침해로 이어질 수 있음을 보여준다."
      ]
    },
    {
      number: 13,
      topic: "데이터센터와 기후 윤리",
      type: "choice",
      background: [
        "생성형 AI를 작동시키는 데이터센터는 엄청난 전기를 사용하고, 서버 냉각을 위해 수많은 물을 소비하며 온실가스를 배출한다."
      ],
      prompt: "AI 데이터센터의 증가가 환경 윤리 문제로 이어지는 이유로 가장 적절하지 않은 것은 무엇인가?",
      options: [
        { id: "1", marker: "①", text: "데이터센터가 대량의 전기를 사용해 탄소 배출을 늘리기 때문이다." },
        { id: "2", marker: "②", text: "냉각수를 너무 많이 사용하여 해당 지역의 물 자원을 부족하게 만들기 때문이다." },
        { id: "3", marker: "③", text: "서버에서 나온 뜨거운 열수가 배출되어 주변 생태계에 영향을 줄 수 있기 때문이다." },
        { id: "4", marker: "④", text: "AI 데이터센터가 늘어날수록 지구의 인구수가 급격하게 줄어들기 때문이다." }
      ],
      answer: "4",
      explanation: [
        "AI의 편리함 뒤에는 전력 소모, 수자원 부족, 온실가스 증가라는 구체적인 기후·환경적 영향이 숨어있음을 이해해야 한다."
      ]
    },
    {
      number: 14,
      topic: "악의적 딥페이크와 AI 가짜뉴스",
      type: "choice",
      background: [
        "딥페이크 기술을 이용하면 특정 인물이 하지도 않은 말이나 행동을 진짜처럼 만든 가짜 영상을 쉽게 제작할 수 있다."
      ],
      prompt: "누군가의 얼굴을 합성해 거짓 행동을 하는 악의적인 딥페이크 영상을 만들어 퍼뜨릴 때 발생하는 가장 핵심적인 AI 윤리 문제는 무엇인가?",
      options: [
        { id: "1", marker: "①", text: "AI 영상의 화질이 너무 낮아서 시청하기 불편하다는 점이다." },
        { id: "2", marker: "②", text: "거짓 정보를 진짜처럼 만들어 타인의 명예를 훼손하고 사회적 혼란을 일으킨다는 점이다." },
        { id: "3", marker: "③", text: "가짜 영상 때문에 컴퓨터 바이러스가 유포될 수 있다는 점이다." },
        { id: "4", marker: "④", text: "AI 프로그램을 설치하는 데 시간이 너무 오래 걸린다는 점이다." }
      ],
      answer: "2",
      explanation: [
        "딥페이크 기술의 무단 남용은 진실성(Fact)을 왜곡하고, 피해자의 명예를 훼손하며, 사회적 신뢰를 무너뜨리는 중대한 윤리적 문제를 일으킨다."
      ]
    },
    {
      number: 15,
      topic: "모델 붕괴와 소외 계층의 디지털 배제",
      type: "choice",
      background: [
        "인터넷에 AI가 생성한 데이터가 범람하면서, AI가 다시 이 AI 생성 데이터를 재학습하면 다수의 주류 정보만 남고 희귀 정보는 사라지는 '모델 붕괴' 현상이 나타난다."
      ],
      prompt: "AI가 주류 데이터만 반복 학습하여 소수 집단의 기록을 밀어낸다면 발생할 가장 큰 윤리적 문제는 무엇인가?",
      options: [
        { id: "1", marker: "①", text: "디지털 저작권 침해" },
        { id: "2", marker: "②", text: "글로벌 통신망 마비" },
        { id: "3", marker: "③", text: "소외 계층의 디지털 배제" },
        { id: "4", marker: "④", text: "인공지능의 자아 형성" }
      ],
      answer: "3",
      explanation: [
        "소수 문화, 희귀 질환, 사회적 약자의 경험 및 기록이 AI 시스템에서 삭제·배제되어, 복지·의료·법률 등 핵심 서비스 영역에서 소외 계층이 더욱 배제되는 결과를 초래한다."
      ]
    }
  ];

  const baseQuestionCount = questions.length;
  const choiceMarkers = ["\u2460", "\u2461", "\u2462", "\u2463", "\u2464"];

  function quizClassId() {
    return sessionStorage.getItem("kit-class-section") || localStorage.getItem("kit-last-class-section") || "class-a";
  }

  function customQuestionStorageKey() {
    return `kit-ethics-custom-questions:${quizClassId()}`;
  }

  function splitCustomParagraphs(value) {
    return String(value || "")
      .split(/\n+/)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  function loadCustomQuestionRecords() {
    try {
      const saved = JSON.parse(localStorage.getItem(customQuestionStorageKey()) || "[]");
      return Array.isArray(saved) ? saved.filter((item) => item && typeof item === "object") : [];
    } catch {
      return [];
    }
  }

  function saveCustomQuestionRecords(records) {
    localStorage.setItem(customQuestionStorageKey(), JSON.stringify(records));
  }

  function customQuestionSignature(records) {
    return JSON.stringify((Array.isArray(records) ? records : []).map((record) => ({
      id: String(record?.id || ""),
      topic: String(record?.topic || ""),
      background: Array.isArray(record?.background) ? record.background : splitCustomParagraphs(record?.background),
      prompt: String(record?.prompt || ""),
      options: Array.isArray(record?.options) ? record.options.map((option) => ({
        id: String(option?.id || ""),
        marker: String(option?.marker || ""),
        text: String(option?.text || "")
      })) : [],
      answer: String(record?.answer || ""),
      explanation: Array.isArray(record?.explanation) ? record.explanation : splitCustomParagraphs(record?.explanation),
      sourceImage: String(record?.sourceImage || ""),
      baseNumber: Number(record?.baseNumber || 0) || 0
    })));
  }

  const savedCustomQuestionRecords = loadCustomQuestionRecords();
  let customQuestionsFingerprint = customQuestionSignature(savedCustomQuestionRecords);

  function customQuestionHeaders(role = "") {
    const resolvedRole = role || document.body?.dataset.auth || sessionStorage.getItem("kit-auth-role") || "student";
    return {
      "x-kit-role": resolvedRole,
      "x-kit-class": quizClassId()
    };
  }

  function applyCustomQuestionRecords(records) {
    const validRecords = (Array.isArray(records) ? records : [])
      .filter((record) => normalizeCustomQuestion(record, 0));
    const nextFingerprint = customQuestionSignature(validRecords);
    if (nextFingerprint === customQuestionsFingerprint) return false;
    customQuestionsFingerprint = nextFingerprint;
    saveCustomQuestionRecords(validRecords);

    rebuildEthicsQuestions(validRecords);
    window.KitEthicsQuizQuestions = questions;
    window.dispatchEvent(new CustomEvent("kit-ethics-questions-updated", {
      detail: { count: questions.length }
    }));
    return true;
  }

  async function refreshCustomQuestionsFromServer() {
    if (typeof fetch !== "function") return;
    try {
      const response = await fetch(`/api/ethics-questions?classId=${encodeURIComponent(quizClassId())}`, {
        cache: "no-store",
        headers: customQuestionHeaders()
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !Array.isArray(data.questions)) return;
      applyCustomQuestionRecords(data.questions);
    } catch {
      // Local custom questions still work when the page is opened without the Node API server.
    }
  }

  if (typeof window !== "undefined") {
    window.KitRefreshEthicsQuestions = refreshCustomQuestionsFromServer;
  }

  async function saveCustomQuestionToServer(record) {
    if (typeof fetch !== "function") return false;
    try {
      const response = await fetch("/api/ethics-questions", {
        method: "POST",
        headers: {
          ...customQuestionHeaders("teacher"),
          "content-type": "application/json"
        },
        body: JSON.stringify({
          classId: quizClassId(),
          question: record
        })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !Array.isArray(data.questions)) return false;
      applyCustomQuestionRecords(data.questions);
      return true;
    } catch {
      return false;
    }
  }

  async function deleteCustomQuestionFromServer(id) {
    if (typeof fetch !== "function") return false;
    try {
      const response = await fetch("/api/ethics-questions", {
        method: "POST",
        headers: {
          ...customQuestionHeaders("teacher"),
          "content-type": "application/json"
        },
        body: JSON.stringify({
          action: "delete",
          id,
          classId: quizClassId()
        })
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  function normalizeCustomParagraphs(value) {
    if (Array.isArray(value)) {
      return value.map((item) => String(item || "").trim()).filter(Boolean);
    }
    return splitCustomParagraphs(value);
  }

  function cloneQuestion(question) {
    return {
      ...question,
      background: Array.isArray(question.background) ? [...question.background] : [],
      options: Array.isArray(question.options) ? question.options.map((option) => ({ ...option })) : [],
      explanation: Array.isArray(question.explanation) ? [...question.explanation] : []
    };
  }

  function normalizedBaseNumber(record) {
    const number = Number(record?.baseNumber || 0);
    return Number.isInteger(number) && number >= 1 && number <= baseQuestionCount ? number : 0;
  }

  function normalizeCustomQuestion(record, index) {
    const options = Array.isArray(record.options)
      ? record.options
        .map((option, optionIndex) => ({
          id: String(option?.id || optionIndex + 1),
          marker: String(option?.marker || choiceMarkers[optionIndex] || `${optionIndex + 1}.`),
          text: String(option?.text || "").trim()
        }))
        .filter((option) => option.text)
      : [];
    const answer = String(record.answer || "").trim();
    const topic = String(record.topic || "").trim();
    const prompt = String(record.prompt || "").trim();
    const explanation = normalizeCustomParagraphs(record.explanation);

    if (!topic || !prompt || options.length < 2 || !options.some((option) => option.id === answer) || !explanation.length) {
      return null;
    }

    const baseNumber = normalizedBaseNumber(record);
    return {
      number: baseNumber || baseQuestionCount + index + 1,
      baseNumber,
      custom: !baseNumber,
      customId: String(record.id || `custom-${index}`),
      topic,
      type: "choice",
      background: normalizeCustomParagraphs(record.background),
      prompt,
      options,
      answer,
      explanation,
      sourceImage: String(record.sourceImage || "").trim()
    };
  }

  const updatedSourceImages = {
    3: "assets/ethics_updates/q03_webtoon.png",
    6: "assets/ethics_updates/q06_medical_bias.png",
    7: "assets/ethics_updates/q07_publicity.png",
    8: "assets/ethics_updates/q08_hallucination.png",
    9: "assets/ethics_updates/q09_autonomous_crash.png",
    11: "assets/ethics_updates/q11_smart_glasses.png"
  };

  questions.forEach((question) => {
    if (!question.custom && updatedSourceImages[question.number]) {
      question.sourceImage = updatedSourceImages[question.number];
      return;
    }
    if (!question.sourceImage && !question.custom) {
      question.sourceImage = `assets/ethics-quiz-images/q${String(question.number).padStart(2, "0")}.png`;
    }
  });
  const baseQuestionTemplates = questions.slice(0, baseQuestionCount).map(cloneQuestion);

  function rebuildEthicsQuestions(records) {
    const nextBaseQuestions = baseQuestionTemplates.map(cloneQuestion);
    const nextCustomQuestions = [];
    (Array.isArray(records) ? records : []).forEach((record) => {
      const normalized = normalizeCustomQuestion(record, nextCustomQuestions.length);
      if (!normalized) return;
      if (normalized.baseNumber) {
        nextBaseQuestions[normalized.baseNumber - 1] = {
          ...normalized,
          number: normalized.baseNumber,
          custom: false
        };
        return;
      }
      nextCustomQuestions.push({
        ...normalized,
        number: baseQuestionCount + nextCustomQuestions.length + 1,
        custom: true
      });
    });
    questions.splice(0, questions.length, ...nextBaseQuestions, ...nextCustomQuestions);
  }

  rebuildEthicsQuestions(savedCustomQuestionRecords);
  window.KitEthicsBaseQuestions = baseQuestionTemplates.map(cloneQuestion);
  window.KitEthicsQuizQuestions = questions;
  refreshCustomQuestionsFromServer();
  if (typeof window !== "undefined") {
    window.setInterval(refreshCustomQuestionsFromServer, 30000);
  }

  const page = document.body;
  if (!page?.classList.contains("ethics-page")) return;

  const mode = page.dataset.quizMode || "student";
  const classId = quizClassId();
  const team = sessionStorage.getItem("kit-auth-team") || sessionStorage.getItem("kit-auth-user") || mode;
  const storageKey = `kit-ethics-quiz:${classId}:${team}`;

  const nodes = {
    nav: document.querySelector("[data-quiz-nav]"),
    card: document.querySelector("[data-question-card]"),
    progressText: document.querySelector("[data-progress-text]"),
    scoreText: document.querySelector("[data-score-text]"),
    progressFill: document.querySelector("[data-progress-fill]"),
    reset: document.querySelector("[data-reset-quiz]"),
    openBuilder: document.querySelector("[data-open-question-builder]"),
    builder: document.querySelector("[data-question-builder]"),
    builderForm: document.querySelector("[data-question-builder-form]"),
    closeBuilder: document.querySelector("[data-close-question-builder]"),
    builderMessage: document.querySelector("[data-question-builder-message]"),
    customQuestionList: document.querySelector("[data-custom-question-list]")
  };

  const state = {
    current: 0,
    answers: loadAnswers()
  };

  function loadAnswers() {
    try {
      const parsed = JSON.parse(localStorage.getItem(storageKey) || "{}");
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
      return {};
    }
  }

  function saveAnswers() {
    localStorage.setItem(storageKey, JSON.stringify(state.answers));
  }

  function answerFor(question) {
    return state.answers[String(question.number)] || { value: "", revealed: false };
  }

  function setAnswer(question, patch) {
    const key = String(question.number);
    state.answers[key] = { ...answerFor(question), ...patch };
    saveAnswers();
  }

  function isChoice(question) {
    return question.type === "choice";
  }

  function isCorrect(question) {
    const answer = answerFor(question);
    return isChoice(question) && answer.value === question.answer;
  }

  function isComplete(question) {
    const answer = answerFor(question);
    return Boolean(answer.revealed || (answer.value && isChoice(question) && isCorrect(question)));
  }

  function createElement(tag, className, text) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
  }

  function selectedOption(question) {
    return question.options?.find((option) => option.id === answerFor(question).value) || null;
  }

  function renderNav() {
    if (!nodes.nav) return;
    nodes.nav.textContent = "";
    questions.forEach((question, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = String(question.number);
      button.classList.toggle("is-active", index === state.current);
      button.classList.toggle("is-done", isComplete(question) && (!isChoice(question) || isCorrect(question)));
      button.classList.toggle("is-wrong", Boolean(answerFor(question).revealed && isChoice(question) && !isCorrect(question)));
      button.addEventListener("click", () => {
        state.current = index;
        render();
      });
      nodes.nav.append(button);
    });
  }

  function renderProgress() {
    const completed = questions.filter(isComplete).length;
    const correct = questions.filter(isCorrect).length;
    const objective = questions.filter(isChoice).length;
    if (nodes.progressText) nodes.progressText.textContent = `${completed}/${questions.length} 완료`;
    if (nodes.scoreText) nodes.scoreText.textContent = `정답 ${correct}/${objective}`;
    if (nodes.progressFill) nodes.progressFill.style.width = `${Math.round((completed / questions.length) * 100)}%`;
  }

  function renderParagraphs(container, paragraphs = []) {
    paragraphs.forEach((text) => {
      container.append(createElement("p", "", text));
    });
  }

  function renderSourcePanel(question) {
    const panel = createElement("aside", "source-panel");
    panel.setAttribute("aria-label", `${question.number}번 문제 자료 이미지`);
    panel.append(createElement("h3", "", "문제 자료"));

    if (!question.sourceImage) {
      panel.append(createElement("p", "source-empty", "추가 자료 이미지가 없습니다."));
      return panel;
    }

    const pages = createElement("div", "source-pages");
    const figure = createElement("figure", "source-page");
    const image = document.createElement("img");
    image.src = question.sourceImage;
    image.alt = `${question.number}번 문제 자료 이미지`;
    image.loading = "lazy";
    image.decoding = "async";
    const caption = createElement("figcaption", "", `PDF에서 가져온 ${question.number}번 자료`);
    figure.append(image, caption);
    pages.append(figure);
    panel.append(pages);
    return panel;
  }

  function renderQuestion() {
    if (!nodes.card) return;
    const question = questions[state.current];
    const answer = answerFor(question);
    const revealed = answer.revealed;
    nodes.card.textContent = "";

    const head = createElement("div", "question-head");
    const titleWrap = document.createElement("div");
    titleWrap.append(
      createElement("p", "question-kicker", `${question.number}번 문제`),
      createElement("h2", "", question.topic)
    );
    head.append(titleWrap, createElement("p", "question-topic", `${state.current + 1} / ${questions.length}`));

    const body = createElement("div", "question-body");
    const content = createElement("div", "question-content");
    const copy = createElement("div", "question-copy");
    if (question.background?.length) {
      const section = createElement("section", "quiz-section");
      section.append(createElement("h3", "", "배경설명"));
      renderParagraphs(section, question.background);
      copy.append(section);
    }

    const prompt = createElement("section", "quiz-section prompt-text");
    prompt.append(createElement("h3", "", isChoice(question) && question.options?.length === 2 ? "퀴즈 O/X" : "퀴즈"));
    prompt.append(createElement("p", "", question.prompt));
    copy.append(prompt);

    if (isChoice(question)) {
      const options = createElement("section", "quiz-section");
      options.append(createElement("h3", "", "보기"));
      const list = createElement("div", "option-list");
      question.options.forEach((option) => {
        const label = createElement("label", "quiz-option");
        const input = document.createElement("input");
        input.type = "radio";
        input.name = `quiz-${question.number}`;
        input.value = option.id;
        input.checked = answer.value === option.id;
        input.addEventListener("change", () => {
          setAnswer(question, { value: option.id, revealed: false });
          render();
        });
        const text = createElement("span", "", `${option.marker} ${option.text}`);
        label.classList.toggle("is-selected", answer.value === option.id);
        label.classList.toggle("is-correct", revealed && option.id === question.answer);
        label.classList.toggle("is-wrong", revealed && answer.value === option.id && option.id !== question.answer);
        label.append(input, text);
        list.append(label);
      });
      options.append(list);
      copy.append(options);
    } else {
      const section = createElement("section", "quiz-section");
      section.append(createElement("h3", "", "답변"));
      const textarea = document.createElement("textarea");
      textarea.className = "open-answer";
      textarea.value = answer.value || "";
      textarea.placeholder = "답변을 적어 보세요.";
      textarea.addEventListener("input", () => {
        setAnswer(question, { value: textarea.value, revealed: false });
      });
      section.append(textarea);
      copy.append(section);
    }

    const answerPanel = createElement("section", "quiz-section answer-panel");
    answerPanel.classList.toggle("is-visible", revealed);
    answerPanel.append(createElement("h3", "", "해설"));
    if (isChoice(question)) {
      const correct = question.options.find((option) => option.id === question.answer);
      answerPanel.append(createElement("p", "", `정답: ${correct ? `${correct.marker} ${correct.text}` : question.answer}`));
    }
    renderParagraphs(answerPanel, question.explanation);
    copy.append(answerPanel);

    const status = createElement("div", "quiz-status");
    status.dataset.quizStatus = "";
    if (revealed && isChoice(question)) {
      const selected = selectedOption(question);
      status.textContent = isCorrect(question)
        ? "정답입니다."
        : selected
          ? "오답입니다. 해설을 확인하세요."
          : "정답과 해설을 표시합니다.";
      status.classList.toggle("is-ok", isCorrect(question));
      status.classList.toggle("is-bad", Boolean(selected && !isCorrect(question)));
    } else if (revealed) {
      status.textContent = "해설을 확인했습니다.";
      status.classList.add("is-ok");
    }
    copy.append(status);
    content.append(renderSourcePanel(question), copy);
    body.append(content);

    const actions = createElement("div", "quiz-actions");
    const mainActions = createElement("div", "quiz-actions__main");
    const submit = createElement("button", "quiz-btn quiz-btn--primary", isChoice(question) ? "정답 확인" : "해설 보기");
    submit.type = "button";
    submit.addEventListener("click", () => {
      if (isChoice(question) && !answerFor(question).value) {
        const statusNode = document.querySelector("[data-quiz-status]");
        if (statusNode) {
          statusNode.textContent = "보기를 선택하세요.";
          statusNode.className = "quiz-status is-bad";
        }
        return;
      }
      if (!isChoice(question) && !String(answerFor(question).value || "").trim()) {
        const statusNode = document.querySelector("[data-quiz-status]");
        if (statusNode) {
          statusNode.textContent = "답변을 먼저 적어 보세요.";
          statusNode.className = "quiz-status is-bad";
        }
        return;
      }
      setAnswer(question, { revealed: true });
      render();
    });
    mainActions.append(submit);

    const moveActions = createElement("div", "quiz-actions__move");
    const prev = createElement("button", "quiz-btn", "이전");
    prev.type = "button";
    prev.disabled = state.current === 0;
    prev.addEventListener("click", () => {
      state.current = Math.max(0, state.current - 1);
      render();
    });
    const next = createElement("button", "quiz-btn", "다음");
    next.type = "button";
    next.disabled = state.current === questions.length - 1;
    next.addEventListener("click", () => {
      state.current = Math.min(questions.length - 1, state.current + 1);
      render();
    });
    moveActions.append(prev, next);
    actions.append(mainActions, moveActions);

    nodes.card.append(head, body, actions);
  }

  function render() {
    renderNav();
    renderProgress();
    renderQuestion();
  }

  function setBuilderMessage(text, type = "") {
    if (!nodes.builderMessage) return;
    nodes.builderMessage.textContent = text;
    nodes.builderMessage.classList.toggle("is-ok", type === "ok");
    nodes.builderMessage.classList.toggle("is-bad", type === "bad");
  }

  function renderCustomQuestionList() {
    if (!nodes.customQuestionList) return;
    const records = loadCustomQuestionRecords();
    nodes.customQuestionList.textContent = "";

    if (!records.length) {
      nodes.customQuestionList.append(createElement("p", "custom-question-empty", "추가한 문제가 없습니다."));
      return;
    }

    records.forEach((record, index) => {
      const item = createElement("article", "custom-question-item");
      item.append(
        createElement("span", "custom-question-number", `${baseQuestionCount + index + 1}번`),
        createElement("strong", "custom-question-title", String(record.topic || "제목 없음")),
      );
      const remove = createElement("button", "custom-question-delete", "삭제");
      remove.type = "button";
      remove.dataset.deleteCustomQuestion = String(index);
      item.append(remove);
      nodes.customQuestionList.append(item);
    });
  }

  function setupQuestionBuilder() {
    if (mode !== "teacher" || !nodes.openBuilder || !nodes.builder || !nodes.builderForm) return;

    const setOpen = (open) => {
      nodes.builder.hidden = !open;
      nodes.openBuilder.textContent = open ? "문제 추가 닫기" : "문제 추가";
      if (open) {
        nodes.builder.scrollIntoView({ behavior: "smooth", block: "start" });
        nodes.builderForm.querySelector("[name='topic']")?.focus({ preventScroll: true });
      }
    };

    nodes.openBuilder.addEventListener("click", () => setOpen(nodes.builder.hidden));
    nodes.closeBuilder?.addEventListener("click", () => setOpen(false));

    nodes.builderForm.addEventListener("submit", (event) => {
      event.preventDefault();
      const form = new FormData(nodes.builderForm);
      const options = [1, 2, 3, 4].map((number, index) => ({
        id: String(number),
        marker: choiceMarkers[index],
        text: String(form.get(`option${number}`) || "").trim()
      })).filter((option) => option.text);
      const answer = String(form.get("answer") || "").trim();
      const record = {
        id: window.crypto?.randomUUID ? window.crypto.randomUUID() : `custom-${Date.now()}`,
        topic: String(form.get("topic") || "").trim(),
        type: "choice",
        background: splitCustomParagraphs(form.get("background")),
        prompt: String(form.get("prompt") || "").trim(),
        options,
        answer,
        explanation: splitCustomParagraphs(form.get("explanation")),
        sourceImage: String(form.get("sourceImage") || "").trim()
      };

      if (!record.topic || !record.prompt || options.length < 2 || !options.some((option) => option.id === answer) || !record.explanation.length) {
        setBuilderMessage("제목, 문제, 보기 2개 이상, 정답, 해설을 입력하세요.", "bad");
        return;
      }

      const records = loadCustomQuestionRecords();
      records.push(record);
      saveCustomQuestionRecords(records);

      const question = normalizeCustomQuestion(record, records.length - 1);
      if (question) {
        question.number = questions.length + 1;
        questions.push(question);
        state.current = questions.length - 1;
      }

      nodes.builderForm.reset();
      renderCustomQuestionList();
      setBuilderMessage(`${questions.length}번 문제가 추가되었습니다. 서버 저장을 확인하는 중입니다.`, "ok");
      render();

      saveCustomQuestionToServer(record).then((synced) => {
        setBuilderMessage(
          synced ? `${questions.length}번 문제가 추가되고 서버에 저장되었습니다.` : `${questions.length}번 문제가 이 브라우저에 저장되었습니다.`,
          "ok"
        );
      });
    });

    nodes.customQuestionList?.addEventListener("click", (event) => {
      const button = event.target instanceof Element ? event.target.closest("[data-delete-custom-question]") : null;
      if (!button) return;
      const index = Number(button.dataset.deleteCustomQuestion);
      const records = loadCustomQuestionRecords();
      if (!records[index]) return;
      if (!window.confirm("추가한 문제를 삭제할까요?")) return;
      const removed = records[index];
      records.splice(index, 1);
      saveCustomQuestionRecords(records);
      deleteCustomQuestionFromServer(removed.id).finally(() => window.location.reload());
    });

    renderCustomQuestionList();
  }

  window.addEventListener("kit-ethics-questions-updated", () => {
    state.current = Math.min(state.current, Math.max(0, questions.length - 1));
    renderCustomQuestionList();
    render();
  });

  nodes.reset?.addEventListener("click", () => {
    if (!window.confirm("윤리퀴즈 풀이 기록을 초기화할까요?")) return;
    state.answers = {};
    saveAnswers();
    render();
  });

  setupQuestionBuilder();
  render();
})();
