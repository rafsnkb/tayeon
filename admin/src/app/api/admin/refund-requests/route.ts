import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { getAdminUidFromRequest } from "@/lib/auth/verifyAdminRequest";

/** 승인 처리된 건이 **실제로** 회수됐는지. 요청 문서의 status 만 보면 "승인했다고 기록됐다"는
 *  것밖에 모른다 — 포트원 취소는 됐는데 이용권 회수가 빠졌거나, 반대로 콘솔에서 취소만 하고
 *  앱에 반영이 안 된 경우를 구분할 수 없다(2026-09-24 실제로 그 상태의 건이 있었다).
 *
 *  그래서 결제 문서와 이용권 문서를 직접 읽어 확인한 결과를 같이 내려준다. */
type Settlement = {
  paymentStatus: string | null;
  passStatus: string | null;
  /** 결제·이용권이 모두 정리됐는가. 완료 목록에서 이것만 보면 된다. */
  settled: boolean;
};

async function settlementOf(uid: string, paymentId: string): Promise<Settlement> {
  const userRef = adminDb.collection("users").doc(uid);
  const payment = (await userRef.collection("payments").doc(paymentId).get()).data();
  const paymentStatus = typeof payment?.status === "string" ? payment.status : null;

  const collection =
    payment?.productType === "countPass" ? "countPasses" : payment?.productType === "timePass" ? "timePasses" : null;
  const passId = payment?.productType === "countPass" ? payment?.countPassId : payment?.timePassId;
  let passStatus: string | null = null;
  if (collection && typeof passId === "string") {
    const pass = (await userRef.collection(collection).doc(passId).get()).data();
    // 문서가 사라졌으면 회수된 것으로 본다(탈퇴 등).
    passStatus = pass ? (typeof pass.status === "string" ? pass.status : "unknown") : "deleted";
  }
  const settled =
    paymentStatus === "refunded" && (passStatus === null || passStatus === "refunded" || passStatus === "deleted");
  return { paymentStatus, passStatus, settled };
}

/** 상태별로 따로 읽는 이유: 예전엔 전체에서 최근 100건을 가져와 브라우저에서 탭별로 걸렀다.
 *  환불 요청 문서는 3년 보존이고 지워지지 않아서, 승인·거절 건이 100건을 채우는 순간 **가장
 *  오래된 대기 건** — 즉 법정 기한이 가장 임박한 건 — 이 목록에서 조용히 사라졌다(2026-09-24).
 *  대기 건은 밀릴수록 위에 와야 하므로 오름차순으로, 처리된 건은 최근 것부터 본다. */
const LIST_LIMIT = 100;

export async function GET(req: NextRequest) {
  if (!(await getAdminUidFromRequest(req))) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const [pending, approved, rejected] = await Promise.all([
    adminDb.collection("refundRequests").where("status", "==", "pending").orderBy("requestedAt", "asc").limit(LIST_LIMIT).get(),
    adminDb.collection("refundRequests").where("status", "==", "approved").orderBy("requestedAt", "desc").limit(LIST_LIMIT).get(),
    adminDb.collection("refundRequests").where("status", "==", "rejected").orderBy("requestedAt", "desc").limit(LIST_LIMIT).get(),
  ]);
  const snapshot = { docs: [...pending.docs, ...approved.docs, ...rejected.docs] };
  const refs = snapshot.docs.map((doc) => adminDb.collection("users").doc(doc.data().uid ?? ""));
  const users = refs.length ? await adminDb.getAll(...refs) : [];
  const nicknames = new Map(users.map((user) => [user.id, user.data()?.nickname ?? null]));

  const requests = await Promise.all(
    snapshot.docs.map(async (doc) => {
      const data = doc.data();
      // 승인 건만 확인한다 — 대기·거절은 회수될 이유가 없다.
      const settlement = data.status === "approved" ? await settlementOf(String(data.uid ?? ""), doc.id) : null;
      return {
        id: doc.id,
        nickname: nicknames.get(data.uid) ?? null,
        paymentMethod: data.paymentMethod ?? null,
        ...data,
        settlement,
      };
    })
  );
  return NextResponse.json({ requests });
}
