import { notFound } from "next/navigation";
import { getSajuProduct } from "@/lib/saju/products";
import { FortuneDetailScreen } from "./FortuneDetailScreen";

/** 운세 상품 한 개의 상세·구매 화면(목업 New/`Fortune_Select_Dark`·`_Light`).
 *
 *  화면 이름은 **운세**, 도메인 이름은 **사주**다 — 라우트는 `/fortune/[slug]`, 데이터는
 *  `src/lib/saju/products` 에서 온다(설계 doc/사주_구현설계.md §3).
 *
 *  상품 해석은 서버에서 한다. `getSajuProduct` 는 정적 레지스트리 조회라 클라이언트에서도
 *  돌아가지만, 없는 slug 를 `notFound()` 로 보내려면 서버 컴포넌트여야 한다 — 클라이언트에서
 *  걸러내면 없는 상품 URL 이 200 을 받고 화면 안에서만 "없음"이 된다. */
export default async function FortuneProductPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const product = getSajuProduct(slug);
  if (!product) notFound();
  return <FortuneDetailScreen product={product} />;
}
