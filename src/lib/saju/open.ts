// 결제된 주문을 **리포트로 연다** — 계산 + 1단 골격을 돌리고 리포트 문서를 만든다.
//
// ── 왜 `purchase.ts` 가 아니라 별 파일인가 ────────────────────────────────────
// `purchase.ts` 는 결제 검증 경로(`validatePayment.ts` → `fulfill.ts`)가 import 한다. 그 경로에
// 이 파일의 import 그래프가 끌려 들어오면 안 된다 — 여기서 쓰는 `generate/outline.ts` 가
// `@/lib/anthropic` 을 타고 **모듈 로드 시점에** `new Anthropic()` 을 실행하고, 그 생성자는
// API 키가 없으면 던진다. 즉 키가 빠진 환경에서 라이브 결제 검증이 import 단계에서 죽는다.
// 같은 이유로 `purchase.test.mjs` 도 키 없이 못 돌게 된다. 그래서 무거운 쪽을 이 파일로 갈라 둔다.
// `purchase.ts` 는 순수 계산(가격·게이트·식별자)만 남긴다.
//
// ── 왜 `fulfill` 안에서 하지 않는가 ──────────────────────────────────────────
// 계산 + 골격이 실측 29초다(설계 §2). 결제 확정 웹훅을 29초 잡고 있으면 타임아웃과 재시도가
// 겹쳐 **같은 결제가 두 번 이행될 수 있다.** `fulfill` 은 "주문이 성립했다"까지만 쓰고, 여는 건
// 사용자가 결과 화면에 들어올 때 이 함수가 한다(§6 이 페이지에 쓴 온디맨드와 같은 패턴 —
// 백그라운드 워커·큐 없이 끝난다).
//
// 이 함수는 **명시적인 POST 로만 불린다.** GET 에 붙이면 브라우저 prefetch·크롤러·실수로 연 탭이
// 전부 골격 한 번(섹션 한 장보다 비싸다)을 태운다.
import { calculateChart, whyUnsellable } from "@/lib/saju/generate/chart";
import { generateOutline } from "@/lib/saju/generate/outline";
import { getSajuProduct } from "@/lib/saju/products";
import { openGateReason } from "@/lib/saju/purchase";
import { adminDb } from "@/lib/firebase/admin";
import {
  createSajuReading,
  getSajuOrder,
  newSajuReadingId,
  sajuOrderRef,
  type SajuOrder,
} from "@/lib/saju/storage";

/** 골격 생성 재시도 횟수(§9 "골격 실패 → 자동 재시도 3회 → 실패 시 자동 전액 환불"). */
export const OUTLINE_MAX_ATTEMPTS = 3;

export type OpenSajuResult =
  /** 방금 열었다. */
  | { outcome: "opened"; readingId: string }
  /** 이미 열려 있었다 — 재시도·중복 요청. 같은 리포트를 돌려준다. */
  | { outcome: "already"; readingId: string }
  /** 주문이 없거나 아직 결제 확정 전이다. */
  | { outcome: "not_paid" }
  /**
   * 열 수 없다 — **환불로 보내야 하는 건**이다(§9). 사용자가 아직 아무것도 읽지 않았으므로
   * 전액 환불의 경계 안에 정확히 들어간다. 환불 실행은 결제 계층의 일이라 여기서 하지 않는다.
   */
  | { outcome: "refundable"; reason: string };

/**
 * 결제된 주문 하나를 리포트로 연다. **멱등하다** — 두 번 불러도 리포트는 하나다.
 *
 * 멱등성의 근거는 주문 마커의 `readingId` 다. 계산·골격(29초)을 먼저 돌리고 **마지막 트랜잭션에서
 * 마커를 다시 읽어** 그 사이 다른 요청이 이미 열었는지 본다 — 열려 있으면 방금 만든 골격을 버리고
 * 저장된 리포트를 돌려준다. 페이지 저장과 같은 원칙이다: **사용자가 이미 보고 있는 것을 나중
 * 결과로 덮지 않는다.**
 *
 * 29초를 트랜잭션 안에서 돌리지 않는 이유도 같다 — Firestore 트랜잭션에 그만큼 긴 작업을 넣으면
 * 경합 시 재시도가 그 작업을 통째로 다시 돌린다. 그래서 무거운 일은 밖에서 하고, 트랜잭션은
 * "마커 확인 + 두 문서 쓰기"만 짧게 잡는다.
 */
