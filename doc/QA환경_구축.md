# QA 환경 구축 절차

> 2026-09-21 작성. `qa` 브랜치 + 별도 Firebase 프로젝트 + 카카오 이메일 allowlist 구조로 확정.

## 왜 이 구조인가

- **별도 Firebase 프로젝트**: QA 가입·리딩·결제 기록이 프로덕션 Firestore에 섞이면 어드민 통계와
  비용 분석이 오염되고, QA에서 실수로 지운 데이터가 진짜 사용자 데이터가 된다.
- **카카오 이메일 allowlist**: 어드민의 `ADMIN_UIDS`와 같은 패턴. 사람이 보고 관리하기 쉬워
  테스터를 추가·제거하기 편하다. UID 방식은 테스터가 한 번 로그인해 UID를 알아내야 해서 번거롭다.
- **기본 hosted.app URL**: DNS·TLS 대기 없이 바로 쓸 수 있다. 필요해지면 나중에 커스텀 도메인
  연결 가능.

## 코드에 이미 반영된 것 (커밋 `3991861`)

- `src/lib/auth/loginAllowlist.ts` — `APP_ENV === "qa"`일 때만 동작. **허용 목록이 비어 있으면
  전원 거부**(fail-closed). 환경 플래그와 목록을 분리한 이유는, 목록 유무로만 판단하면 QA에
  변수를 넣는 걸 잊었을 때 조용히 무제한 개방되기 때문.
- `src/app/api/auth/kakao/callback/route.ts` — 사용자 문서를 만들기 **전에** 차단해서 거부된
  계정의 흔적이 남지 않게 한다. 거부 시 `/login?error=not_allowed`.
- `src/app/login/page.tsx` — `not_allowed`는 "다시 시도해주세요" 대신 접근 불가 안내.
- `src/app/robots.ts` — QA만 크롤링 차단(프로덕션과 거의 동일한 중복 콘텐츠가 색인되지 않도록).

## 남은 설정 (수동)

### 1. Firebase 프로젝트 생성
- 콘솔에서 새 프로젝트 생성(예: `tayeon-qa`). **Blaze 요금제** 필요(App Hosting·Functions).
- Firestore 생성 — 리전은 프로덕션과 같게(`asia-east1` 계열) 맞추는 편이 동작 차이가 없다.
- Authentication 활성화(커스텀 토큰만 쓰므로 공급자 설정은 불필요).
- 웹 앱 등록 후 `firebaseConfig` 값 6개를 확보 → `qa` 브랜치 `apphosting.yaml`의
  `<QA_...>` 자리표시자 교체.

### 2. Firestore 규칙·인덱스·TTL
```bash
firebase deploy --only firestore:rules,firestore:indexes --project <QA_PROJECT_ID>
```
TTL은 배포 대상이 아니라 별도 설정이다. 프로덕션과 동일하게 6개를 켠다.
```bash
for spec in "expiresAt signupGrants" "expiresAt friends" "retainUntil paymentArchive" \
            "expiresAt supportInquiries" "expiresAt refundRequests" "expiresAt rateLimits"; do
  set -- $spec
  gcloud firestore fields ttls update "$1" --collection-group="$2" --enable-ttl \
    --project=<QA_PROJECT_ID> --database="(default)"
done
```

### 3. App Hosting 백엔드
- QA 프로젝트에 백엔드 생성, GitHub `rafsnkb/tayeon` 연결, **라이브 브랜치를 `qa`로 지정**.
- 생성 후 받은 URL을 `NEXT_PUBLIC_KAKAO_REDIRECT_URI`에 반영.

### 4. 시크릿 등록 (QA 프로젝트에서 따로)
프로덕션과 프로젝트가 달라 Secret Manager가 공유되지 않는다.
```bash
firebase apphosting:secrets:set KAKAO_CLIENT_SECRET   --force --project <QA_PROJECT_ID>
firebase apphosting:secrets:set ANTHROPIC_API_KEY     --force --project <QA_PROJECT_ID>
firebase apphosting:secrets:set PORTONE_API_SECRET    --force --project <QA_PROJECT_ID>
firebase apphosting:secrets:set PORTONE_WEBHOOK_SECRET --force --project <QA_PROJECT_ID>
firebase apphosting:secrets:set RESEND_API_KEY        --force --project <QA_PROJECT_ID>
```
`PORTONE_WEBHOOK_SECRET`은 **테스트 모드 웹훅 시크릿**을 넣는다(QA는 테스트 채널 사용).

### 5. 카카오 콘솔
- 기존 앱에 QA Redirect URI 추가(앱을 새로 만들 필요 없음 — REST API 키는 그대로 공유).

### 6. 포트원
- 채널은 새로 만들지 않고 기존 **테스트 채널**(`타연_이니시스_테스트`, MID `INIpayTest`)을 쓴다.
- 웹훅 URL은 프로덕션 하나만 등록 가능하다면, QA 결제의 지급 검증은 `/api/payment/complete`
  콜백에만 의존하게 된다. 웹훅까지 QA로 검증하려면 포트원 테스트 모드 웹훅 URL을 QA 주소로
  바꿔야 하는데, 그러면 프로덕션 테스트 결제 알림이 QA로 간다 — 필요할 때만 일시적으로 바꿀 것.

## 운영 규칙

- **브랜치 흐름**: `main`(개발) → `qa`(검증) → `live`(프로덕션). `qa`는 `main`에서 머지해 만든다.
- **`apphosting.yaml` 충돌 주의**: 세 브랜치가 각자 다른 값을 들고 있다. `main`을 `qa`나 `live`에
  머지할 때 이 파일이 덮어써지지 않도록, 충돌 시 항상 대상 브랜치 쪽(ours)을 유지한다.
- **테스터 추가**: `qa` 브랜치 `apphosting.yaml`의 `LOGIN_ALLOWED_EMAILS`에 카카오 계정 이메일을
  쉼표로 덧붙이고 재배포. 목록을 비우면 아무도 못 들어간다.
- QA에서는 실제 카드가 승인되지 않는다(테스트 채널). 다만 **간편결제는 테스트 MID여도 간편결제사
  쪽에서 실결제가 처리**되므로, QA에서도 카드로만 테스트할 것.
