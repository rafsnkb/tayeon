import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { getUidFromRequest } from "@/lib/auth/verifyRequest";
import { isBirthDateString, isBirthTimeString, isJasiRule, type BirthInfo } from "@/lib/tarot/birthInfo";
import { normalizeBirthdayMMDD } from "@/lib/user/birthday";


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

  // 생년월일ㆍ성별은 2026-09-19부터 가입 시 필수(목업 "Screen / Join" — 닉네임과 동일하게 빨간 *
  // 표시). 태어난 시간만 선택 입력으로 유지(자시법 등은 기본값으로 채워서 저장).
  if (!isBirthDateString(birthInfo?.birthDate)) {
    return NextResponse.json({ error: "생년월일을 입력해주세요." }, { status: 400 });
  }
  if (birthInfo.gender !== "male" && birthInfo.gender !== "female" && birthInfo.gender !== "unspecified") {
    return NextResponse.json({ error: "성별을 선택해주세요." }, { status: 400 });
  }
  const birthInfoUpdate: { birthInfo: BirthInfo } = {
    birthInfo: {
      calendarType: birthInfo.calendarType === "lunar" ? "lunar" : "solar",
      isLeapMonth: birthInfo.calendarType === "lunar" && Boolean(birthInfo.isLeapMonth),
      birthDate: birthInfo.birthDate,
      birthTime: birthInfo.timeUnknown || !isBirthTimeString(birthInfo.birthTime) ? null : birthInfo.birthTime,
      timeUnknown: Boolean(birthInfo.timeUnknown),
      jasiRule: isJasiRule(birthInfo.jasiRule)
        ? birthInfo.jasiRule
        : "midnight",
      gender: birthInfo.gender,
      useTrueSolarTime: Boolean(birthInfo.useTrueSolarTime),
      birthPlace:
        typeof birthInfo.birthPlace === "string" && birthInfo.birthPlace.trim()
          ? birthInfo.birthPlace.trim()
          : null,
    },
  };

  const userRef = adminDb.collection("users").doc(uid);
  // 정규화된 생일은 카카오 생일이 우선이라, 이미 저장된 카카오 값을 확인한 뒤 결정한다.
  const kakaoBirthday = (await userRef.get()).data()?.kakaoBirthday;
  await userRef.set(
    {
      nickname: trimmed,
      termsAgreedAt: new Date().toISOString(),
      ...birthInfoUpdate,
      birthdayMMDD: normalizeBirthdayMMDD(kakaoBirthday, birthInfoUpdate.birthInfo.birthDate),
    },
    { merge: true }
  );

  return NextResponse.json({ ok: true });
}
