"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import SubPageTopBar from "@/components/SubPageTopBar";
import SnsFollowLinks from "@/components/SnsFollowLinks";
import CouponTerms from "@/components/CouponTerms";
import InfoModal from "@/components/InfoModal";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase/client";
import { useRooms } from "@/lib/tarot/RoomsContext";
import { formatDateTime } from "@/lib/util/formatDate";
import { ChevronDownIcon } from "@/app/(app)/tarot/icons";

type ShelfState = "usable" | "scheduled" | "used" | "expired";
type Coupon = {
  code: string;
  name: string;
  discountRate: number;
  startsAt: string;
  endsAt: string;
  status: "unused" | "used";
  state: ShelfState;
  usable: boolean;
  usedAt: string | null;
  usedProduct: { orderName: string | null; comboLabel: string | null } | null;
};

/** 상태 배지. 색은 의미를 나른다 — 초록만 "지금 할 수 있는 일"이고 나머지는 지나간 상태다. */
const BADGE: Record<ShelfState, { label: string; className: string }> = {
  usable: { label: "사용 가능", className: "bg-[#22c55e] text-white" },
  scheduled: { label: "사용 예정", className: "bg-chip-soft text-chip-soft-text" },
  used: { label: "사용 완료", className: "bg-chip-fill text-white" },
  expired: { label: "만료", className: "bg-chip-soft text-icon-muted" },
};

type Tab = "list" | "apply";

