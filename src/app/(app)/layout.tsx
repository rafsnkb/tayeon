"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { withReturnTo } from "@/lib/navigation";
import { onOpenMenu } from "@/lib/ui/menuBus";
import { RoomsProvider, useRooms } from "@/lib/tarot/RoomsContext";
import { DEFAULT_ROOM_TITLE } from "@/lib/tarot/room";
import { BrandBi } from "@/components/BrandBi";
import TestAccountLogin from "@/components/TestAccountLogin";
import { kakaoAuthorizeUrl } from "@/components/LoginPanel";
import Link from "next/link";
import { NewChatIcon, ChevronRightIcon, BellIcon } from "./tarot/icons";
import { FORTUNE_FILTERS, fortuneFilterIcon, fortuneListHref } from "./fortune/filters";

const SIDEBAR_COLLAPSED_KEY = "tayeon-sidebar-collapsed";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <RoomsProvider>
      <AppShell>{children}</AppShell>
    </RoomsProvider>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  // hori.chat 실제 확인(2026-09-14): /terms, /support 같은 하위 페이지는 사이드바가 아예 없는
  // 별도의 단순한 화면이고, 상시 사이드바는 메인 채팅 화면에만 있다. 타연도 같은 원칙 —
  // "뒤로가기"로 들어가는 서브페이지(SubPageTopBar 쓰는 화면들)는 사이드바 없이 단순 중앙정렬.
  // 메인은 `/`, 대화방은 `/tarot/[roomId]` 다(2026-09-24 분리). 예전엔 둘이 한 라우트라
  // `isMainRoute` 하나가 두 가지를 겸했는데, 가르고 나니 역할이 갈라진다:
  //
  //  - isChatRoute: 드로어(사이드바)를 붙이고 풀스크린 레이아웃을 쓰는 화면. 메인과 대화방 **둘 다**.
  //  - isMainRoute: 비로그인이 머물 수 있는 유일한 화면. 메인뿐이다(대화방은 남의 방 id 를
  //    URL 로 찍어도 볼 게 없으므로 메인으로 돌려보낸다).
  //
  // 이 둘을 한 변수로 묶으면 대화방에서 드로어가 통째로 사라진다(2026-09-24 분리 중 실제로 냄).
  const isMainRoute = pathname === "/";
  // 운세(사주) 상품 목록도 같은 껍데기를 쓴다(2026-09-26). 목업 New/`Fortune_Home_*` 의 상단바에
  // 햄버거가 있어서 드로어가 붙어야 하고, 가게 진열대라 비로그인도 머물 수 있어야 한다 —
  // 서브페이지 취급을 하면 둘 다 안 된다. 드로어 **내용**은 아직 타로 것 그대로다: 목업
  // `MenuOpen_Fortune_*` 의 8줄(전체·신규 + 카테고리 6개, `public/icons/fortune_category_*`)은
  // 아직 만들지 않았다.
  //
  // **목록 한 장만이다** — `/fortune/readings/[id]`(리포트 읽기)는 다른 화면이라 여기 걸지 않는다.
  const isFortuneRoute = pathname === "/fortune";
  const isChatRoute = isMainRoute || pathname.startsWith("/tarot/") || isFortuneRoute;
  const {
    user,
    profileImage,
    hasUnreadNotifications,
    rooms,
    activeRoomId,
    selectRoom,
    createRoom,
    authChecked,
    loaded,
    meFailed,
  } = useRooms();
  const [menuOpen, setMenuOpen] = useState(false);
  // 데스크탑(lg+)에서만 의미 있는 상시 사이드바 접기 상태 — hori.chat 참조(2026-09-14).
  // 모바일 오버레이 드로어(menuOpen)와는 별개 개념.
  const [sidebarCollapsed, setSidebarCollapsed] = useState(
    () => typeof window !== "undefined" && window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "1"
  );

  function toggleSidebarCollapsed() {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, next ? "1" : "0");
      return next;
    });
  }

  // 비로그인이어도 대화 화면은 그대로 보여준다 — 로그인 유도는 입력을 시도했을 때 뜨는
  // LoginModal과, 아래 드로어의 로그인 CTA가 맡는다(피그마 "Screen / LoginModal",
  // "MenuOpen - NotLogin"). /me·/charge 같은 나머지 화면은 볼 내용 자체가 계정에 딸려 있어서
  // 머물 수 없지만, 내보낼 곳은 /login이 아니라 메인 화면이다(2026-09-23, 사용자 지시:
  // 로그인이든 비로그인이든 진입하면 메인 화면). /me에서 로그아웃하면 이 경로를 타는데
  // 예전엔 로그인 카드만 남은 /login으로 튕겨서, 로그아웃 확인 모달이 "메인 화면으로
  // 이동합니다"라고 약속한 것과도 어긋났다. /login 자체는 (app) 그룹 밖이라 친구초대
  // 링크(/login?ref=)와 카카오 실패 콜백(/login?error=)은 그대로 살아있다.
  useEffect(() => {
    if (authChecked && !user && !isMainRoute && !isFortuneRoute) router.replace("/");
  }, [authChecked, user, isMainRoute, isFortuneRoute, router]);

  useEffect(() => onOpenMenu(() => setMenuOpen(true)), []);

  /* "새 대화"는 방을 만들어서 그리로 들어간다 — 그래야 상담사 인사말이 뜬다(2026-09-26).
   *
   * 한동안은 방을 만들지 않고 메인으로만 보냈다. 말을 걸지 않고 나가면 "새 대화" 제목의 빈 방이
   * 목록에 쌓였기 때문인데, 그 대가로 **버튼을 눌러도 아무 일도 안 일어나는** 화면이 됐다.
   *
   * 빈 방이 쌓이던 문제는 방을 안 만드는 대신 **이미 있는 빈 방을 다시 쓰는** 것으로 푼다. 한 번도
   * 쓰지 않은 방은 제목이 기본값 그대로라 그걸로 알아본다(대화방 탑바도 같은 기준을 쓴다). 그러면
   * 버튼을 열 번 눌러도 빈 방은 하나를 넘지 않는다.
   *
   * 방 개수 상한에 걸리면 조용히 메인으로 보낸다 — 여기서 상한 모달까지 띄우면 "새 대화"를 누른
   * 사람에게 지우기를 강요하는 흐름이 된다. 첫 질문을 보내는 시점에 TarotScreen 이 제대로 묻는다. */
  async function handleNewRoom() {
    setMenuOpen(false);
    const empty = rooms.find((room) => room.title === DEFAULT_ROOM_TITLE);
    if (empty) {
      selectRoom(empty.id);
      router.push(`/tarot/${empty.id}`);
      return;
    }
    try {
      const created = await createRoom();
      if (created) {
        router.push(`/tarot/${created.id}`);
        return;
      }
    } catch {
      // 상한 초과·네트워크 오류 — 메인으로 떨어뜨린다.
    }
    router.push("/");
  }

  function handleSelectRoom(roomId: string) {
    selectRoom(roomId);
    setMenuOpen(false);
    router.push(`/tarot/${roomId}`);
  }

  if (!authChecked) return null;
  if (!user && !isChatRoute) return null;
  // 서브페이지는 `/api/user/me` 가 도착하기 전에는 아예 그리지 않는다(2026-09-25).
  //
  // authChecked 는 "파이어베이스가 로그인 여부를 알려줬다"까지고, 계정에 딸린 값(쿠폰,
  // 보유 이용권, 생년월일시)은 그 뒤 fetch 로 온다. 그동안 컨텍스트는 전부 초기값 —
  // activeCoupon=null, countPasses=[], hasBirthInfo=false — 이라 서브페이지가 "없다"를
  // 사실로 알고 한 번 그린다. 앱 안에서 이동할 때는 이미 채워져 있어 안 보이지만,
  // 새로고침·URL 직접 진입·결제 실패 후 재진입에서는 매번 보인다:
  //  - /charge 는 열두 장이 정가로 떴다가 할인가로 바뀌며 가격 줄이 한 줄 늘어난다
  //    (사용자 리포트 "진입 때 쿠폰 보유 여부를 미리 계산하는 게 아니야?" 의 나머지 절반).
  //  - /charge·/received-passes 는 생년월일시를 넣어둔 사람에게도 자미두수 조합을 누르면
  //    NoBirthTimePopup 을 띄운다.
  // 값마다 가드를 다는 대신 진입 자체를 늦춘다 — 서브페이지는 전부 로그인 전용이고, 어차피
  // 새로고침 직후엔 이미 빈 화면이라 한 왕복이 더 붙을 뿐이다. 대화 화면(isChatRoute)은
  // 비로그인도 머무는 곳이라 여기서 막을 수 없어, 필요한 자리마다 개별로 가드한다.
  if (!isChatRoute && !loaded) return null;
  // `loaded` 만으로는 부족하다(2026-09-26). 저건 "me 요청이 끝났다"라서 401·5xx 에도 열린다 —
  // 그러면 위에서 막으려던 바로 그 상태(컨텍스트 전부 초기값)로 화면이 열린다. /charge 에서는
  // 그게 돈 문제가 된다: 쿠폰이 null 이라 끄기 토글이 안 그려지고, useCoupon 은 기본값 true 로
  // 전송되어 서버가 1 회용 쿠폰을 소진한다. 화면은 정가라고 말한 채로.
  //
  // 그래서 빈 화면 대신 **실패를 말한다**. 자동 복구도 열어 둔다 — RoomsContext 의 10 초 주기
  // refreshMe 가 성공하면 meFailed 가 풀려 이 화면이 알아서 사라진다.
  if (!isChatRoute && meFailed) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-bg p-8 text-center">
        <p className="text-base font-semibold text-bold-text">정보를 불러오지 못했어요.</p>
        {/* 여기는 /charge 부터 /settings 까지 서브페이지 전부가 지나는 자리라 금액을 특정해
            말하지 않는다. 이유는 하나로 묶인다 — 계정 정보가 없으면 어느 화면이든 잘못된 값을
            보여주게 된다. */}
        <p className="text-sm font-semibold text-icon-muted">
          잘못된 정보가 보일 수 있어 화면을 열지 않았어요.
          <br />
          잠시 후 자동으로 다시 시도합니다.
        </p>
        <button
          type="button"
          onClick={() => router.push("/")}
          className="mt-2 h-12 rounded-full bg-chip-soft px-6 text-base font-semibold text-chip-soft-text"
        >
          메인으로
        </button>
      </div>
    );
  }

  // 서브페이지(/me, /settings, /charge 등)는 사이드바 없이 단순 중앙정렬 — hori.chat의 /terms,
  // /support와 동일한 원칙(위 isMainRoute 주석 참고). 사이드바+플렉스로 관련 복잡한 폭 계산이
  // 전혀 필요 없어서 별도의 단순한 트리로 일찍 반환한다.
  // 여기서는 폭을 아예 제한하지 않는다 — hori.chat 실측(/terms): 상단바(SubPageTopBar 해당)는
  // 뷰포트 폭 그대로(풀블리드), 그 아래 본문만 max-w-5xl(960px)로 중앙정렬됨. 상단바까지 같이
  // 좁혀버리면 다시 "탑바가 잘려 보인다"는 문제가 재현되므로(2026-09-14), 각 서브페이지가 자기
  // 본문 영역에만 개별적으로 폭을 건다.
  if (!isChatRoute) {
    return (
      <div className="flex min-h-dvh w-full flex-col overflow-visible xl:h-dvh xl:overflow-hidden">
        {children}
      </div>
    );
  }

  return (
    <div className="flex h-dvh flex-col overflow-hidden xl:flex-row">
      {/* 모바일(<lg): 햄버거로 여닫는 오버레이 드로어(fixed, translate로 슬라이드).
          데스크탑(lg+): 상시 노출되는 좌측 사이드바로 전환 — PC 브라우저에서 412px 모바일 프레임이
          화면 가운데 떠 있고 양옆이 텅 비어 보이던 문제(2026-09-14, 사용자 피드백) 해결용. 같은
          엘리먼트를 항상 DOM에 두고 브레이크포인트별로 포지셔닝만 바꾼다(조건부 렌더링이면 lg에서
          "항상 보이기"가 안 됨). */}
      <div
        className={`fixed inset-0 z-40 bg-black/40 transition-opacity xl:hidden ${
          menuOpen ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={() => setMenuOpen(false)}
      />
      <div
        className={`fixed inset-y-0 left-0 z-50 flex w-[290px] max-w-[85%] flex-col bg-topbar transition-transform duration-200 xl:static xl:z-auto xl:max-w-none xl:translate-x-0 xl:border-r xl:border-border ${
          menuOpen ? "translate-x-0" : "-translate-x-full"
        } ${sidebarCollapsed ? "xl:w-20" : "xl:w-[300px]"}`}
      >
        {/* 피그마 "Screen / MenuOpen" 실측(2026-09-23, doc/design/measure-menu.mjs):
            로고 top 19 잉크 21.3 / "새 대화" top 78 높이 48 / 그 아래 선 top 140.
            사용자 지시 — 새 대화 버튼과 그 아래 선은 **고정**이다. 그래서 스크롤 영역
            (최근 대화 목록) 바깥의 shrink-0 헤더에 둔다.

            로고는 시안에서 중앙이고 접기 화살표가 없다. 화살표는 데스크탑 전용 기능
            (hori.chat 참조, 2026-09-14)이라 없앨 수 없어, 로고를 중앙에 두고 화살표만
            xl 에서 absolute 로 우측에 얹는다 — 모바일(시안의 412 뷰포트)에서는 안 보인다. */}
        <div className="shrink-0">
          <div className={`relative flex items-center justify-center px-4 pt-[19px] ${sidebarCollapsed ? "xl:pt-4" : ""}`}>
            <span className={sidebarCollapsed ? "xl:hidden" : ""}>
              <BrandBi className="h-[21px] w-[43px]" />
            </span>
            <button
              type="button"
              onClick={toggleSidebarCollapsed}
              aria-label={sidebarCollapsed ? "사이드바 펼치기" : "사이드바 접기"}
              className={`absolute hidden h-8 w-8 shrink-0 items-center justify-center rounded-full text-icon-muted hover:bg-chip-soft hover:text-chip-soft-text xl:flex ${
                sidebarCollapsed ? "xl:static" : "xl:right-4"
              }`}
            >
              <ChevronRightIcon
                className={`h-3 w-2 transition-transform ${sidebarCollapsed ? "" : "rotate-180"}`}
              />
            </button>
          </div>

          {/* 운세 드로어에는 「새 대화」가 없다. 대신 로고 아래 선은 남는다 — 실측(3배 목업)
              로고 잉크 바닥 40, 선 62, 첫 줄 원의 위 80, 첫 구분선 137. 아래 `FortuneMenu` 의
              `pt-[9px]` 와 줄 높이 66 이 그 숫자와 맞물린다. */}
          {user && isFortuneRoute && (
            <div className="border-b border-border pb-[14px]" aria-hidden="true" />
          )}
          {/* 비로그인 드로어에는 새 대화 버튼도, 그 아래 선도 없다(MenuOpen - NotLogin). */}
          {user && !isFortuneRoute && (
            <div className="border-b border-border px-4 pb-[14px] pt-[37px]">
              <button
                type="button"
                onClick={handleNewRoom}
                className={`relative flex h-12 items-center justify-center rounded-full bg-chip-soft text-base font-semibold text-chip-soft-text ${
                  sidebarCollapsed ? "xl:w-12" : "w-full"
                }`}
              >
                {/* 아이콘은 좌측 고정(실측 중심 x 33), 라벨은 버튼 중앙 — 둘이 한 줄에 나란히
                    붙어 있는 게 아니라 라벨만 가운데다. 접힌 레일에서는 아이콘만 남는다. */}
                <NewChatIcon
                  className={`h-[17px] w-[17px] ${sidebarCollapsed ? "xl:static" : "absolute left-6"}`}
                />
                <span className={sidebarCollapsed ? "xl:hidden" : ""}>새 대화</span>
              </button>
            </div>
          )}
        </div>

        {/* 피그마 "Screen / MenuOpen - NotLogin" 실측: 안내 3줄 top 275.7 줄간격 17,
            카카오 버튼 top 333 높이 46 좌우여백 32 반경 9, 면 #fee500(카카오 공식색 —
            예전 코드의 #fae100 은 실측과 다르다), 글자 거의 검정. 여긴 모달을 띄우지 않고
            카카오로 바로 보낸다: 드로어를 열어 버튼까지 누른 사람에게 같은 내용을 한 번 더
            카드로 보여줄 이유가 없다. */}
        {!authChecked ? (
          /* 로그인 여부가 정해지기 전에는 어느 쪽도 그리지 않는다. 예전엔 !user 로만 갈라서
             세션을 복원하는 수백 ms 동안 **이미 로그인한 사람에게도** 카카오 버튼이 떴다 —
             그걸 누르면 카카오를 한 바퀴 돌고 원래 계정 그대로 돌아온다(2026-09-23 사용자 신고
             "카카오 로그인을 눌렀는데 테스트 계정으로 로그인된다"의 앞쪽 절반). */
          <div className="flex-1" />
        ) : !user ? (
          <div className={`flex flex-1 flex-col justify-center px-8 ${sidebarCollapsed ? "xl:hidden" : ""}`}>
            <p className="text-center text-sm font-bold leading-[17px] text-chip-soft-text">
              카카오 로그인으로
              <br />
              타연에서 여러분의 고민을
              <br />
              얘기해보세요
            </p>
            {/* 버튼은 받은 이미지 에셋 한 장이다(asset/texture/btn_kakao.png → public, 448x92
                2배수 = 시안 실측 224x46과 정확히 같다). 노란 면·말풍선·글자가 전부 그림 안에
                있어서 여기서 다시 그리지 않는다. w-full + 원본 비율이라 드로어가 넓어지는
                데스크탑 사이드바(300)에서도 같은 비율로 따라 커진다. */}
            <a href={kakaoAuthorizeUrl()} className="mt-[11px] block">
              <img
                src="/textures/btn_kakao.png"
                alt="카카오로 시작하기"
                width={448}
                height={92}
                className="h-auto w-full"
              />
            </a>

            {/* PG 심사용 ID/PW 로그인(2026-09-23 지시) — 토스페이먼츠 심사자가 마주치는
                로그인 지점 전부에 있어야 한다. 시안에는 없는 요소지만 심사 기간 한정이고,
                .env.local 의 PG_REVIEW_TEST_ID/PASSWORD 를 지우면 통로 자체가 닫힌다. */}
            <div className="mt-6">
              <TestAccountLogin />
            </div>
          </div>
        ) : isFortuneRoute ? (
          <FortuneMenu collapsed={sidebarCollapsed} onPick={() => setMenuOpen(false)} />
        ) : (
        /* 스크롤은 이 목록만 한다 — 위의 새 대화·선과 아래의 마이페이지·이용권은 고정이다.
           실측: "최근 대화" top 151.7(선에서 11.7), 첫 행 top 178.3, 행 높이 48 간격 4,
           불릿 지름 8 중심 x 38.7, 제목 x 66.7(행 padding 18 + 불릿 8 + gap 24 = 50). */
        <div className="flex-1 overflow-y-auto px-4 pb-2 pt-3">
          <div className={sidebarCollapsed ? "xl:hidden" : ""}>
            <p className="text-sm font-semibold text-placeholder">최근 대화</p>
            {/* 대화 화면은 109줄 게이트가 비껴가므로(비로그인도 머무는 곳이라) 여기선 rooms 가
                [] 인 채로 한 번 그려진다 — 제목만 있고 행이 하나도 없는 목록은 "이 계정엔 대화가
                없다"는 말이라, 쌓인 대화가 있는 사람에게 거짓이다(2026-09-26). 로드 전에는
                목록 자리를 그대로 비워 두고 아무 말도 하지 않는다. */}
            <div className="mt-[14px] flex flex-col gap-1">
              {!loaded && <p className="px-[18px] py-3 text-sm text-placeholder">불러오는 중...</p>}
              {rooms.map((room) => (
                <button
                  key={room.id}
                  type="button"
                  onClick={() => handleSelectRoom(room.id)}
                  className={`flex h-12 shrink-0 items-center gap-6 rounded-lg px-[18px] text-left text-base font-semibold text-chip-soft-text ${
                    room.id === activeRoomId ? "bg-chip-soft" : "hover:bg-chip-soft"
                  }`}
                >
                  <span className="h-2 w-2 shrink-0 rounded-full bg-current" />
                  <span className="truncate">{room.title}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
        )}

        {/* 비로그인 드로어 하단에 있던 사업자정보 블록은 걷어냈다(2026-09-23, 사용자 지시).
            같은 내용이 초기 화면 컴포저 아래 "회사 정보" 링크 → CompanyInfoModal 에 전부
            들어 있고(공정위 사업자정보 공개페이지 링크까지), 드로어는 애초에 닫혀 있는
            서랍이라 "초기 화면 표시"(전자상거래법 시행규칙 제7조①) 역할을 한 적이 없다.
            로그인한 사용자에게는 원래 안 보이던 블록이기도 하다. */}
        {authChecked && user && (
        /* 실측: 위 선 top 587 → 마이페이지 top 603(16) → 하단 651 → CTA top 667(16) →
           하단 715 → 바닥 732(17). 즉 border-t + p-4 + 사이 간격 16. */
        <div
          className={`flex shrink-0 flex-col gap-4 border-t border-border p-4 ${sidebarCollapsed ? "xl:items-center xl:px-2" : ""}`}
        >
          {/* 피그마 "Screen / MenuOpen" — 마이페이지 + 알림 벨이 한 행에 나란히. 데스크탑에서
              사이드바를 아이콘 레일로 접으면(sidebarCollapsed) 폭이 좁아 나란히 둘 수 없으므로
              flex-col-reverse로 순서만 뒤집어 벨을 마이페이지 위에 세로로 쌓는다.
              실측: 마이페이지 x 16~212(폭 196, 남는 폭 전부), 벨 x 228~276(48), 간격 16. */}
          <div className={`flex items-center gap-4 ${sidebarCollapsed ? "xl:flex-col-reverse xl:justify-center" : ""}`}>
            <button
              type="button"
              onClick={() => {
                setMenuOpen(false);
                router.push("/me");
              }}
              aria-label="마이 페이지"
              className={`flex h-12 min-w-0 items-center overflow-hidden rounded-full bg-chip-soft ${
                sidebarCollapsed ? "xl:w-12 xl:flex-none xl:justify-center" : "flex-1"
              }`}
            >
              {/* 프로필 원은 알약 높이(48)를 꽉 채우지 않는다 — 실측(New/MenuOpen_*, 2026-09-24)
                  x 20~60, y 607~647 로 **40x40**, 알약(x 16~, top 603) 안쪽으로 4 들어와 있다.
                  예전엔 48 을 알약 왼쪽 끝에 딱 붙여놔서 원이 한 치수 커 보였다.
                  라벨은 원 오른쪽 남은 공간의 가운데에 온다(flex-1) — 실측 라벨 중심 135.7,
                  원이 끝나는 60 과 알약 오른쪽 끝 212 의 중앙 136 과 맞는다. */}
              <span className="ml-1 h-10 w-10 shrink-0 overflow-hidden rounded-full bg-border">
                {profileImage && (
                  <img src={profileImage} alt="" className="h-full w-full object-cover" />
                )}
              </span>
              {/* 라벨은 프로필 원을 뺀 남은 폭의 가운데에 온다(실측 글자 중심 134.6 ≈ 138). */}
              <span className={`min-w-0 flex-1 truncate px-2 text-center text-base font-semibold text-chip-soft-text ${sidebarCollapsed ? "xl:hidden" : ""}`}>
                마이 페이지
              </span>
            </button>
            <button
              type="button"
              onClick={() => {
                setMenuOpen(false);
                router.push("/notifications");
              }}
              aria-label="알림"
              className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-chip-soft text-chip-soft-text"
            >
              <BellIcon className="h-5 w-5" />
              {/* 실측 12x12, 원의 우상단 끝에 딱 붙는다. */}
              {/* 초기값 false 는 "새 알림 없음"이라는 단언이다 — 로드 전엔 말하지 않는다. */}
              {loaded && hasUnreadNotifications && (
                <span className="absolute right-0 top-0 h-3 w-3 rounded-full bg-point" />
              )}
            </button>
          </div>
          {/* 피그마 "Screen / MenuOpen" 최하단 CTA. 실측 양 끝이 --point-light → --point 로
              떨어져 제안 알약과 같은 가로 그라데이션이다(.point-pill, globals.css).
              글자는 두 모드 모두 흰색. 접힌 아이콘 레일에는 넣을 자리가 없어 숨긴다. */}
          <button
            type="button"
            onClick={() => {
              setMenuOpen(false);
              router.push(withReturnTo("/charge", pathname));
            }}
            className={`point-pill flex h-12 w-full shrink-0 items-center justify-center rounded-full text-base font-bold ${
              sidebarCollapsed ? "xl:hidden" : ""
            }`}
          >
            이용권 구입하기
          </button>
        </div>
        )}
      </div>

      {/* 사이드바 옆 남는 공간은 여기서 전부 채운다(풀블리드) — hori.chat처럼 탑바/컴포저 배경은
          화면 끝까지, 그 안의 실제 콘텐츠만 중앙정렬하는 2단 구조는 /tarot 자신(TarotChat)이
          내부적으로 처리한다(서브페이지들이 각자 mx-auto max-w-2xl을 거는 것과 같은 패턴).
          예전엔 이 wrapper에 xl:max-w-4xl을 걸어서 /tarot의 탑바까지 통째로 좁아졌었음
          (2026-09-14 발견, 사용자 피드백: "상단바가 왜 안 고쳐지냐") — 제거함. */}
      <div className="flex h-full w-full flex-1 flex-col overflow-hidden">
        {children}
      </div>
    </div>
  );
}

/** 운세 모드의 메뉴 드로어 — 목업 New/`MenuOpen_Fortune_Dark`·`MenuOpen_Fortune_Light`.
 *
 *  타로 드로어의 "최근 대화" 자리에 **여덟 줄**(전체·신규 + 카테고리 6개)이 들어간다. 고른
 *  카테고리는 목록 화면의 필터로 이어져야 해서 주소로 넘긴다(`/fortune?c=love`) — 화면 안
 *  상태로는 드로어에서 목록까지 닿지 못한다.
 *
 *  실측(목업 3배): 줄 높이 66(원 48 + 위아래 9), 구분선은 줄 사이에만, 원 지름 48 `--chip-soft`,
 *  아이콘 잉크 18(83px 에셋의 잉크가 90% 라 20px 로 그린다), 라벨 16px `--chip-soft-text` 가
 *  원에서 8 떨어짐, 오른쪽 셰브런 9x18.
 *
 *  아이콘이 래스터라 `currentColor` 를 못 따라가서 모드별 파일을 두 장 겹치고 하나를 숨긴다
 *  (`BrandBi` 와 같은 방식). 파일명↔한국어 매핑은 `fortune/filters.ts` 한 곳에만 있다 —
 *  상품 정의에는 아이콘 경로를 넣지 않는다(설계 §3).
 *
 *  **로고 위치는 목업과 다르다.** `MenuOpen_Fortune_*` 은 로고가 왼쪽 정렬인데, 타로 드로어
 *  (`MenuOpen_*`)는 가운데다. 헤더는 두 모드가 공유하고, 토글만 눌렀는데 로고가 옆으로 뛰는
 *  건 더 이상해서 가운데를 유지했다. 같은 이유로 목업이 드로어 머리에 그려 둔 타로/운세 토글도
 *  넣지 않았다 — 실제로는 드로어가 상단바를 덮으므로 토글이 두 벌이 된다. */
function FortuneMenu({ collapsed, onPick }: { collapsed: boolean; onPick: () => void }) {
  return (
    <div className="flex-1 overflow-y-auto px-4 pt-[9px]">
      <div className={collapsed ? "xl:hidden" : ""}>
        {FORTUNE_FILTERS.map((item, index) => {
          const icon = fortuneFilterIcon(item.key);
          return (
            <Link
              key={item.key}
              href={fortuneListHref(item.key)}
              onClick={onPick}
              className={`flex h-[66px] items-center gap-2 ${
                index === FORTUNE_FILTERS.length - 1 ? "" : "border-b border-border"
              }`}
            >
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-chip-soft">
                <img src={icon.light} alt="" className="h-5 w-5 dark:hidden" />
                <img src={icon.dark} alt="" className="hidden h-5 w-5 dark:block" />
              </span>
              <span className="min-w-0 flex-1 truncate text-base font-semibold text-chip-soft-text">
                {item.label}
              </span>
              <ChevronRightIcon className="h-[18px] w-[9px] shrink-0 text-chip-soft-text" />
            </Link>
          );
        })}
      </div>
    </div>
  );
}
