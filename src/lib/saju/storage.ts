// 사주 리포트 한 편의 저장·조회. `users/{uid}/sajuReadings/{id}` 문서와 그 아래 `pages/{n}` 이
// 전부이고, 필드 구성은 doc/사주_구현설계.md §7 이 단일 출처다.
//
// 이 계층이 지는 책임이 세 가지 있다. 라우트로 새면 라우트마다 다시 짜게 되므로 여기 둔다.
//
// 1. **뽑은 판을 그대로 얼려 둔다.** `chart`(계산 결과 원본)와 `birthSnapshot`(구매 시점의 생년
//    월일시·성별·자시법·진태양시)을 주문 시점에 박는다. 계산 로직이나 라이브러리가 나중에 바뀌어도,
//    사용자 프로필이 바뀌어도 **그때 판 결과 그대로** 다시 보여야 한다 — 돈 받고 판 결과가
//    재접속하면 달라지는 건 사고다(§7).
// 2. **페이지 N 은 N-1 이 있어야 만들 수 있다.** 2단 생성이 앞 섹션이 실제로 쓴 것을 받아서
//    중복을 피하는 구조라, 순서를 건너뛰면 그 장치가 무력해진다(§5·§6). 그 선행 조건 판정을
//    `pageGateReason` 한 곳에 모아 두고, 쓰기 함수가 트랜잭션 안에서 다시 확인한다.
// 3. **이미 있는 페이지를 덮어쓰지 않는다.** 온디맨드라 같은 페이지 요청이 겹칠 수 있는데
//    (읽는 중 prefetch + 새로고침), 두 번 생성해서 나중 것으로 덮으면 **사용자가 읽던 문장이
//    바뀐다.** "있으면 그대로 주고 없을 때만 만든다"가 §6 의 전제다. 그래서 저장 함수들은
//    트랜잭션 안에서 존재 여부를 먼저 보고, 있으면 저장된 쪽을 돌려준다.
//
// 날짜는 이 저장소의 관례대로 ISO 문자열이다(Timestamp 를 쓰지 않는다 — 기존 리딩·결제 문서와
// 같은 형식이어야 어드민·이용내역이 같은 코드로 읽는다).
import { type Transaction } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/admin";
import { USERS, SAJU_READINGS, SAJU_PAGES, SAJU_ORDERS } from "@/lib/firestore/collections";
import type { BirthInfo } from "@/lib/tarot/birthInfo";
import type { SajuChart, SajuMode } from "@/lib/saju/generate/chart";
import type { SajuOutline } from "@/lib/saju/generate/outline";
import type { SajuSection } from "@/lib/saju/generate/section";
import type { SajuClosing } from "@/lib/saju/generate/closing";

/** 리포트 한 편의 상태.
 *
 *  - `generating` — 골격까지 끝났고 섹션은 온디맨드로 채워지는 중. 사용자는 이미 읽을 수 있다.
 *  - `complete` — 총평(`closing`)까지 저장됐다. 마지막 페이지가 있다는 뜻이다.
 *  - `failed` — **환불 처리가 끝난 건.** 더 읽히지도, 생성되지도 않게 막는 표시다
 *    (`pageGateReason` 이 `reading_failed` 로 뒤 페이지 생성을 멈춘다).
 *
 *  골격 생성 실패는 여기 오지 않는다 — 그때는 문서를 아예 만들지 않으므로(`createSajuReading`
 *  주석 참고) 결제 쪽 기록으로만 남는다. 섹션 1개의 실패도 여기 오지 않는다: §9 가 "그 페이지만
 *  조용히 재시도, 나머지는 멀쩡하다"로 정했으므로 문서 전체의 상태가 아니라 그 페이지의 일이고,
 *  3회까지 실패한 페이지는 `saveSajuPageFailure` 가 자리표로 남긴다. */
export type SajuReadingStatus = "generating" | "complete" | "failed";

export type SajuReadingImage = { url: string; regeneratedCount: number };

/**
 * 궁합 상품이 얼려 두는 상대방 정보.
 *
 * **닉네임도 같이 얼린다.** 본문이 상대를 그 이름으로 부르는데, 사용자가 나중에 상대 프로필의
 * 닉네임을 바꾸면 저장된 리포트와 어긋난다. 게다가 구매 화면에서 상대 값을 「변경」해도 그건
 * 프로필에 저장되지 않으므로, **구매 시점의 값은 프로필에 아예 없을 수도 있다.** 그러니 프로필을
 * 다시 읽어 맞추는 방법이 없고, 여기 얼려 두는 것만이 답이다(`birthSnapshot` 과 같은 이유, §7).
 */
