import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { getUidFromRequest } from "@/lib/auth/verifyRequest";

export async function POST(req: NextRequest) {
  const uid = await getUidFromRequest(req);
  if (!uid) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { passId } = (await req.json()) as { passId?: string };
  if (!passId) {
    return NextResponse.json({ error: "passId가 필요해요." }, { status: 400 });
  }

  const userRef = adminDb.collection("users").doc(uid);
  const passRef = userRef.collection("timePasses").doc(passId);
  const [userSnap, passSnap] = await Promise.all([userRef.get(), passRef.get()]);

  const activeTimePass = userSnap.data()?.activeTimePass as
    | { expiresAt: string }
    | null
    | undefined;
  if (activeTimePass && new Date(activeTimePass.expiresAt).getTime() > Date.now()) {
    return NextResponse.json(
      { error: "이미 활성화된 이용권이 있어요. 만료 후 다시 시도해주세요." },
      { status: 409 }
    );
  }

  if (!passSnap.exists || passSnap.data()?.status !== "unused") {
    return NextResponse.json({ error: "사용할 수 없는 이용권이에요." }, { status: 400 });
  }

  const { minutes, includesOptions } = passSnap.data() as {
    minutes: number;
    includesOptions: boolean;
  };

  const startedAt = new Date().toISOString();
  const expiresAt = new Date(Date.now() + minutes * 60_000).toISOString();
  const nextActiveTimePass = { passId, minutes, includesOptions, startedAt, expiresAt };

  await Promise.all([
    passRef.update({ status: "active", startedAt, expiresAt }),
    userRef.update({ activeTimePass: nextActiveTimePass }),
  ]);

  return NextResponse.json({ activeTimePass: nextActiveTimePass });
}
