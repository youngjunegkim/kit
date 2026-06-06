# Vercel 배포 방법

이 프로젝트는 Vercel에 그대로 올리면 정적 페이지와 `/api/chat` 서버리스 함수가 함께 배포됩니다.

## 1. GitHub에 업로드

프로젝트 폴더 전체를 GitHub 저장소에 올립니다.

## 2. Vercel에서 프로젝트 연결

Vercel에서 `New Project`를 눌러 GitHub 저장소를 연결합니다.
별도 빌드 명령은 필요 없습니다.

## 3. 환경 변수 추가

Vercel 프로젝트의 `Settings` -> `Environment Variables`에서 아래 값을 추가합니다.

API 키는 Production/Preview 환경에서 `Sensitive` 옵션을 켜고 저장하세요.

키를 1개만 쓸 때:

```text
GEMINI_API_KEY=본인 Gemini API 키
GEMINI_MODEL=gemini-2.5-flash
```

3팀이 나눠 쓸 때는 키 3개를 한 변수에 넣는 것을 추천합니다.

```text
GEMINI_API_KEYS=키1,키2,키3
GEMINI_MODEL=gemini-2.5-flash
CLASS_ACCESS_CODE=수업용입장코드
```

`GEMINI_API_KEYS`는 쉼표, 세미콜론, 줄바꿈으로 구분해도 됩니다. 서버가 요청마다 키를 무작위 시작점으로 돌려 쓰고, 한 키가 제한이나 혼잡 오류를 내면 다른 키로 다시 시도합니다.

`CLASS_ACCESS_CODE`를 넣으면 학생이 처음 질문할 때 입장 코드를 입력해야 합니다. 코드가 틀리면 Gemini API를 호출하지 않습니다.

질문권과 학생별 질문 로그를 선생님/학생 노트북 사이에서 공유하려면 Upstash Redis 환경 변수도 추가하세요.
선생님은 `질문권 주기`, 학생은 `질문권 받기`, 선생님 로그는 `현황 새로고침`을 눌렀을 때만 서버에 요청하므로 계속 자동 동기화하지 않습니다.

```text
UPSTASH_REDIS_REST_URL=Upstash Redis REST URL
UPSTASH_REDIS_REST_TOKEN=Upstash Redis REST Token
KIT_CREDIT_NAMESPACE=kit-class-1
KIT_PRESENCE_TTL_MS=90000
```

`KIT_CREDIT_NAMESPACE`는 선택값입니다. 같은 Redis를 여러 수업에 재사용할 때 반별로 값을 다르게 넣으면 질문권 데이터가 섞이지 않습니다.
이 값을 넣지 않으면 `default` 저장 공간을 씁니다.
`KIT_PRESENCE_TTL_MS`는 접속 중 계정이 마지막 신호 후 몇 ms 동안 온라인으로 보일지 정하는 선택값입니다. 기본값은 90000, 즉 90초입니다.
Upstash 환경 변수가 없으면 질문권, 질문 로그, 접속 중 계정은 서버 메모리에만 임시 저장되므로, Vercel 배포 환경에서는 여러 기기 사이 공유가 안정적으로 유지되지 않습니다.

선택으로 1분당 요청 제한도 바꿀 수 있습니다.

```text
CHAT_RATE_LIMIT_PER_MINUTE=12
CHAT_MAX_MESSAGE_CHARS=500
CHAT_MAX_REQUEST_BYTES=25000
```

## 4. 재배포

환경 변수를 추가하거나 바꾼 뒤에는 Vercel의 `Deployments`에서 최신 배포를 `Redeploy`하세요.

## 5. 확인

배포된 주소에서 상단 `AI 연결` 상태가 아래처럼 보이면 키가 서버에 잡힌 상태입니다.

```text
Gemini 준비됨 (gemini-2.5-flash)
```

채팅을 보낸 뒤 브라우저 개발자도구 `Network` -> `chat` -> `Response`에 아래 값이 보이면 성공입니다.

```json
{
  "source": "gemini"
}
```

## 보안 주의

무료 API 키여도 공개 웹 코드에 넣으면 안 됩니다. 유출되면 쿼터가 소진되거나 키가 정지될 수 있고, 나중에 결제를 연결하면 비용 문제가 생길 수 있습니다.

Gemini API 키는 브라우저 코드에 넣지 말고 Vercel 환경 변수에만 저장하세요.
Google AI Studio 또는 Google Cloud Console에서 Gemini API에만 쓸 수 있게 키 제한을 걸어두세요.
수업 링크를 공개할 때는 `CLASS_ACCESS_CODE`를 함께 설정하는 것을 강하게 권장합니다.
로그인 계정은 아래처럼 준비되어 있습니다.

```text
선생님 1: master / master1
선생님 2: master2 / master2
승우: 승우 / tmddn1
연수: 연수 / dustn1
은혁: 은혁 / dmsgur1
영준: 영준 / dudwns1
혜빈: 혜빈 / gpqls1
윤지: 윤지 / dbswl1
가빈: 가빈 / rkqls1
채희: 채희 / cogml1
```

이 로그인은 수업 화면 분리용입니다. 정적 HTML과 JS는 브라우저에서 볼 수 있으므로, 진짜 비밀 자료를 보호하는 서버 인증으로 보지 마세요.