export type SajuPartnerSnapshot = { nickname: string; birthInfo: BirthInfo };

/** 저장된 리포트 문서. `id` 는 문서 id 를 담아 되돌려 주는 편의 필드라 문서 본문에는 없다. */
export type SajuReading = {
  id: string;
  productSlug: string;
  mode: SajuMode;
  status: SajuReadingStatus;
  createdAt: string;
  /** 구매 시점의 출생 정보 스냅샷. 사용자가 나중에 프로필을 고쳐도 이 값은 불변이다(§7). */
  birthSnapshot: BirthInfo;
  /** 구매 시점의 상대방 스냅샷. 상대가 필요 없는 상품은 null. */
  partnerBirthSnapshot: SajuPartnerSnapshot | null;
  /** 계산 결과 원본. 재계산하지 않고 이걸 그대로 다시 쓴다(§7). */
  chart: SajuChart;
  outline: SajuOutline;
  /** 사용자가 주문할 때 적어 넣은 추가 질문. 섹션·총평 생성이 매번 다시 받아야 해서 같이 둔다. */
  userInput: string;
  closing: SajuClosing | null;
  image: SajuReadingImage | null;
  lastReadPage: number;
  /** 어느 결제로 팔린 건인지.
   *
   *  ⚠️ **§7 의 필드 목록에는 없다.** 그런데 §9 의 자동 전액 환불(계산 실패·골격 실패)이
   *  "어느 결제를 취소하나"에 답하려면 리포트에서 결제로 가는 길이 있어야 하고, 반대 방향
   *  (`users/{uid}/payments/{paymentId}`)만 있으면 전체를 훑어야 찾는다. 그래서 주문 생성 때
   *  받아 둔다. 설계 문서 §7 을 고칠 때 같이 적을 것. */
  paymentId: string | null;
  failedReason: string | null;
};

// 보관 만료 필드(`expiresAt`·`expiresAtTs`)는 **없다.** 2026-09-27 에 걷어냈다 — 리포트는
// 타로 리딩과 같이 **회원 탈퇴 시까지** 남는다. 30일 만료를 뒀던 근거는 저장 비용 걱정이었는데
// 실측이 틀렸다: 리포트 한 건이 100~170KB 라 10만 건을 영구 보관해도 월 4천 원이고, 한 건
// **생성**에 224~335원이 든다. 그리고 개인정보처리방침은 이미 "대화ㆍ리딩 기록: 회원 탈퇴 시
// 파기(별도의 보관 기간을 두지 않습니다)"라고 적고 있었다 — 사주만 예외였던 셈이다.
//
// ⚠️ **다시 넣지 말 것.** 넣으려면 Firestore TTL 정책(비활성화됨, 2026-09-27)과 약관·
// 개인정보처리방침을 함께 되돌려야 하고, "왜 하필 N일인가"에 답할 근거가 필요하다.
// "회원 탈퇴 시까지"는 표준적이라 그 설명이 필요 없다.

/**
 * 저장된 페이지 한 장. `pageNumber` 는 정렬용이다(컬렉션 상수 주석 참고).
 *
 * **두 종류가 있고 `kind` 로 갈린다.** 섹션 N 이 3회까지 실패하면 §9 는 "그 페이지에 안내 +
 * 운영자 알림, 전액 환불은 부적절"로 정했는데, 그 실패를 아무것도 남기지 않으면 `pageGateReason`
 * 의 "N 은 N-1 이 있어야 한다"에 걸려 **N+1 부터 끝까지 영구히 막힌다** — 18섹션 상품에서 3번이
 * 죽으면 사용자가 3장만 보게 된다. 그래서 실패도 문서로 남겨 게이트가 "존재한다"로 보게 한다.
 *
 * 본문 필드를 빈 문자열로 채우는 방식은 쓰지 않는다: 뷰어가 빈 페이지를 그리게 되고 "생성 안 됨"과
 * "모델이 짧게 씀"을 구분할 수 없다. 실패 자리표에 제목도 넣지 않는다 — 뷰어는 제목을
 * `outline.sections[n-1]` 에서 가져오므로, 같은 값을 두 곳에 두면 갈라진다.
 *
 * ⚠️ **호출부 주의:** 2단 생성에 넘길 `written`(`echoOf`)을 만들 때는 반드시
 * `kind === "section"` 만 골라야 한다. 실패 자리표에는 본문이 없어서 `echoOf` 에 넣으면 터진다.
 *
 */
