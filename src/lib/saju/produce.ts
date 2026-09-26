// 리포트를 실제로 "만들어 내는" 층. 저장(`storage.ts`)과 생성(`generate/`) 사이에 있고,
// 라우트가 아니라 여기 있는 이유는 **주문 직후 서버가 1페이지를 미리 만드는 경로**와
// **사용자가 읽으며 요청하는 경로**가 같은 규칙을 써야 하기 때문이다(§6).
//
// 이 층이 지는 책임 두 가지가 storage 에도 generate 에도 없다.
//
// 1. **같은 페이지를 동시에 두 번 만들지 않는다.**
//    `saveSajuPage` 의 트랜잭션은 **쓰기**의 중복만 막는다. 나중 것을 버리므로 사용자가 읽던
//    문장은 안 바뀌지만, **버려질 쪽도 이미 모델을 불렀다.** 섹션 한 장이 약 20원이라 조용히
//    두 배로 나간다. 온디맨드 + prefetch 구조에서 이건 예외가 아니라 일상이다 — 사용자가
//    3페이지를 보는 중에 4페이지를 당겨오는데 그 순간 새로고침하면 바로 겹친다.
//    그래서 **진행 중인 생성을 프로세스 안에서 공유**한다. 둘째 요청은 새로 만들지 않고
//    같은 약속을 기다린다.
//
//    인스턴스가 여럿이면 인스턴스 간에는 안 막힌다. 그건 Firestore 잠금이라야 하는데, 그
//    복잡도를 지금 지불할 이유가 없다 — 겹침의 대부분은 **한 사용자의 한 탭**에서 나고 그건
//    같은 인스턴스다. 막지 못한 경우에도 결과는 정확하고 20원이 샐 뿐이다.
//
// 2. **실패를 §9 대로 처리한다.** 섹션은 조용히 재시도하고, 3회째에도 안 되면 **실패 자리표를
//    페이지로 저장**한다. 자리표를 남기지 않으면 게이트("N 은 N-1 이 있어야 한다")에 걸려
//    뒤 페이지가 전부 막힌다 — §7 「실패한 페이지도 문서로 남긴다」 참고.
import { notifyOwner } from "@/lib/notify/owner";
import { getSajuProduct } from "@/lib/saju/products";
import { SAJU_PERSONAS } from "@/lib/saju/personas";
import { echoOf, generateSection, type SectionEcho } from "@/lib/saju/generate/section";
import { generateAnswer } from "@/lib/saju/generate/answer";
import type { SajuAnswer } from "@/lib/saju/generate/answer";
import { generateClosing } from "@/lib/saju/generate/closing";
import type { SajuClosing } from "@/lib/saju/generate/closing";
import { generateSajuImage } from "@/lib/saju/generate/image";
import { putSajuImageBytes, sajuImageUrl } from "@/lib/saju/imageStore";
import {
  getSajuReading,
  getSajuReadingWithPages,
  pageGateReason,
  saveSajuAnswer,
  saveSajuClosing,
  saveSajuImage,
  saveSajuPage,
  saveSajuPageFailure,
  type PageGate,
  type SajuReading,
  type SajuReadingImage,
  type SajuReadingPage,
} from "@/lib/saju/storage";

/** 섹션 한 장을 몇 번까지 다시 만들어 보는가(§9 "섹션 3회 실패"). */
export const SECTION_MAX_ATTEMPTS = 3;

/** 재시도 사이에 쉬는 시간(ms). 첫 실패 뒤 0, 두 번째 뒤 1.5초.
 *
 *  **쉬지 않으면 재시도가 사실상 한 번이다.** 실패의 흔한 원인이 429(사용량 제한)와 과부하인데,
 *  그건 시간이 지나야 풀리는 것이라 즉시 세 번 치면 세 번 다 같은 이유로 죽는다. 그 상태로
 *  실패 자리표를 박으면 **잠깐의 혼잡 때문에 그 페이지가 영구히 안내로 남는다.** */
