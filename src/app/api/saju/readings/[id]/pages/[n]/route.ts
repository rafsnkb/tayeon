// 페이지 한 장. §11 의 「147초를 누가 돌리나」가 걸려 있는 자리다.
//
// 10섹션을 한 번에 만들면 147초다. 그걸 누구도 기다리지 않게 하는 방법이 **읽는 시간 뒤로
// 숨기는 것**이고(§6), 그래서 페이지는 필요할 때 한 장씩 만든다. 화면은 사용자가 N 을 읽는
// 동안 N+1 을 미리 당겨 온다.
//
// **GET 과 POST 를 나눈 것이 이 파일의 핵심 설계다.**
//
// - `GET` — 저장된 것만 읽는다. 없으면 404. **모델을 부르지 않으므로 공짜다.**
// - `POST` — 없으면 만든다. **한 번에 약 20원이 나간다.**
//
// 생성을 GET 에 두면 안 된다. GET 은 주소만 알면 누르는 것이고, 브라우저 prefetch·크롤러·
// 실수로 연 탭이 전부 돈을 쓰게 된다. "부작용이 있으면 GET 이 아니다"를 여기서 지키는
// 실질적인 이유가 그것이다.
import { NextRequest, NextResponse } from "next/server";
import { getUidFromRequest } from "@/lib/auth/verifyRequest";
import { getSajuPage } from "@/lib/saju/storage";
import { producePage } from "@/lib/saju/produce";

type Params = { params: Promise<{ id: string; n: string }> };

/** `n` 은 주소에서 온 문자열이다. 정수가 아니면 게이트까지 갈 것도 없이 여기서 자른다. */
function parsePageNumber(raw: string): number | null {
  const n = Number(raw);
  return Number.isInteger(n) && n >= 1 ? n : null;
}

export async function GET(req: NextRequest, { params }: Params) {
  const uid = await getUidFromRequest(req);
  if (!uid) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id, n } = await params;
  const pageNumber = parsePageNumber(n);
  if (pageNumber === null) return NextResponse.json({ error: "bad_page" }, { status: 400 });

  const page = await getSajuPage(uid, id, pageNumber);
  // 여기의 404 는 "리포트가 없다"가 아니라 **"아직 안 만들어졌다"** 이다. 화면은 이걸 받으면
  // POST 로 만들라는 신호로 읽는다.
  if (!page) return NextResponse.json({ error: "not_generated" }, { status: 404 });

  return NextResponse.json({ page });
}

export async function POST(req: NextRequest, { params }: Params) {
  const uid = await getUidFromRequest(req);
  if (!uid) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id, n } = await params;
  const pageNumber = parsePageNumber(n);
  if (pageNumber === null) return NextResponse.json({ error: "bad_page" }, { status: 400 });

  // `retryFailed` 는 **실패 자리표를 다시 만들어 보는 운영용 문**이다(§9 의 3회를 소진한 페이지).
  // 사용자 화면은 이걸 보내지 않는다 — 3회 실패한 페이지에 "다시 시도"를 권하지 않기로 했다.
  // 모델 사용량 제한처럼 **조건이 바뀐 뒤**에 복구하는 용도다. 본문이 이미 있는 페이지는
  // 이 값으로도 못 덮는다(`produce.ts`).
  const body = (await req.json().catch(() => ({}))) as { retryFailed?: unknown };
  const retryFailed = body.retryFailed === true;

  const result = await producePage({ uid, id, pageNumber, retryFailed });

  if (result.outcome === "not_found") {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  if (result.outcome === "product_gone") {
    // 저장된 페이지는 계속 읽히지만(`GET`) 아직 안 만든 건 만들 수 없다. 기다려서 풀리는
    // 일이 아니므로 500 을 주지 않는다 — 화면이 "잠시 후 다시"를 띄우면 영원히 다시 누른다.
    return NextResponse.json({ error: "product_gone" }, { status: 409 });
  }

  if (result.outcome === "rejected") {
    const { gate } = result;
    // 409 인 이유: 요청이 잘못된 게 아니라 **지금 상태에서 할 수 없는** 일이다. 화면이
    // `missing` 을 받아 앞 페이지부터 만들고 스스로 회복할 수 있어야 하므로 번호를 같이 준다.
    return NextResponse.json(
      {
        error: gate.reason,
        ...(gate.reason === "missing_previous" ? { missing: gate.missing } : {}),
      },
      { status: gate.reason === "out_of_range" ? 400 : 409 }
    );
  }

  // `kind: "failed"` 도 200 이다. 생성은 §9 대로 3회까지 시도하고 끝난 것이고, 화면은 그
  // 페이지에 안내를 그린다. 여기서 5xx 를 주면 화면이 "다시 시도" 를 권하게 되는데, 이미
  // 세 번 해 봤고 운영자에게도 알림이 갔다.
  return NextResponse.json({ page: result.page });
}
