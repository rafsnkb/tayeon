// 리포트 안에 들어가는 그림 한 장.
//
// `GET` 은 **이미지 자체**를 돌려준다(JSON 이 아니다). 바이트가 어디 저장되는지와 왜 Storage 가
// 아닌지는 `src/lib/saju/imageStore.ts` 머리말에 있다.
//
// ## `<img src={image.url}>` 로는 못 건다 (2026-09-26 바로잡음)
//
// 이 주석은 한동안 "화면은 `<img src>` 로 그대로 건다"고 적고 있었는데 **틀렸다.** 이 앱의
// 인증은 `getUidFromRequest` 하나뿐이고 그건 `Authorization: Bearer` **헤더만** 본다 —
// 쿠키 폴백이 없다. `<img>` 태그는 헤더를 못 실으므로 **401 이 온다.**
//
// 그래서 화면은 `fetch` 로 바이트를 받아 `URL.createObjectURL` 로 건다(`useSajuReader`).
// 토큰 인증 앱에서 사용자별 유료 자산을 다루는 보통의 방법이고, 쿠키 세션을 새로 들이는
// 것보다 훨씬 작다. 대가는 브라우저가 `<img>` 로 알아서 하던 ETag/304 를 훅이 직접 쥔다는 것인데,
// 한 편에 한 장이고 다시 뽑을 때만 바뀌므로 훅이 메모리에 들고 있으면 그만이다.
//
// `POST` 는 **새로 그린다.** 장당 8원이라 다시 뽑기를 횟수로 막지 않고 기능으로 연다(§8) —
// 실패 보상이 아니라 셀링포인트다. 해석은 그대로고 그림만 바뀌므로 결과의 일관성도 안 깨진다.
import { NextRequest, NextResponse } from "next/server";
import { getUidFromRequest } from "@/lib/auth/verifyRequest";
import { getSajuImageBytes } from "@/lib/saju/imageStore";
import { produceImage } from "@/lib/saju/produce";

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const uid = await getUidFromRequest(req);
  if (!uid) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;
  const stored = await getSajuImageBytes(uid, id);
  // "아직 안 그려졌다"이다. 화면은 이걸 받으면 POST 로 만든다.
  if (!stored) return NextResponse.json({ error: "not_generated" }, { status: 404 });

  // 주소는 다시 뽑아도 그대로고 **ETag 만 바뀐다**(`sajuImageUrl` 주석 참고). 그래서 평소에는
  // 304 로 끝나고, 다시 뽑은 뒤에만 바이트가 실제로 내려간다.
  const etag = `W/"saju-image-${stored.version}"`;
  if (req.headers.get("if-none-match") === etag) {
    return new NextResponse(null, { status: 304, headers: { ETag: etag } });
  }

  return new NextResponse(new Uint8Array(stored.bytes), {
    headers: {
      "Content-Type": stored.contentType,
      ETag: etag,
      // `private` — 돈 받고 파는 리포트의 일부라 공용 캐시에 두지 않는다.
      // `no-cache` 는 "캐시하지 말라"가 아니라 **"쓰기 전에 물어보라"** 다. 다시 뽑은 그림이
      // 바로 보여야 하므로 max-age 로 굳히지 않는다.
      "Cache-Control": "private, no-cache",
    },
  });
}

export async function POST(req: NextRequest, { params }: Params) {
  const uid = await getUidFromRequest(req);
  if (!uid) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;
  const result = await produceImage({ uid, id });

  if (result.outcome === "not_found") {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (result.outcome === "unsupported") {
    // 19개 중 이미지를 쓰는 상품은 셋뿐이다. 화면이 이미지 페이지를 아예 그리지 않아야 하는
    // 상품이므로, 여기 온 것 자체가 화면의 버그다 — 조용히 200 으로 넘기지 않는다.
    return NextResponse.json({ error: "unsupported_product" }, { status: 400 });
  }

  // 바이트가 아니라 `{ url, regeneratedCount }` 를 돌려준다. 화면은 이걸 받고 `url` 을 다시
  // 걸면 되는데, ETag 가 바뀌었으므로 브라우저가 새 그림을 받아 온다.
  return NextResponse.json({ image: result.image });
}
