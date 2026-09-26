# API 키 관리 메모

> 최종 업데이트: 2026-09-08

---

## Anthropic API 키 (Claude Haiku 4.5, 타로 해석용)

- 발급처: https://console.anthropic.com → API Keys → Create Key
- 저장 위치: `.env.local`의 `ANTHROPIC_API_KEY` (커밋 안 됨, `.gitignore`에 `.env*` 처리되어 있음)
- 개발 서버는 시작 시에만 `.env.local`을 읽으므로, 키 추가/변경 후 `npm run dev` 재시작 필요

### ID 페더레이션 vs API 키
- 콘솔에서 키 생성 시 "ID 페더레이션"(Workload Identity Federation) 안내 팝업이 뜨는데, 이는 GCP/AWS/Azure/GitHub Actions 같은 클라우드 인프라가 요청을 인증해 단기 토큰을 자동 발급하는 방식
- **로컬 개발 단계에서는 해당 없음** → "API 키로 계속하기" 선택해서 일반 장기 키 발급
- 추후 실제 서비스가 GCP(Firebase App Hosting 등) 위에서 돌아가게 되면, 그 시점에 ID 페더레이션 전환 검토 가능 (고정 키 관리 부담을 줄일 수 있음) — 확정 아님, 재검토 필요 항목

### 사주·자미두수 서비스도 같은 키를 쓴다 (2026-09-26 결정)

사주 서비스는 텍스트 생성에 **Claude Sonnet 5**(`claude-sonnet-5`)를 쓰지만 **키를 새로 발급하지
않는다.** 키는 계정 단위고 모델은 요청 파라미터라, 같은 `ANTHROPIC_API_KEY` 로 타로(Haiku)와
사주(Sonnet)를 모두 호출한다.

콘솔에서 Workspace 를 따로 만들면 원가가 분리 집계되고 워크스페이스별 spend limit 도 걸 수
있어서 검토했지만, **사주는 타연 안에 있는 서비스**이므로 나누지 않기로 했다(`doc/사주_구현설계.md`
§1 — 코드도 타연 안 `src/app/(saju)` 라우트 그룹이고 로그인·결제 인프라를 재사용한다).
비용 분리가 필요해지면 그때 Workspace 를 만들면 되고, 코드는 env 변수 하나만 갈아끼우면 된다.
