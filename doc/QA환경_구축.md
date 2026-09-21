# QA 환경 구축 절차

> 2026-09-21 확정. `qa` 브랜치 + 프로덕션과 같은 Firebase 프로젝트 + 카카오 이메일 allowlist.

## 환경 구성

| 환경 | 결제 | 접근 | 배포 |
|---|---|---|---|
| 로컬 / `main` | 테스트 채널(`INIpayTest`) — 실제 승인 없음 | 제한 없음 | 없음 |
| **QA** (`qa`) | **실연동 채널 — 실제 카드 승인** | 허용된 카카오 계정만 | App Hosting 백엔드 |
| 라이브 (`live`) | 실연동 채널 | 전체 공개 | `tayeon` 백엔드 |

## 왜 QA가 "배포"여야 하는가

로컬에서 되는데 배포에서만 깨지는 경우가 실제로 반복해서 나왔다. QA가 로컬이면 이걸 못 잡는다.

- **빌드 타임 인라인**: `NEXT_PUBLIC_*`는 빌드 시점에 번들에 박힌다. `apphosting.yaml`에 없으면
  프로덕션에서만 `undefined`가 된다 — 2026-09-21 결제창이 안 열린 원인이 정확히 이것이었고,
  `tsc`·`eslint`·유닛테스트는 전부 통과했다.
- **환경에 따라 다른 코드 경로**: `src/lib/payment/fulfill.ts`의 LIVE 채널 가드는
  `NODE_ENV === "production"`일 때만 동작한다. 즉 지급 로직이 로컬과 배포에서 다르다.
- **인증 방식 차이**: 로컬은 gcloud ADC, 배포는 서비스 계정. ADC 만료·quota project 미설정으로
  인한 500은 로컬에서만 나고, 반대 방향의 문제도 생긴다.
- **웹훅은 로컬에 오지 않는다**: 포트원 웹훅 URL이 배포 주소로 고정이라 로컬에서는 검증 불가.
- **콜드스타트·타임아웃**: 2026-09-19 프로덕션 500(재시도 루프가 인프라 타임아웃에 걸린 건)처럼
  배포 환경에서만 재현되는 종류가 있다.

## 코드에 이미 반영된 것 (커밋 `3991861`)

- `src/lib/auth/loginAllowlist.ts` — `APP_ENV === "qa"`일 때만 동작. **허용 목록이 비어 있으면
  전원 거부**(fail-closed). 환경 플래그와 목록을 분리한 이유는, 목록 유무로만 판단하면 QA에
  변수를 넣는 걸 잊었을 때 조용히 무제한 개방되기 때문.
- `src/app/api/auth/kakao/callback/route.ts` — 사용자 문서를 만들기 **전에** 차단해서 거부된
  계정의 흔적이 남지 않게 한다. 거부 시 `/login?error=not_allowed`.
- `src/app/login/page.tsx` — `not_allowed`는 "다시 시도" 대신 접근 불가 안내.
- `src/app/robots.ts` — QA만 크롤링 차단.

## 남은 설정 (수동)

### 1. App Hosting 백엔드 생성
- **프로젝트는 기존 `tayeon-d5149` 그대로.** 콘솔에서 백엔드만 하나 더 만든다(예: `tayeon-qa`).
- GitHub `rafsnkb/tayeon` 연결, **라이브 브랜치를 `qa`로 지정**
  (⚠️ `main`으로 잘못 지정하면 개발 중인 커밋이 바로 배포된다).
- Firestore·Auth·Secret Manager는 프로덕션과 공유하므로 **추가 설정이 없다.**

### 2. 카카오 콘솔
- 기존 앱에 QA Redirect URI 추가: `<백엔드URL>/api/auth/kakao/callback`
  (앱을 새로 만들 필요 없음 — REST API 키 공유)

### 3. `qa` 브랜치 `apphosting.yaml` 마무리
- `NEXT_PUBLIC_KAKAO_REDIRECT_URI`의 `<QA_BACKEND_URL>`을 실제 백엔드 URL로 교체 후 롤아웃.

## 운영 규칙

- **브랜치 흐름**: `main`(개발) → `qa`(실결제 검증) → `live`(프로덕션).
- **`apphosting.yaml` 충돌 주의**: 세 브랜치가 각자 다른 값을 들고 있다. `main`을 `qa`/`live`에
  머지할 때 덮어써지지 않도록, 충돌 시 항상 대상 브랜치 쪽(ours)을 유지한다.
- **테스터 추가**: `qa` 브랜치의 `LOGIN_ALLOWED_EMAILS`에 **카카오 계정 이메일**을 쉼표로 덧붙이고
  재배포. 목록을 비우면 아무도 못 들어간다.
- **QA 결제는 실제 돈이 나간다.** Firestore를 프로덕션과 공유하므로 어드민 매출·비용 분석에
  그대로 잡힌다. 테스트할 때마다 결제 내역에서 **환불까지 해야** 통계가 깨끗하다.
- **간편결제는 쓰지 말 것.** 테스트 MID에서도 간편결제사 쪽은 실결제가 처리되는 함정이 있어,
  결제 검증은 카드로만 한다.

## 나중에 분리해야 하는 시점

지금은 실사용자가 거의 없어 공유해도 잃을 게 없지만, **QA는 정의상 검증 안 된 코드를 돌리는
곳이고 그 코드가 실데이터에 직접 쓴다.** 계정 삭제(`recursiveDelete`), 이용권 회수 트랜잭션,
백필 스크립트 같은 파괴적 경로에서 버그가 나면 실제 사용자 데이터가 사라진다.

**실사용자가 쌓이기 시작하면 별도 Firebase 프로젝트로 분리할 것.** 코드는 이미 `APP_ENV`로
분기되어 있어 바꿀 것은 `apphosting.yaml` 값들과 아래 항목뿐이다.

- 새 프로젝트 생성(Blaze), Firestore 생성, `firebase deploy --only firestore:rules,firestore:indexes`
- TTL 6개 활성화: `signupGrants`/`friends`/`paymentArchive`/`supportInquiries`/`refundRequests`/`rateLimits`
- 시크릿 5개 재등록(`KAKAO_CLIENT_SECRET`, `ANTHROPIC_API_KEY`, `PORTONE_API_SECRET`,
  `PORTONE_WEBHOOK_SECRET`, `RESEND_API_KEY`)
- 카카오 Redirect URI는 그대로 재사용
