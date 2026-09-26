"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { openMenu } from "@/lib/ui/menuBus";
import { TarotFortuneToggle } from "@/components/TarotFortuneToggle";
import type { SajuProduct } from "@/lib/saju/products";
import { FORTUNE_FILTERS, fortuneFilterFromKey, fortuneListHref } from "./filters";
import { productMeta, productsFor } from "./productList";
import { productArt } from "./productArt";
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
 *  **선택된 필터는 URL 에 있다**(`?c=love`). 메뉴 드로어의 운세 8줄이 같은 주소로 들어오기
 *  때문이다 — 화면 안 상태로만 두면 드로어에서 고른 카테고리가 목록에 닿지 못한다. */

export function FortuneScreen() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const filter = fortuneFilterFromKey(searchParams.get("c"));
  const products = productsFor(filter);

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
                onOpen={() => router.push(`/fortune/${product.slug}`)}
              />
            ))}
          </div>
          {products.length === 0 && (
            <p className="py-10 text-center text-sm font-semibold text-placeholder">
              아직 준비 중인 카테고리예요.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function ProductCard({ product, onOpen }: { product: SajuProduct; onOpen: () => void }) {
  const art = productArt(product.slug, "card");
  /* 목업의 속궁합 카드는 `연애 · 궁합 · 속궁합` 이지만 상품표는 `궁합, 연애` 순이라 화면에는
     `궁합 · 연애 · 속궁합` 으로 나온다. 설계 §3 이 **상품표를 단일 출처**로 못박았고 목업
     카드의 순서는 예시로 읽으라고 적어 뒀다. */
  const meta = productMeta(product);

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
        {/* 세 모드 중 최저가인 사주 단품가. 목업에 "부터" 같은 말이 없어서 붙이지 않는다.
            라이트 목업의 `50% ₩4,450` 은 사주에 타로 쿠폰이 먹는다는 전제인데 아직 안 정해졌다 —
            정가 한 줄만 그린다(2026-09-26 판단). */}
        <p className="mt-auto text-right text-lg font-bold leading-none text-bold-text">
          ₩{product.pricesWon.saju.toLocaleString("ko-KR")}
        </p>
      </div>
    </button>
  );
}
