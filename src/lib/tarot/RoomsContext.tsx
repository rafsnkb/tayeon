"use client";

// 방 목록/횟수제·시간제 이용권 상태 — 원래 /tarot 페이지에만 있었는데, 피그마 리디자인에서는
// 메뉴 드로어((app)/layout.tsx)가 어느 페이지에서든 "최근 대화"/이용권 상태를 보여줘야
// 해서 페이지 로컬 state로는 안 되고 레이아웃 레벨에서 공유해야 한다(2026-09-14).
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { auth } from "@/lib/firebase/client";
import type { ComboKey, CountPassBalance } from "@/lib/tarot/pricing";
import { DEFAULT_TONE, isToneKey, type ToneKey } from "@/lib/tarot/tone";

export type Room = { id: string; title: string; updatedAt: string };
export type ActiveTimePass = {
  passId: string;
  minutes: number;
  combo: ComboKey;
  startedAt: string;
  expiresAt: string;
};
export type TimePass = { id: string; minutes: number; combo: ComboKey };
export type CountPass = CountPassBalance & {
  id: string;
  productId?: string;
  source?: "purchase" | "admin-grant" | "signup-free" | "referral-signup" | "bonus-reward" | "referral-payout";
  reason?: string | null;
  freePasses?: number;
  createdAt: string;
};
export type ActiveCountPass = {
  passId: string;
  combo: ComboKey | "any";
  basis: number;
  remaining: number;
  expiresAt: string | null;
  source?: string;
  productId?: string;
};

/** `/api/user/me` 응답 중 이 컨텍스트가 쓰는 부분만. 라우트 반환값 전체를 베껴 오면 한쪽만
 *  고쳐져 어긋나므로, 쓰는 필드만 적고 나머지는 무시한다. */
/** 지금 쓸 수 있는 할인쿠폰 한 장. 서버(/api/user/me)가 골라서 내려준다 — 화면이 여러 장 중에
 *  고르는 일이 없도록 발급 단계에서 기간이 겹치지 않게 막아 두었다. */
export type ActiveCoupon = { code: string; name: string; discountRate: number; startsAt: string; endsAt: string };

/** 궁합 상대 프로필. `/compatibility` 의 폼이 그대로 쓴다. */
export type Partner = {
  nickname: string;
  birthDate: string | null;
  birthTime: string | null;
  gender: "male" | "female" | "unspecified";
  calendarType: "solar" | "lunar";
  isLeapMonth?: boolean;
  birthPlace?: string | null;
};

type MeResponse = {
  activeCoupon?: ActiveCoupon | null;
  nickname: string | null;
  /** 고른 상담사(톤). 메인에서 인사말을 그 자리에서 만들어 보여줄 때 쓴다. */
  tone?: ToneKey;
  profileImage?: string | null;
  email?: string | null;
  countPasses?: CountPass[];
  activeCountPass?: ActiveCountPass | null;
  /** 서버가 내린 "생년월일 정보가 갖춰졌는가" 판정(isValidBirthInfo). */
  birthInfoComplete?: boolean;
  birthInfo?: { timeUnknown?: boolean } | null;
  /** 궁합 상대. **필드를 좁히지 말 것**(2026-09-26) — 서버는 Firestore 의 partner 객체를
   *  통째로 내려주는데(api/user/me/route.ts) 여기서 두 필드만 받아 적으면, 그 값이 필요한
   *  화면(/compatibility)이 같은 데이터를 `/api/user/partner` 로 **한 번 더** 받아 오게 된다. */
  partner?: Partner | null;
  activeTimePass?: ActiveTimePass | null;
  timePasses?: TimePass[];
  hasUnreadNotifications?: boolean;
};