const RETRY_BACKOFF_MS = [0, 1500];

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export type ProducePageResult =
  /** 읽을 수 있는 상태다. 저장돼 있었거나 방금 만들었다.
   *  `page.kind === "failed"` 면 3회까지 실패한 자리표다 — 화면이 안내를 그린다. */
  | { outcome: "ready"; page: SajuReadingPage }
  | { outcome: "not_found" }
  | { outcome: "rejected"; gate: Exclude<PageGate, { ok: true }> }
  /** 상품이 레지스트리에서 빠졌다. **저장된 건 읽히지만 새로 만들 수는 없다** —
   *  섹션 정의·문체 규칙·중점이 상품에서 오므로, 없는 채로 만들면 앞뒤가 다른 글이 된다.
   *  던지지 않고 결과로 돌려주는 이유: 라우트가 500 을 주면 화면이 "잠시 후 다시"를 띄우는데
   *  이건 기다려서 풀리는 일이 아니다. */
  | { outcome: "product_gone" };

export type ProduceClosingResult =
  | { outcome: "ready"; closing: SajuClosing }
  | { outcome: "not_found" }
  /** 아직 섹션이 다 안 끝났다. 총평은 **전 섹션의 결론을 받아** 쓰는 것이라 미리 쓸 수 없다.
   *
   *  `missing` 은 **아직 없는 페이지 번호들**이다. 개수가 아니라 번호로 준다 — 개수에서 번호를
   *  역산하려면 "1..N 이 연속으로 찬다"를 가정해야 하는데, 그 가정이 깨지는 날(비연속 저장)
   *  화면은 조용히 엉뚱한 페이지를 만들기 시작한다. */
  | { outcome: "sections_incomplete"; missing: number[] }
  /** 섹션이 **전부** 실패 자리표다. 받아 쓸 결론이 하나도 없다. */
  | { outcome: "all_sections_failed" }
  /** 상품이 레지스트리에서 빠졌다. 총평도 상품의 문체 규칙 위에서 쓰이므로 만들 수 없다. */
  | { outcome: "product_gone" }
  /** 환불된 건이다. 저장된 건 계속 읽히지만 **새로 만들지 않는다.** */
  | { outcome: "not_producible" };

/** 답변은 총평과 전제가 같아서(모든 섹션 완료) 결과 모양도 같다 — 하나만 다르다. */
export type ProduceAnswerResult =
  | { outcome: "ready"; answer: SajuAnswer }
  | { outcome: "not_found" }
  | { outcome: "sections_incomplete"; missing: number[] }
  | { outcome: "all_sections_failed" }
  | { outcome: "product_gone" }
  | { outcome: "not_producible" }
  /** 사용자가 사연을 안 적었다. **이 장 자체가 없다** — 오류가 아니라 정상 상태다. */
  | { outcome: "no_question" };

// ─────────────────────────────────────────────────────────────────────────────
// 진행 중인 생성 공유
// ─────────────────────────────────────────────────────────────────────────────

/** 키 → 진행 중인 생성. 끝나면(성공이든 실패든) 반드시 지운다. */
const inFlight = new Map<string, Promise<unknown>>();

/**
 * 같은 키의 생성이 이미 돌고 있으면 그것을 기다리고, 없으면 시작한다.
 *
 * `finally` 로 지우는 것이 핵심이다. 실패했을 때 키가 남으면 **그 페이지는 영영 다시 만들 수
 * 없다** — 거부된 약속을 계속 돌려주게 된다.
 */
function share<T>(key: string, start: () => Promise<T>): Promise<T> {
  const running = inFlight.get(key) as Promise<T> | undefined;
  if (running) return running;

  const started = start().finally(() => {
    inFlight.delete(key);
  });
  inFlight.set(key, started);
  return started;
}

/**
 * **더 만들면 안 되는 건인가.** 환불된 리포트다.
 *
 * 페이지 생성은 `pageGateReason` 이 이미 막는데, **총평과 이미지는 그 게이트를 안 거친다.**
 * 그래서 이미지를 쓰는 상품의 환불된 리포트를 **열기만 해도** 총평(약 20원)과
 * 이미지(8원)가 실제로 만들어졌다. 화면이 안 보여준다고 돈이 안 나가는 게 아니다 —
 * 화면 쪽 가드는 다른 클라이언트나 직접 호출로 우회된다.
 *
 * 2026-09-27 에 만료 분기가 빠졌다(무기한 보관). 남은 건 **환불**뿐이다 — 환불된 리포트에
 * 돈 드는 생성을 더 태우지 않는다.
 */
