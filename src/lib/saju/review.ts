// 사주 리포트 후기·별점.
//
// 설계: `doc/사주_리뷰_별점_설계.md`. 목업: `asset/Screen/New/Fortune_Report_End_*`(작성 폼),
// `FortuneReview_*`(목록).
//
// ## 확정된 정책 (2026-09-26·27 사용자 결정)
//
// - **완전 익명으로 보여준다.** 닉네임을 쓰지 않는다 — 그 닉네임을 받은 목적은 "AI 가 부를
//   호칭"이지 "공개 게시물에 이름 걸기"가 아니라, 그대로 쓰면 목적 외 이용이 된다.
//   다만 **`uid` 는 저장한다.** 표시하지 않는 것과 기록하지 않는 것은 다르다 — 정보통신망법의
//   삭제 요청 처리는 게시자에게 통지해야 하고, 탈퇴 시 파기도 `uid` 없이는 못 한다.
// - **환불돼도 후기는 그대로 둔다.** 숨기지도, 집계에서 빼지도 않는다.
// - **자해 신호를 운영자에게 알리지 않는다** — 사용자가 진심인지 장난인지 알 방법이 없다.
// - **보상은 10% 할인 쿠폰 한 장**(2026-09-27). 목업 문구: "타연 내 모든 상품에 적용 가능한".
//
// ## 한 번만 쓸 수 있고, 고칠 수 없다
//
// 문서 id 가 리포트 id 라 두 벌이 생길 길이 **구조적으로** 없다. 수정을 막은 건 별개 판단이다 —
// 후기에 쿠폰이 걸려 있어서, 고칠 수 있게 하면 "쿠폰 받고 별 1개로 바꾸기"가 열린다. 그걸
// 막으려면 다시 조건을 달아야 하고, 그 복잡도를 지금 살 이유가 없다.
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/admin";
import {
  SAJU_PRODUCT_RATINGS,
  SAJU_REVIEWS,
  USERS,
  USER_DISCOUNT_COUPONS,
} from "@/lib/firestore/collections";

/** 별점 없이 글만, 글 없이 별점만 남기는 걸 허용하지 않는다 — 목업이 두 칸을 모두 필수로
 *  표시한다("후기는 15자 이상 작성해주세요", 별 5개 기본 미선택). 둘 다 받아야 집계에
 *  "글 없는 평점"과 "평점 없는 글"을 어떻게 셀지 고민할 일이 아예 없다. */
export const REVIEW_MIN_BODY_CHARS = 15;
/** 화면 textarea 와 서버가 같은 상한을 쓴다. 고객센터 문의(1,000자)와 같은 크기다. */
export const REVIEW_MAX_BODY_CHARS = 1000;

/**
 * 후기 보상 쿠폰의 할인율과 유효기간.
 *
 * **6개월 — 처음엔 근거 없이 90일로 잡았다가 조사 후 고쳤다(2026-09-27).**
 *
 * 경쟁 서비스 중 약관 원문을 실제로 확인할 수 있었던 곳은 **청월당** 하나다. 거기는
 * 「별도의 정함이 없는 결제 적립 무료 복채의 유효기간은 지급일로부터 6개월」이고, 유상으로
 * 충전한 것은 5년이다(상사채권 소멸시효와 같은 값). 무상/유상을 가르고 무상 쪽을 6개월로
 * 두는 게 이 업계의 모양이다.
 *
 * **법으로 정해진 하한은 없다.** 우리 쿠폰은 대가를 받고 발행한 상품권이 아니라 무상 할인권
 * 이라, 「소비자분쟁해결기준」의 ‘상품권 관련업’(유효기간 경과분 환급 등)이 그대로 걸리지
 * 않는다 — 우리 업종은 같은 고시의 ‘인터넷콘텐츠업’이다. 대신 걸리는 것은 두 가지다:
 *
 *   1. **약관규제법 제6조** — 신의성실에 반해 공정성을 잃은 조항은 무효이고, 「고객에게
 *      부당하게 불리한 조항」은 공정성을 잃은 것으로 **추정**된다(제2항 제1호). 지나치게
 *      짧은 기간이 여기 걸릴 수 있다. 업계 관행선(6개월)에 맞춰 두면 그 다툼이 안 생긴다.
 *   2. **전자상거래법 제13조 제2항·제5항** — 구매 판단에 영향을 주는 거래조건은 미리 표시·
 *      고지해야 하고, 고지한 대로 이행해야 한다. 그래서 이 기간은 **화면에 적혀야 한다**
 *      (쿠폰함이 `endsAt` 을 보여준다).
 *
 * 바꾸려면 여기 한 줄이다. 다만 **이미 발급된 쿠폰의 기간은 안 바뀐다** — 발급 시점에
 * `endsAt` 이 문서에 박히기 때문이고, 그게 맞다(나중에 줄이면 소급해서 불리해진다).
 */
export const REVIEW_REWARD_RATE = 0.1;
export const REVIEW_REWARD_VALID_DAYS = 180;
export const REVIEW_REWARD_NAME = "후기 작성 감사 10% 할인 쿠폰";

