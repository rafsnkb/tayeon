"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { openMenu } from "@/lib/ui/menuBus";
import { TarotFortuneToggle } from "@/components/TarotFortuneToggle";
import type { SajuProduct } from "@/lib/saju/products";
import { useRooms, type ActiveCoupon } from "@/lib/tarot/RoomsContext";
import { discountedAmount } from "@/lib/payment/discountCoupon";
import { FORTUNE_FILTERS, fortuneFilterFromKey, fortuneListHref } from "./filters";
import { productMeta, productsFor } from "./productList";
import { productArt } from "./productArt";
import { MainCompanyInfo } from "@/components/MainCompanyInfo";
import { FortunePitch } from "./FortunePitch";
import { MenuIcon } from "../tarot/icons";

/** 사주·자미두수 상품 목록. 화면 이름은 **운세**, 도메인 이름은 **사주**다 — 라우트는
 *  `/fortune`, 데이터는 `src/lib/saju` 로 갈린다.
 *
 *  목업 New/`Fortune_Home_Dark`·`Fortune_Home_Light`. 값은 전부 픽셀 실측이고(목업 1236px =
 *  뷰포트 412px, 3배), 색은 실측이 기존 토큰과 맞아떨어지는 것만 확인하고 **토큰을 쓴다** —
 *  카드 테두리처럼 목업이 토큰보다 한 단계 진한 자리가 몇 군데 있지만 토큰이 이긴다.
 *
 *  실측 요약(CSS px):
 *    · 좌우 여백 16 / 상단바 아래 16 부터 칩
 *    · 칩 h32 · rounded-full · px16 · 16px 글자 · 가로 간격 10 · 줄 간격 8 · 가운데 정렬 줄바꿈
 *    · 섹션 헤딩 16px Bold, 칩에서 20 아래 · 카드에서 8 위 · 가운데
 *    · 카드 h114(= 썸네일 96 + p8*2 + 테두리) · rounded-xl · 사이 8
 *    · 썸네일 128x96 rounded-md, 글 칸과 8 벌어짐
 *    · 카테고리 줄 14px `--placeholder` / 제목 18px Bold 줄높이 22 / 가격 18px Bold 우측 하단
 *
 *  **비로그인도 이 화면을 본다**(2026-09-27 사용자 결정). 예전에는 소개 화면(`FortuneIntro`)이
 *  따로 갈라져 있었는데 없앴다 — 타로 쪽이 이미 화면 하나로 둘 다 받고 있었고(`TarotScreen`),
 *  실제 상품·가격을 보여주는 편이 카피만 읽히는 화면보다 설득력이 있다. 소개 화면이 하던 두
 *  가지는 각각 자리를 옮겼다: 여섯 줄 카피는 `FortunePitch`(목록 위), 사업자정보는 맨 아래
 *  `MainCompanyInfo`.
 *
 *  **선택된 필터는 URL 에 있다**(`?c=love`). 메뉴 드로어의 운세 8줄이 같은 주소로 들어오기
 *  때문이다 — 화면 안 상태로만 두면 드로어에서 고른 카테고리가 목록에 닿지 못한다. */

