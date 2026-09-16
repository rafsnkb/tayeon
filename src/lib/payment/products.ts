// 포트원 결제의 customData에 실어 보낼 "상품 식별자"와, 그 식별자를 pricing.ts의 실제 상품
// 정의(가격/코인수/분)로 되돌리는 로직. 서버가 결제 금액을 검증할 때 반드시 이 표에 있는
// 가격과 실제 결제 금액이 일치하는지 대조한다 — 클라이언트가 보낸 금액은 절대 신뢰하지 않는다.
import { COIN_PACKAGES, TIME_PASS_PACKAGES } from "@/lib/tarot/pricing";

export type ProductType = "coin" | "timePass";

export type ResolvedProduct =
  | {
      type: "coin";
      productId: string;
      priceWon: number;
      coins: number;
      orderName: string;
    }
  | {
      type: "timePass";
      productId: string;
      priceWon: number;
      minutes: number;
      includesOptions: boolean;
      orderName: string;
    };

/** COIN_PACKAGES/TIME_PASS_PACKAGES 안에서 골라 쓸 수 있는 productId 목록(프론트에서 사용). */
export function listCoinProductIds(): { productId: string; priceWon: number; coins: number }[] {
  return COIN_PACKAGES.map((pkg) => ({
    productId: pkg.id,
    priceWon: pkg.priceWon,
    coins: pkg.coins,
  }));
}

export function listTimePassProductIds(): {
  productId: string;
  priceWon: number;
  minutes: number;
  includesOptions: boolean;
}[] {
  return TIME_PASS_PACKAGES.map((pkg) => ({
    productId: pkg.id,
    priceWon: pkg.priceWon,
    minutes: pkg.minutes,
    includesOptions: pkg.includesOptions,
  }));
}

/**
 * productId(pricing.ts의 고정 id, 예: "coin-2", "timepass-30")로부터 실제 상품을 찾는다.
 * pricing.ts에 없는 값이면 null — 클라이언트가 임의로 만들어낸 productId를 거른다.
 */
export function resolveProduct(productId: unknown): ResolvedProduct | null {
  if (typeof productId !== "string") return null;

  const coinPkg = COIN_PACKAGES.find((pkg) => pkg.id === productId);
  if (coinPkg) {
    return {
      type: "coin",
      productId,
      priceWon: coinPkg.priceWon,
      coins: coinPkg.coins,
      orderName: `타연 코인 ${coinPkg.coins.toLocaleString("ko-KR")}개`,
    };
  }

  const timePassPkg = TIME_PASS_PACKAGES.find((pkg) => pkg.id === productId);
  if (timePassPkg) {
    return {
      type: "timePass",
      productId,
      priceWon: timePassPkg.priceWon,
      minutes: timePassPkg.minutes,
      includesOptions: timePassPkg.includesOptions,
      orderName: `타연 시간제 이용권 ${timePassPkg.minutes}분`,
    };
  }

  return null;
}