export type SajuReadingPage =
  | ({ kind: "section"; pageNumber: number; createdAt: string } & SajuSection)
  | { kind: "failed"; pageNumber: number; createdAt: string; attempts: number };

/** 새 리포트 문서 id 를 미리 채번한다 — 마커와 리포트를 한 트랜잭션에서 쓰려면 id 가 먼저
 *  있어야 한다(`open.ts`). 쓰기는 일어나지 않는다. */
export function newSajuReadingId(uid: string): string {
  return adminDb.collection(USERS).doc(uid).collection(SAJU_READINGS).doc().id;
}

function readingRef(uid: string, id: string) {
  return adminDb.collection(USERS).doc(uid).collection(SAJU_READINGS).doc(id);
}

function pageRef(uid: string, id: string, pageNumber: number) {
  return readingRef(uid, id).collection(SAJU_PAGES).doc(String(pageNumber));
}

// ─────────────────────────────────────────────────────────────────────────────
// 주문 생성
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 결제가 확정된 뒤 리포트 한 편을 연다 — 계산 결과와 골격을 같이 박아 저장한다.
 *
 * 골격까지 있어야 0페이지(목차)를 보여줄 수 있고, 골격이 없으면 섹션을 하나도 만들 수 없다.
 * 그래서 "빈 문서를 먼저 만들고 골격을 나중에 붙이는" 형태를 쓰지 않는다 — 중간 상태가 생기면
 * 뷰어가 "골격 없는 generating" 을 따로 그려야 하고, 그 상태에서 죽으면 환불 판정도 애매해진다.
 * 골격 생성이 실패하면 문서를 만들지 말고 그대로 환불한다(§9).
 *
 * 그렇다면 "결제는 됐는데 아직 안 열림"은 어디 있나 — **주문 마커**(`SAJU_ORDERS`)다. 결제와
 * 골격 사이에 29초가 있어서 그 상태는 반드시 어딘가 있어야 하는데, 그걸 리포트 문서의 빈 상태로
 * 표현하지 않고 마커로 옮긴 것이다. 원칙("골격 없는 리포트는 없다")은 그대로 지켜진다.
 *
 * `id` 를 바깥에서 받는다 — 마커와 리포트를 한 트랜잭션에서 묶으려면 호출자가 id 를 먼저 알아야
 * 한다(`open.ts`). 트랜잭션에 참여할 때는 `tx` 를 넘긴다.
 */
export async function createSajuReading(args: {
  uid: string;
  /** 리포트 문서 id. 안 주면 Firestore 자동 채번. */
  id?: string;
  productSlug: string;
  // mode 를 따로 받지 않는다 — 문서의 `mode` 는 `chart.mode` 에서 나온다. 인자로도 받으면
  // 호출자가 넘긴 값이 조용히 무시되는데, 받아서 버리는 인자는 없는 것보다 나쁘다.
  birthInfo: BirthInfo;
  /** 궁합 상품이면 주문 마커의 상대 스냅샷을 그대로 넘긴다. */
  partnerSnapshot?: SajuPartnerSnapshot | null;
  chart: SajuChart;
  outline: SajuOutline;
  userInput: string;
  paymentId?: string | null;
  /** 진행 중인 트랜잭션. 주문 마커 갱신과 한 덩어리로 묶을 때 넘긴다. */
  tx?: Transaction;
}): Promise<SajuReading> {
  const col = adminDb.collection(USERS).doc(args.uid).collection(SAJU_READINGS);
  const ref = args.id ? col.doc(args.id) : col.doc();
  const createdAt = new Date();
  const now = createdAt.toISOString();
  const doc = {
    productSlug: args.productSlug,
    // chart.mode 와 같은 값이다(§7 이 둘을 다 적어 뒀다) — 목록·필터가 chart 전체를 읽지 않고
    // 모드만 보려고 쓰는 자리다. 두 곳이 갈라지지 않도록 여기서 한 번 맞춰 둔다.
    mode: args.chart.mode satisfies SajuMode,
    status: "generating" as SajuReadingStatus,
    createdAt: now,
    birthSnapshot: args.birthInfo,
    partnerBirthSnapshot: args.partnerSnapshot ?? null,
    chart: args.chart,
    outline: args.outline,
    userInput: args.userInput,
    closing: null,
    image: null,
    // 0 = 목차 페이지. 아직 아무 섹션도 안 읽었다는 뜻이다(§6 미해결 ③).
    lastReadPage: 0,
    paymentId: args.paymentId ?? null,
    failedReason: null,
  };
  if (args.tx) args.tx.set(ref, doc);
  else await ref.set(doc);
  return { id: ref.id, ...doc };
}