export type SajuReview = {
  /** 리포트 id 이자 문서 id. */
  readingId: string;
  productSlug: string;
  /** 1~5. */
  stars: number;
  body: string;
  createdAt: string;
};

/** 목록에 내보내는 모양. **`uid` 가 없다** — 완전 익명이고, `view.ts` 의 "빼는 목록이 아니라
 *  내보낼 목록" 원칙을 그대로 따른다. `readingId` 도 뺀다: 그걸 알면 남의 리포트 주소를
 *  만들어 볼 수 있다(열리지는 않지만, 존재를 알릴 이유가 없다). */
export type PublicSajuReview = { stars: number; body: string; createdAt: string };

export type SajuProductRating = { count: number; average: number };

export type SubmitReviewResult =
  | { outcome: "created"; review: SajuReview; reward: { code: string; discountRate: number; endsAt: string } }
  /** 이미 남겼다. 한 리포트에 한 번뿐이다. */
  | { outcome: "exists" }
  | { outcome: "invalid"; message: string };

/** 입력 검증. **서버가 자기 규칙으로 다시 잰다** — 화면의 「0/15자」 표시는 안내이고, 그걸
 *  믿으면 직접 호출로 빈 후기가 쿠폰만 받아 간다. */
export function validateReviewInput(stars: unknown, body: unknown): { ok: true; stars: number; body: string } | { ok: false; message: string } {
  const n = typeof stars === "number" ? stars : Number(stars);
  if (!Number.isInteger(n) || n < 1 || n > 5) return { ok: false, message: "별점을 선택해주세요." };
  const text = typeof body === "string" ? body.trim() : "";
  if (text.length < REVIEW_MIN_BODY_CHARS) {
    return { ok: false, message: `후기는 ${REVIEW_MIN_BODY_CHARS}자 이상 작성해주세요.` };
  }
  if (text.length > REVIEW_MAX_BODY_CHARS) {
    return { ok: false, message: `후기는 ${REVIEW_MAX_BODY_CHARS}자까지 쓸 수 있어요.` };
  }
  return { ok: true, stars: n, body: text };
}

/** 보상 쿠폰의 코드. **발급마다 새로 만든다** — 쿠폰 코드가 사용자 쿠폰함의 문서 id 라,
 *  고정 코드를 쓰면 두 번째 후기의 쿠폰이 첫 번째를 덮어쓴다(리포트를 두 편 사면 바로 생긴다).
 *
 *  최상위 캠페인 문서(`discountCoupons/{code}`)를 만들지 않는다. 그 문서는 **선착순 등록**을
 *  세기 위한 것이고(`api/user/discount-coupons`), 이건 등록이 아니라 지급이다 — 사용·환불
 *  복원 경로는 전부 사용자 쿠폰함만 본다(`fulfill.ts`·`revoke.ts`·`refundUnopenable.ts`). */
function newRewardCode(): string {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let suffix = "";
  for (let i = 0; i < 10; i += 1) suffix += alphabet[Math.floor(Math.random() * alphabet.length)];
  return `REVIEW${suffix}`;
}

/**
 * 후기를 남기고 보상 쿠폰을 지급한다. **한 트랜잭션이다.**
 *
 * 나누면 반드시 어긋난다: 후기만 저장되고 쿠폰이 안 나가면 사용자가 약속받은 것을 못 받고,
 * 쿠폰만 나가면 후기 없이 할인만 받는 길이 열린다. 집계도 같은 트랜잭션에서 올린다 —
 * 집계는 캐시라서 틀려도 안 죽지만, **한 번 어긋나면 되돌릴 방법이 없다**(원본을 다 세는 것
 * 말고는). 쓰는 순간 같이 올리는 게 유일하게 싼 방법이다.
 */
export async function submitSajuReview(args: {
  uid: string;
  readingId: string;
  productSlug: string;
  stars: number;
  body: string;
}): Promise<SubmitReviewResult> {
  const { uid, readingId, productSlug, stars, body } = args;

  const reviewRef = adminDb.collection(SAJU_REVIEWS).doc(readingId);
  const ratingRef = adminDb.collection(SAJU_PRODUCT_RATINGS).doc(productSlug);
  const code = newRewardCode();
  const couponRef = adminDb.collection(USERS).doc(uid).collection(USER_DISCOUNT_COUPONS).doc(code);

  const now = new Date();
  const endsAt = new Date(now.getTime() + REVIEW_REWARD_VALID_DAYS * 24 * 60 * 60 * 1000);

  return adminDb.runTransaction(async (tx): Promise<SubmitReviewResult> => {
    const [reviewSnap, ratingSnap] = await Promise.all([tx.get(reviewRef), tx.get(ratingRef)]);
    if (reviewSnap.exists) return { outcome: "exists" };

    const review: SajuReview = {
      readingId,
      productSlug,
      stars,
      body,
      createdAt: now.toISOString(),
    };
    // `uid` 는 문서에만 남기고 타입에는 없다 — 밖으로 나갈 일이 없는 값이라, 타입에 두면
    // 누군가 응답에 실어 보내게 된다(`PublicSajuReview` 주석).
    tx.set(reviewRef, { ...review, uid });

    // 평균을 그대로 들고 있지 않고 **합계와 개수**로 둔다. 평균만 두면 새 별점을 더할 때
    // 이전 평균 × 이전 개수를 역산해야 하고, 반올림 오차가 매번 누적된다.
    const prevCount = Number(ratingSnap.data()?.count ?? 0);
    const prevTotal = Number(ratingSnap.data()?.total ?? 0);
    tx.set(ratingRef, { count: prevCount + 1, total: prevTotal + stars, updatedAt: now.toISOString() });

    tx.set(couponRef, {
      name: REVIEW_REWARD_NAME,
      discountRate: REVIEW_REWARD_RATE,
      startsAt: now.toISOString(),
      endsAt: endsAt.toISOString(),
      status: "unused",
      registeredAt: FieldValue.serverTimestamp(),
      // 어디서 왔는지 남긴다. 나중에 "이 쿠폰이 왜 있지"를 어드민에서 물을 때 답이 된다.
      grantedFor: `sajuReview/${readingId}`,
    });

    return {
      outcome: "created",
      review,
      reward: { code, discountRate: REVIEW_REWARD_RATE, endsAt: endsAt.toISOString() },
    };
  });
}

