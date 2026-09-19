export type ComboKey = "tarot" | "tarot-saju" | "tarot-ziwei" | "tarot-saju-ziwei";

// 시간제 무제한 상품(구매 시간 내 이용 무제한). 조합 4종 × 시간 3종 = 12개 SKU.
// admin/은 타연 본체와 완전히 분리된 별도 앱(별도 App Hosting backend, Turbopack 빌드 루트도
// admin/ 하나로 고정돼 있어 리포 루트를 걸치는 공유 모듈을 쓸 수 없음 — 실제로 리포 루트
// shared/를 시도했다가 `next build`의 Turbopack이 Module not found로 실패한 적 있음, 2026-09-19)
// 라 src/lib/tarot/pricing.ts의 TIME_PASS_PACKAGES를 이 파일에 그대로 복제해서 쓴다.
// 본체 값이 바뀌면 이 파일도 반드시 같이 고칠 것(id·priceWon·minutes·combo 전부 동일해야 함).
export const TIME_PASS_PACKAGES = [
  { id: "timepass-tarot-15", combo: "tarot", priceWon: 8900, minutes: 15 },
  { id: "timepass-tarot-30", combo: "tarot", priceWon: 12900, minutes: 30 },
  { id: "timepass-tarot-60", combo: "tarot", priceWon: 19900, minutes: 60 },
  { id: "timepass-saju-15", combo: "tarot-saju", priceWon: 12900, minutes: 15 },
  { id: "timepass-saju-30", combo: "tarot-saju", priceWon: 19900, minutes: 30 },
  { id: "timepass-saju-60", combo: "tarot-saju", priceWon: 24900, minutes: 60 },
  { id: "timepass-ziwei-15", combo: "tarot-ziwei", priceWon: 19900, minutes: 15 },
  { id: "timepass-ziwei-30", combo: "tarot-ziwei", priceWon: 24900, minutes: 30 },
  { id: "timepass-ziwei-60", combo: "tarot-ziwei", priceWon: 39900, minutes: 60 },
  { id: "timepass-all-15", combo: "tarot-saju-ziwei", priceWon: 24900, minutes: 15 },
  { id: "timepass-all-30", combo: "tarot-saju-ziwei", priceWon: 39900, minutes: 30 },
  { id: "timepass-all-60", combo: "tarot-saju-ziwei", priceWon: 65900, minutes: 60 },
] as const satisfies readonly { id: string; combo: ComboKey; priceWon: number; minutes: number }[];