// ─────────────────────────────────────────────────────────────────────────────
// 주문 마커 — 결제와 리포트 사이의 상태
// ─────────────────────────────────────────────────────────────────────────────

/** 주문 마커. `readingId` 가 채워지면 "이미 열었다"는 뜻이고, 그게 멱등 키다. */
export type SajuOrder = {
  paymentId: string;
  productSlug: string;
  mode: SajuMode;
  /** `refunded` 는 **열기를 막는 자리**다. 환불이 열기보다 먼저 올 수 있는데(결제 직후 취소),
   *  그때 마커가 `paid` 로 남아 있으면 나중에 `openSajuReading` 이 환불된 결제로 리포트를
   *  만들어 준다. 그래서 회수 시점에 여기부터 내린다. */
  status: "pending" | "paid" | "refunded";
  /** 구매 시점의 출생 정보. 결제와 계산 사이에 프로필이 바뀌어도 **이것으로만** 계산한다 —
   *  안 그러면 사용자가 A 를 사고 B 를 받는다(§7 "구매 시점 스냅샷"). */
  birthSnapshot: BirthInfo;
  /** 상대방 정보가 필요한 상품(`needsPartner`)의 상대 스냅샷. 아니면 null.
   *  닉네임까지 얼리는 이유는 `SajuPartnerSnapshot` 주석 참고. */
  partnerBirthSnapshot: SajuPartnerSnapshot | null;
  userInput: string;
  readingId: string | null;
  createdAt: string;
  paidAt: string | null;
};

function orderRef(uid: string, paymentId: string) {
  return adminDb.collection(USERS).doc(uid).collection(SAJU_ORDERS).doc(paymentId);
}

/**
 * 결제창을 열기 **직전**에 주문 마커를 남긴다(`status: "pending"`).
 *
 * 스냅샷을 이 시점에 뜨는 것이 핵심이다 — 판매 제약(§10)을 통과시킨 그 입력이 그대로 계산에
 * 쓰여야 "결제는 됐는데 계산이 안 되는" 건이 생기지 않는다. 게이트와 스냅샷이 같은 순간이어야
 * 한다는 뜻이고, 그 순간이 `prepare` 다.
 *
 * 주문 내역(`paymentIntents`)이 아니라 여기 담는다: 그쪽은 최상위 컬렉션이라 회원 탈퇴의
 * `recursiveDelete(users/{uid})` 에 지워지지 않고, 생년월일시가 탈퇴 후에도 남는다(방침 제3조는
 * "회원 탈퇴 시 지체 없이 파기"다). 이 마커는 users 서브트리 안이라 함께 지워진다.
 *
 * 결제를 중간에 포기하면 `pending` 마커가 남는다 — 리포트는 안 생기므로 무해하지만, 개인정보가
 * 담긴 문서라 쌓이는 게 좋지 않다. TTL 정책 대상으로 둘 만하다(`paymentIntents` 와 같은 취급).
 */
export async function recordSajuOrderIntent(args: {
  uid: string;
  paymentId: string;
  productSlug: string;
  mode: SajuMode;
  birthSnapshot: BirthInfo;
  partnerBirthSnapshot?: SajuPartnerSnapshot | null;
  userInput: string;
}): Promise<void> {
  const order: SajuOrder = {
    paymentId: args.paymentId,
    productSlug: args.productSlug,
    mode: args.mode,
    status: "pending",
    birthSnapshot: args.birthSnapshot,
    partnerBirthSnapshot: args.partnerBirthSnapshot ?? null,
    userInput: args.userInput,
    readingId: null,
    createdAt: new Date().toISOString(),
    paidAt: null,
  };
  await orderRef(args.uid, args.paymentId).set(order);
}

