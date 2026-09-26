// 뷰어가 처음 열릴 때 한 번 부르는 자리 — 리포트 상태 + 지금까지 저장된 페이지 전부.
//
// 주소는 `saju` 인데 화면은 `fortune` 이다. 의도적으로 갈라 뒀다(설계 §3) — 사용자가 보는 말은
// "운세"이고, 라이브러리·컬렉션·설계 문서는 전부 "사주"로 쓰여 있다.
import { NextRequest, NextResponse } from "next/server";
import { getUidFromRequest } from "@/lib/auth/verifyRequest";
import { getSajuProduct } from "@/lib/saju/products";
import { getSajuReadingWithPages } from "@/lib/saju/storage";
import { getSajuReview } from "@/lib/saju/review";
import { toReadingView } from "@/lib/saju/view";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const uid = await getUidFromRequest(req);
  if (!uid) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;
  const loaded = await getSajuReadingWithPages(uid, id);
  // 남의 리포트를 볼 수 없다는 건 경로가 보장한다 — 문서가 `users/{uid}` 아래에 있으므로
  // 다른 사람의 id 를 넣으면 그냥 없는 문서가 된다. 소유자 검사를 따로 두지 않는 이유다.
  if (!loaded) return NextResponse.json({ error: "not_found" }, { status: 404 });

  // 상품이 레지스트리에서 빠졌는데 그 상품으로 팔린 리포트가 남아 있을 수 있다. **읽기는
  // 막지 않는다** — 이미 돈을 받은 결과물이고 본문은 문서에 얼려 있다. 상품에서 오는 건 섹션
  // 제목뿐이라 그것만 골격의 요지로 대신한다(`toReadingView`).
  //
  // 반대로 **생성은 막는다**(`produce.ts` 가 `SAJU_PRODUCT_GONE` 을 던진다). 아직 안 만든
  // 섹션은 상품의 문체 규칙·중점이 있어야 쓸 수 있어서, 없는 채로 만들면 앞뒤가 다른 글이 된다.
  const product = getSajuProduct(loaded.reading.productSlug);

  // 내가 남긴 후기. 문서 하나 더 읽는 값으로 "총평 장이 폼으로 깜빡였다가 읽기 전용이 되는"
  // 일을 없앤다. 실패해도 읽기를 막지 않는다 — 후기는 리포트를 읽는 데 필요한 것이 아니다.
  const myReview = await getSajuReview(id).catch(() => null);

  return NextResponse.json(toReadingView(loaded.reading, loaded.pages, product, myReview));
}
