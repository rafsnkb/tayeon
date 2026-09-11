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