/**
 * 결제가 확정됐다고 표시한다. **지급 트랜잭션 안에서 부른다** — 결제 문서 기록과 같은 덩어리여야
 * "결제는 fulfilled 인데 주문 마커는 pending" 같은 어긋남이 생기지 않는다.
 *
 * 여기서 계산·골격을 돌리지 않는다: 그게 29초라 결제 확정 웹훅을 잡고 있으면 타임아웃·재시도가
 * 겹쳐 같은 결제가 두 번 이행될 수 있다. 여는 건 `open.ts` 가 따로 한다.
 */
export function markSajuOrderPaid(tx: Transaction, uid: string, paymentId: string, paidAt: string | null): void {
  tx.update(orderRef(uid, paymentId), { status: "paid", paidAt });
}

/**
 * 환불 회수 시점에 주문 마커를 내린다. **리포트를 잠그는 것만으로는 부족하다** — 환불이 열기보다
 * 먼저 오면 잠글 리포트가 아직 없고, 마커가 `paid` 로 남아 있으면 그 뒤에 들어온 열기 요청이
 * 환불된 결제로 리포트를 만들어 준다.
 */
export function markSajuOrderRefunded(tx: Transaction, uid: string, paymentId: string): void {
  tx.update(orderRef(uid, paymentId), { status: "refunded" satisfies SajuOrder["status"] });
}

export async function getSajuOrder(uid: string, paymentId: string): Promise<SajuOrder | null> {
  const snap = await orderRef(uid, paymentId).get();
  return snap.exists ? (snap.data() as SajuOrder) : null;
}

/** `open.ts` 가 마커를 트랜잭션 안에서 읽고 `readingId` 를 박을 때 쓴다. */
export function sajuOrderRef(uid: string, paymentId: string) {
  return orderRef(uid, paymentId);
}

/**
 * 환불이 끝난 건을 잠근다 — 더 읽히지도, 생성되지도 않게 한다(`pageGateReason` 이
 * `reading_failed` 로 막는다). 환불 실행 자체는 결제 계층의 일이다(§9).
 *
 * 환불 회수(`revoke.ts`)와 한 트랜잭션으로 묶을 때는 `tx` 를 넘긴다 — 결제는 refunded 인데
 * 리포트는 멀쩡한 중간 상태가 남지 않게.
 */
export function markSajuReadingFailed(uid: string, id: string, reason: string, tx: Transaction): void;
export function markSajuReadingFailed(uid: string, id: string, reason: string): Promise<void>;
export function markSajuReadingFailed(
  uid: string,
  id: string,
  reason: string,
  tx?: Transaction
): void | Promise<void> {
  const patch = { status: "failed" satisfies SajuReadingStatus, failedReason: reason };
  if (tx) {
    tx.update(readingRef(uid, id), patch);
    return;
  }
  return readingRef(uid, id).update(patch).then(() => undefined);
}

// ─────────────────────────────────────────────────────────────────────────────
// 조회
// ─────────────────────────────────────────────────────────────────────────────

/** 문서 하나. 없으면 null — 라우트가 404 로 바꿔 쓴다. */
export async function getSajuReading(uid: string, id: string): Promise<SajuReading | null> {
  const snap = await readingRef(uid, id).get();
  if (!snap.exists) return null;
  return { id: snap.id, ...(snap.data() as Omit<SajuReading, "id">) };
}

/**
 * 상태 + 지금까지 저장된 페이지 전부. 뷰어가 처음 열릴 때 한 번 부르는 용도다.
 *
 * 페이지를 전부 실어 보내는 게 과해 보일 수 있지만, 한 편이 최대 11장이고 재접속하면 읽던
 * 데까지 이어 봐야 하므로(§6 미해결 ③) 어차피 다 필요하다. 페이지 하나만 필요할 때는
 * `getSajuPage` 를 쓴다.
 */
export async function getSajuReadingWithPages(
  uid: string,
  id: string
): Promise<{ reading: SajuReading; pages: SajuReadingPage[] } | null> {
  const reading = await getSajuReading(uid, id);
  if (!reading) return null;
  const snap = await readingRef(uid, id).collection(SAJU_PAGES).orderBy("pageNumber").get();
  return { reading, pages: snap.docs.map((d) => d.data() as SajuReadingPage) };
}