function mustNotProduce(reading: Pick<SajuReading, "status">): boolean {
  return reading.status === "failed";
}

// ─────────────────────────────────────────────────────────────────────────────
// 섹션 페이지
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 페이지 `pageNumber` 를 읽을 수 있는 상태로 만든다.
 *
 * 이미 있으면 모델을 부르지 않는다. 없으면 만들어 저장하고 돌려준다. 호출자는 "저장분을
 * 읽는 것"과 "새로 만드는 것"을 구분할 필요가 없다 — 그 구분이 라우트로 새면 prefetch 와
 * 첫 열람이 서로 다른 코드를 타게 된다.
 */
export function producePage(args: {
  uid: string;
  id: string;
  pageNumber: number;
  /** 실패 자리표를 **다시 만들어 본다**(§9 의 3회를 이미 소진한 페이지).
   *
   *  **사용자에게 주는 버튼이 아니다.** §9 는 3회 실패한 페이지에 안내만 띄우기로 했고, 그
   *  판단은 유효하다 — 같은 조건에서 네 번째도 실패한다.
   *
   *  이건 **조건이 바뀐 뒤를 위한 문**이다. 모델 사용량 제한이 10분 걸렸다든지 해서 그 사이에
   *  생성된 리포트들이 통째로 안내 페이지를 갖게 되면, 이 문이 없으면 Firestore 를 손으로
   *  고치는 것 말고 복구할 길이 없다. 운영 경로에서만 켠다. */
  retryFailed?: boolean;
}): Promise<ProducePageResult> {
  return share(`page:${args.uid}:${args.id}:${args.pageNumber}`, () => runPage(args));
}

async function runPage(args: {
  uid: string;
  id: string;
  pageNumber: number;
  retryFailed?: boolean;
}): Promise<ProducePageResult> {
  const { uid, id, pageNumber, retryFailed } = args;

  const loaded = await getSajuReadingWithPages(uid, id);
  if (!loaded) return { outcome: "not_found" };
  const { reading, pages } = loaded;

  const already = pages.find((p) => p.pageNumber === pageNumber);
  // 본문이 이미 있으면 **절대 다시 만들지 않는다.** `retryFailed` 로도 못 뚫는다 —
  // 사용자가 읽던 문장이 바뀌는 건 어떤 이유로도 안 된다(§6).
  if (already && !(retryFailed && already.kind === "failed")) {
    return { outcome: "ready", page: already };
  }

  const gate = pageGateReason(
    reading,
    pages.map((p) => p.pageNumber),
    pageNumber
  );
  if (!gate.ok) return { outcome: "rejected", gate };

  const product = getSajuProduct(reading.productSlug);
  if (!product) return { outcome: "product_gone" };

  // 이 상품의 페르소나가 어떤 문체로 끝맺는가(personas.ts). `echoOf`(반복 방지 추출)와
  // `generateSection`(반복 방지 지시문) 양쪽에 같은 값을 넘겨야 한다 — 둘이 다른 레지스터를
  // 보면 추출은 한 문체로, 지시는 다른 문체로 나가는 모순이 생긴다.
  const endingRegister = SAJU_PERSONAS[product.persona].endingRegister;

  // 앞 섹션이 **실제로 쓴 것**만 넘긴다(§5). 실패 자리표는 쓴 게 없으므로 빼야 한다 —
  // 넣으면 `echoOf` 가 없는 본문을 읽는다.
  const written: SectionEcho[] = pages
    .filter((p): p is Extract<SajuReadingPage, { kind: "section" }> => p.kind === "section")
    .sort((a, b) => a.pageNumber - b.pageNumber)
    .filter((p) => p.pageNumber < pageNumber)
    // `.map(echoOf)` 로 직접 넘기면 안 된다 — `Array.prototype.map` 이 두 번째 인자로 넘기는
    // 인덱스(number)가 `echoOf` 의 `register`(`SajuEndingRegister`) 자리에 들어간다.
    .map((p) => echoOf(p, endingRegister));

  let lastError: unknown = null;
  for (let attempt = 1; attempt <= SECTION_MAX_ATTEMPTS; attempt += 1) {
    try {
      const section = await generateSection({
        product,
        chart: reading.chart,
        outline: reading.outline,
        index: pageNumber - 1,
        written,
        userInput: reading.userInput,
        today: new Date(),
        endingRegister,
      });
      const saved = await saveSajuPage({ uid, id, pageNumber, section });
      // `exists` 면 그 사이 다른 경로가 먼저 저장했다는 뜻이다. 저장된 쪽이 이긴다.
      if (saved.outcome === "rejected") return { outcome: "rejected", gate: saved.gate };
      return { outcome: "ready", page: saved.page };
    } catch (error) {
      lastError = error;
      const backoff = RETRY_BACKOFF_MS[attempt - 1];
      if (backoff) await wait(backoff);
    }
  }

  // 여기까지 오면 §9 의 "섹션 3회 실패"다. 전액 환불은 부적절하고(이미 읽었다) 그 페이지에만
  // 안내를 띄운다. 자리표를 남겨야 뒤 페이지가 풀린다.
  await notifyOwner({
    key: `saju-section-failed/${uid}/${id}/${pageNumber}`,
    level: "warn",
    title: "사주 리포트 섹션 생성이 3회 실패했습니다",
    fields: [
      ["상품", reading.productSlug],
      ["리포트", id],
      ["페이지", String(pageNumber)],
      ["사용자", uid],
      ["마지막 오류", lastError instanceof Error ? lastError.message : String(lastError)],
    ],
    note: "해당 페이지에는 안내가 표시되고 나머지 페이지는 정상입니다. 환불 대상은 아닙니다.",
  }).catch(() => {});

  const placeholder = await saveSajuPageFailure({
    uid,
    id,
    pageNumber,
    attempts: SECTION_MAX_ATTEMPTS,
  });
  if (placeholder.outcome === "rejected") return { outcome: "rejected", gate: placeholder.gate };
  return { outcome: "ready", page: placeholder.page };
}