export function FortuneScreen() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const filter = fortuneFilterFromKey(searchParams.get("c"));
  const products = productsFor(filter);
  // `activeCoupon` — 할인쿠폰은 사주에도 적용된다(2026-09-27 사용자 결정, 아래 ProductCard 주석).
  //
  // `authChecked` — 이게 참이 되기 전에는 소개 블록을 **그리지 않는다**. `!user` 를 그냥
  // 믿으면 이미 로그인한 사람에게도 세션 복원 수백 ms 동안 "로그인하세요" 블록이 번쩍인다
  // (없어진 `FortuneEntry` 가 같은 이유로 들고 있던 가드를 여기로 옮겼다).
  const { activeCoupon, user, authChecked } = useRooms();

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* 상단바는 대화 화면(TarotScreen)과 같은 껍데기다 — 높이 64, 글래스 표면, 아래 경계선.
          가운데 토글을 **바의 한가운데**에 두려면 왼쪽 햄버거와 같은 폭의 빈 칸이 오른쪽에
          있어야 한다(TarotScreen 의 메인 분기와 같은 이유). */}
      <div className="app-topbar-glass relative z-20 flex h-16 shrink-0 items-center border-b border-border">
        <button
          type="button"
          onClick={openMenu}
          aria-label="메뉴 열기"
          className="flex h-16 w-16 shrink-0 items-center justify-center text-icon-muted xl:hidden"
        >
          <MenuIcon className="h-3 w-5" />
        </button>
        <div className="flex flex-1 justify-center">
          <TarotFortuneToggle active="fortune" />
        </div>
        <div className="w-16 shrink-0 xl:w-4" aria-hidden="true" />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-2xl px-4 pb-8 pt-4">
          {authChecked && !user && (
            <div className="mb-6">
              <FortunePitch />
            </div>
          )}

          {/* 칩은 아이콘 없이 글자만이다 — `public/icons/fortune_category_*` 는 메뉴 드로어의
              8줄용이고(설계 §3), 목업의 칩에는 아이콘이 없다.
              누르면 주소가 바뀐다. `replace` 라서 칩을 열 번 눌러도 뒤로가기 한 번이면 나간다. */}
          <div className="flex flex-wrap justify-center gap-x-2.5 gap-y-2">
            {FORTUNE_FILTERS.map((item) => {
              const selected = item.key === filter.key;
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => router.replace(fortuneListHref(item.key))}
                  aria-pressed={selected}
                  className={`h-8 shrink-0 rounded-full px-4 text-base ${
                    selected
                      ? "point-pill font-bold shadow-[0_0_20px_3px_var(--point-glow),inset_0_0_6px_0_var(--point-rim)]"
                      : "bg-chip-soft font-semibold text-placeholder"
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </div>

          <h1 className="mb-2 mt-5 text-center text-base font-bold text-bold-text">
            {filter.label} 운세
          </h1>

          <div className="flex flex-col gap-2">
            {products.map((product) => (
              <ProductCard
                key={product.slug}
                product={product}
                activeCoupon={activeCoupon}
                onOpen={() => router.push(`/fortune/${product.slug}`)}
              />
            ))}
          </div>
          {products.length === 0 && (
            <p className="py-10 text-center text-sm font-semibold text-placeholder">
              아직 준비 중인 카테고리예요.
            </p>
          )}

          {/* 사업자정보. 전자상거래법 제10조①·시행규칙 제7조①의 표시 의무가 **초기 화면**
              기준이고, 운세 홈은 토글로 갈리는 두 초기 화면 중 하나다. 소개 화면이 들고 있던
              것을 그대로 옮겨 왔다 — **비로그인에게도 보여야 하므로 로그인 분기 밖에 둔다**
              (`TarotScreen` 이 같은 이유로 `user` 블록 밖에 두는 것과 같다). */}
          <div className="mt-8">
            <MainCompanyInfo />
          </div>
        </div>
      </div>
    </div>
  );
}

function ProductCard({
  product,
  activeCoupon,
  onOpen,
}: {
  product: SajuProduct;
  activeCoupon: ActiveCoupon | null;
  onOpen: () => void;
}) {
  const art = productArt(product.slug, "card");
  /* 목업의 속궁합 카드는 `연애 · 궁합 · 속궁합` 이지만 상품표는 `궁합, 연애` 순이라 화면에는
     `궁합 · 연애 · 속궁합` 으로 나온다. 설계 §3 이 **상품표를 단일 출처**로 못박았고 목업
     카드의 순서는 예시로 읽으라고 적어 뒀다. */
  const meta = productMeta(product);
  // 세 모드 중 최저가인 사주 단품가. 목업에 "부터" 같은 말이 없어서 붙이지 않는다.
  // 라이트 목업의 `50% ₩4,450` 은 사주에 타로 쿠폰이 먹는다는 전제였는데, 2026-09-27
  // 사용자가 "할인쿠폰은 사주에도 적용된다"고 정하면서 그 전제가 풀렸다 — 정가만 그리던 걸
  // 멈추고 할인가를 그린다. 표시가는 `discountedAmount`(discountCoupon.ts) 그대로 쓴다 —
  // 여기서 따로 계산하면 결제창 금액과 갈릴 수 있다(그 파일 머리말 경고와 같은 사고).
  const listPrice = product.pricesWon.saju;
  const discounted = activeCoupon ? discountedAmount(listPrice, activeCoupon.discountRate) : null;

  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex w-full items-stretch gap-2 rounded-xl border border-border bg-surface p-2 text-left"
    >
      {/* 자리표는 빈 면 하나다 — 목업에 없는 아이콘을 여기 끼워 넣지 않는다(productArt 주석). */}
      {art ? (
        <img src={art} alt="" className="h-24 w-32 shrink-0 rounded-md object-cover" />
      ) : (
        <div className="h-24 w-32 shrink-0 rounded-md bg-chip-soft" aria-hidden="true" />
      )}
      <div className="flex min-w-0 flex-1 flex-col">
        <p className="text-sm font-semibold leading-none text-placeholder">{meta}</p>
        {/* 제목은 줄 수를 자르지 않는다 — 목업의 세 번째 카드가 3줄이다. */}
        <p className="text-lg font-bold leading-[22px] text-bold-text">{product.title}</p>
        {discounted ? (
          <div className="mt-auto text-right">
            <p className="text-xs font-semibold text-icon-muted line-through">
              ₩{listPrice.toLocaleString("ko-KR")}
            </p>
            <p className="text-lg font-bold leading-none text-bold-text">
              <span className="text-point-text">{Math.round(activeCoupon!.discountRate * 100)}%</span> ₩
              {discounted.amountWon.toLocaleString("ko-KR")}
            </p>
          </div>
        ) : (
          <p className="mt-auto text-right text-lg font-bold leading-none text-bold-text">
            ₩{listPrice.toLocaleString("ko-KR")}
          </p>
        )}
      </div>
    </button>
  );
}
