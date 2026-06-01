# Vercel 배포 방법

이 프로젝트는 Vercel에 그대로 올리면 정적 페이지와 `/api/chat` 서버리스 함수가 함께 배포됩니다.

## 1. GitHub에 업로드

프로젝트 폴더 전체를 GitHub 저장소에 올립니다.

## 2. Vercel에서 프로젝트 연결

Vercel에서 `New Project`를 눌러 GitHub 저장소를 연결합니다.
별도 빌드 명령은 필요 없습니다.

## 3. 환경 변수 추가

Vercel 프로젝트의 `Settings` -> `Environment Variables`에서 아래 값을 추가합니다.

키를 1개만 쓸 때:

```text
GEMINI_API_KEY=본인 Gemini API 키
GEMINI_MODEL=gemini-2.5-flash
```

3팀이 나눠 쓸 때는 키 3개를 한 변수에 넣는 것을 추천합니다.

```text
GEMINI_API_KEYS=키1,키2,키3
GEMINI_MODEL=gemini-2.5-flash
```

`GEMINI_API_KEYS`는 쉼표, 세미콜론, 줄바꿈으로 구분해도 됩니다. 서버가 요청마다 키를 무작위 시작점으로 돌려 쓰고, 한 키가 제한이나 혼잡 오류를 내면 다른 키로 다시 시도합니다.

## 4. 재배포

환경 변수를 추가하거나 바꾼 뒤에는 Vercel의 `Deployments`에서 최신 배포를 `Redeploy`하세요.

## 5. 확인

배포된 주소에서 상단 `AI 연결` 상태가 아래처럼 보이면 키가 서버에 잡힌 상태입니다.

```text
Gemini 준비됨 (gemini-2.5-flash, 키 3개)
```

채팅을 보낸 뒤 브라우저 개발자도구 `Network` -> `chat` -> `Response`에 아래 값이 보이면 성공입니다.

```json
{
  "source": "gemini",
  "keyCount": 3
}
```

## 보안 주의

무료 API 키여도 공개 웹 코드에 넣으면 안 됩니다. 유출되면 쿼터가 소진되거나 키가 정지될 수 있고, 나중에 결제를 연결하면 비용 문제가 생길 수 있습니다.

Gemini API 키는 브라우저 코드에 넣지 말고 Vercel 환경 변수에만 저장하세요.