/** 「운세 보관함」이 쓰는 목록. 최신 구매가 위로 온다.
 *
 *  **페이지 서브컬렉션을 세지 않는다** — 리포트마다 한 번씩 더 읽으면 목록이 리포트 수만큼
 *  느려진다(N+1). 목록에 필요한 건 정확한 장수가 아니라 "이어 볼 수 있는가, 어디부터인가"이고
 *  그건 문서 안의 `lastReadPage`·`status` 로 충분하다(`view.ts` 의 `toReadingSummary`).
 *
 *  `limit` 이 있는 이유: 리포트는 한 번 사면 지워지지 않으므로 오래 쓴 사용자는 수십 편이 된다.
 *  화면이 전부를 한 번에 그릴 일은 없다. */
export async function listSajuReadings(uid: string, limit = 50): Promise<SajuReading[]> {
  const snap = await adminDb
    .collection(USERS)
    .doc(uid)
    .collection(SAJU_READINGS)
    .orderBy("createdAt", "desc")
    .limit(limit)
    .get();
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<SajuReading, "id">) }));
}

/** 페이지 한 장. 없으면 null(= 아직 안 만들어졌다). */
export async function getSajuPage(uid: string, id: string, pageNumber: number): Promise<SajuReadingPage | null> {
  const snap = await pageRef(uid, id, pageNumber).get();
  return snap.exists ? (snap.data() as SajuReadingPage) : null;
}

// ─────────────────────────────────────────────────────────────────────────────
// 페이지 쓰기 — 선행 조건과 덮어쓰기 금지
// ─────────────────────────────────────────────────────────────────────────────

export type PageGate =
  | { ok: true }
  /** 골격에 없는 번호다. 1..outline.sections.length 밖. */
  | { ok: false; reason: "out_of_range" }
  /** 앞 페이지가 아직 없다. `missing` 은 먼저 만들어야 하는 번호. */
  | { ok: false; reason: "missing_previous"; missing: number }
  /** 골격 생성이 실패한 건이라 섹션을 만들 수 없다. */
  | { ok: false; reason: "reading_failed" };

// 만료 사유(`reason: "expired"`)와 `isSajuReadingExpired` 는 **없다**(2026-09-27) — 리포트가
// 무기한 보관으로 바뀌면서 "기간이 지나 못 읽는" 상태 자체가 사라졌다. 환불(`status: "failed"`)
// 은 그대로다 — 그건 시간이 아니라 사건으로 정해지는 상태다.

/**
 * 페이지 `pageNumber` 를 지금 만들 수 있는가. **순수 함수다** — 읽기를 더 하지 않으므로
 * 트랜잭션 안에서도 같은 판정을 그대로 재사용할 수 있다.
 *
 * `savedPageNumbers` 는 이미 저장된 페이지 번호들이다. "N-1 이 있어야 한다"만 보면 충분하다 —
 * 그게 재귀적으로 1..N-1 전부를 보장하기 때문이다(1번은 앞이 골격뿐이라 조건이 없다).
 */
export function pageGateReason(
  reading: Pick<SajuReading, "status" | "outline">,
  savedPageNumbers: readonly number[],
  pageNumber: number
): PageGate {
  if (reading.status === "failed") return { ok: false, reason: "reading_failed" };
  if (!Number.isInteger(pageNumber) || pageNumber < 1 || pageNumber > reading.outline.sections.length) {
    return { ok: false, reason: "out_of_range" };
  }
  if (pageNumber > 1 && !savedPageNumbers.includes(pageNumber - 1)) {
    return { ok: false, reason: "missing_previous", missing: pageNumber - 1 };
  }
  return { ok: true };
}

export type SavePageResult =
  /** 방금 저장했다. */
  | { outcome: "created"; page: SajuReadingPage }
  /** 이미 있었다 — 저장된 쪽을 그대로 돌려준다. 새로 만든 본문은 버린다. */
  | { outcome: "exists"; page: SajuReadingPage }
  /** 선행 조건 위반. 아무것도 쓰지 않았다. */
  | { outcome: "rejected"; gate: Exclude<PageGate, { ok: true }> };

/** 실패 자리표를 남긴 결과. 이미 무언가 저장돼 있었으면 그대로 두고 `exists` 다. */
export type SavePageFailureResult =
  | { outcome: "created"; page: SajuReadingPage }
  | { outcome: "exists"; page: SajuReadingPage }
  | { outcome: "rejected"; gate: Exclude<PageGate, { ok: true }> };

