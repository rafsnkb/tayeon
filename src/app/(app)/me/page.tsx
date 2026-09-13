"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase/client";
import { useRooms } from "@/lib/tarot/RoomsContext";
import { CompanyFooter } from "@/components/CompanyFooter";
import ConfirmModal from "@/components/ConfirmModal";
import SubPageTopBar from "@/components/SubPageTopBar";
import {
  SearchIcon,
  InvitePersonIcon,
  CartIcon,
  CardIcon,
  ListIcon,
  IdCardIcon,
  PersonIcon,
  CompassIcon,
  GearIcon,
  LogoutDoorIcon,
  ChevronRightIcon,
  CloseIcon,
} from "../tarot/icons";

function ListRow({
  icon,
  label,
  danger,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  danger?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 py-4 text-left"
    >
      <span
        className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-bg ${
          danger ? "text-urgent" : "text-white"
        }`}
      >
        {icon}
      </span>
      <span className={`flex-1 text-base font-semibold ${danger ? "text-urgent" : "text-[#dcdee3]"}`}>
        {label}
      </span>
      <span className="text-white">
        <ChevronRightIcon className="h-4 w-2" />
      </span>
    </button>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <p className="px-1 text-base font-semibold text-icon-muted">{title}</p>
      <div className="flex flex-col divide-y divide-border rounded-[32px] border border-border bg-topbar px-6">
        {children}
      </div>
    </div>
  );
}

function ComingSoon() {
  alert("아직 준비 중인 기능이에요.");
}

// 완벽한 UA 파싱은 아니고, 계정정보 모달의 "접속환경" 표시용 대략적인 추정치.
function describeEnvironment(): string {
  if (typeof navigator === "undefined") return "-";
  const ua = navigator.userAgent;
  let os = "알 수 없음";
  const iosMatch = ua.match(/OS (\d+)_(\d+)/);
  const androidMatch = ua.match(/Android (\d+(?:\.\d+)?)/);
  const macMatch = ua.match(/Mac OS X (\d+[_.]\d+)/);
  if (/iPhone|iPad|iPod/.test(ua)) os = iosMatch ? `iOS ${iosMatch[1]}.${iosMatch[2]}` : "iOS";
  else if (/Android/.test(ua)) os = androidMatch ? `Android ${androidMatch[1]}` : "Android";
  else if (/Windows/.test(ua)) os = "Windows";
  else if (/Mac OS X/.test(ua)) os = macMatch ? `macOS ${macMatch[1].replace("_", ".")}` : "macOS";

  let browser = "알 수 없음";
  if (/Edg\//.test(ua)) browser = "Edge";
  else if (/Chrome\//.test(ua) && !/Chromium/.test(ua)) browser = "Chrome";
  else if (/Firefox\//.test(ua)) browser = "Firefox";
  else if (/Safari\//.test(ua) && !/Chrome/.test(ua)) browser = "Safari";

  return `${os}/${browser}`;
}

/** 피그마 "Screen / MyPage" — 예전엔 /me가 바로 생년월일시 폼이었는데, 이제는 다른 설정 화면들로
 * 가는 허브. 공지사항/친구초대는 사용자가 애초에 "이 두 화면은 안 만들어뒀다"고 한 항목이라
 * 목적지 없이 안내만 띄움. */
export default function MyPage() {
  const router = useRouter();
  const { user, nickname, profileImage, coins, activeTimePass, timePasses } = useRooms();
  const [accountInfoOpen, setAccountInfoOpen] = useState(false);
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);
  const [termsAgreedAt, setTermsAgreedAt] = useState<string | null>(null);

  async function openAccountInfo() {
    setAccountInfoOpen(true);
    if (!user) return;
    const idToken = await user.getIdToken();
    const res = await fetch("/api/user/me", { headers: { Authorization: `Bearer ${idToken}` } });
    if (res.ok) {
      const data = await res.json();
      setTermsAgreedAt(data.termsAgreedAt ?? null);
    }
  }

  return (
    <div className="flex h-full flex-col overflow-hidden bg-bg">
      <SubPageTopBar title="마이 페이지" />

      <div className="flex-1 overflow-y-auto p-4">
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
          <Section title="계정">
            <div className="flex items-center gap-3 py-4">
              <span className="h-16 w-16 shrink-0 overflow-hidden rounded-full border border-border bg-chip-fill">
                {profileImage && <img src={profileImage} alt="" className="h-full w-full object-cover" />}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-lg font-semibold text-[#dcdee3]">{nickname ?? "-"}</p>
              </div>
              <button
                type="button"
                onClick={openAccountInfo}
                className="flex shrink-0 items-center gap-1.5 rounded-full bg-cta-fill px-3 py-1.5 text-sm font-semibold text-cta-text"
              >
                <SearchIcon className="h-3.5 w-3.5" />
                계정정보
              </button>
            </div>
            <div className="flex items-center justify-between py-3">
              <span className="flex items-center gap-1.5">
                <img src="/icons/coin.png" alt="" className="h-5 w-5" />
                <span className="text-lg font-bold text-gold">{coins ?? "-"}</span>
              </span>
              <button
                type="button"
                onClick={() => router.push("/charge")}
                className="rounded-full bg-point px-4 py-1.5 text-sm font-semibold text-white"
              >
                충전
              </button>
            </div>
            <div className="flex items-center justify-between py-3">
              <span className="text-base font-semibold text-white">
                {activeTimePass
                  ? "시간제 이용권 사용중"
                  : timePasses.length > 0
                    ? `보유 이용권 ${timePasses.length}개`
                    : "보유 이용권 없음"}
              </span>
              <button
                type="button"
                onClick={() => router.push("/charge")}
                className="rounded-full bg-point px-4 py-1.5 text-sm font-semibold text-white"
              >
                구입
              </button>
            </div>
            <ListRow icon={<InvitePersonIcon className="h-4 w-5" />} label="친구 초대하기" onClick={ComingSoon} />
          </Section>

          <Section title="코인ㆍ이용권 구입">
            <ListRow icon={<CartIcon className="h-5 w-5" />} label="코인ㆍ이용권 구입" onClick={() => router.push("/charge")} />
            <ListRow icon={<CardIcon className="h-4 w-5" />} label="결제 내역" onClick={() => router.push("/purchase-history")} />
            <ListRow icon={<ListIcon className="h-5 w-3.5" />} label="사용 내역" onClick={() => router.push("/usage-history")} />
          </Section>

          <Section title="프로필">
            <ListRow icon={<IdCardIcon className="h-3.5 w-5" />} label="내 프로필 관리" onClick={() => router.push("/me/profile")} />
            <ListRow icon={<PersonIcon className="h-5 w-4" />} label="궁합 상대 프로필 관리" onClick={() => router.push("/compatibility")} />
          </Section>

          <Section title="시스템">
            <ListRow icon={<CompassIcon className="h-5 w-5" />} label="공지사항" onClick={ComingSoon} />
            <ListRow icon={<GearIcon className="h-[18px] w-5" />} label="설정" onClick={() => router.push("/settings")} />
            <ListRow
              icon={<LogoutDoorIcon className="h-5 w-5" />}
              label="로그아웃"
              danger
              onClick={() => setLogoutConfirmOpen(true)}
            />
          </Section>

          <CompanyFooter />
        </div>
      </div>

      {accountInfoOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setAccountInfoOpen(false)}
        >
          <div
            className="w-full max-w-sm rounded-[32px] border border-border bg-[#2a2c31] p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <p className="text-lg font-bold text-white">계정 정보</p>
              <button type="button" onClick={() => setAccountInfoOpen(false)} aria-label="닫기" className="text-white">
                <CloseIcon className="h-5 w-5" />
              </button>
            </div>
            <div className="flex flex-col gap-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-icon-muted">아이디</span>
                <span className="font-semibold text-white">카카오 로그인</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-icon-muted">UID</span>
                <span className="font-semibold text-white">{user?.uid ?? "-"}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-icon-muted">가입일</span>
                <span className="font-semibold text-white">
                  {termsAgreedAt ? new Date(termsAgreedAt).toLocaleString("ko-KR") : "-"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-icon-muted">최근 로그인</span>
                <span className="font-semibold text-white">
                  {user?.metadata.lastSignInTime
                    ? new Date(user.metadata.lastSignInTime).toLocaleString("ko-KR")
                    : "-"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-icon-muted">접속환경</span>
                <span className="font-semibold text-white">{describeEnvironment()}</span>
              </div>
            </div>
            <p className="mt-4 text-xs text-icon-muted">
              고객센터 문의 시 현재 화면을 캡처하여 같이 보내주시면 빠르게 도움을 드릴 수 있습니다.
            </p>
          </div>
        </div>
      )}

      {logoutConfirmOpen && (
        <ConfirmModal
          title="로그아웃"
          description="메인 화면으로 이동합니다."
          confirmLabel="로그아웃"
          onConfirm={() => {
            setLogoutConfirmOpen(false);
            signOut(auth);
          }}
          onClose={() => setLogoutConfirmOpen(false)}
        />
      )}
    </div>
  );
}
