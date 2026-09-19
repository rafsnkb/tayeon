import { NextRequest, NextResponse } from "next/server";
import { getUidFromRequest } from "@/lib/auth/verifyRequest";
import { ensureReferralCode, getReferralInvitedFriendsCount } from "@/lib/referral/code";
import { REFERRAL_SIGNUP_FRIEND_CAP } from "@/lib/tarot/pricing";

export async function GET(req: NextRequest) {
  const uid = await getUidFromRequest(req);
  if (!uid) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const code = await ensureReferralCode(uid);
  const invitedFriends = await getReferralInvitedFriendsCount(uid);

  return NextResponse.json({
    code,
    invitedFriends,
    cap: REFERRAL_SIGNUP_FRIEND_CAP,
  });
}
