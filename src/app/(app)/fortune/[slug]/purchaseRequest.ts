import type { BirthInfo } from "@/lib/tarot/birthInfo";
import type { SajuMode } from "@/lib/saju/generate/chart";

/** 구매 화면이 모아 주는 값 한 덩어리. **결제 실행은 이 파일에도, 이 화면에도 없다** —
 *  결제 경로는 `src/lib/saju/purchase.ts` 쪽에서 이어 붙이고(그 파일 끝 「결제 확정 경로」 절),
 *  여기 있는 것은 그때 넘겨줄 **인자의 모양**뿐이다.
 *
 *  왜 지금 타입만 두는가: 화면이 "무엇을 모으는지"가 정해져 있어야 결제 쪽이 그 모양에 맞춰
 *  붙일 수 있고, 반대로 화면은 결제가 붙기 전에도 타입체커에게 검사받을 수 있다. 모양 없이
 *  버튼만 비워 두면 나중에 붙이는 쪽이 화면을 다시 읽어야 한다. */
export type FortunePurchaseRequest = {
  /** 상품 식별자. 결제 식별자(`sajureport-{slug}-{mode}`)는 서버가 만든다 —
   *  `sajuProductId()` 가 있는 곳이 purchase.ts 이고, 클라이언트가 만들어 보내면 안 된다. */
  slug: string;
  mode: SajuMode;
  /** 구매자 본인. 이 화면에서 편집하지 않는다 — 등록된 프로필(`/api/user/me` 의 `birthInfo`)을
   *  그대로 싣는다. 서버는 이 값을 **믿지 말고** 자기가 읽은 프로필로 다시 검증해야 한다
   *  (설계 §10 "API 를 직접 두드리면 화면 검사는 우회된다"). 여기 싣는 이유는 **구매 시점
   *  스냅샷**(§7 `birthSnapshot`)이 화면이 계산에 쓴 값과 같아야 하기 때문이다. */
  birthInfo: BirthInfo;
  /** `needsPartner: true` 상품(19개 중 10개)만 값이 있다. 나머지는 null.
   *
   *  ⚠️ **저장 계층에 아직 자리가 없다**(2026-09-26). `SajuReading` 은 `birthSnapshot` 한 벌만
   *  들고 있어서(storage.ts), 궁합 상품의 상대 명반을 어디에 얼려 둘지가 정해져 있지 않다.
   *  결제를 붙이기 전에 그 자리를 먼저 만들어야 한다. */
  partner: FortunePartnerInput | null;
  /** 「적어주신 내용」 textarea. 목업이 이 칸을 필수(`*`)로 표시한다. */
  userInput: string;
  /** 필수 동의 기록. **불리언 두 개가 아닌 이유가 있다.**
   *
   *  대법원 2018다287034(2023.6.15)은 청약철회 제한을 주장하려면 사업자가 "제한사유가 있었다"와
   *  "표시의무를 이행했다"를 **증명**해야 한다고 했다. 그러려면 체크했다는 사실만이 아니라
   *  **언제** 체크했고 **그때 무슨 문구를 보여줬는지**가 남아야 한다. */
  consent: PurchaseConsent;
};

export type ConsentKey = "terms" | "refundLimit";

export type PurchaseConsent = {
  /** 청약철회 제한 동의. **모양을 서버에 맞춰 둔다** — `src/lib/saju/purchase.ts` 의
   *  `validatePurchaseConsent(input, now)` 가 받는 `PurchaseConsentInput` 의 `refund` 필드
   *  그대로다. `noticeVersion` 은 그쪽 `REFUND_NOTICE_VERSION` 에서 온 값이고, 서버가 **자기
   *  상수와 대조**한다 — 화면이 보낸 값을 그대로 믿으면 "그때 본 문구"를 클라이언트가 정하는
   *  셈이 된다. */
  refund: { agreed: boolean; noticeVersion: string };
  /** 이용약관·개인정보 처리 동의.
   *
   *  `termsVersion` 은 **화면이 실제로 보여준 약관의 시행일**(`TERMS_EFFECTIVE_DATE`)이다.
   *  안 보내면 서버가 "지금 시행 중인 약관"을 찍게 되는데, 그러면 **캐시된 옛 약관을 보고
   *  결제한 사람의 기록만 최신이 된다** — 동의 기록을 남기는 이유가 "그때 무엇을 보여줬는지"를
   *  대는 것이라, 그 경우 목적이 반만 달성된다. `refund.noticeVersion` 과 같은 이유·같은 방식
   *  이고, 서버가 자기 값과 대조한다. */
  terms: { agreed: boolean; termsVersion: string };
  /** 각 칸을 체크한 시각(ISO). 체크 안 했으면 null.
   *
   *  ⚠️ **증거가 아니다.** 클라이언트 시계는 틀릴 수도 고쳐질 수도 있어서, 보존할 시각은 서버가
   *  다시 찍는다(`RefundConsentRecord.consentedAt`). 이 값은 "두 칸을 어떤 순서·간격으로
   *  눌렀나" 정도의 참고값이다. */
  checkedAt: Record<ConsentKey, string | null>;
};

/** 상대방 정보. 닉네임은 호칭이라 명반 계산에는 안 쓰이지만 본문이 상대를 부를 때 쓴다. */
export type FortunePartnerInput = {
  nickname: string;
  birthInfo: BirthInfo;
};
