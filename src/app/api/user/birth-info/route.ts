import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { getUidFromRequest } from "@/lib/auth/verifyRequest";
import type { BirthInfo, JasiRule } from "@/lib/tarot/birthInfo";

const JASI_RULES: JasiRule[] = ["midnight", "jasi", "splitJasi"];

export async function POST(req: NextRequest) {
  const uid = await getUidFromRequest(req);
  if (!uid) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = (await req.json()) as Partial<BirthInfo>;

  if (!body.birthDate) {
    return NextResponse.json({ error: "생년월일을 입력해주세요." }, { status: 400 });
  }
  if (body.gender !== "male" && body.gender !== "female") {
    return NextResponse.json({ error: "성별을 선택해주세요." }, { status: 400 });
  }

  const birthInfo: BirthInfo = {
    calendarType: body.calendarType === "lunar" ? "lunar" : "solar",
    birthDate: body.birthDate,
    birthTime: body.timeUnknown ? null : body.birthTime || null,
    timeUnknown: Boolean(body.timeUnknown),
    jasiRule: JASI_RULES.includes(body.jasiRule as JasiRule) ? (body.jasiRule as JasiRule) : "midnight",
    gender: body.gender,
  };

  await adminDb.collection("users").doc(uid).set({ birthInfo }, { merge: true });

  return NextResponse.json({ ok: true });
}
