"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { useRouter } from "next/navigation";
import SubPageTopBar from "@/components/SubPageTopBar";
import { auth } from "@/lib/firebase/client";
import { formatDateTime } from "@/lib/util/formatDate";
import { getSajuProduct } from "@/lib/saju/products";
import type { SajuReadingSummary } from "@/lib/saju/view";
import { productArt } from "../fortune/productArt";
import { productMeta } from "../fortune/productList";
import { STORAGE_NOTICE } from "./storageNotice";

/** 운세 보관함 — 산 리포트를 다시 찾아가는 곳. 목업 New/`MyFortuneStorage_Dark`·`_Light`.
 *
 *  **약속된 화면이다.** 결제 화면의 환불 안내가 "마이 페이지→운세 보관함"이라고 가리키는 그곳
 *  이고, 아래 안내 상자의 두 줄은 그 안내와 **같은 출처**를 쓴다(`storageNotice.ts` → sub_4 의
 *  `refundNotice.ts` 의 `STORAGE_NOTICE`). 문장을 여기 옮겨 적지 말 것 — 정본은 거기 하나다.
 *
 *  **목록에 오는 것은 "읽을 수 있는 것"뿐이다**(2026-09-26 사용자 결정). 환불된 건과 보관
 *  만료된 건은 `GET /api/saju/readings` 가 뺀다 — 보관함은 "읽을 수 있는 것"의 목록이고,
 *  탭해도 안 열리는 카드를 두면 사용자는 고장으로 읽는다. 환불 기록은 결제 내역(`/purchase-history`)이 이미
 *  「환불완료」로 보여준다. **화면에서 다시 거르지 않는다** — 두 곳에서 거르면 한쪽이 잊는다.
 *
 *  실측(목업 1236px = 뷰포트 412px, 3배 / CSS px):
 *    · 첫 카드 top 80 = 상단바 64 + 16
 *    · 카드는 운세 목록과 같은 규격 — h114 · rounded-xl · p-2 · 썸네일 128x96 · 사이 8
 *    · 윗줄 `카테고리들 · 태그` 14px `--placeholder`, 제목 18px Bold 줄높이 22
 *    · 오른쪽 아래 **`구매 날짜: 2026.08.24 20:08:49`** 14px `--placeholder` — 초까지 찍는다
 *    · 썸네일 좌하단 배지 h22, 안쪽 4, 12px, 면 #ec5d59(두 모드 같은 값), 글자 `--bg`
 *    · 안내 상자 카드에서 24 아래, 전체폭, `--surface` + 테두리, 14px 줄높이 17 `--placeholder`
 *
 *  **목업에 없어서 넣지 않은 것**: 모드(사주/자미두수) 표기 — 목업 카드에 자리가 없다.
 *  진행률(「N장까지 읽음」)과 「만드는 중」도 없다. 그 자리가 구매 날짜다. */

/** 서버가 `expiresAt` 을 아직 주지 않는다(sub_2 작업 중). 필드가 붙으면 이 교차 타입을 지우고
 *  `SajuReadingSummary` 만 쓰면 된다 — 배지 쪽 코드는 그대로다. */
type ReadingRow = SajuReadingSummary & { expiresAt?: string | null };

/** 실패하면 조용히 빈 보관함으로 둔다 — "불러오지 못했다"고 말해도 사용자가 할 수 있는 일이
 *  없고, 아직 아무것도 안 산 상태와 화면상 구분할 필요도 없다. */
async function load(user: User, setReadings: (v: ReadingRow[]) => void) {
  try {
    const token = await user.getIdToken();
    const res = await fetch("/api/saju/readings", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return setReadings([]);
    const body: { readings?: ReadingRow[] } = await res.json();
    setReadings(body.readings ?? []);
  } catch {
    setReadings([]);
  }
}

export default function MyReadingsPage() {
  const router = useRouter();
  const [readings, setReadings] = useState<ReadingRow[] | null>(null);

  // 다른 서브페이지(/coupons 등)와 같은 방식이다 — 이펙트 본문에서 바로 setState 하지 않고
  // 구독 콜백에서 부르므로 연쇄 렌더를 만들지 않고, 토큰이 준비된 뒤에만 조회한다.
  useEffect(() => onAuthStateChanged(auth, (u) => { if (u) void load(u, setReadings); }), []);

  return (
    <>
      <SubPageTopBar title="운세 보관함" backHref="/me" />
      <div className="mx-auto w-full max-w-2xl px-4 pb-8 pt-20">
        {/* 로드 전에는 아무 말도 하지 않는다 — 빈 목록을 먼저 그리면 "산 게 없다"는 거짓말이
            된다(앱 셸의 서브페이지 게이트와 같은 이유). */}
        {readings === null ? null : readings.length === 0 ? (
          <p className="py-16 text-center text-sm font-semibold text-placeholder">
            아직 보관된 운세가 없어요.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {readings.map((reading) => (
              <ReadingCard
                key={reading.id}
                reading={reading}
                onOpen={() => router.push(`/fortune/readings/${reading.id}`)}
              />
            ))}
          </div>
        )}

        {/* 안내는 목록이 비어 있어도 둔다 — 보관 기간 안내가 목록이 왜 비었는지에 대한
            답이기도 하다. 로드 전(null)에만 감춘다. */}
        {readings !== null && STORAGE_NOTICE.length > 0 && (
          <ul className="mt-6 list-disc rounded-xl border border-border bg-surface py-2 pl-9 pr-4 text-sm font-semibold leading-[17px] text-placeholder">
            {STORAGE_NOTICE.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}

function ReadingCard({ reading, onOpen }: { reading: ReadingRow; onOpen: () => void }) {
  /* 제목·카테고리 줄은 응답이 아니라 슬러그로 찾는다 — 상품 정의가 단일 출처이고, 제목을 응답에
     실어 나르면 상품 제목을 고쳤을 때 예전에 산 건만 옛 제목으로 남는다. 모르는 슬러그(상품이
     내려간 뒤)는 슬러그를 그대로 보여준다. 살 수 없게 된 상품이어도 **이미 산 건은 읽을 수
     있어야 하므로** 여기서는 `purchasableSajuProducts()` 로 거르지 않는다.

     썸네일도 목록 화면과 같은 `productArt(slug)` 다. `hasImage` 는 리포트 **안**의 생성
     이미지라 다른 물건이고, 그건 인증이 필요해서 `<img src>` 로 걸 수 없다. */
  const product = getSajuProduct(reading.productSlug);
  const art = productArt(reading.productSlug, "card");

  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex w-full items-stretch gap-2 rounded-xl border border-border bg-surface p-2 text-left"
    >
      <div className="relative h-24 w-32 shrink-0">
        {art ? (
          <img src={art} alt="" className="h-24 w-32 rounded-md object-cover" />
        ) : (
          <div className="h-24 w-32 rounded-md bg-chip-soft" aria-hidden="true" />
        )}
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <p className="text-sm font-semibold leading-none text-placeholder">
          {product ? productMeta(product) : reading.productSlug}
        </p>
        <p className="text-lg font-bold leading-[22px] text-bold-text">
          {product?.title ?? reading.productSlug}
        </p>
        {/* 목업이 초까지 찍는다. 형식은 다른 화면과 같은 공통 함수다. */}
        <p className="mt-auto text-right text-sm font-semibold leading-none text-placeholder">
          구매 날짜: {formatDateTime(reading.createdAt)}
        </p>
      </div>
    </button>
  );
}