/** 한 리포트에 달린 후기(본인 것). 뷰어가 폼 대신 읽기 전용을 그릴지 판단하는 값이다. */
export async function getSajuReview(readingId: string): Promise<SajuReview | null> {
  const snap = await adminDb.collection(SAJU_REVIEWS).doc(readingId).get();
  if (!snap.exists) return null;
  const d = snap.data()!;
  return {
    readingId,
    productSlug: String(d.productSlug ?? ""),
    stars: Number(d.stars ?? 0),
    body: String(d.body ?? ""),
    createdAt: String(d.createdAt ?? ""),
  };
}

/**
 * 상품 하나의 후기 목록. 최신순.
 *
 * **페이지네이션이 없다.** 상한(`limit`)만 두고 자른다 — 이 화면은 "실제 사람이 썼다"를
 * 보이는 자리이지 전수 열람 자리가 아니고, 스무 개쯤 읽고 나면 더 읽어도 판단이 안 바뀐다.
 * 필요해지면 `startAfter` 를 얹으면 되고, 그때까지 인덱스 하나를 덜 만든다.
 */
export async function listSajuReviews(productSlug: string, limit = 50): Promise<PublicSajuReview[]> {
  const snap = await adminDb
    .collection(SAJU_REVIEWS)
    .where("productSlug", "==", productSlug)
    .orderBy("createdAt", "desc")
    .limit(limit)
    .get();
  return snap.docs.map((doc) => {
    const d = doc.data();
    return { stars: Number(d.stars ?? 0), body: String(d.body ?? ""), createdAt: String(d.createdAt ?? "") };
  });
}

/** 상품의 별점 집계. 후기가 없으면 `null` 이다 — `{ count: 0, average: 0 }` 을 돌려주면
 *  화면이 "0.0점"을 그리게 되고, 그건 "나쁜 상품"으로 읽힌다. */
export async function getSajuProductRating(productSlug: string): Promise<SajuProductRating | null> {
  const snap = await adminDb.collection(SAJU_PRODUCT_RATINGS).doc(productSlug).get();
  if (!snap.exists) return null;
  const count = Number(snap.data()?.count ?? 0);
  const total = Number(snap.data()?.total ?? 0);
  if (count <= 0) return null;
  return { count, average: total / count };
}

/**
 * 회원 탈퇴 때 그 사람의 후기를 지운다. **집계도 같이 내린다** — 안 내리면 지워진 후기가
 * 평점에 영원히 남는다.
 *
 * 최상위 컬렉션이라 `recursiveDelete(users/{uid})` 가 못 건드린다(`collections.ts` 주석).
 * 방침 제3조가 "회원 탈퇴 시 지체 없이 파기"이므로 남겨 둘 수 없다.
 */
export async function deleteSajuReviewsOfUser(uid: string): Promise<number> {
  const snap = await adminDb.collection(SAJU_REVIEWS).where("uid", "==", uid).get();
  for (const doc of snap.docs) {
    const productSlug = String(doc.data().productSlug ?? "");
    const stars = Number(doc.data().stars ?? 0);
    const ratingRef = adminDb.collection(SAJU_PRODUCT_RATINGS).doc(productSlug);
    await adminDb.runTransaction(async (tx) => {
      const ratingSnap = await tx.get(ratingRef);
      tx.delete(doc.ref);
      if (!ratingSnap.exists) return;
      // 음수로 내려가지 않게 바닥을 둔다. 집계는 캐시라 원본과 어긋날 수 있고(수동 삭제 등),
      // 그때 음수 개수가 남으면 화면이 "-1개의 후기"를 그린다.
      const count = Math.max(Number(ratingSnap.data()?.count ?? 0) - 1, 0);
      const total = Math.max(Number(ratingSnap.data()?.total ?? 0) - stars, 0);
      tx.set(ratingRef, { count, total, updatedAt: new Date().toISOString() });
    });
  }
  return snap.size;
}