/**
 * 섹션 본문 한 장을 저장한다. **이미 있으면 덮지 않고 저장된 쪽을 돌려준다.**
 *
 * 존재 확인과 쓰기를 트랜잭션으로 묶는 이유: 같은 페이지 요청이 거의 동시에 둘 들어오면(사용자가
 * 새로고침하는 순간의 prefetch) 둘 다 "없음"을 보고 둘 다 쓴다. 나중 쓰기가 이기면 사용자가
 * 읽던 문장이 중간에 바뀐다 — 생성 비용이 아니라 **읽는 경험**이 문제라서 막는다.
 *
 * 선행 조건도 트랜잭션 안에서 다시 본다. 호출자가 미리 `pageGateReason` 으로 걸러도, 그 사이에
 * 상태가 바뀔 수 있기 때문이다(예: 환불 처리와 경합).
 *
 * **덮어쓰기 금지의 유일한 예외:** 그 자리에 실패 자리표(`kind: "failed"`)가 있으면 본문으로
 * 바꿔 쓴다. 나중에 재시도가 성공했다는 뜻이라, 자리표를 남겨 두면 사용자가 영구히 안내 문구만
 * 보게 된다. 바뀌어도 사용자가 잃는 게 없는 방향(안내 → 본문)이라서 허용한다.
 */
export async function saveSajuPage(args: {
  uid: string;
  id: string;
  pageNumber: number;
  section: SajuSection;
}): Promise<SavePageResult> {
  const ref = readingRef(args.uid, args.id);
  const target = pageRef(args.uid, args.id, args.pageNumber);
  return adminDb.runTransaction(async (tx): Promise<SavePageResult> => {
    const existing = await tx.get(target);
    const existingPage = existing.exists ? (existing.data() as SajuReadingPage) : null;
    if (existingPage?.kind === "section") return { outcome: "exists", page: existingPage };

    const readingSnap = await tx.get(ref);
    // 문서가 없는 건 선행 조건 위반이 아니라 호출이 잘못된 것이다 — `rejected` 로 뭉치면
    // 라우트가 "앞 페이지를 먼저 만들라"는 안내를 잘못 띄운다.
    if (!readingSnap.exists) throw new Error(`사주 리포트를 찾을 수 없다: ${args.id}`);
    const reading = readingSnap.data() as Omit<SajuReading, "id">;

    // 앞 페이지 존재 확인은 그 문서 하나만 읽으면 된다 — 컬렉션 전체를 트랜잭션에서 읽으면
    // 잠그는 범위가 매 페이지마다 넓어진다.
    const saved: number[] = [];
    if (args.pageNumber > 1) {
      const prev = await tx.get(pageRef(args.uid, args.id, args.pageNumber - 1));
      if (prev.exists) saved.push(args.pageNumber - 1);
    }
    const gate = pageGateReason(reading, saved, args.pageNumber);
    if (!gate.ok) return { outcome: "rejected", gate };

    const page: SajuReadingPage = {
      kind: "section",
      ...args.section,
      pageNumber: args.pageNumber,
      createdAt: new Date().toISOString(),
      // 부모 리포트에서 그대로 복사한다 — 이미 이 트랜잭션에서 읽어 둔 값이라 추가 조회가
      // 없다(`SajuReadingPage` 주석 참고).
    };
    tx.set(target, page);
    return { outcome: "created", page };
  });
}

/**
 * 섹션 N 이 재시도까지 실패했을 때 그 자리에 **실패 자리표**를 남긴다(§9 "그 페이지에 안내 +
 * 운영자 알림, 전액 환불은 부적절 — 이미 읽었다").
 *
 * 자리표가 없으면 게이트의 "N 은 N-1 이 있어야 한다"에 걸려 뒤 페이지가 전부 막힌다
 * (`SajuReadingPage` 주석 참고). 그래서 이건 기록용이 아니라 **뒤를 풀어 주는 장치**다.
 *
 * 이미 무언가 저장돼 있으면 덮지 않는다 — 본문이 있으면 당연히 안 되고, 자리표가 이미 있어도
 * `attempts` 를 덮어쓰려 경합할 이유가 없다. 재시도가 성공한 경우는 `saveSajuPage` 쪽에서
 * 자리표를 본문으로 바꾼다.
 */