type RoomsContextValue = {
  user: User | null;
  nickname: string | null;
  tone: ToneKey;
  profileImage: string | null;
  email: string | null;
  countPasses: CountPass[];
  setCountPasses: Dispatch<SetStateAction<CountPass[]>>;
  activeCountPass: ActiveCountPass | null;
  hasBirthInfo: boolean;
  myTimeUnknown: boolean;
  hasPartner: boolean;
  partnerTimeUnknown: boolean;
  /** 궁합 상대 프로필 전체. `/api/user/me` 가 이미 실어다 주므로 `/compatibility` 가
   *  `/api/user/partner` 를 따로 부를 필요가 없다(2026-09-26). */
  partner: Partner | null;
  activeTimePass: ActiveTimePass | null;
  setActiveTimePass: Dispatch<SetStateAction<ActiveTimePass | null>>;
  timePasses: TimePass[];
  setTimePasses: Dispatch<SetStateAction<TimePass[]>>;
  hasUnreadNotifications: boolean;
  setHasUnreadNotifications: Dispatch<SetStateAction<boolean>>;
  /** 알림을 다 읽었을 때 배지를 끄는 **전용** 경로. `setHasUnreadNotifications(false)` 를 직접
   *  쓰면 그보다 먼저 출발한 /api/user/me 응답이 배지를 되살린다(아래 badgeClearedAtRef 참고). */
  clearNotificationBadge: () => void;
  /** 지금 적용될 할인쿠폰(없으면 null). 구입 화면이 **진입 시점에 이미** 알고 있어야 가격이
   *  튀지 않는다 — 그래서 별도 조회가 아니라 /api/user/me 에 실려 온다. */
  activeCoupon: ActiveCoupon | null;
  rooms: Room[];
  activeRoomId: string | null;
  /** null 이면 "방 없음"(메인 화면). 라우트를 따라간다 — TarotScreen 이 동기화한다. */
  selectRoom: (roomId: string | null) => void;
  loaded: boolean;
  /** 방 목록을 못 받아온 채로 로딩이 끝난 상태. `loaded && !activeRoomId`로 유추하지 않고
   *  따로 들고 있는 이유: 마지막 방을 지운 직후에도 그 조합이 나올 수 있어서 구분이 안 된다. */
  loadFailed: boolean;
  /** `/api/user/me` 가 값을 못 준 상태. `loaded` 가 true 여도 이게 true 면 계정에 딸린 값은
   *  **전부 초기값(거짓)** 이다 — 그 상태로 화면을 열면 안 된다. `loadFailed` 와 다르다:
   *  저건 방 목록 기준이라 아래에서 덮어쓰인다. */
  meFailed: boolean;
  authChecked: boolean;
  createRoom: (force?: boolean) => Promise<Room | null>;
  deleteRoom: (roomId: string) => Promise<void>;
  renameRoom: (roomId: string, title: string) => Promise<void>;
  setRoomTitleLocal: (roomId: string, title: string) => void;
  refreshMe: () => Promise<void>;
  pendingReadingRoomIds: Set<string>;
  markReadingPending: (roomId: string) => void;
  markReadingDone: (roomId: string) => void;
};

export const RoomsContext = createContext<RoomsContextValue | null>(null);

