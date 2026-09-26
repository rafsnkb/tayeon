"use client";

// 후기 목록. 카드 하나에 별점 + 본문 전문이고, **작성자 표기가 없다**(완전 익명).
//
// 본문을 자르지 않는다 — 상세의 미리보기는 자르지만 여기는 읽으러 온 자리다.
import { useEffect, useState } from "react";
import SubPageTopBar from "@/components/SubPageTopBar";
import type { PublicSajuReview } from "@/lib/saju/review";
import { ReviewStars } from "../ProductReviews";

export function ReviewsScreen({ slug }: { slug: string }) {
  const [reviews, setReviews] = useState<PublicSajuReview[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(`/api/saju/products/${slug}/reviews`);
        if (!res.ok) return void (!cancelled && setReviews([]));
        const body = (await res.json()) as { reviews?: PublicSajuReview[] };
        if (!cancelled) setReviews(body.reviews ?? []);
      } catch {
        if (!cancelled) setReviews([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  return (
    <>
      <SubPageTopBar title="사용자 실제 리뷰" backHref={`/fortune/${slug}`} />
      <div className="mx-auto w-full max-w-2xl px-4 pb-8 pt-20">
        {/* 불러오기 전에는 아무 말도 하지 않는다 — 빈 목록을 먼저 그리면 "후기가 없다"는
            거짓말이 된다(운세 보관함과 같은 규칙). */}
        {reviews === null ? null : reviews.length === 0 ? (
          <p className="py-16 text-center text-sm font-semibold text-placeholder">
            아직 남겨진 후기가 없어요.
          </p>
        ) : (
          <div className="flex flex-col gap-4">
            {reviews.map((review, i) => (
              // 익명이라 문서 id 가 없다(응답에 안 싣는다 — `review.ts` 의 `PublicSajuReview`).
              // 목록이 다시 정렬되지 않는 읽기 전용 화면이라 인덱스 키로 충분하다.
              <article key={i} className="rounded-2xl border border-border bg-surface p-4">
                <ReviewStars stars={review.stars} />
                <p className="mt-4 whitespace-pre-line text-base font-semibold leading-relaxed text-text">
                  {review.body}
                </p>
              </article>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
