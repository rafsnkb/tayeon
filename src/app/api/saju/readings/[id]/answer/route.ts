// 사연 답변 장. 총평과 같은 이유로 POST 다 — 없으면 모델을 부르고 돈이 나간다.
//
// **언제 부르는가**: 총평과 같은 자리다(총평 바로 앞 장에 들어설 때, §6). 총평 라우트가
// 답변을 먼저 만들도록 `produce.ts` 가 이미 엮어 놨으므로 화면이 이걸 따로 안 불러도
// 결국 만들어지지만, **화면은 답변 장을 총평보다 먼저 보여준다** — 그때까지 기다리게 두면
// 총평을 만드는 동안 답변 장이 비어 있다. 그래서 별도 라우트가 있다.
import { NextRequest, NextResponse } from "next/server";
import { getUidFromRequest } from "@/lib/auth/verifyRequest";
import { produceAnswer } from "@/lib/saju/produce";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const uid = await getUidFromRequest(req);
  if (!uid) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;
  const result = await produceAnswer({ uid, id });

  if (result.outcome === "not_found") {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  if (result.outcome === "no_question") {
    // 사연을 안 적었다. **오류가 아니다** — 이 장이 없는 것이 정상이고, 화면은 애초에 이
    // 장을 세지 않으므로 여기 올 일이 거의 없다. 그래도 직접 호출은 가능하니 답을 정해 둔다.
    // 404 가 아닌 이유: 리포트는 있다. 없는 건 이 장뿐이다.
    return NextResponse.json({ error: "no_question" }, { status: 409 });
  }

  if (result.outcome === "all_sections_failed") {
    return NextResponse.json({ error: "all_sections_failed" }, { status: 409 });
  }

  if (result.outcome === "not_producible") {
    return NextResponse.json({ error: "not_producible" }, { status: 409 });
  }

  if (result.outcome === "product_gone") {
    return NextResponse.json({ error: "product_gone" }, { status: 409 });
  }

  if (result.outcome === "sections_incomplete") {
    return NextResponse.json(
      { error: "sections_incomplete", missing: result.missing },
      { status: 409 }
    );
  }

  return NextResponse.json({ answer: result.answer });
}
