/**
 * 상품 목록의 카드 한 장(목업 Buy_CountPass / Buy_TimePass, 2026-09-25).
 *
 * 예전 카드는 전체폭 80px 줄에 텍스처를 깔고 어두운 막을 덮어 흰 글자를 얹는 모양이었다.
 * 새 목업은 **2열 그리드의 세로 카드**이고, 상품마다 고유한 그림이 위를 채운 뒤 아래로
 * 카드 바탕색까지 흐려진다 — 이름은 그 흐려진 자리에 겹쳐 놓인다(실측: 카드 184×262,
 * 그림 정사각 184, 이름 잉크가 그림 아래끝 179~198 구간에 걸친다).
 *
 * 그러데이션은 여기서 덧씌운다. 그림 파일 자체에는 흰 페이드가 없어서, 카드 바탕색을 따라가야
 * 다크 모드에서도 이어진다.
 */

/** "추가 횟수 +8.5% 포함"의 백분율만 포인트색으로 남긴다 — 목업이 그 숫자만 핑크다. */
function highlightPercent(text: string) {
  return text.split(/(\+[\d.]+%)/).map((part, i) =>
    /^\+[\d.]+%$/.test(part) ? (
      <span key={i} className="text-point-text">
        {part}
      </span>
    ) : (
      part
    )
  );
}

/** 할인이 걸린 카드의 가격 줄(목업 Buy_TimePass_*, 2026-09-25).
 *
 *  `50% ₩4,450` 한 줄 + 아래에 정가를 취소선으로. 할인율만 포인트색이고 실제 낼 금액은 본문
 *  색 그대로다 — 눈이 먼저 닿아야 하는 건 "얼마를 내는가"이고, 몇 %인지는 그 이유다. */
function PriceLines({ price, discount }: { price: string; discount?: { percent: number; listPrice: string } }) {
  if (!discount) return <p className="mt-5 text-base font-bold text-bold-text">{price}</p>;
  return (
    <div className="mt-3">
      <p className="text-base font-bold text-bold-text">
        <span className="text-point-text">{discount.percent}%</span> {price}
      </p>
      <p className="text-sm font-semibold text-icon-muted line-through">{discount.listPrice}</p>
    </div>
  );
}

export default function PassArtCard({
  art,
  name,
  caption,
  price,
  discount,
  onClick,
  disabled,
}: {
  art: string;
  name: string;
  caption: string;
  /** 실제로 낼 금액. 할인이 걸리면 할인가다. */
  price: string;
  /** 있으면 정가를 취소선으로 함께 보여준다. */
  discount?: { percent: number; listPrice: string };
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="relative flex h-[262px] flex-col overflow-hidden rounded-[20px] bg-topbar text-left disabled:opacity-60"
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- 정적 webp 18장, 크기도 고정이라 최적화할 것이 없다 */}
      <img src={art} alt="" className="absolute inset-x-0 top-0 h-[200px] w-full object-cover" />
      <div className="absolute inset-x-0 top-[112px] h-[88px] bg-gradient-to-b from-transparent to-topbar" />
      <div className="relative mt-auto px-2 pb-2 text-center">
        <p className="truncate text-lg font-bold text-bold-text">{name}</p>
        <p className="mt-0.5 truncate text-xs font-semibold text-icon-muted">{highlightPercent(caption)}</p>
        <PriceLines price={price} discount={discount} />
      </div>
    </button>
  );
}

/** 구입 상세 맨 위의 큰 그림(목업 Buy_*_Purchase). 목록 카드와 같은 그림을 화면 폭으로 쓴다 —
 *  좌우 여백 없이 붙으므로 바깥 패딩 밖에 놓아야 한다. */
export function PassArtHero({ art, name, caption }: { art: string; name: string; caption: string }) {
  return (
    <div className="relative h-[340px] w-full">
      {/* eslint-disable-next-line @next/next/no-img-element -- 위와 같음 */}
      <img src={art} alt="" className="absolute inset-0 h-full w-full object-cover" />
      <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-b from-transparent to-bg" />
      <div className="absolute inset-x-0 bottom-4 px-4 text-center">
        <p className="text-3xl font-bold text-bold-text">{name}</p>
        <p className="mt-1 text-base font-semibold text-icon-muted">{highlightPercent(caption)}</p>
      </div>
    </div>
  );
}