export function RoomsProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [nickname, setNickname] = useState<string | null>(null);
  const [tone, setTone] = useState<ToneKey>(DEFAULT_TONE);
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [countPasses, setCountPasses] = useState<CountPass[]>([]);
  const [activeCountPass, setActiveCountPass] = useState<ActiveCountPass | null>(null);
  const [hasBirthInfo, setHasBirthInfo] = useState(false);
  const [myTimeUnknown, setMyTimeUnknown] = useState(false);
  const [hasPartner, setHasPartner] = useState(false);
  const [partner, setPartner] = useState<Partner | null>(null);
  const [partnerTimeUnknown, setPartnerTimeUnknown] = useState(false);
  const [activeTimePass, setActiveTimePass] = useState<ActiveTimePass | null>(null);
  const [timePasses, setTimePasses] = useState<TimePass[]>([]);
  const [hasUnreadNotifications, setHasUnreadNotifications] = useState(false);
  /** 지금 적용될 할인쿠폰. /api/user/me 가 같이 내려준다 — 구입 화면이 마운트된 뒤에 따로
   *  조회하면 첫 렌더가 정가였다가 할인가로 바뀌면서 화면이 튄다(2026-09-25). */
  const [activeCoupon, setActiveCoupon] = useState<ActiveCoupon | null>(null);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  /** `/api/user/me` 가 **값을 못 준** 상태. `loaded` 와 반드시 따로 들어야 한다(2026-09-26).
   *
   *  `loaded` 는 "요청이 끝났다"이지 "값이 왔다"가 아니다 — me 가 401·5xx 면 applyMe 를
   *  건너뛰고 그대로 setLoaded(true) 로 흐른다. 서브페이지를 loaded 로만 막으면 그 창에서
   *  **컨텍스트가 전부 초기값인 채로** 화면이 열린다. 그게 단순한 오표시로 끝나지 않는다:
   *  /charge 는 activeCoupon 이 null 이면 쿠폰 끄기 토글을 아예 안 그리는데, useCoupon 은
   *  기본값 true 로 남아 그대로 전송되고 서버(payment/prepare)는 `useCoupon !== false` 라
   *  보유 쿠폰을 골라 적용한다 — 화면은 정가라 해 놓고 1 회용 쿠폰이 소진된다.
   *
   *  loadFailed 로 겸할 수 없다. 저 값은 아래에서 **방 목록 기준으로 덮어쓰인다**
   *  (`setLoadFailed(failed)`) — me 실패를 적어둬도 방 목록이 성공하면 지워진다. */
  const [meFailed, setMeFailed] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  // 리딩 요청(handleSubmit)이 "어느 방에" 진행 중인지 — TarotChat 로컬 state가 아니라 여기 두는
  // 이유: 로딩 중에 다른 페이지로 이동했다가 돌아오면 TarotChat이 통째로 재마운트되는데, 그
  // 새 인스턴스가 "이 방은 아직 리딩이 안 끝났다"를 알 방법이 로컬 state로는 없어서 방금 물어본
  // 질문+답변이 사라진 것처럼 보이는 버그가 있었음(2026-09-14, 사용자 리포트: 로딩 중 이용권
  // 버튼 눌러서 /charge로 이동 후 뒤로가기하면 방금 대화가 없어진 것처럼 보임). 실제로는 서버가
  // 리딩 저장·이용권 차감까지 다 끝내지만(원래 컴포넌트 인스턴스가 죽어도 fetch 자체는 안 끊김),
  // 새로 마운트된 인스턴스가 "언제 다시 히스토리를 조회해야 하는지" 알 방법이 없어서 생긴 문제.
  const [pendingReadingRoomIds, setPendingReadingRoomIds] = useState<Set<string>>(new Set());

  const markReadingPending = useCallback((roomId: string) => {
    setPendingReadingRoomIds((prev) => new Set(prev).add(roomId));
  }, []);
  const markReadingDone = useCallback((roomId: string) => {
    setPendingReadingRoomIds((prev) => {
      if (!prev.has(roomId)) return prev;
      const next = new Set(prev);
      next.delete(roomId);
      return next;
    });
  }, []);

  const selectRoom = useCallback((roomId: string | null) => setActiveRoomId(roomId), []);

  /** `/api/user/me` 응답을 상태에 푼다. 처음 로그인할 때와 `refreshMe()` 때 **같은 열세 줄**이
   *  두 벌로 복사돼 있었다. 실제로 2026-09-25 에 판정 한 줄(`birthInfoComplete`)을 바꾸면서
   *  두 곳을 모두 고쳐야 했고, 한쪽만 고쳤다면 새로고침 전후로 화면이 달라졌을 것이다. */
  /** 알림 배지를 **로컬에서 끈 시각**. 알림 화면이 mark-read 를 보내고 배지를 끄는데, 그보다
   *  먼저 출발한 refreshMe 의 응답이 나중에 도착하면 아직 `true` 라서 배지를 되살린다 —
   *  다 읽고 나왔는데 빨간 점이 최대 10 초간 다시 켜져 있다(2026-09-26). 마지막 쓰기 승자
   *  문제라, 응답이 **언제 요청된 것인지**를 보고 옛 응답의 true 만 무시한다. false 는 그대로
   *  반영한다 — 끄는 건 늦게 와도 맞는 말이다. */
  const badgeClearedAtRef = useRef(0);

  const clearNotificationBadge = useCallback(() => {
    badgeClearedAtRef.current = Date.now();
    setHasUnreadNotifications(false);
  }, []);

  /** `requestedAt` 은 이 응답을 **요청한** 시각이다. 안 주면 지금으로 친다(로그인 직후 최초 조회). */
  const applyMe = useCallback((data: MeResponse, requestedAt = Date.now()) => {
    setNickname(data.nickname);
    setTone(isToneKey(data.tone) ? data.tone : DEFAULT_TONE);
    setProfileImage(data.profileImage ?? null);
    setEmail(data.email ?? null);
    setCountPasses(data.countPasses ?? []);
    setActiveCountPass(data.activeCountPass ?? null);
    // 서버가 내려주는 판정을 그대로 쓴다 — birthDate 만 보면 자미두수를 실제로 막는
    // 서버 검사(isValidBirthInfo)와 어긋나 "버튼은 눌리는데 409" 가 된다(2026-09-25).
    setHasBirthInfo(Boolean(data.birthInfoComplete));
    setMyTimeUnknown(Boolean(data.birthInfo?.timeUnknown));
    setHasPartner(Boolean(data.partner?.nickname));
    setPartner(data.partner ?? null);
    setPartnerTimeUnknown(Boolean(data.partner?.nickname) && !data.partner?.birthTime);
    setActiveTimePass(data.activeTimePass ?? null);
    setTimePasses(data.timePasses ?? []);
    // 이 요청보다 **나중에** 배지를 껐다면, 이 응답의 true 는 이미 낡은 소식이다.
    const stale = Boolean(data.hasUnreadNotifications) && requestedAt < badgeClearedAtRef.current;
    if (!stale) setHasUnreadNotifications(Boolean(data.hasUnreadNotifications));
    setActiveCoupon(data.activeCoupon ?? null);
  }, []);

  const refreshMe = useCallback(async () => {
    if (!user) return;
    const requestedAt = Date.now();
    const idToken = await user.getIdToken();
    const res = await fetch("/api/user/me", { headers: { Authorization: `Bearer ${idToken}` } });
    if (!res.ok) return;
    applyMe(await res.json(), requestedAt);
    // 10 초 주기 폴링과 focus 복귀가 이 경로를 탄다 — 처음에 실패했더라도 여기서 값이
    // 들어오면 화면을 다시 열어 준다.
    setMeFailed(false);
  }, [user, applyMe]);

  useEffect(() => {
    return onAuthStateChanged(auth, async (u) => {
      if (!u) {
        setUser(null);
        setLoadFailed(false);
        setMeFailed(false);
        setAuthChecked(true);
        return;
      }
      setUser(u);
      setAuthChecked(true);

      // getIdToken()과 두 fetch는 전부 던질 수 있다(오프라인, 토큰 갱신 실패 등). 예전엔
      // 그대로 새어나가서 이 async 콜백이 reject되고 setLoaded(true)에 도달하지 못했다 —
      // 그러면 화면이 로딩 상태로 굳는다. 실패해도 로딩은 반드시 끝낸다.
      let idToken: string;
      try {
        idToken = await u.getIdToken();
      } catch {
        setLoadFailed(true);
        setMeFailed(true);
        setLoaded(true);
        return;
      }

      let meRes: Response;
      let roomsRes: Response;
      try {
        [meRes, roomsRes] = await Promise.all([
          fetch("/api/user/me", { headers: { Authorization: `Bearer ${idToken}` } }),
          fetch("/api/tarot/rooms", { headers: { Authorization: `Bearer ${idToken}` } }),
        ]);
      } catch {
        setLoadFailed(true);
        setMeFailed(true);
        setLoaded(true);
        return;
      }

      // `.json()` 은 **200 이어도** 던진다 — 본문이 JSON이 아닐 때(개발 서버 HTML 오류 페이지,
      // 프록시·캡티브 포털이 가로챈 응답). 아래 방 목록 파싱은 예전부터 같은 이유로 try 로
      // 감싸 두었는데 여기만 맨몸이었다. 예전엔 그래도 화면은 떴기 때문에 눈에 안 띄었다:
      // 콜백이 reject 되면 맨 아래 setLoaded(true) 에 못 닿을 뿐, 레이아웃은 authChecked 만
      // 보고 그렸으니까. 그런데 2026-09-25 에 서브페이지를 loaded 로 막으면서 같은 사고가
      // **모든 서브페이지가 영영 빈 화면**이 되는 것으로 바뀌었다. 실패해도 로딩은 끝낸다.
      // `.json()` 은 **200 이어도** 던진다 — 본문이 JSON이 아닐 때(개발 서버 HTML 오류 페이지,
      // 프록시·캡티브 포털이 가로챈 응답). 아래 방 목록 파싱은 예전부터 같은 이유로 try 로
      // 감싸 두었는데 여기만 맨몸이었다. 예전엔 그래도 화면은 떴기 때문에 눈에 안 띄었다:
      // 콜백이 reject 되면 맨 아래 setLoaded(true) 에 못 닿을 뿐, 레이아웃은 authChecked 만
      // 보고 그렸으니까. 그런데 2026-09-25 에 서브페이지를 loaded 로 막으면서 같은 사고가
      // **모든 서브페이지가 영영 빈 화면**이 되는 것으로 바뀌었다. 실패해도 로딩은 끝낸다.
      // 재현: /api/user/me 가 200 + text/html 을 주도록 가로채면 이 try 없이 /charge 가
      // 7초 뒤에도 백지였다.
      if (meRes.ok) {
        try {
          applyMe(await meRes.json());
          setMeFailed(false);
        } catch {
          setMeFailed(true);
        }
      } else {
        // 401·5xx. 여기서 아무것도 안 적으면 아래 setLoaded(true) 만 남아, 게이트가
        // "값이 왔다"인 척 열린다.
        setMeFailed(true);
      }

      // 실패 응답을 방으로 착각하지 않도록 두 요청 모두 ok를 본다. 예전엔 POST 결과를
      // `roomList = [await createRes.json()]`로 그냥 받았는데, 401 본문이
      // `{ error: "unauthorized" }`라는 정상 JSON이라 파싱이 성공해서 id가 undefined인 유령
      // 방이 들어왔다 — 그러면 activeRoomId가 null로 남아 /tarot가 "이전 대화를 불러오는
      // 중..."에서 영구히 멈추고, 드로어의 rooms.map은 key={undefined} 경고를 냈다.
      // 방이 하나도 없으면 여기서 POST 로 하나 만들어두던 코드가 있었는데 걷어냈다
      // (2026-09-24) — 로그인만 하고 아무 말도 안 한 사람에게 빈 "새 대화" 방이 생기는 게
      // 이상했고, 메인/대화방을 가른 뒤로는 그 방이 어디에도 안 쓰인다. 방은 첫 질문을 보낼 때
      // 만들어진다(TarotScreen.handleSubmit).
      let roomList: Room[] = [];
      let failed = false;
      try {
        if (roomsRes.ok) {
          const data = await roomsRes.json();
          roomList = data.rooms;
        } else {
          failed = true;
        }
      } catch {
        // 본문이 JSON이 아닌 실패(프록시 HTML 오류 페이지 등)까지 여기로 온다.
        failed = true;
      }

      // 여기서 signOut을 부르고 싶어지는데, 하면 안 된다 — 401은 "이 토큰이 무효"와 "서버가
      // 지금 아무 토큰도 검증할 수 없다"를 구분하지 못한다. getUidFromRequest가 verifyIdToken의
      // 모든 예외를 catch해서 null로 뭉개기 때문이다(verifyRequest.ts). 실제로 2026-09-23
      // 로컬에서 이 화면이 멈춘 원인은 무효 토큰이 아니라 만료된 application default
      // credentials였다(admin SDK가 invalid_grant). 그 상태에서 401로 로그아웃시켰다면
      // 멀쩡한 사용자 전원이 튕겨나갔을 것이다.
      setLoadFailed(failed);
      setRooms(roomList);
      // 여기서 "가장 최근 방"을 기본값으로 잡던 코드도 걷어냈다(2026-09-24). 이제 활성 방은
      // 전적으로 라우트가 정한다 — `/` 면 null, `/tarot/[roomId]` 면 그 방. 기본값을 잡으면
      // 진입 즉시 마지막 방이 열린 것처럼 되어, "진입은 항상 메인"이라는 전제가 깨진다.
      setLoaded(true);
    });
    // applyMe 는 useCallback([]) 이라 신원이 고정이다 — 넣어도 이 effect 는 여전히 한 번만
    // 돈다(onAuthStateChanged 구독을 다시 걸면 안 된다).
  }, [applyMe]);

  // 관리자 지급처럼 다른 화면에서 바뀌는 이용권은 로그인 시 한 번만 읽으면 열린 채팅 화면에
  // 반영되지 않는다. Firestore 클라이언트 읽기 권한은 열지 않은 상태라, 기존의 인증된 BFF
  // 경로를 화면 재진입 및 짧은 주기로 다시 조회한다.
  useEffect(() => {
    if (!user) return;

    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") void refreshMe();
    };

    window.addEventListener("focus", refreshWhenVisible);
    document.addEventListener("visibilitychange", refreshWhenVisible);
    const interval = window.setInterval(refreshWhenVisible, 10_000);

    return () => {
      window.removeEventListener("focus", refreshWhenVisible);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
      window.clearInterval(interval);
    };
  }, [user, refreshMe]);

  const createRoom = useCallback(async (force = false): Promise<Room | null> => {
    if (!user) return null;
    const idToken = await user.getIdToken();
    const res = await fetch("/api/tarot/rooms", {
      method: "POST",
      headers: { Authorization: `Bearer ${idToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ confirmDeleteOldest: force }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      if (data.code === "ROOM_LIMIT") throw new Error("ROOM_LIMIT");
      throw new Error(data.error ?? "대화방을 만들지 못했어요.");
    }
    const created: Room = await res.json();
    setRooms((prev) => [created, ...prev]);
    setActiveRoomId(created.id);
    return created;
  }, [user]);

  const deleteRoom = useCallback(
    async (roomId: string) => {
      if (!user) return;
      const idToken = await user.getIdToken();
      await fetch(`/api/tarot/rooms/${roomId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${idToken}` },
      });
      setRooms((prev) => {
        const remaining = prev.filter((r) => r.id !== roomId);
        setActiveRoomId((current) => (current === roomId ? (remaining[0]?.id ?? null) : current));
        return remaining;
      });
    },
    [user]
  );

  const renameRoom = useCallback(
    async (roomId: string, title: string) => {
      if (!user) return;
      const idToken = await user.getIdToken();
      const res = await fetch(`/api/tarot/rooms/${roomId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({ title }),
      });
      if (!res.ok) return;
      setRooms((prev) => prev.map((r) => (r.id === roomId ? { ...r, title: title.trim().slice(0, 40) } : r)));
    },
    [user]
  );

  // 방의 첫 리딩이 성공하면 서버(/api/tarot/reading)가 Firestore 방 제목을 "새 대화"에서 질문
  // 앞부분으로 직접 바꾸는데, 이 컨텍스트의 rooms는 최초 로그인 시 한 번만 불러온 로컬 상태라
  // 그 변경이 반영되지 않고 있었다(2026-09-15) — API 재호출 없이 로컬 상태만 서버와 같은 값으로
  // 맞춰준다(src/app/(app)/tarot/page.tsx의 handleSubmit이 첫 메시지일 때만 호출).
  const setRoomTitleLocal = useCallback((roomId: string, title: string) => {
    setRooms((prev) => prev.map((r) => (r.id === roomId ? { ...r, title } : r)));
  }, []);

  return (
    <RoomsContext.Provider
      value={{
        user,
        nickname,
        tone,
        profileImage,
        email,
        countPasses,
        setCountPasses,
        activeCountPass,
        hasBirthInfo,
        myTimeUnknown,
        hasPartner,
        partner,
        partnerTimeUnknown,
        activeTimePass,
        setActiveTimePass,
        timePasses,
        setTimePasses,
        hasUnreadNotifications,
        setHasUnreadNotifications,
        clearNotificationBadge,
        activeCoupon,
        rooms,
        activeRoomId,
        selectRoom,
        loaded,
        loadFailed,
        meFailed,
        authChecked,
        createRoom,
        deleteRoom,
        renameRoom,
        setRoomTitleLocal,
        refreshMe,
        pendingReadingRoomIds,
        markReadingPending,
        markReadingDone,
      }}
    >
      {children}
    </RoomsContext.Provider>
  );
}

export function useRooms(): RoomsContextValue {
  const ctx = useContext(RoomsContext);
  if (!ctx) throw new Error("useRooms must be used within RoomsProvider");
  return ctx;
}