// ─────────────────────────────────────────────────────────────────────────────
// 사연 답변
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 사연 답변 장을 만든다. 총평과 **전제가 같다**(모든 섹션 완료) — 둘 다 섹션이 실제로 쓴
 * 결론을 받아 쓰기 때문이다.
 *
 * 총평보다 **먼저** 돈다. `runClosing` 이 이 함수를 직접 부르므로 순서는 프롬프트가 아니라
 * 코드가 보장한다(`generate/answer.ts` 머리말 「총평과의 역할 분담」).
 */
export function produceAnswer(args: { uid: string; id: string }): Promise<ProduceAnswerResult> {
  return share(`answer:${args.uid}:${args.id}`, () => runAnswer(args));
}

async function runAnswer(args: { uid: string; id: string }): Promise<ProduceAnswerResult> {
  const { uid, id } = args;

  const loaded = await getSajuReadingWithPages(uid, id);
  if (!loaded) return { outcome: "not_found" };
  const { reading, pages } = loaded;

  // 사연이 없으면 이 장 자체가 없다. **모델을 부르지 않는다** — 빈 사연에 답하라고 시키면
  // 모델은 무언가를 지어낸다.
  if (!reading.userInput.trim()) return { outcome: "no_question" };
  if (reading.userAnswer) return { outcome: "ready", answer: reading.userAnswer };
  if (mustNotProduce(reading)) return { outcome: "not_producible" };

  const total = reading.outline.sections.length;
  const savedNumbers = new Set(pages.map((p) => p.pageNumber));
  const missing = Array.from({ length: total }, (_, i) => i + 1).filter((n) => !savedNumbers.has(n));
  if (missing.length) return { outcome: "sections_incomplete", missing };

  const product = getSajuProduct(reading.productSlug);
  if (!product) return { outcome: "product_gone" };

  const sections = pages
    .filter((p): p is Extract<SajuReadingPage, { kind: "section" }> => p.kind === "section")
    .sort((a, b) => a.pageNumber - b.pageNumber);
  // 총평과 같은 이유로 막는다 — 본문이 하나도 없는데 사연에만 답하면, 리포트가 통째로
  // 실패했다는 사실이 이 한 장에 가려진다.
  if (sections.length === 0) return { outcome: "all_sections_failed" };

  const answer = await generateAnswer({
    product,
    chart: reading.chart,
    sections,
    userInput: reading.userInput,
    today: new Date(),
  });
  const saved = await saveSajuAnswer({ uid, id, answer });
  return { outcome: "ready", answer: saved.answer };
}