export async function saveSajuPageFailure(args: {
  uid: string;
  id: string;
  pageNumber: number;
  attempts: number;
}): Promise<SavePageFailureResult> {
  const ref = readingRef(args.uid, args.id);
  const target = pageRef(args.uid, args.id, args.pageNumber);
  return adminDb.runTransaction(async (tx): Promise<SavePageFailureResult> => {
    const existing = await tx.get(target);
    if (existing.exists) return { outcome: "exists", page: existing.data() as SajuReadingPage };

    const readingSnap = await tx.get(ref);
    if (!readingSnap.exists) throw new Error(`사주 리포트를 찾을 수 없다: ${args.id}`);
    const reading = readingSnap.data() as Omit<SajuReading, "id">;

    const saved: number[] = [];
    if (args.pageNumber > 1) {
      const prev = await tx.get(pageRef(args.uid, args.id, args.pageNumber - 1));
      if (prev.exists) saved.push(args.pageNumber - 1);
    }
    const gate = pageGateReason(reading, saved, args.pageNumber);
    if (!gate.ok) return { outcome: "rejected", gate };

    const page: SajuReadingPage = {
      kind: "failed",
      pageNumber: args.pageNumber,
      createdAt: new Date().toISOString(),
      attempts: args.attempts,
      // 부모 리포트에서 그대로 복사한다(saveSajuPage 와 같은 이유) — 실패 자리표도 나중에
    };
    tx.set(target, page);
    return { outcome: "created", page };
  });
}

/**
 * 총평을 저장하고 상태를 `complete` 로 올린다. 이미 있으면 덮지 않는다 — 페이지와 같은 이유로,
 * 사용자가 마지막 페이지를 읽는 중에 문장이 바뀌면 안 된다.
 */
export async function saveSajuClosing(args: {
  uid: string;
  id: string;
  closing: SajuClosing;
}): Promise<{ outcome: "created" | "exists"; closing: SajuClosing }> {
  const ref = readingRef(args.uid, args.id);
  return adminDb.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new Error(`사주 리포트를 찾을 수 없다: ${args.id}`);
    const current = snap.data() as Omit<SajuReading, "id">;
    if (current.closing) return { outcome: "exists" as const, closing: current.closing };
    tx.update(ref, { closing: args.closing, status: "complete" satisfies SajuReadingStatus });
    return { outcome: "created" as const, closing: args.closing };
  });
}

/**
 * 이미지를 저장한다. 처음이면 `regeneratedCount: 0`, 이후 호출마다 1씩 올린다 — 다시 뽑기는
 * 실패 보상이 아니라 기능이라(장당 8원, §8) 횟수를 눌러 막지 않고 세기만 한다.
 *
 * 이쪽은 **덮어쓰는 게 맞다**: 페이지 본문과 달리 사용자가 "다시 그려 달라"고 누른 결과이므로
 * 바뀌는 것이 기대 동작이다. 해석은 그대로고 그림만 바뀌니 결과의 일관성도 깨지지 않는다.
 */
export async function saveSajuImage(args: {
  uid: string;
  id: string;
  url: string;
}): Promise<SajuReadingImage> {
  const ref = readingRef(args.uid, args.id);
  return adminDb.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new Error(`사주 리포트를 찾을 수 없다: ${args.id}`);
    const current = (snap.data() as Omit<SajuReading, "id">).image;
    const image: SajuReadingImage = {
      url: args.url,
      regeneratedCount: current ? current.regeneratedCount + 1 : 0,
    };
    tx.update(ref, { image });
    return image;
  });
}

/**
 * 읽던 위치를 기록한다(§6 미해결 ③). 뒤로 넘겨도 그 값이 그대로 들어간다 — "가장 멀리 본
 * 페이지"가 아니라 **마지막으로 본 페이지**여야 다시 들어왔을 때 덮던 자리에서 이어진다.
 *
 * 트랜잭션을 쓰지 않는다: 사용자 한 명의 화면 이동이라 경합이 없고, 어긋나도 다음 이동이
 * 덮어써서 스스로 낫는 값이다.
 */
export async function updateLastReadPage(uid: string, id: string, pageNumber: number): Promise<void> {
  await readingRef(uid, id).update({ lastReadPage: pageNumber });
}
