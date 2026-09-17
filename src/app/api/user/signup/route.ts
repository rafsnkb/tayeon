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

  const { nickname, birthInfo } = (await req.json()) as {
    nickname?: string;
    birthInfo?: Partial<BirthInfo>;
  };
  const trimmed = nickname?.trim();
  if (!trimmed) {
    return NextResponse.json({ error: "닉네임을 입력해주세요." }, { status: 400 });
  }

  // 생년월일시는 가입 시 선택 입력 — 둘 중 하나라도 시작했다면 나머지도 채워야 저장(반쪽만
  // 저장하면 사주/자미두수 계산에 못 쓰므로), 아예 안 건드렸다면 건너뛰고 나중에 /me에서 입력 가능.
  let birthInfoUpdate: { birthInfo: BirthInfo } | Record<string, never> = {};
  if (birthInfo && (birthInfo.birthDate || birthInfo.gender)) {
    if (!birthInfo.birthDate) {
      return NextResponse.json({ error: "생년월일을 입력해주세요." }, { status: 400 });
    }
    if (birthInfo.gender !== "male" && birthInfo.gender !== "female" && birthInfo.gender !== "unspecified") {
      return NextResponse.json({ error: "성별을 선택해주세요." }, { status: 400 });
    }
    birthInfoUpdate = {
      birthInfo: {
        calendarType: birthInfo.calendarType === "lunar" ? "lunar" : "solar",
        isLeapMonth: birthInfo.calendarType === "lunar" && Boolean(birthInfo.isLeapMonth),
        birthDate: birthInfo.birthDate,
        birthTime: birthInfo.timeUnknown ? null : birthInfo.birthTime || null,
        timeUnknown: Boolean(birthInfo.timeUnknown),
        jasiRule: JASI_RULES.includes(birthInfo.jasiRule as JasiRule)
          ? (birthInfo.jasiRule as JasiRule)
          : "midnight",
        gender: birthInfo.gender,
        useTrueSolarTime: Boolean(birthInfo.useTrueSolarTime),
        birthPlace:
          typeof birthInfo.birthPlace === "string" && birthInfo.birthPlace.trim()
            ? birthInfo.birthPlace.trim()
            : null,
      },
    };
  }

  const userRef = adminDb.collection("users").doc(uid);
  await userRef.set(
    {
      nickname: trimmed,
      termsAgreedAt: new Date().toISOString(),
      ...birthInfoUpdate,
    },
    { merge: true }
  );

  return NextResponse.json({ ok: true });
}
