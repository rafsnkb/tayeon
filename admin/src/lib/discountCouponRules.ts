// 할인쿠폰 발급 입력 검증과 기간 겹침 판정 — 순수 함수다(Firestore 없음).
//
// 겹침 검사가 여기 있는 이유가 핵심이다. 운영 원칙이 "유효기간이 겹치게 발급하지 않는다"인데,
// 그걸 지켜야 **한 사용자가 어느 시점에도 쓸 수 있는 쿠폰이 최대 한 장**이 된다. 그 전제 위에서
// 구매 화면이 "적용된 쿠폰" 하나만 보여주면 되고, "여러 장 중 뭘 쓸지 고르는" 흐름 자체가
// 필요 없어진다. 즉 이 검사가 무너지면 본체 설계가 같이 흔들린다.

/** 코드에 쓸 수 있는 글자 — 본체(src/lib/payment/discountCoupon.ts)의 CODE_PATTERN 과 같아야
 *  한다. 여기서 통과시킨 코드를 사용자가 등록할 수 없으면 발급이 헛돈다. */
const CODE_PATTERN = /^[A-Z0-9]{4,20}$/;

export const NAME_MAX_LENGTH = 50;
/** 100% 는 지원하지 않는다 — 청구액이 0 이 되면 결제창이 뜨지 않는다. 무료 지급이 필요하면
 *  리워드(pendingRewards) 경로를 쓴다. */
export const MAX_DISCOUNT_PERCENT = 99;

/** 랜덤 코드에 쓰는 글자. 전체 A-Z0-9 에서 **헷갈리는 짝을 뺐다** — 0/O, 1/I/L, 2/Z, 5/S, 8/B.
 *  쿠폰 코드는 SNS 이미지에 얹히거나 입으로 불러 주는 값이라, 옮겨 적다 틀리면 "코드가 안
 *  먹는다"는 문의가 된다. 직접 입력할 때는 여전히 전체 글자를 쓸 수 있다(CODE_PATTERN). */
const RANDOM_ALPHABET = "ACDEFGHJKMNPQRTUVWXY34679";
const RANDOM_LENGTH = 10;

/** 랜덤 쿠폰 코드 한 개. 중복 여부는 **여기서 판정하지 않는다** — 발급 시점에 Firestore 를
 *  보고 정하는 일이라, 순수 함수는 후보만 만들고 호출부가 빈 코드를 고를 때까지 돌린다. */
export function generateCouponCode(random: () => number = Math.random): string {
  let code = "";
  for (let i = 0; i < RANDOM_LENGTH; i++) {
    code += RANDOM_ALPHABET[Math.floor(random() * RANDOM_ALPHABET.length)];
  }
  return code;
}

export type CouponPeriod = { startsAt: string; endsAt: string };

export type CouponIssueInput = {
  code: string;
  /** 운영자가 알아보기 위한 이름. 예: "런칭 기념 30% 할인". 사용자에게도 보인다. */
  name: string;
  discountPercent: number;
  startsAt: string;
  endsAt: string;
  /** 선착순 인원. null 이면 무제한. **등록** 기준이다(구매가 아니라). */
  maxRegistrations: number | null;
};

export type CouponIssueValid = {
  ok: true;
  value: {
    code: string;
    name: string;
    discountRate: number;
    startsAt: string;
    endsAt: string;
    maxRegistrations: number | null;
  };
};
export type CouponIssueInvalid = { ok: false; error: string };

/** 입력을 다듬고 검증한다. 할인율은 화면에서 % 로 받아 소수 비율로 바꾼다 — 저장은 비율로
 *  통일해야 본체의 discountedAmount 가 그대로 쓴다. */
export function validateCouponIssue(input: Partial<CouponIssueInput>): CouponIssueValid | CouponIssueInvalid {
  const code = typeof input.code === "string" ? input.code.trim().toUpperCase() : "";
  if (!CODE_PATTERN.test(code)) {
    return { ok: false, error: "코드는 영문 대문자와 숫자 4~20자여야 합니다." };
  }

  const name = typeof input.name === "string" ? input.name.trim() : "";
  if (!name) return { ok: false, error: "쿠폰 이름을 입력해주세요." };
  if (name.length > NAME_MAX_LENGTH) {
    return { ok: false, error: `쿠폰 이름은 ${NAME_MAX_LENGTH}자 이하여야 합니다.` };
  }

  const percent = Number(input.discountPercent);
  if (!Number.isInteger(percent) || percent < 1 || percent > MAX_DISCOUNT_PERCENT) {
    return { ok: false, error: `할인율은 1~${MAX_DISCOUNT_PERCENT} 사이의 정수여야 합니다.` };
  }

  const starts = Date.parse(String(input.startsAt ?? ""));
  const ends = Date.parse(String(input.endsAt ?? ""));
  if (!Number.isFinite(starts) || !Number.isFinite(ends)) {
    return { ok: false, error: "유효기간을 올바르게 입력해주세요." };
  }
  if (ends <= starts) {
    return { ok: false, error: "종료 일시가 시작 일시보다 뒤여야 합니다." };
  }

  let maxRegistrations: number | null = null;
  if (input.maxRegistrations !== null && input.maxRegistrations !== undefined) {
    const max = Number(input.maxRegistrations);
    if (!Number.isInteger(max) || max < 1) {
      return { ok: false, error: "선착순 인원은 1 이상의 정수여야 합니다." };
    }
    maxRegistrations = max;
  }

  return {
    ok: true,
    value: {
      code,
      name,
      // 저장은 비율로. 30% → 0.3. 부동소수점 오차를 피하려고 100 으로 나누기만 한다.
      discountRate: percent / 100,
      startsAt: new Date(starts).toISOString(),
      endsAt: new Date(ends).toISOString(),
      maxRegistrations,
    },
  };
}

/** 두 기간이 한 순간이라도 겹치는가. 경계가 맞닿는 것(앞 쿠폰 종료 == 뒤 쿠폰 시작)도 그 순간에
 *  둘 다 유효하므로 겹침으로 본다 — 한 장만 살아 있게 하려는 것이 목적이다. */
export function periodsOverlap(a: CouponPeriod, b: CouponPeriod): boolean {
  const aStart = Date.parse(a.startsAt);
  const aEnd = Date.parse(a.endsAt);
  const bStart = Date.parse(b.startsAt);
  const bEnd = Date.parse(b.endsAt);
  if (![aStart, aEnd, bStart, bEnd].every(Number.isFinite)) {
    // 읽을 수 없는 기간은 겹치는 것으로 본다 — 모르는 채로 발급을 통과시키는 것보다 낫다.
    return true;
  }
  return aStart <= bEnd && bStart <= aEnd;
}

/** 기존 쿠폰들 중 기간이 겹치는 첫 번째를 돌려준다(없으면 null). 비활성화된 것은 제외한다 —
 *  쓸 수 없는 쿠폰이 새 쿠폰의 기간을 막을 이유가 없다. */
export function findOverlapping<T extends CouponPeriod & { code: string; disabled?: boolean }>(
  existing: T[],
  candidate: CouponPeriod
): T | null {
  return existing.find((c) => c.disabled !== true && periodsOverlap(c, candidate)) ?? null;
}
