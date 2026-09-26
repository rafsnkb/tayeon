// 상품 하나의 공개 후기 목록.
//
// **로그인을 요구하지 않는다.** 상품 상세는 사기 전에 보는 화면이라, 후기를 보려고 로그인해야
// 하면 후기를 두는 이유(사기 전 판단을 돕는 것)가 사라진다.
//
// 나가는 것은 `PublicSajuReview` 뿐이다 — 별점·본문·작성시각. **작성자 정보가 없다**(완전
// 익명, 2026-09-26 사용자 결정). `uid` 도 `readingId` 도 응답에 안 싣는다(`review.ts` 주석).
import { NextRequest, NextResponse } from "next/server";
import { getSajuProduct } from "@/lib/saju/products";
import { getSajuProductRating, listSajuReviews } from "@/lib/saju/review";

type Params = { params: Promise<{ slug: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { slug } = await params;
  // 없는 slug 로 컬렉션을 훑게 두지 않는다. 상품 레지스트리는 코드에 있어서 조회가 공짜다.
  if (!getSajuProduct(slug)) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const [reviews, rating] = await Promise.all([listSajuReviews(slug), getSajuProductRating(slug)]);
  return NextResponse.json({ reviews, rating });
}
