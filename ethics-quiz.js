(function () {
  const questions = [
    {
      number: 1,
      topic: "COMPAS 재범 위험도 점수와 AI 판단의 편향성",
      type: "choice",
      background: [
        "미국 법원에서 사용된 재범 위험도 예측 프로그램 COMPAS는 피고인의 재범률을 평가했다. 두 인물은 모두 절도사건으로 수감 중이다. COMPAS는 Vernon Prater에게는 낮은 위험 점수, Brisha Borden에게는 높은 위험 점수를 매겼다."
      ],
      prompt: "COMPAS가 두 절도 사건 피고인에게 서로 다른 재범 위험도 점수를 매긴 사례에서 가장 핵심적인 AI 윤리 쟁점은 무엇인가?",
      options: [
        { id: "1", marker: "①", text: "AI가 인간 판사보다 더 많은 정보를 빠르게 처리할 수 있는가" },
        { id: "2", marker: "②", text: "AI가 판단한 결과를 법원이 그대로 활용해도 되는가" },
        { id: "3", marker: "③", text: "AI의 판단 기준이 불투명하고, 과거 데이터의 편향이 사법적 불평등으로 이어질 수 있는가" },
        { id: "4", marker: "④", text: "AI가 범죄자의 미래 행동을 완벽하게 예측할 수 있는가" }
      ],
      answer: "3",
      explanation: [
        "핵심은 AI가 단순히 위험 점수를 냈다는 점이 아니라, 그 점수가 어떤 데이터와 기준으로 산출되었는지 알기 어렵다는 점이다.",
        "또한 편향된 과거 데이터가 특정 집단에게 불리한 판단으로 이어질 수 있으며, 사법 영역에서는 이런 편향이 재판과 형량의 공정성을 해칠 수 있다."
      ]
    },
    {
      number: 2,
      topic: "AI 기반 군사 표적 판단의 책임성",
      type: "choice",
      background: [
        "2026년 이란 미나브의 한 초등학교가 공습 피해를 입었다. 이후 보도에서는 표적 선정 과정에서 AI 기반 표적 분석 시스템과 오래된 군사 데이터가 활용되었고, 학교가 군사시설로 잘못 분류되었을 가능성이 제기되었다."
      ],
      prompt: "이 사건에서 가장 중요한 민주주의적 쟁점은 무엇일까? 아래 보기 중 가장 적절한 것을 고르고 이유를 말해 보자.",
      options: [
        { id: "1", marker: "①", text: "AI가 전쟁을 더 빠르고 효율적으로 만들 수 있는가" },
        { id: "2", marker: "②", text: "AI가 전쟁 비용을 줄이고 작전 시간을 단축할 수 있는가" },
        { id: "3", marker: "③", text: "AI가 개입한 군사 결정에서 책임을 누구에게 물을 수 있는가" },
        { id: "4", marker: "④", text: "AI가 사람보다 더 많은 데이터를 처리할 수 있는가" }
      ],
      answer: "3",
      explanation: [
        "이 사례는 AI가 잘못된 데이터나 분석으로 민간 시설을 군사시설로 오인했을 가능성을 보여 준다. 전쟁에서 AI 판단이 공격 결정에 영향을 주면, 피해가 발생했을 때 책임이 개발자, 군 지휘관, 국가 중 누구에게 있는지 불분명해질 수 있다.",
        "따라서 핵심 쟁점은 AI 군사 활용의 책임성, 투명성, 인간의 최종 판단이다."
      ]
    },
    {
      number: 3,
      topic: "생성형 AI 무단 학습과 창작자 권리",
      type: "choice",
      background: [
        "국내 한 대형 웹툰 플랫폼의 약관에 사용자가 올린 콘텐츠를 AI 기술 연구에 활용할 수 있다는 취지의 조항이 알려지면서, 웹툰 작가들과 독자들이 강하게 반발했다.",
        "작가들은 창작자의 동의 없이 작품과 그림체가 AI 학습에 사용되면, AI가 비슷한 스타일의 콘텐츠를 만들어 창작자의 권리와 생계를 위협할 수 있다고 주장했다. 독자들도 AI 학습 논란이 있는 작품에 낮은 별점을 주거나 불매 운동에 참여했다."
      ],
      prompt: "웹툰 작품을 창작자의 동의 없이 생성형 AI 학습에 활용할 때 가장 핵심적인 윤리 문제는 무엇일까?",
      options: [
        { id: "1", marker: "①", text: "AI가 웹툰을 더 빠르게 만들 수 있다는 점" },
        { id: "2", marker: "②", text: "창작자의 동의와 권리를 무시하고 작품을 학습 데이터로 사용하는 점" },
        { id: "3", marker: "③", text: "독자들이 웹툰 플랫폼을 너무 많이 이용한다는 점" },
        { id: "4", marker: "④", text: "AI가 사람보다 그림을 더 잘 그릴 수 있다는 점" }
      ],
      answer: "2",
      explanation: [
        "웹툰 작품은 작가의 창작물이며, 그림체와 표현 방식도 작가의 노력과 개성이 담긴 결과이다. 이를 동의 없이 AI 학습에 사용하면 창작자의 권리와 수익을 침해할 수 있다.",
        "따라서 핵심 문제는 창작자의 동의, 저작권 보호, 창작 생태계의 공정성이다."
      ]
    },
    {
      number: 4,
      topic: "배달 플랫폼 알고리즘과 노동 통제",
      type: "choice",
      background: [],
      prompt: "배달 플랫폼이 알고리즘으로 예상 배달 시간을 정하고, 지연 시 라이더에게 불이익을 주는 상황에서 가장 적절한 윤리적 비판은 무엇인가?",
      options: [
        { id: "1", marker: "①", text: "알고리즘이 배달 경로를 자동으로 계산하기 때문에 인간의 판단이 완전히 필요 없어졌다는 점" },
        { id: "2", marker: "②", text: "플랫폼이 효율성을 높이는 과정에서 노동자의 안전과 자율성을 약화시키고, 위험 책임을 개인에게 전가할 수 있다는 점" },
        { id: "3", marker: "③", text: "고객이 배달 시간을 정확히 알게 되어 음식점의 경쟁이 심해질 수 있다는 점" },
        { id: "4", marker: "④", text: "AI가 주문량을 예측하지 못하면 배달 플랫폼의 수익이 감소할 수 있다는 점" }
      ],
      answer: "2",
      explanation: [
        "이 문제의 핵심은 단순한 배달 지연이 아니라, 알고리즘이 노동자의 행동을 통제하고 속도 경쟁을 강요할 수 있다는 점이다.",
        "그 결과 안전 문제가 생겨도 책임은 플랫폼보다 라이더 개인에게 돌아갈 수 있다. 따라서 핵심 쟁점은 알고리즘에 의한 노동 통제, 안전 위협, 책임 전가이다."
      ]
    },
    {
      number: 5,
      topic: "EU AI Act와 고위험 AI",
      type: "choice",
      background: [
        "EU AI Act(유럽연합 인공지능법)는 유럽연합이 세계 최초로 제정한 포괄적인 인공지능 규제 법안이다.",
        "EU AI Act는 AI를 위험도에 따라 분류한다. 특히 채용, 승진, 해고처럼 사람의 직업과 삶에 큰 영향을 주는 AI는 고위험 AI로 보고 엄격한 관리와 인간의 감시가 필요하다고 본다."
      ],
      prompt: "다음 중 EU AI Act 기준에서 고위험 AI로 보기 가장 어려운 것은?",
      options: [
        { id: "1", marker: "①", text: "입사 지원서를 자동으로 걸러내는 AI" },
        { id: "2", marker: "②", text: "직원의 승진·해고 가능성을 예측하는 AI" },
        { id: "3", marker: "③", text: "직원의 출퇴근 시간을 기록하는 디지털 근태 시스템" },
        { id: "4", marker: "④", text: "면접에서 지원자의 성향을 분석하는 AI 인·적성 검사" }
      ],
      answer: "3",
      explanation: [
        "단순 근태 기록은 비교적 위험이 낮지만, 채용·평가·승진·해고처럼 사람의 일자리와 권리에 큰 영향을 주는 AI는 고위험 AI로 분류될 수 있다."
      ]
    },
    {
      number: 6,
      topic: "의료 AI와 대리 변수로 인한 차별",
      type: "choice",
      background: [
        "2019년 미국의 한 의료 알고리즘에서 차별 문제가 발견되었다. 미국 병원들은 이 AI 알고리즘을 사용해 추가 건강 관리가 필요한 환자를 선별했다. 그런데 실제 건강 상태가 비슷해도 흑인 환자들이 백인 환자보다 혜택 대상에서 더 많이 제외되는 문제가 나타났다."
      ],
      prompt: "AI에 인종 정보가 직접 들어가지 않았는데도, 왜 흑인 환자들이 불리한 결과를 받았을까?",
      options: [
        { id: "1", marker: "①", text: "AI가 특정 인종에 대한 혐오 표현을 학습했기 때문에" },
        { id: "2", marker: "②", text: "해킹으로 알고리즘이 조작되었기 때문에" },
        { id: "3", marker: "③", text: "실제 건강 상태 대신 과거 의료비 지출액을 기준으로 삼았기 때문에" },
        { id: "4", marker: "④", text: "병원 의사들의 주관적인 평가가 그대로 반영되었기 때문에" }
      ],
      answer: "3",
      explanation: [
        "의료비 지출액은 실제 건강 상태를 완전히 보여 주지 못한다. 의료 접근성과 경제적 차이 때문에 흑인 환자의 의료비 기록이 적게 남았고, AI는 이를 “덜 아프다”는 신호로 잘못 해석했다.",
        "이처럼 현실의 불평등이 섞인 데이터를 그대로 학습하면 AI는 중립적으로 보여도 차별적인 판단을 할 수 있으므로, AI를 만들고 사용하는 사람은 데이터와 결과를 계속 점검할 책임이 있다."
      ]
    },
    {
      number: 7,
      topic: "유명인 목소리·이미지와 퍼블리시티권",
      type: "choice",
      background: [
        "2024년 한 AI 기업은 사람처럼 실시간 대화가 가능한 음성 AI 서비스를 공개했다. 그런데 그중 한 목소리가 유명 영화에서 AI 비서 목소리를 연기한 배우의 목소리와 매우 비슷하다는 논란이 일었다. 해당 배우는 이전에 목소리 사용 제안을 거절했다고 밝혔고, 논란 이후 그 음성은 사용 중단되었다."
      ],
      prompt: "AI가 유명인의 목소리나 이미지를 동의 없이 비슷하게 만들어 상업적으로 사용한다면, 가장 직접적으로 침해될 수 있는 권리는 무엇일까?",
      options: [
        { id: "1", marker: "①", text: "정보공개 청구권" },
        { id: "2", marker: "②", text: "인격 표지 재산권 (퍼블리시티권)" },
        { id: "3", marker: "③", text: "잊힐 권리" },
        { id: "4", marker: "④", text: "공정 이용권 (Fair Use)" }
      ],
      answer: "2",
      explanation: [
        "퍼블리시티권은 사람의 이름, 얼굴, 목소리처럼 개인을 알아볼 수 있는 특징을 상업적으로 이용하고 통제할 수 있는 권리이다. 생성형 AI가 당사자의 동의 없이 목소리나 이미지를 비슷하게 만들면 개인의 정체성과 권리를 침해할 수 있다."
      ]
    },
    {
      number: 8,
      topic: "생성형 AI 환각 현상",
      type: "choice",
      background: [
        "2023년 미국 뉴욕 법원에서 한 변호사가 항공사 소송 자료를 준비하며 생성형 AI 서비스를 사용했다. AI는 과거 판례 6개를 찾아준 것처럼 답했지만, 실제로는 존재하지 않는 가짜 판례였다. 변호사는 이를 제대로 검증하지 않고 법원에 제출했고, 결국 5,000달러의 벌금을 부과받았다."
      ],
      prompt: "위 사례에서 나온 생성형 AI의 문제점은 무엇인가?",
      options: [
        { id: "1", marker: "①", text: "딥페이크" },
        { id: "2", marker: "②", text: "환각 현상" },
        { id: "3", marker: "③", text: "블랙박스 문제" },
        { id: "4", marker: "④", text: "과적합" }
      ],
      answer: "2",
      explanation: [
        "환각 현상은 AI가 틀린 정보나 존재하지 않는 내용을 사실처럼 만들어내는 현상이다. 이 사례는 AI 답변이 전문적으로 보여도 반드시 사람이 직접 사실 확인을 해야 한다는 점을 보여준다."
      ]
    },
    {
      number: 9,
      topic: "AI 주행 보조 사고와 기업 책임",
      type: "choice",
      background: [
        "2019년 미국 플로리다에서 한 전기차의 AI 주행 보조 기능을 켠 차량이 정지 신호를 지나쳐 사고를 냈고, 한 명이 사망하고 한 명이 크게 다쳤다. 운전자는 휴대전화를 줍느라 전방을 제대로 보지 못했다고 했지만, 피해자 측은 제조사도 주행 보조 기능의 한계와 위험성을 충분히 알리지 않았다고 주장했다."
      ],
      prompt: "2026년 2월, 미국 법원은 이 사고에 대해 “운전자 부주의만의 문제가 아니라 자동차 제조사에도 일부 책임이 있다”고 판단했다.",
      options: [
        { id: "O", marker: "O", text: "맞다" },
        { id: "X", marker: "X", text: "아니다" }
      ],
      answer: "O",
      explanation: [
        "법원은 이 사고를 운전자 부주의만의 문제로 보지 않았다. 주행 보조 기능의 이름과 홍보 방식이 운전자가 기술을 과신하게 만들 수 있고, 제조사가 완전하지 않은 AI 주행 보조 기능의 한계를 충분히 알렸는지도 문제가 되었다.",
        "따라서 AI가 관련된 사고에서는 사용자의 책임뿐 아니라, 기술을 만든 기업의 설명 책임과 안전 책임도 함께 따져야 한다."
      ]
    },
    {
      number: 10,
      topic: "생성형 AI의 물 소비와 환경 비용",
      type: "choice",
      background: [
        "우리가 ChatGPT 같은 생성형 AI와 대화할 때, 보이지 않는 곳에서는 대규모 데이터 센터가 작동한다. AI 서버는 많은 전기를 사용하고 열을 내기 때문에, 이를 식히기 위한 냉각수도 필요하다. 일부 연구에서는 ChatGPT와 짧은 대화를 나누는 과정에서도 상당한 양의 물이 소비될 수 있다고 추정했다."
      ],
      prompt: "ChatGPT와 약 10~50문장 정도의 간단한 대화를 나눌 때 소비될 수 있는 물의 양은 대략 어느 정도일까?",
      options: [
        { id: "1", marker: "①", text: "한두 방울, 약 1ml" },
        { id: "2", marker: "②", text: "종이컵 반 컵, 약 50ml" },
        { id: "3", marker: "③", text: "생수 한 병, 약 500ml" },
        { id: "4", marker: "④", text: "대형 양동이 한 가득, 약 10L" }
      ],
      answer: "3",
      explanation: [
        "생성형 AI는 답변을 만들기 위해 많은 서버와 전기를 사용하고, 서버에서 발생한 열을 식히기 위해 물이 필요하다. 문제는 단순히 물을 쓴다는 점이 아니라, 데이터 센터가 늘어날수록 전력 사용, 탄소 배출, 지역 수자원 부담이 함께 커질 수 있다는 것이다.",
        "따라서 AI를 편리하게 사용하는 만큼, 그 뒤에 있는 환경 비용도 생각해야 한다."
      ]
    },
    {
      number: 11,
      topic: "AI 스마트 글래스 부정행위와 윤리 책임",
      type: "choice",
      background: [
        "최근 국내 토익 시험장에서 일반 안경처럼 보이는 AI 스마트 글래스를 이용한 부정행위가 적발되었다. 피의자는 안경의 초소형 카메라로 시험지를 촬영해 외부로 보내고, 공범은 정답을 풀어 초소형 이어폰으로 전달했다.",
        "이 사건은 AI와 웨어러블 기술이 악용될 경우 시험의 공정성과 사회적 신뢰가 쉽게 무너질 수 있음을 보여 준다."
      ],
      prompt: "AI 글래스 부정행위 사건을 AI 기술 윤리 관점에서 볼 때, 가장 핵심적인 시사점은 무엇일까?",
      options: [
        { id: "1", marker: "①", text: "범죄 가능성이 있는 모든 웨어러블 기기의 생산을 중단해야 한다." },
        { id: "2", marker: "②", text: "기술은 중립적이므로 개인의 처벌보다 기술 결함 보완이 우선이다." },
        { id: "3", marker: "③", text: "AI 기술이 발전할수록 인간의 윤리적 책임 의식이 없으면 사회적 신뢰가 무너질 수 있다." },
        { id: "4", marker: "④", text: "시험 공정성을 위해 모든 시험을 지필 방식으로만 바꾸어야 한다." },
        { id: "5", marker: "⑤", text: "AI를 활용한 부정행위도 개인의 능력으로 인정해야 한다." }
      ],
      answer: "3",
      explanation: [
        "AI와 스마트 기기는 편리한 도구이지만, 사용자의 도덕성이 부족하면 공정성과 신뢰를 해치는 수단이 될 수 있다. 따라서 기술 발전과 함께 윤리적 책임 의식과 사회적 가이드라인을 갖추는 것이 중요하다."
      ]
    },
    {
      number: 12,
      topic: "AI 글래스와 공개 데이터 연결로 인한 개인정보 침해",
      type: "choice",
      background: [
        "미국 하버드대 학생들은 일반 안경처럼 보이는 AI 글래스를 이용해, 사람의 얼굴을 인식하고 인터넷에 공개된 정보를 연결하는 실험을 했다. 이 실험에서는 SNS, 뉴스, 검색 결과 등에 흩어진 공개 정보가 AI를 통해 빠르게 연결되면, 모르는 사람의 이름이나 연락처 같은 개인정보까지 추정될 수 있음을 보여 주었다."
      ],
      prompt: "AI 글래스가 사람의 얼굴만 보고 개인정보를 찾아낼 수 있었던 핵심 이유는 무엇일까?",
      options: [
        { id: "1", marker: "①", text: "AI가 행인의 뇌파를 읽어 기억을 분석했기 때문에" },
        { id: "2", marker: "②", text: "국가 비밀 안면인식 데이터베이스가 해킹되었기 때문에" },
        { id: "3", marker: "③", text: "인터넷에 흩어진 공개 데이터를 AI가 빠르게 연결·분석할 수 있었기 때문에" },
        { id: "4", marker: "④", text: "AI 렌즈가 행인의 신분증을 투시해 촬영했기 때문에" }
      ],
      answer: "3",
      explanation: [
        "AI는 얼굴이라는 단서를 바탕으로 SNS, 뉴스, 검색 결과 등 공개된 데이터를 빠르게 연결할 수 있다. 문제는 우리가 따로따로 올린 정보들이 AI를 만나면 한 사람을 추적하는 도구가 될 수 있다는 점이다.",
        "이는 개인정보 보호와 사생활 침해 문제로 이어질 수 있다."
      ]
    },
    {
      number: 13,
      topic: "생성형 AI 데이터 센터와 기후 윤리",
      type: "choice",
      background: [
        "ChatGPT 같은 생성형 AI와 대화할 때, 화면 뒤에서는 대규모 데이터 센터가 작동한다. AI 서버는 많은 전기를 사용하고 열을 내기 때문에, 이를 식히기 위한 냉각수도 필요하다. 일부 연구에서는 짧은 대화에도 약 500ml의 물이 소비될 수 있다고 추정한다."
      ],
      prompt: "다음 중 생성형 AI 사용이 기후 윤리 문제로 이어지는 이유로 가장 타당하지 않은 것은?",
      options: [
        { id: "1", marker: "①", text: "데이터 센터가 많은 전기를 사용해 온실가스 배출을 늘릴 수 있기 때문에" },
        { id: "2", marker: "②", text: "데이터 센터가 지역의 하천과 지하수에 부담을 줄 수 있기 때문에" },
        { id: "3", marker: "③", text: "서버 냉각 후 배출되는 열이 주변 생태계에 영향을 줄 수 있기 때문에" },
        { id: "4", marker: "④", text: "AI가 냉각수를 많이 써서 전 세계 마트의 생수 가격이 폭등하기 때문에" }
      ],
      answer: "4",
      explanation: [
        "데이터 센터가 사용하는 물은 마트에서 파는 생수를 사서 쓰는 것이 아니라, 주로 지역의 물 자원을 이용한다. 그래서 핵심 문제는 생수 가격 상승이 아니라, 데이터 센터가 있는 지역의 수자원 부족, 전력 사용, 탄소 배출, 생태계 부담이 커질 수 있다는 점이다."
      ]
    },
    {
      number: 14,
      topic: "악의적 딥페이크 영상과 명예훼손",
      type: "choice",
      background: [
        "딥페이크 기술은 타인의 얼굴이나 목소리를 이용해 실제로 하지 않은 말과 행동을 한 것처럼 보이게 만들 수 있다. 이런 가짜 영상은 피해자의 사회적 평가와 명예를 크게 해칠 수 있어 법적·윤리적 문제가 된다."
      ],
      prompt: "성폭력처벌법 같은 특별법을 제외하고, 대한민국 형법만으로 악의적인 딥페이크 영상 제작 행위를 처벌하려 할 때 가장 성립하기 쉬운 죄는 무엇일까?",
      options: [
        { id: "1", marker: "①", text: "위조지폐 제작과 동일하게 처벌하는 통화위조죄" },
        { id: "2", marker: "②", text: "컴퓨터 파일(전자기록)을 위조한 것이므로 당연히 성립하는 공·사문서위조죄" },
        { id: "3", marker: "③", text: "타인의 사회적 명예를 훼손할 만한 가짜 영상을 만들었으므로 성립하는 명예훼손죄" },
        { id: "4", marker: "④", text: "가짜 영상이라는 무형의 결과물을 만들어 냈으므로 성립하는 절도죄" }
      ],
      answer: "3",
      explanation: [
        "딥페이크 영상은 타인이 하지 않은 말이나 행동을 한 것처럼 보이게 만들어 사회적 명예를 떨어뜨릴 수 있다. 따라서 형법상 허위사실을 바탕으로 한 명예훼손 문제가 될 수 있다.",
        "반면 단순히 컴퓨터 파일을 조작했다는 이유만으로 문서위조죄가 바로 성립하는 것은 아니다."
      ]
    },
    {
      number: 15,
      topic: "모델 붕괴와 소외 계층의 디지털 배제",
      type: "choice",
      background: [
        "생성형 AI가 많아지면서 인터넷에는 AI가 만든 글과 이미지가 점점 늘어나고 있다. AI가 이런 데이터를 다시 학습하면, 다양하고 희귀한 정보보다 자주 반복되는 주류 정보만 더 강하게 남을 수 있다. 이를 모델 붕괴라고 한다."
      ],
      prompt: "AI가 반복되는 주류 데이터만 학습하고, 소수 집단의 기록을 중요하지 않은 정보로 밀어낸다면 가장 큰 윤리적 문제는 무엇일까?",
      options: [
        { id: "1", marker: "①", text: "디지털 저작권 침해" },
        { id: "2", marker: "②", text: "글로벌 통신망 마비" },
        { id: "3", marker: "③", text: "소외 계층의 디지털 배제" },
        { id: "4", marker: "④", text: "인공지능의 자아 형성" }
      ],
      answer: "3",
      explanation: [
        "모델 붕괴가 일어나면 AI는 세상을 주류 데이터 중심으로만 이해하게 된다. 그 결과 소수 문화, 희귀 질환, 사회적 약자의 경험이 AI 시스템에서 잘 보이지 않게 되고, 복지·의료·법률 같은 중요한 영역에서 소외 계층이 배제될 수 있다."
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
    saveCustomQuestionRecords(validRecords);

    const normalized = validRecords
      .map(normalizeCustomQuestion)
      .filter(Boolean)
      .map((question, index) => ({ ...question, number: baseQuestionCount + index + 1 }));
    questions.splice(baseQuestionCount, questions.length - baseQuestionCount, ...normalized);
    window.KitEthicsQuizQuestions = questions;
    window.dispatchEvent(new CustomEvent("kit-ethics-questions-updated", {
      detail: { count: questions.length }
    }));
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

    return {
      number: baseQuestionCount + index + 1,
      custom: true,
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

  const customQuestions = loadCustomQuestionRecords()
    .map(normalizeCustomQuestion)
    .filter(Boolean)
    .map((question, index) => ({ ...question, number: baseQuestionCount + index + 1 }));
  questions.push(...customQuestions);

  questions.forEach((question) => {
    if (!question.sourceImage && !question.custom) {
      question.sourceImage = `assets/ethics-quiz-images/q${String(question.number).padStart(2, "0")}.png`;
    }
  });
  window.KitEthicsQuizQuestions = questions;
  refreshCustomQuestionsFromServer();

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
