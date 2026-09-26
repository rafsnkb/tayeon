import type { SajuProduct } from "@/lib/saju/products";

/** 목업의 「해석 내용」 구역 — `product.sections` 를 `#1`..`#N` 으로 나열한다.
 *
 *  **개수는 상품마다 다르다**(10~18). 목업은 10개짜리(`reunion-reading`)를 그렸을 뿐이라
 *  높이를 고정하지 않는다. 이미지 상품(솔로·결혼 시기·자녀)의 이미지 장은 `sections` 에 없으니
 *  여기에도 안 나온다 — 텍스트 섹션만 세는 게 맞다(설계 §10 「섹션 수는 기획 문서와 다르다」).
 *
 *  실측(목업 3배): 줄 66(10줄 660 = 카드 안높이와 정확히 일치 → 카드에 세로 패딩이 없다),
 *  동그라미 48, 좌우 들여쓰기 8(구분선도 같은 8만큼 들어간다), 동그라미↔제목 8, 카드 라운드 28.
 *  구분선을 줄 높이 안에 넣어야(`border-box`) 카드 높이가 660 으로 떨어진다.
 *
 *  「#N」 글자색은 목업이 다크 #ffffff / 라이트 #6b6666 으로 한 쌍을 이루지 않는다. 옅은 칩 면
 *  위의 글자는 --chip-soft-text 가 그 자리의 토큰이라 그걸 쓴다(토큰 우선). */
export function SectionOutline({ product }: { product: SajuProduct }) {
  return (
    <section className="px-4">
      <h2 className="mb-1.5 mt-10 text-center text-base font-bold text-bold-text">해석 내용</h2>
      <ol className="overflow-hidden rounded-[28px] border border-border bg-surface">
        {product.sections.map((section, index) => (
          <li key={section.id} className="px-2">
            <div
              className={`flex h-[66px] items-center gap-2 ${
                index > 0 ? "border-t border-border" : ""
              }`}
            >
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-chip-soft text-base font-bold text-chip-soft-text">
                #{index + 1}
              </span>
              <span className="min-w-0 flex-1 text-base font-semibold text-bold-text">
                {section.title}
              </span>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