// ─────────────────────────────────────────────────────────────────────────────
// 총평
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 마지막 페이지(총평)를 만든다. **모든 섹션이 끝난 뒤에만** 만들 수 있다 — 총평의 입력이
 * 각 섹션이 실제로 쓴 `summary` 이기 때문이다(§1 "총평은 마지막이다").
 *
 * 사용자가 이미지 페이지를 보는 동안 만들면 지연이 보이지 않는다(§6). 그래서 호출 시점은
 * 마지막 섹션이 아니라 **이미지 페이지 진입**이다 — 그 판단은 화면이 한다.
 */
export function produceClosing(args: { uid: string; id: string }): Promise<ProduceClosingResult> {
  return share(`closing:${args.uid}:${args.id}`, () => runClosing(args));
}

async function runClosing(args: { uid: string; id: string }): Promise<ProduceClosingResult> {
  const { uid, id } = args;

  const loaded = await getSajuReadingWithPages(uid, id);
  if (!loaded) return { outcome: "not_found" };
  const { reading, pages } = loaded;

  // 이미 만든 총평은 계속 돌려준다 — 읽는 것은 막지 않는다. 막는 건 **새로 만드는 것**이다.
  if (reading.closing) return { outcome: "ready", closing: reading.closing };
  if (mustNotProduce(reading)) return { outcome: "not_producible" };

  const total = reading.outline.sections.length;
  // 실패 자리표도 "끝난 것"으로 센다. 3회까지 실패한 섹션은 다시 시도하지 않기로 했으므로
  // (§9) 그걸 기다리면 총평이 영영 안 나온다. 대신 총평은 **성공한 섹션의 결론만** 받는다.
  const savedNumbers = new Set(pages.map((p) => p.pageNumber));
  const missing = Array.from({ length: total }, (_, i) => i + 1).filter((n) => !savedNumbers.has(n));
  if (missing.length) return { outcome: "sections_incomplete", missing };

  const product = getSajuProduct(reading.productSlug);
  if (!product) return { outcome: "product_gone" };

  const sections = pages
    .filter((p): p is Extract<SajuReadingPage, { kind: "section" }> => p.kind === "section")
    .sort((a, b) => a.pageNumber - b.pageNumber);

  // 섹션이 전부 실패 자리표면 총평의 입력이 비어 있다. 그대로 부르면 모델이 **근거 없이**
  // 결론을 지어내고, 그게 저장돼 `status: "complete"` 가 된다 — 아무것도 못 읽은 사용자에게
  // 그럴듯한 총평 한 장만 주는 꼴이라 제일 나쁜 결과다.
  //
  // 여기까지 왔다는 건 리포트 한 편이 통째로 실패했다는 뜻이고, §9 의 표에 없는 상황이다
  // (§9 는 섹션 **하나**가 죽는 경우만 다룬다). 돈은 받았는데 읽을 게 없으므로 사람이 봐야 한다.
  if (sections.length === 0) {
    await notifyOwner({
      key: `saju-all-sections-failed/${uid}/${id}`,
      level: "urgent",
      title: "사주 리포트의 섹션이 전부 실패했습니다",
      fields: [
        ["상품", reading.productSlug],
        ["리포트", id],
        ["섹션 수", String(total)],
        ["사용자", uid],
      ],
      note: "사용자는 돈을 냈고 읽을 수 있는 페이지가 하나도 없습니다. 환불 여부를 판단해 주세요 — §9 의 표에 없는 상황입니다.",
    }).catch(() => {});
    return { outcome: "all_sections_failed" };
  }

  // 답변이 먼저다(설계 B안). **프롬프트가 아니라 코드로 순서를 보장한다** — 총평과 답변은
  // 둘 다 섹션 결론을 재료로 써서, "겹치지 마라"를 지시로만 말하면 걸러낼 장치가 없다.
  //
  // 여기서 답변 생성이 실패해도 **총평은 계속 만든다.** 총평은 리포트의 마지막 장이고,
  // 답변 한 장 때문에 결론을 통째로 못 읽게 되는 건 손해가 훨씬 크다. 그 경우 총평은
  // `answer: null` 로 돌아가 "사연 답을 되풀이하지 말라"는 지시만 빠진다 — 답변 장이 실제로
  // 없으니 되풀이할 것도 없어서 앞뒤가 맞는다.
  const produced = reading.userInput.trim()
    ? await produceAnswer({ uid, id }).catch(() => null)
    : null;
  const answer = produced?.outcome === "ready" ? produced.answer : null;

  const closing = await generateClosing({
    product,
    chart: reading.chart,
    sections,
    answer,
    today: new Date(),
  });
  const saved = await saveSajuClosing({ uid, id, closing });
  return { outcome: "ready", closing: saved.closing };
}

