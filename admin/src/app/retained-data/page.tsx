"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase/client";
import { AdminPageHeader } from "@/components/AdminPageHeader";

type Target = "paymentArchive" | "supportInquiries";

type ArchivedPayment = {
  id: string;
  uid: string | null;
  orderName: string | null;
  priceWon: number | null;
  status: string | null;
  paidAt: string | null;
  archivedAt: string | null;
  retainUntil: string | null;
};

type Inquiry = {
  id: string;
  uid: string | null;
  nickname: string | null;
  email: string | null;
  content: string;
  status: string | null;
  emailDeliveryStatus: string | null;
  createdAt: string | null;
  expiresAt: string | null;
};

const TABS: { key: Target; label: string; note: string }[] = [
  {
    key: "paymentArchive",
    label: "탈퇴자 결제기록",
    note: "전자상거래법 시행령 제6조에 따라 5년간 보관합니다. 보관 기한이 지나면 Firestore TTL이 자동으로 파기합니다.",
  },
  {
    key: "supportInquiries",
    label: "고객센터 문의",
    note: "소비자 불만·분쟁처리 기록으로 3년간 보관합니다. 보관 기한이 지나면 Firestore TTL이 자동으로 파기합니다.",
  },
];

const date = (value: string | null) => {
  if (!value || Number.isNaN(Date.parse(value))) return "-";
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(value));
};

/** 법령상 보관 의무 때문에 탈퇴 후에도 남겨둔 기록을 확인하는 화면.
 *  조회할 때마다 서버가 감사 로그(adminAccessLogs)를 남긴다 — 개인정보처리방침 제3조의
 *  "계정과 분리하여 보관" 약속이 말뿐이 되지 않게 하기 위함. */
export default function RetainedDataPage() {
  const router = useRouter();
  const [target, setTarget] = useState<Target>("paymentArchive");
  const [items, setItems] = useState<(ArchivedPayment | Inquiry)[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(
    async (next: Target) => {
      setLoading(true);
      const user = auth.currentUser;
      if (!user) return;
      const response = await fetch(`/api/admin/retained-data?target=${next}`, {
        headers: { authorization: `Bearer ${await user.getIdToken()}` },
      });
      setItems(response.ok ? (await response.json()).items : []);
      setLoading(false);
    },
    []
  );

  useEffect(
    () =>
      onAuthStateChanged(auth, (user) => {
        if (!user) {
          router.push("/login");
          return;
        }
        void load(target);
      }),
    [router, load, target]
  );

  const active = TABS.find((tab) => tab.key === target)!;

  return (
    <main className="admin-page pb-12">
      <AdminPageHeader
        title="보관 데이터"
        description="법령상 보관 의무로 탈퇴 후에도 남아 있는 기록입니다. 조회 이력이 기록됩니다."
      />
      <div className="mx-auto max-w-[1180px] px-6">
        <div className="mb-4 flex gap-2">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setTarget(tab.key)}
              className={`rounded-full px-4 py-2 text-sm font-medium ${
                target === tab.key ? "bg-[#0071E3] text-white" : "border border-[#D2D2D7] text-[#424245]"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <p className="mb-4 text-sm text-[#817789]">{active.note}</p>

        <section className="overflow-hidden rounded-[28px] bg-white">
          {loading ? (
            <p className="p-12 text-center text-[#817789]">불러오는 중...</p>
          ) : items.length === 0 ? (
            <p className="p-12 text-center text-[#817789]">보관 중인 기록이 없습니다.</p>
          ) : target === "paymentArchive" ? (
            (items as ArchivedPayment[]).map((item) => (
              <article key={item.id} className="border-b border-[#EEEAF0] p-5 last:border-0">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="font-semibold text-[#30253A]">{item.orderName ?? "-"}</p>
                    <p className="mt-1 font-mono text-xs text-[#817789]">UID · {item.uid ?? "-"}</p>
                  </div>
                  <p className="font-semibold text-[#30253A]">
                    {item.priceWon != null ? `${item.priceWon.toLocaleString("ko-KR")}원` : "-"}
                  </p>
                </div>
                <dl className="mt-3 grid gap-2 text-sm text-[#51475B] sm:grid-cols-3">
                  <div>
                    <dt className="inline text-[#9A8FA0]">결제 · </dt>
                    <dd className="inline">{date(item.paidAt)}</dd>
                  </div>
                  <div>
                    <dt className="inline text-[#9A8FA0]">보관 시작 · </dt>
                    <dd className="inline">{date(item.archivedAt)}</dd>
                  </div>
                  <div>
                    <dt className="inline text-[#9A8FA0]">파기 예정 · </dt>
                    <dd className="inline">{date(item.retainUntil)}</dd>
                  </div>
                </dl>
              </article>
            ))
          ) : (
            (items as Inquiry[]).map((item) => (
              <article key={item.id} className="border-b border-[#EEEAF0] p-5 last:border-0">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="font-semibold text-[#30253A]">{item.nickname ?? "(닉네임 없음)"}</p>
                    <p className="mt-1 font-mono text-xs text-[#817789]">
                      UID · {item.uid ?? "비로그인"} · {item.email ?? "-"}
                    </p>
                  </div>
                  <span className="rounded-full bg-[#F2EFF4] px-2.5 py-1 text-xs text-[#64586B]">
                    {item.emailDeliveryStatus ?? "-"}
                  </span>
                </div>
                <p className="mt-3 whitespace-pre-line text-sm text-[#51475B]">{item.content}</p>
                <dl className="mt-3 grid gap-2 text-sm text-[#51475B] sm:grid-cols-2">
                  <div>
                    <dt className="inline text-[#9A8FA0]">접수 · </dt>
                    <dd className="inline">{date(item.createdAt)}</dd>
                  </div>
                  <div>
                    <dt className="inline text-[#9A8FA0]">파기 예정 · </dt>
                    <dd className="inline">{date(item.expiresAt)}</dd>
                  </div>
                </dl>
              </article>
            ))
          )}
        </section>
      </div>
    </main>
  );
}
