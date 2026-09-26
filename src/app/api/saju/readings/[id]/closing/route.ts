// 마지막 페이지(총평). 섹션과 같은 이유로 POST 다 — 없으면 모델을 부르고 돈이 나간다.
//
// **언제 부르는가가 중요하다.** 총평은 전 섹션의 결론을 받아 쓰므로 마지막 섹션이 끝나야
// 만들 수 있는데, 그때 만들기 시작하면 사용자가 마지막 페이지에서 기다리게 된다. 그래서
// 화면은 **이미지 페이지에 들어설 때** 이걸 부른다(§6) — 사용자가 그림을 보는 동안 만들면
// 지연이 보이지 않는다. 그 판단은 화면이 하고 이 라우트는 하지 않는다.
import { NextRequest, NextResponse } from "next/server";
import { getUidFromRequest } from "@/lib/auth/verifyRequest";
import { produceClosing } from "@/lib/saju/produce";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const uid = await getUidFromRequest(req);
  if (!uid) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;
  const result = await produceClosing({ uid, id });

  if (result.outcome === "not_found") {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  if (result.outcome === "all_sections_failed") {
    // 읽을 수 있는 섹션이 하나도 없다. 운영자에게 urgent 알림이 이미 나갔다(`produce.ts`).
    // 화면은 "다시 시도"가 아니라 **고객센터 안내**를 띄워야 하므로 다른 코드로 준다.
    return NextResponse.json({ error: "all_sections_failed" }, { status: 409 });
  }

  if (result.outcome === "product_gone") {
    // 상품이 레지스트리에서 빠졌다. 저장된 본문은 계속 읽히지만(`view.ts`) 총평은 상품의
    // 문체 규칙 위에서 쓰이므로 만들 수 없다. 500 이 아니라 409 인 이유: 기다려서 풀리는
    // 일이 아니라 화면이 "마지막 장은 준비되지 않았어요"로 끝내야 하는 상태다.
    return NextResponse.json({ error: "product_gone" }, { status: 409 });
  }

  if (result.outcome === "sections_incomplete") {
    // 화면이 너무 일찍 불렀다는 뜻이다. **빠진 번호들**을 주어 스스로 회복하게 한다 —
    // 그 페이지들을 마저 만들고 다시 부르면 된다.
    return NextResponse.json(
      { error: "sections_incomplete", missing: result.missing },
      { status: 409 }
    );
  }

  return NextResponse.json({ closing: result.closing });
}
