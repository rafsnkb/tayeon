import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { getUidFromRequest } from "@/lib/auth/verifyRequest";
import { isToneKey } from "@/lib/tarot/tone";
import { isJasiRule } from "@/lib/tarot/birthInfo";

export async function POST(req: NextRequest) {
  const uid = await getUidFromRequest(req);
  if (!uid) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { tone, useReversedCards, jasiRule, useTrueSolarTime } = (await req.json()) as {
    tone?: string;
    useReversedCards?: boolean;
    jasiRule?: string;
    useTrueSolarTime?: boolean;
  };

  // jasiRule/useTrueSolarTime은 birthInfo 안에 저장되지만, /api/user/birth-info로 보내면
  // birthDate/gender가 없다고 거부당한다(그 라우트는 생년월일 폼 저장 전용) — 설정 화면에서
  // 이 둘만 따로 바꿀 수 있어야 해서, 점 표기 경로로 birthInfo 하위 필드만 부분 업데이트한다.
  const update: Record<string, unknown> = {};
  if (isToneKey(tone)) update.tone = tone;
  if (typeof useReversedCards === "boolean") update.useReversedCards = useReversedCards;
  if (isJasiRule(jasiRule)) {
    update["birthInfo.jasiRule"] = jasiRule;
  }
  if (typeof useTrueSolarTime === "boolean") {
    update["birthInfo.useTrueSolarTime"] = useTrueSolarTime;
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "변경할 값이 없어요." }, { status: 400 });
  }

  // 주의: set(..., { merge: true })는 "birthInfo.jasiRule" 같은 점 표기 키를 중첩 경로로 풀어주지
  // 않고 그 이름 그대로의 최상위 필드를 만들어버린다(직접 확인함) — update()만 점 표기를 필드
  // 경로로 해석한다.
  await adminDb.collection("users").doc(uid).update(update);

  return NextResponse.json({ ok: true });
}
