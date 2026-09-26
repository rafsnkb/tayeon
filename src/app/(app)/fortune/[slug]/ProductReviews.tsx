"use client";

// 상품 상세의 「사용자 실제 리뷰」 구역 — 히어로와 설명 카드 사이(목업 `Fortune_Select_*`).
//
// **한 장만 보여주고 나머지는 별도 화면으로 보낸다.** 여기는 사기 전에 보는 자리라 "실제
// 사람이 썼다"만 전해지면 충분하고, 목록을 길게 깔면 상품 설명·목차·입력 폼이 전부 스크롤
// 아래로 밀린다.
//
// 작성자 표기가 **없다**(완전 익명, 2026-09-26 사용자 결정). 닉네임은 "AI 가 부를 호칭"으로
// 받은 값이라 공개 게시물 이름으로 쓰면 목적 외 이용이 된다.
import { useEffect, useState } from "react";
import Link from "next/link";
import type { PublicSajuReview } from "@/lib/saju/review";

/** 별점 다섯 개. 목록 화면과 같은 모양이라 여기 한 벌만 두고 내보낸다. */
export function ReviewStars({ stars }: { stars: number }) {
  return (
    <div className="flex items-center gap-1" aria-label={`별점 ${stars}점`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <svg key={n} viewBox="0 0 24 24" className="h-5 w-5" aria-hidden>
          <path
            d="M12 2.6l2.94 5.96 6.58.96-4.76 4.64 1.12 6.55L12 17.7l-5.88 3.09 1.12-6.55L2.48 9.6l6.58-.96L12 2.6z"
            className={n <= stars ? "fill-point" : "fill-chip-soft"}
          />
        </svg>
      ))}
    </div>
  );
}

/** 상세에 미리 보여줄 때만 자른다. **목록 화면에서는 안 자른다** — 거기는 읽으러 가는 곳이다. */
const PREVIEW_CHARS = 120;

export function ProductReviews({ slug }: { slug: string }) {
  const [reviews, setReviews] = useState<PublicSajuReview[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(`/api/saju/products/${slug}/reviews`);
        if (!res.ok) return;
        const body = (await res.json()) as { reviews?: PublicSajuReview[] };
        if (!cancelled) setReviews(body.reviews ?? []);
      } catch {
        // 조용히 접는다 — 후기를 못 불러온 것은 사용자가 할 수 있는 일이 없고, 상품을 사는
        // 데 필요한 정보도 아니다. 아직 아무도 안 쓴 상태와 화면상 구분할 이유가 없다.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  // 후기가 하나도 없으면 **구역 자체를 안 그린다.** "아직 후기가 없어요"는 팔기 직전 화면에서
  // 굳이 할 말이 아니다.
  const first = reviews?.[0];
  if (!first) return null;

  const truncated = first.body.length > PREVIEW_CHARS;

  return (
    <section className="mt-6 px-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-base font-semibold text-placeholder">사용자 실제 리뷰</p>
        <Link
          href={`/fortune/${slug}/reviews`}
          className="shrink-0 rounded-full bg-chip-soft px-4 py-1.5 text-sm font-bold text-chip-soft-text"
        >
          모두 보기
        </Link>
      </div>

      <div className="mt-2 rounded-2xl border border-border bg-surface p-4">
        <ReviewStars stars={first.stars} />
        <p className="mt-3 whitespace-pre-line text-base font-semibold leading-relaxed text-text">
          {truncated ? `${first.body.slice(0, PREVIEW_CHARS)}....` : first.body}
          {truncated && (
            <>
              {" "}
              <Link href={`/fortune/${slug}/reviews`} className="font-bold text-point-text">
                더보기
              </Link>
            </>
          )}
        </p>
      </div>
    </section>
  );
}
