import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/admin";
import { getUidFromRequest } from "@/lib/auth/verifyRequest";
import { isBirthDateString, isBirthTimeString } from "@/lib/tarot/birthInfo";

export async function GET(req: NextRequest) {
  const uid = await getUidFromRequest(req);
  if (!uid) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const snap = await adminDb.collection("users").doc(uid).get();
  return NextResponse.json({ partner: snap.data()?.partner ?? null });
}

export async function POST(req: NextRequest) {
  const uid = await getUidFromRequest(req);
  if (!uid) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const userRef = adminDb.collection("users").doc(uid);
  const snap = await userRef.get();
  if (snap.data()?.partner) {
    return NextResponse.json(
      { error: "이미 저장된 상대 정보가 있어요. 삭제 후 다시 입력해주세요." },
      { status: 409 }
    );
  }

  const { nickname, birthDate, birthTime, gender, calendarType, isLeapMonth, birthPlace } =
    (await req.json()) as {
      nickname?: string;
      birthDate?: string;
      birthTime?: string;
      gender?: "male" | "female" | "unspecified";
      calendarType?: "solar" | "lunar";
      isLeapMonth?: boolean;
      birthPlace?: string;
    };

  const trimmedNickname = nickname?.trim();
  if (!trimmedNickname) {
    return NextResponse.json({ error: "별명을 입력해주세요." }, { status: 400 });
  }

  await userRef.set(
    {
      partner: {
        nickname: trimmedNickname,
        // 형식이 어긋난 값은 저장하지 않는다 — 상대 정보도 사주·자미두수 계산에 그대로 들어간다.
        birthDate: isBirthDateString(birthDate) ? birthDate : null,
        birthTime: isBirthTimeString(birthTime) ? birthTime : null,
        gender: gender ?? "unspecified",
        calendarType: calendarType === "lunar" ? "lunar" : "solar",
        isLeapMonth: calendarType === "lunar" && Boolean(isLeapMonth),
        birthPlace: typeof birthPlace === "string" && birthPlace.trim() ? birthPlace.trim() : null,
        savedAt: new Date().toISOString(),
      },
    },
    { merge: true }
  );

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const uid = await getUidFromRequest(req);
  if (!uid) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  await adminDb.collection("users").doc(uid).update({
    partner: FieldValue.delete(),
  });

  return NextResponse.json({ ok: true });
}
