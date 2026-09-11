import { NextRequest } from "next/server";
import { adminAuth } from "@/lib/firebase/admin";

const ADMIN_UIDS = new Set(
  (process.env.ADMIN_UIDS ?? "")
    .split(",")
    .map((uid) => uid.trim())
    .filter(Boolean)
);

// Only UIDs in ADMIN_UIDS may use this app — a valid Firebase ID token alone is not enough.
export async function getAdminUidFromRequest(req: NextRequest): Promise<string | null> {
  const authHeader = req.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) return null;

  try {
    const decoded = await adminAuth.verifyIdToken(token);
    return ADMIN_UIDS.has(decoded.uid) ? decoded.uid : null;
  } catch {
    return null;
  }
}