export async function openSajuReading(uid: string, paymentId: string): Promise<OpenSajuResult> {
  const order = await getSajuOrder(uid, paymentId);
  const gate = openGateReason(order);
  if (!gate.ok) {
    return gate.reason === "already"
      ? { outcome: "already", readingId: gate.readingId }
      : { outcome: "not_paid" };
  }
  // 위 게이트가 통과했으면 주문은 반드시 있다 — 타입만 좁혀 준다.
  if (!order) return { outcome: "not_paid" };

  const product = getSajuProduct(order.productSlug);
  // 주문 마커에 적힌 상품이 지금 코드에 없다 — 상품을 지우고 배포한 뒤에 옛 주문이 들어온 경우다.
  // 만들 수 없으니 환불로 보낸다.
  if (!product) return { outcome: "refundable", reason: `상품 정의가 없습니다: ${order.productSlug}` };

  // 판매 제약을 한 번 더 본다. `prepare` 가 이미 걸렀지만 그건 결제 **전** 검사이고, 여기서
  // 쓰는 스냅샷이 그때 통과한 그 값인지는 여기서 확인해야 한다(§10 "API 를 직접 두드리면 화면
  // 검사는 우회된다"와 같은 이유 — 경로가 아니라 값을 믿는다).
  //
  // **상대방 쪽도 여기서 따로 본다.** `calculateChart` 가 내부에서 같은 검사를 하고 실패하면
  // null 을 주므로 §9 경로로는 제대로 가지만, 그 길로만 가면 운영자 알림에 "명식 계산 실패"만
  // 남고 **왜인지가 안 남는다.** 사유가 없으면 사람이 손으로 뭘 고쳐야 하는지 모른다.
  const unsellable = whyUnsellable(order.birthSnapshot, order.mode);
  if (unsellable) return { outcome: "refundable", reason: unsellable };
  const partnerSnapshot = order.partnerBirthSnapshot;
  if (product.needsPartner) {
    if (!partnerSnapshot) {
      return { outcome: "refundable", reason: "상대방 — 생년월일시가 주문에 없습니다." };
    }
    const partnerUnsellable = whyUnsellable(partnerSnapshot.birthInfo, order.mode);
    // 화면이 쓰는 방식대로 `상대방 — ` 을 앞에 붙인다 — 같은 문장이 두 사람 것으로 다 나올 수
    // 있어서, 누구 쪽인지가 문장 안에 있어야 한다.
    if (partnerUnsellable) return { outcome: "refundable", reason: `상대방 — ${partnerUnsellable}` };
  }

  // 계산 실패 → 생성 시작 전이므로 자동 전액 환불(§9).
  //
  // `required` 를 상품 정의에서 넘긴다 — 계산 계층은 상품을 모르므로, "상대가 안 들어온 것"이
  // 상대가 필요 없는 상품이라서인지 빠뜨린 것인지 그쪽에서 가릴 수 없다(PartnerChartInput 주석).
  const chart = calculateChart(order.birthSnapshot, order.mode, new Date(), {
    required: product.needsPartner,
    birthInfo: partnerSnapshot?.birthInfo ?? null,
  });
  if (!chart) return { outcome: "refundable", reason: "명식 계산에 실패했습니다." };

  // 골격 실패 → 자동 재시도 3회 → 그래도 실패면 전액 환불(§9). 재시도는 같은 입력으로 다시
  // 부르는 것이 전부다 — 모델이 스키마를 못 맞춘 경우가 대부분이라 대개 다음 시도에서 통과한다.
  let outline = null;
  let lastError: unknown = null;
  for (let attempt = 1; attempt <= OUTLINE_MAX_ATTEMPTS; attempt += 1) {
    try {
      outline = await generateOutline({
        product,
        chart,
        userInput: order.userInput,
        today: new Date(),
      });
      break;
    } catch (error) {
      lastError = error;
      console.error("[saju] 골격 생성 실패", paymentId, `${attempt}/${OUTLINE_MAX_ATTEMPTS}`, error);
    }
  }
  if (!outline) {
    return {
      outcome: "refundable",
      reason: `골격 생성이 ${OUTLINE_MAX_ATTEMPTS}회 실패했습니다: ${
        lastError instanceof Error ? lastError.message : String(lastError)
      }`,
    };
  }

  const readingId = newSajuReadingId(uid);
  return adminDb.runTransaction(async (tx): Promise<OpenSajuResult> => {
    const snap = await tx.get(sajuOrderRef(uid, paymentId));
    const current = (snap.data() as SajuOrder | undefined) ?? null;
    // 같은 판정을 다시 본다. 29초 사이에 다른 요청이 먼저 열었거나(→ `already`, 방금 만든 골격은
    // 버린다) 환불이 들어왔을(→ `not_paid`) 수 있다.
    const recheck = openGateReason(current);
    if (!recheck.ok) {
      return recheck.reason === "already"
        ? { outcome: "already", readingId: recheck.readingId }
        : { outcome: "not_paid" };
    }

    await createSajuReading({
      uid,
      id: readingId,
      productSlug: order.productSlug,
      birthInfo: order.birthSnapshot,
      partnerSnapshot,
      chart,
      outline,
      userInput: order.userInput,
      paymentId,
      tx,
    });
    tx.update(sajuOrderRef(uid, paymentId), { readingId });
    return { outcome: "opened", readingId };
  });
}
