"use client";

import { useEffect, useState } from "react";
import { formatDateTime } from "@/lib/util/formatDate";
import { useRouter } from "next/navigation";
import { withReturnTo } from "@/lib/navigation";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase/client";
import { useRooms } from "@/lib/tarot/RoomsContext";
import ConfirmModal from "@/components/ConfirmModal";
import SubPageTopBar from "@/components/SubPageTopBar";
import { ComboAllowancePanel } from "@/components/ComboAllowanceCard";
import {
  COMBOS,
  COMBO_ORDER,
  PAYMENT_BONUS_REWARD_TIERS,
  REWARD_PAYOUT_DAY_OF_MONTH,
  SPREADS,
  rewardAllowancesForCombo,
} from "@/lib/tarot/pricing";
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
  ChevronLeftIcon,
  ChevronRightIcon,
  CloseIcon,
} from "../tarot/icons";

export function ListRow({
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
          danger ? "text-urgent" : "text-icon-muted"
        }`}
      >
        {icon}
      </span>
      <span className={`flex-1 text-base font-semibold ${danger ? "text-urgent" : "text-icon-muted"}`}>
        {label}
      </span>
      <span className="text-icon-muted">
        <ChevronRightIcon className="h-4 w-2" />
      </span>
    </button>
  );
}

export function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <p className="px-1 text-base font-semibold text-icon-muted">{title}</p>
      <div className="flex flex-col divide-y divide-border rounded-[32px] border border-border bg-topbar px-6">
        {children}
      </div>
    </div>
  );
}

export function ComingSoon() {
  alert("아직 준비 중인 기능이에요.");
}

// 완벽한 UA 파싱은 아니고, 계정정보 모달의 "접속환경" 표시용 대략적인 추정치.
// 계정정보 모달 "가입일"/"최근 로그인" — 피그마는 0패딩 24시간제(YYYY.MM.DD HH:mm:ss)인데
// toLocaleString("ko-KR") 기본값은 "2026. 1. 10. 오전 9:00:00"처럼 패딩 없는 12시간제로 나와서 다름.
function formatWonShort(won: number): string {
  return `${(won / 10_000).toLocaleString("ko-KR")}만원`;
}

// RewardInfoModal의 "리워드 지급 비율" 표 — pricing.ts의 PAYMENT_BONUS_REWARD_TIERS를 그대로
// 표시용 행으로 변환한다. 전에는 마지막 행만 "그 위 구간 미만"으로 표기했는데, 그건 최하단 구간이
// 0원(모든 결제가 걸리는 캐치올)일 때만 맞는 문구였다 — 2026-09-18에 하위 2단계(1%/0.5%)를
// 없애면서 최하단이 5만원 구간이 됐는데, 같은 공식을 그대로 쓰면 "5만원 미만은 1.5%"처럼 실제로는
// 리워드가 아예 없는 구간(5만원 미만)에 요율이 적용되는 것처럼 잘못 표시된다. 그래서 모든 행을
// 예외 없이 "X 이상"으로 통일한다.
/** 보너스 리워드 안내 모달의 두 탭(목업 RewardInfoModal_Expect / _Percent, 2026-09-24). */
type RewardTab = "expected" | "rate";

/** 0.015 → "1.5%", 0.1 → "10%". 소수점이 필요한 구간만 붙는다. */
const formatRate = (rate: number) => `${Number((rate * 100).toFixed(2))}%`;

/** 리워드가 시작되는 금액(VAT 제외). 요율표의 최하단 구간이 곧 지급 하한이다. */
const REWARD_MIN_WON = PAYMENT_BONUS_REWARD_TIERS.at(-1)!.minWon;

const REWARD_TIER_ROWS = PAYMENT_BONUS_REWARD_TIERS.map((tier) => ({
  rate: tier.rate,
  label: `${formatWonShort(tier.minWon)} 이상`,
}));

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
 * 가는 허브. 친구초대는 /invite로 연결된다. */
export default function MyPage() {
  const router = useRouter();
  const { user, nickname, profileImage, email } = useRooms();
  const [accountInfoOpen, setAccountInfoOpen] = useState(false);
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);
  const [termsAgreedAt, setTermsAgreedAt] = useState<string | null>(null);
  const [rewardInfoOpen, setRewardInfoOpen] = useState(false);
  const [bonusReward, setBonusReward] = useState<{
    month: number;
    /** 실제 결제 총액(VAT 포함). */
    totalWon: number;
    /** 요율이 걸리는 금액(VAT 제외). 화면에 보여주는 건 이쪽이다. */
    supplyWon: number;
    rate: number;
    projectedPasses: number;
  } | null>(null);
  const [rewardTab, setRewardTab] = useState<RewardTab>("expected");
  const [rewardCombo, setRewardCombo] = useState(0);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const idToken = await user.getIdToken();
      const res = await fetch("/api/user/bonus-reward", { headers: { Authorization: `Bearer ${idToken}` } });
      if (res.ok) setBonusReward(await res.json());
    })();
  }, [user]);

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
    <div className="flex min-h-dvh flex-col overflow-visible bg-bg xl:h-full xl:overflow-hidden">
      <SubPageTopBar title="마이 페이지" />

      <div className="flex-1 overflow-visible p-4 pt-20 xl:overflow-y-auto scroll-gutter-stable">
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
          <Section title="계정">
            <div className="flex items-center gap-3 py-4">
              <span className="h-16 w-16 shrink-0 overflow-hidden rounded-full border border-border bg-chip-fill">
                {profileImage && <img src={profileImage} alt="" className="h-full w-full object-cover" />}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-lg font-semibold text-bold-text">{nickname ?? "-"}</p>
                <p className="truncate text-sm font-semibold text-icon-muted">{email ?? "카카오 로그인"}</p>
              </div>
              <button
                type="button"
                onClick={openAccountInfo}
                className="flex shrink-0 items-center gap-1.5 rounded-full bg-chip-soft px-3 py-1.5 text-sm font-semibold text-chip-soft-text"
              >
                <SearchIcon className="h-3.5 w-3.5" />
                계정정보
              </button>
            </div>
            <div className="flex items-center justify-between py-3">
              {/* 목업(MyPage_*)은 돋보기를 **값 오른쪽 끝**에 둔다 — 라벨에 붙여 두면 "리워드"라는
                  말을 누르는 것처럼 보이고, 실제로 여는 건 옆의 숫자에 대한 설명이다. */}
              <span className="text-sm font-semibold text-icon-muted">
                {bonusReward ? `예상 ${bonusReward.month}월 보너스 리워드` : "예상 이번 달 보너스 리워드"}
              </span>
              <button
                type="button"
                onClick={() => setRewardInfoOpen(true)}
                className="flex items-center gap-2"
              >
                {/* 회수가 아니라 **요율**을 보여준다(목업 MyPage_Dark, 2026-09-24). 회수는 조합마다
                    달라서 한 줄에 담을 수 없고, 요율은 하나뿐이다. 기준 미달이면 요율이 0 인데
                    "0%"는 "리워드가 있는데 0"처럼 읽혀서 미지급임을 그대로 쓴다. */}
                <span className="text-lg font-bold text-bold-text">
                  {!bonusReward ? "-" : bonusReward.rate > 0 ? formatRate(bonusReward.rate) : "미지급"}
                </span>
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-chip-soft text-chip-soft-text">
                  <SearchIcon className="h-3 w-3" />
                </span>
              </button>
            </div>
            <ListRow icon={<InvitePersonIcon className="h-4 w-5" />} label="친구 초대하기" onClick={() => router.push("/invite")} />
          </Section>

          <Section title="이용권">
            <ListRow icon={<CartIcon className="h-5 w-5" />} label="횟수제 · 시간제 이용권 구입" onClick={() => router.push(withReturnTo("/charge", "/me"))} />
            <ListRow icon={<CardIcon className="h-4 w-5" />} label="결제 내역" onClick={() => router.push("/purchase-history")} />
            <ListRow icon={<ListIcon className="h-5 w-3.5" />} label="내 보유 이용권" onClick={() => router.push("/my-passes")} />
          </Section>

          <Section title="프로필">
            <ListRow icon={<IdCardIcon className="h-3.5 w-5" />} label="내 프로필 관리" onClick={() => router.push("/me/profile")} />
            <ListRow icon={<PersonIcon className="h-5 w-4" />} label="궁합 상대 프로필 관리" onClick={() => router.push("/compatibility")} />
          </Section>

          <Section title="시스템">
            <ListRow icon={<CompassIcon className="h-5 w-5" />} label="공지사항" onClick={() => router.push("/notice")} />
            <ListRow icon={<GearIcon className="h-[18px] w-5" />} label="설정" onClick={() => router.push("/settings")} />
            <ListRow
              icon={<LogoutDoorIcon className="h-5 w-5" />}
              label="로그아웃"
              danger
              onClick={() => setLogoutConfirmOpen(true)}
            />
          </Section>
          {/* 하단 사업자정보(CompanyFooter)는 걷어냈다(2026-09-24 사용자 지시). 표시 의무가
              걸리는 자리가 아니다 — 전자상거래법 제10조①·시행규칙 제7조①은 **초기 화면**
              (메인, MainCompanyInfo)을, 제13조①은 **청약을 받을 목적의 표시·광고**(이용권
              구입 화면 /charge)를 대상으로 한다. 마이페이지는 둘 중 어디에도 안 들어간다.
              /charge 쪽은 그대로 둔다. */}
        </div>
      </div>

      {accountInfoOpen && (
        <div
          data-modal-overlay="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setAccountInfoOpen(false)}
        >
          <div
            className="w-full max-w-sm rounded-[32px] border border-border bg-surface p-4 dark:border-border dark:bg-topbar"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <div className="w-5" />
              <p className="flex-1 text-center text-lg font-bold text-bold-text">계정 정보</p>
              <button type="button" onClick={() => setAccountInfoOpen(false)} aria-label="닫기" className="text-bold-text">
                <CloseIcon className="h-5 w-5" />
              </button>
            </div>
            <div className="rounded-2xl bg-bg p-4 dark:bg-border">
              <div className="flex flex-col gap-[28px] text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-icon-muted">아이디</span>
                  <span className="font-semibold text-bold-text">{email ?? "카카오 로그인"}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-icon-muted">UID</span>
                  <span className="font-semibold text-bold-text">{user?.uid ?? "-"}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-icon-muted">가입일</span>
                  <span className="font-semibold text-bold-text">
                    {termsAgreedAt ? formatDateTime(termsAgreedAt) : "-"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-icon-muted">최근 로그인</span>
                  <span className="font-semibold text-bold-text">
                    {user?.metadata.lastSignInTime ? formatDateTime(user.metadata.lastSignInTime) : "-"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-icon-muted">접속환경</span>
                  <span className="font-semibold text-bold-text">{describeEnvironment()}</span>
                </div>
              </div>
            </div>
            <p className="mt-4 text-center text-xs text-icon-muted">
              고객센터 문의 시 현재 화면을 캡처하여 같이 보내주시면 빠르게 도움을 드릴 수 있습니다.
            </p>
          </div>
        </div>
      )}

      {rewardInfoOpen && (
        <div
          data-modal-overlay="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setRewardInfoOpen(false)}
        >
          {/* 목업(RewardInfoModal_Expect / _Percent) 실측, 2026-09-25. 브라우저에서 Pretendard 의
              글자당 가로폭을 재서 목업의 잉크 폭과 맞춰 크기를 역산했다 — 잉크 높이는
              안티에일리어싱 때문에 2~3px 부풀어서 쓸 수 없었다.

              세로: 카드 516, 헤더 72, 토글 56, 설명 50, 바닥 문구 33. 두 탭의 카드 높이가
              **정확히 같고** 비율 탭은 행 간격을 넓혀 그 높이를 채운다 — 내용에 맡기면 토글할
              때마다 모달이 늘었다 줄었다 한다(사용자 지적). 그래서 flex 로 나눠 갖는다. */}
          <div
            className="flex h-[516px] w-full max-w-[380px] flex-col rounded-[32px] border border-border bg-topbar px-4 pt-4"
            onClick={(e) => e.stopPropagation()}
          >
            {/* X 는 목업 실측대로 22×22 이고 오른끝이 카드 바깥선에서 27 이다(= 컨텐츠
                오른끝에서 11 더 안쪽). 제목은 X 와 무관하게 카드 전체 폭의 가운데다. */}
            <div className="relative flex h-14 shrink-0 items-center justify-center">
              <p className="text-center text-base font-bold text-bold-text">보너스 리워드 안내</p>
              <button
                type="button"
                onClick={() => setRewardInfoOpen(false)}
                aria-label="닫기"
                className="absolute right-[11px] text-icon-muted"
              >
                <CloseIcon className="h-[22px] w-[22px]" />
              </button>
            </div>

            {/* 트랙 56 / 알약 40 — 사방 8 안쪽이다(내 보유 이용권 탭바와 같은 규칙). */}
            <div className="flex h-14 shrink-0 rounded-full bg-chip-soft p-2">
              {([["expected", "예상 리워드"], ["rate", "리워드 비율"]] as const).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setRewardTab(key)}
                  className={`h-10 flex-1 rounded-full text-sm font-bold ${
                    rewardTab === key ? "point-pill text-white" : "text-placeholder dark:text-chip-soft-text"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <p className="flex h-[50px] shrink-0 items-center justify-center text-center text-sm font-semibold leading-tight text-placeholder">
              월별 타연 내 결제금액(VAT 제외)에 따라
              <br />
              리워드 이용권을 지급해 드립니다.
            </p>

            {rewardTab === "expected" ? (
              <div className="flex min-h-0 flex-1 flex-col">
                {/* 금액은 가로 한 줄이 아니라 **가운데 쌓기**다(목업). 요율이 걸리는 금액
                    (VAT 제외)을 보여준다 — 총액을 띄우면 옆의 요율과 곱해도 아래 횟수가 나오지
                    않아 사용자가 검산할 수 없다. */}
                <div className="flex h-[88px] shrink-0 flex-col items-center justify-center gap-4 rounded-2xl bg-chip-soft">
                  <span className="text-base font-semibold leading-none text-placeholder">
                    {bonusReward ? `${bonusReward.month}월 결제금액` : "이번 달 결제금액"}
                  </span>
                  <span className="text-2xl font-bold leading-none text-chip-soft-text">
                    {(bonusReward?.supplyWon ?? 0).toLocaleString("ko-KR")}원
                  </span>
                </div>
                {bonusReward && bonusReward.projectedPasses > 0 ? (
                  /* 금액 상자와 아래 표 사이는 목업에서도 그냥 빈 곳이다(실측 72) — mt-auto 로
                     아래쪽 세 덩어리를 바닥에 붙이면 그 여백이 자연히 남는다. */
                  <div className="mt-auto">
                    <p className="text-center text-sm font-semibold text-placeholder">예상 보너스 리워드 이용권</p>
                    {/* 조합을 좌우로 넘겨 본다. 네 조합을 한 화면에 쌓으면 모달이 스크롤된다.
                        알약은 48×32, 가운데 이름은 폭을 고정해 화살표가 춤추지 않게 한다. */}
                    <div className="mt-1 flex h-8 items-center justify-center gap-2.5">
                      <button
                        type="button"
                        aria-label="이전 조합"
                        onClick={() => setRewardCombo((i) => (i + COMBO_ORDER.length - 1) % COMBO_ORDER.length)}
                        className="flex h-8 w-12 shrink-0 items-center justify-center rounded-full bg-chip-soft text-chip-soft-text"
                      >
                        <ChevronLeftIcon className="h-4 w-2" />
                      </button>
                      <span className="w-[152px] text-center text-base font-bold text-chip-soft-text">
                        {COMBOS[COMBO_ORDER[rewardCombo]].label}
                      </span>
                      <button
                        type="button"
                        aria-label="다음 조합"
                        onClick={() => setRewardCombo((i) => (i + 1) % COMBO_ORDER.length)}
                        className="flex h-8 w-12 shrink-0 items-center justify-center rounded-full bg-chip-soft text-chip-soft-text"
                      >
                        <ChevronRightIcon className="h-4 w-2" />
                      </button>
                    </div>
                    <div className="mt-2">
                      {/* 지급 규칙은 무상 지급 쪽(버림 + 조합·스프레드별 단조 감소)이다. */}
                      <ComboAllowancePanel
                        combo={COMBO_ORDER[rewardCombo]}
                        allowanceFor={(combo, spread) =>
                          rewardAllowancesForCombo(bonusReward.projectedPasses * SPREADS.one.cost, combo)[spread]
                        }
                      />
                    </div>
                  </div>
                ) : (
                  <div className="my-auto flex items-center justify-center p-4">
                    <p className="text-center text-sm font-semibold text-placeholder">
                      {(REWARD_MIN_WON / 10_000).toLocaleString("ko-KR")}만 원(VAT 제외) 이상 결제하시면
                      <br />
                      리워드 이용권을 지급해 드려요.
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex min-h-0 flex-1 flex-col">
                <p className="flex h-[42px] shrink-0 items-center justify-center text-sm font-bold text-chip-soft-text">
                  리워드 지급 비율
                </p>
                {/* 표의 색은 목업(RewardInfoModal_Percent)을 sharp 로 픽셀 샘플해서 맞췄다 —
                    박스 bg=--chip-soft(라이트 #e7e2e1 정확 일치), 헤더 칩은 그보다 한 톤 "패인"
                    면(라이트 --bg / 다크 --topbar), 라벨은 --placeholder(양쪽 정확 일치).
                    행은 여섯 칸(헤더+5구간)이 같은 높이로 남는 공간을 나눠 갖는다 — 목업의 행
                    간격 40 이 그렇게 나온 값이다. */}
                <div className="flex min-h-0 flex-1 flex-col rounded-3xl bg-chip-soft p-3">
                  <div className="flex h-8 shrink-0 items-center justify-between gap-2 rounded-xl bg-bg px-3 text-base font-semibold text-placeholder dark:bg-topbar">
                    <span>당월 결제금액</span>
                    <span className="shrink-0">리워드 비율</span>
                  </div>
                  {REWARD_TIER_ROWS.map((row) => (
                    <div key={row.label} className="flex flex-1 items-center justify-between gap-2 px-3 text-base">
                      <span className="font-semibold text-placeholder">{row.label}</span>
                      <span className="shrink-0 font-bold text-point-text">{formatRate(row.rate)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <p className="flex h-[34px] shrink-0 items-center justify-center text-center text-sm text-icon-muted">
              보너스 리워드 이용권은 매월 {REWARD_PAYOUT_DAY_OF_MONTH}일에 지급됩니다.
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
            void signOut(auth);
            // 모달이 "메인 화면으로 이동합니다"라고 약속하므로 여기서 직접 보낸다. AppShell의
            // 비로그인 리다이렉트에만 맡기면 user가 null로 바뀌는 한 프레임 동안 /me가 빈
            // 화면으로 남는다(authChecked는 이미 true라 로딩 표시도 없다).
            router.replace("/");
          }}
          onClose={() => setLogoutConfirmOpen(false)}
        />
      )}
    </div>
  );
}
