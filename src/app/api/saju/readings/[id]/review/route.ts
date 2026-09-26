// 후기·별점 남기기. 리포트 하나에 **한 번**이고 고칠 수 없다(`review.ts` 머리말).
//
// **읽기 라우트가 없다.** 본인 후기는 리포트 조회(`GET /api/saju/readings/{id}`)가 `myReview`
// 로 같이 실어 준다 — 뷰어가 총평 장을 그릴 때 이미 그 응답을 들고 있어서, 따로 한 번 더
// 부르면 왕복만 는다.
import { NextRequest, NextResponse } from "next/server";
import { getUidFromRequest } from "@/lib/auth/verifyRequest";
import { getSajuReading } from "@/lib/saju/storage";
import { submitSajuReview, validateReviewInput } from "@/lib/saju/review";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const uid = await getUidFromRequest(req);
  if (!uid) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as { stars?: unknown; body?: unknown };

  const input = validateReviewInput(body.stars, body.body);
  if (!input.ok) return NextResponse.json({ error: input.message }, { status: 400 });

  // **상품 slug 를 클라이언트에서 받지 않는다.** 받으면 남의 상품에 후기를 달 수 있다 —
  // 집계가 상품별이라 그대로 평점 조작이 된다. 리포트 문서에서 읽는다.
  //
  // 이 조회가 소유권 검사도 겸한다: `getSajuReading(uid, id)` 는 `users/{uid}` 아래만 본다.
  const reading = await getSajuReading(uid, id);
  if (!reading) return NextResponse.json({ error: "not_found" }, { status: 404 });

  // 총평까지 나온 리포트만 후기를 받는다. **다 읽었는지는 묻지 않는다** — 그건 알 수도 없고
  // (`lastReadPage` 는 "가장 최근 위치"라 뒤로 돌아가면 줄어든다), 화면상 후기 폼 자체가
  // 총평 장에 있다. 여기서 재는 건 "읽을 것이 완성되긴 했나" 하나다.
  if (reading.status !== "complete") {
    return NextResponse.json({ error: "아직 리포트가 완성되지 않았어요." }, { status: 409 });
  }

  const result = await submitSajuReview({
    uid,
    readingId: id,
    productSlug: reading.productSlug,
    stars: input.stars,
    body: input.body,
  });

  if (result.outcome === "exists") {
    return NextResponse.json({ error: "이미 후기를 남기셨어요." }, { status: 409 });
  }
  if (result.outcome === "invalid") {
    return NextResponse.json({ error: result.message }, { status: 400 });
  }

  return NextResponse.json({ review: result.review, reward: result.reward });
}