export default function CouponsPage() {
  const router = useRouter();
  const { user, authChecked, refreshMe } = useRooms();
  const [tab, setTab] = useState<Tab>("list");
  const [coupons, setCoupons] = useState<Coupon[] | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const [code, setCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    const token = await user.getIdToken();
    const res = await fetch("/api/user/discount-coupons", { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) return setCoupons([]);
    const body = await res.json();
    setCoupons(body.coupons ?? []);
  }, [user]);

  useEffect(() => {
    if (authChecked && !user) router.replace("/login");
  }, [authChecked, user, router]);
  // onAuthStateChanged 구독으로 불러온다(다른 서브페이지와 같은 방식) — 이펙트 본문에서 바로
  // setState 하지 않으므로 연쇄 렌더를 만들지 않고, 토큰이 준비된 뒤에만 조회한다.
  useEffect(() => onAuthStateChanged(auth, (u) => { if (u) void load(); }), [load]);

  async function register() {
    if (!user || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const token = await user.getIdToken();
      const res = await fetch("/api/user/discount-coupons", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "content-type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) return setError(body.error ?? "쿠폰을 등록하지 못했어요.");
      setCode("");
      // 이 화면의 목록만 다시 읽으면 안 된다(2026-09-26). 구입 화면이 쓰는 건 컨텍스트의
      // `activeCoupon` 이고, 그건 `/api/user/me` 에서 온다 — 여기서 갱신하지 않으면 바로
      // 아래 "사용하기" 로 /charge 에 갔을 때 **방금 등록한 쿠폰이 없는 것처럼 정가**가 뜬다.
      // 10 초 폴링이 언젠가 고쳐 주지만, 그게 "등록 직후"라는 가장 나쁜 타이밍에 걸린다.
      await Promise.all([load(), refreshMe()]);
      setDone("쿠폰을 등록했어요.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-dvh flex-col overflow-visible bg-bg xl:h-full xl:overflow-hidden">
      <SubPageTopBar title="쿠폰함" />

      {/* 하단 토글이 화면에 고정돼 떠 있으므로 그 높이(56 + 여백)만큼 아래를 비워 둔다 —
          안 비우면 목록 마지막 줄이 토글 뒤에 영영 가린다. */}
      <div className="flex-1 overflow-visible p-4 pb-32 pt-20 xl:overflow-y-auto scroll-gutter-stable">
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
          {tab === "apply" ? (
            <section className="rounded-[32px] border border-border bg-topbar p-6">
              <p className="text-center text-sm font-semibold text-icon-muted">쿠폰 코드를 입력해주세요</p>
              <input
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                onKeyDown={(e) => e.key === "Enter" && register()}
                maxLength={20}
                placeholder="쿠폰 코드 입력"
                aria-label="쿠폰 코드"
                className="mt-3 h-14 w-full rounded-2xl border border-border bg-bg px-4 text-center text-lg font-bold text-bold-text outline-none placeholder:font-semibold placeholder:text-placeholder focus:border-point"
              />
              <button
                type="button"
                onClick={register}
                disabled={submitting || code.trim().length === 0}
                className="point-pill mt-3 h-12 w-full rounded-2xl text-base font-semibold disabled:opacity-60"
              >
                {submitting ? "등록 중..." : "쿠폰 등록하기"}
              </button>
              {error && <p className="mt-3 text-center text-sm font-semibold text-urgent">{error}</p>}

              <hr className="my-6 border-border" />

              <p className="text-center text-sm font-semibold leading-6 text-icon-muted">
                쿠폰은 타연 SNS를 통해 비정기적으로 발급됩니다.
                <br />
                타연 SNS를 팔로우하고 새로운 소식을 확인해보세요!
              </p>
              <div className="mt-5">
                <SnsFollowLinks />
              </div>
            </section>
          ) : coupons === null ? (
            <p className="py-16 text-center text-sm font-semibold text-icon-muted">불러오는 중...</p>
          ) : coupons.length === 0 ? (
            <p className="py-16 text-center text-sm font-semibold text-icon-muted">
              보유한 쿠폰이 없어요.
              <br />
              쿠폰 등록 탭에서 코드를 넣어보세요.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {coupons.map((coupon) => {
                const badge = BADGE[coupon.state];
                const open = expanded === coupon.code;
                return (
                  <li key={coupon.code} className="py-5 first:pt-0">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-lg font-bold text-bold-text">{coupon.name || coupon.code}</p>
                        <p className="mt-1 text-sm font-semibold text-icon-muted">
                          {coupon.status === "used"
                            ? `사용 날짜: ${coupon.usedAt ? formatDateTime(coupon.usedAt) : "-"}`
                            : `유효기간: ${formatDateTime(coupon.endsAt)} 까지`}
                        </p>
                        <span className={`mt-2 inline-block rounded-full px-3 py-1 text-sm font-bold ${badge.className}`}>
                          {badge.label}
                        </span>
                      </div>
                      {coupon.usable ? (
                        <button
                          type="button"
                          onClick={() => router.push("/charge")}
                          className="point-pill h-10 shrink-0 rounded-full px-5 text-base font-semibold"
                        >
                          사용하기
                        </button>
                      ) : coupon.status === "used" ? (
                        <button
                          type="button"
                          onClick={() => setExpanded(open ? null : coupon.code)}
                          aria-label={open ? "사용 내역 접기" : "사용 내역 펼치기"}
                          aria-expanded={open}
                          className="flex h-10 w-10 shrink-0 items-center justify-center text-icon-muted"
                        >
                          <ChevronDownIcon className={`h-2 w-4 transition-transform ${open ? "rotate-180" : ""}`} />
                        </button>
                      ) : null}
                    </div>

                    {open && (
                      <div className="mt-4">
                        <p className="text-center text-sm font-semibold text-icon-muted">사용한 상품</p>
                        <div className="mt-2 rounded-2xl bg-chip-soft px-4 py-4 text-center">
                          <p className="text-lg font-bold text-chip-soft-text">
                            {coupon.usedProduct?.orderName ?? "확인할 수 없는 상품"}
                          </p>
                          {coupon.usedProduct?.comboLabel && (
                            <p className="mt-1 text-sm font-semibold text-icon-muted">
                              ({coupon.usedProduct.comboLabel})
                            </p>
                          )}
                        </div>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}

          <section className="rounded-[32px] border border-border bg-topbar p-6">
            <CouponTerms />
          </section>
        </div>
      </div>

      {/* 탭 토글은 화면 바닥에 **고정 오버레이**로 띄운다(사용자 결정, 2026-09-25). 본문 끝에
          두면 목록이 길 때 탭을 바꾸려고 끝까지 스크롤해야 한다. */}
      <div className="fixed inset-x-0 bottom-0 z-30 bg-bg/80 p-4 backdrop-blur-sm">
        <div className="mx-auto flex h-14 w-full max-w-2xl rounded-full bg-chip-soft p-2">
          {([["list", "쿠폰함"], ["apply", "쿠폰 등록"]] as const).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              aria-pressed={tab === key}
              className={`h-10 flex-1 rounded-full text-base font-bold ${
                tab === key ? "point-pill" : "text-chip-soft-text"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {done && <InfoModal title={done} onClose={() => setDone(null)} />}
    </div>
  );
}
