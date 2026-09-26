import type { SajuProduct } from "@/lib/saju/products";
import { productArt } from "../productArt";

/** 목업 `Fortune_Select_*` 의 첫 구역 — 히어로 이미지 + 카테고리 칩 + 제목 + 부제 + 설명 카드.
 *
 *  실측(목업 1236px = 뷰포트 412px, 3배. 색은 실측이 토큰과 맞는 것만 확인하고 토큰을 쓴다):
 *    · 이미지는 풀블리드 4:3(192~1119 = 927px ÷ 3 = 309 ≈ 412×3/4). 상단바 바로 아래에서 시작
 *    · 아래쪽이 페이지 배경으로 녹는다 — 라이트/다크 컬럼이 y=730(이미지 높이의 59%)부터
 *      갈라지고 바닥에서 --bg 로 수렴한다. 사각형 사진이 아니다
 *    · 칩: 가운데 정렬, 이미지 위 8, h25, 좌우 8, 14px. --chip-soft / --chip-soft-text
 *    · 제목: 24px Bold 흰색(이미지 위라 --bold-text 가 아니라 흰색이다), 이미지 바닥에 붙음
 *    · 부제: 이미지에서 8 아래, 16px, --placeholder, 가운데
 *    · 설명 카드: 부제에서 32 아래, h56, 좌우 여백 16, 라운드 12, 16px/19 두 줄, 가운데 */
export function ProductHero({ product }: { product: SajuProduct }) {
  const art = productArt(product.slug);
  /* 목록 카드와 **같은 규칙**이다 — `카테고리들 · 태그` 이고 맨 뒤 한 칸만 태그다
     (설계 §3, FortuneScreen 의 ProductCard 주석). 두 줄짜리 join 이라 공용 함수로 빼지 않았다. */
  const meta = [...product.categories, product.tag].join(" · ");

  return (
    <header>
      <div className="relative aspect-[4/3] w-full overflow-hidden">
        {/* 에셋은 아직 저장소에 없다 — `productArt` 가 단일 출처이고 지금은 전부 자리표다
            (그 파일 주석). 여기서 슬러그로 그림을 따로 찾지 않는다. */}
        {art ? (
          <img src={art} alt="" className="absolute inset-0 h-full w-full object-cover" />
        ) : (
          <div className="absolute inset-0 bg-chip-soft" aria-hidden="true" />
        )}
        {/* 정지점은 실측값이다(59%). Tailwind 의 gradient 유틸 대신 CSS 를 그대로 쓰는 건
            globals.css 의 다른 그라데이션들과 같은 이유 — 값이 실측이라 눈에 보여야 한다. */}
        <div
          className="absolute inset-0 bg-[linear-gradient(to_bottom,transparent_59%,var(--bg)_100%)]"
          aria-hidden="true"
        />
        <span className="absolute left-1/2 top-2 -translate-x-1/2 whitespace-nowrap rounded-full bg-chip-soft px-2 text-sm font-semibold leading-[25px] text-chip-soft-text">
          {meta}
        </span>
        {/* 제목은 상품 정의의 `title` 그대로다 — 이모지까지 포함해 기획 원문이다. */}
        <h1 className="absolute inset-x-0 bottom-0 px-4 text-center text-2xl font-bold text-white">
          {product.title}
        </h1>
      </div>

      <div className="px-4">
        <p className="mt-2 text-center text-base font-semibold text-placeholder">
          {product.subtitle}
        </p>
        <p className="mt-8 rounded-xl border border-border bg-surface px-4 py-2 text-center text-base font-semibold text-placeholder">
          {product.description}
        </p>
      </div>
    </header>
  );
}
