import { notFound } from "next/navigation";
import { getSajuProduct } from "@/lib/saju/products";
import { ReviewsScreen } from "./ReviewsScreen";

/** 상품 하나의 후기 전체 — 목업 New/`FortuneReview_Dark`·`_Light`.
 *
 *  상세 화면의 「모두 보기」가 오는 곳이다. **로그인을 요구하지 않는다** — 사기 전에 보는
 *  화면이라 후기를 보려고 로그인해야 하면 후기를 두는 이유가 사라진다.
 *
 *  없는 slug 를 `notFound()` 로 보내려면 서버 컴포넌트여야 한다(상세 화면과 같은 이유) —
 *  클라이언트에서 걸러내면 없는 상품 URL 이 200 을 받고 화면 안에서만 "없음"이 된다. */
export default async function FortuneReviewsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  if (!getSajuProduct(slug)) notFound();
  return <ReviewsScreen slug={slug} />;
}