// ─────────────────────────────────────────────────────────────────────────────
// 이미지
// ─────────────────────────────────────────────────────────────────────────────

export type ProduceImageResult =
  | { outcome: "ready"; image: SajuReadingImage }
  | { outcome: "not_found" }
  /** 이미지를 지원하지 않는 상품이다(19개 중 3개만 지원). */
  | { outcome: "unsupported" }
  /** 환불된 건이다. 다시 그리지 않는다. */
  | { outcome: "not_producible" };

/**
 * 이미지를 만들어 저장한다. **부를 때마다 새로 그린다** — 다시 뽑기가 기능이기 때문이다(§8,
 * 장당 8원이라 횟수로 막지 않는다). 있는 걸 그냥 보고 싶으면 이걸 부르지 말고 저장된 바이트를
 * 읽으면 된다.
 *
 * 그래도 **동시 호출은 묶는다.** 사용자가 "다시 그리기"를 두 번 누르면 두 장이 그려지고
 * 나중 것만 남는다 — 8원이 조용히 버려지고, 더 나쁜 건 `regeneratedCount` 가 2 오른다는 것이다.
 */
export function produceImage(args: { uid: string; id: string }): Promise<ProduceImageResult> {
  return share(`image:${args.uid}:${args.id}`, () => runImage(args));
}

async function runImage(args: { uid: string; id: string }): Promise<ProduceImageResult> {
  const { uid, id } = args;

  const reading = await getSajuReading(uid, id);
  if (!reading) return { outcome: "not_found" };

  if (mustNotProduce(reading)) return { outcome: "not_producible" };

  const product = getSajuProduct(reading.productSlug);
  if (!product?.image) return { outcome: "unsupported" };

  const generated = await generateSajuImage({ product, imageBrief: reading.outline.imageBrief });

  // 순서가 중요하다. **먼저 번호를 받고 그 번호로 바이트를 쓴다.**
  //
  // `saveSajuImage` 가 트랜잭션 안에서 `regeneratedCount` 를 세므로, 그 값을 받아야 바이트에
  // 붙일 버전을 알 수 있다. 반대로 하면 두 번 눌렀을 때 버전이 어긋난다.
  //
  // 사이에서 죽으면 "리포트는 이미지가 있다고 하는데 바이트가 없는" 창이 열린다. 그때 화면은
  // 404 를 받고 다시 요청하면 되므로 회복 가능하고, 반대 순서(바이트 먼저)는 **아무도 가리키지
  // 않는 바이트가 남아** 회복이 안 된다.
  const image = await saveSajuImage({ uid, id, url: sajuImageUrl(id) });
  await putSajuImageBytes({
    uid,
    id,
    webp: generated.webp,
    contentType: generated.contentType,
    version: image.regeneratedCount,
  });

  return { outcome: "ready", image };
}

/** 뷰어가 "지금 몇 장까지 있나"를 묻는 자리. 라우트가 같은 계산을 다시 하지 않게 여기 둔다. */
export function sectionCountOf(reading: Pick<SajuReading, "outline">): number {
  return reading.outline.sections.length;
}
