"use client";

// 방 목록/코인/시간제 이용권 상태 — 원래 /tarot 페이지에만 있었는데, 피그마 리디자인에서는
// 메뉴 드로어((app)/layout.tsx)가 어느 페이지에서든 "최근 대화"/코인 잔액/이용권 상태를 보여줘야
// 해서 페이지 로컬 state로는 안 되고 레이아웃 레벨에서 공유해야 한다(2026-09-14).
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { auth } from "@/lib/firebase/client";
import type { CountPassBalance } from "@/lib/tarot/pricing";

export type Room = { id: string; title: string; updatedAt: string };
export type ActiveTimePass = {
  passId: string;
  minutes: number;
  includesOptions: boolean;
  startedAt: string;
  expiresAt: string;
};
export type TimePass = { id: string; minutes: number; includesOptions: boolean };
export type CountPass = CountPassBalance & {
  id: string;
  productId?: string;
  source?: "purchase" | "admin-grant" | "signup-free" | "referral-signup" | "bonus-reward" | "referral-payout";
  featureScope?: "tarot-only" | "all-features";
  reason?: string | null;
  freePasses?: number;
  createdAt: string;
};

type RoomsContextValue = {
  user: User | null;
  nickname: string | null;
  profileImage: string | null;
  email: string | null;
  coins: number | null;
  countPasses: CountPass[];
  setCountPasses: Dispatch<SetStateAction<CountPass[]>>;
  setCoins: Dispatch<SetStateAction<number | null>>;
  hasBirthInfo: boolean;
  myTimeUnknown: boolean;
  hasPartner: boolean;
  partnerTimeUnknown: boolean;
  activeTimePass: ActiveTimePass | null;
  setActiveTimePass: Dispatch<SetStateAction<ActiveTimePass | null>>;
  timePasses: TimePass[];
  setTimePasses: Dispatch<SetStateAction<TimePass[]>>;
  rooms: Room[];
  activeRoomId: string | null;
  selectRoom: (roomId: string) => void;
  loaded: boolean;
  authChecked: boolean;
  createRoom: () => Promise<Room | null>;
  deleteRoom: (roomId: string) => Promise<void>;
  renameRoom: (roomId: string, title: string) => Promise<void>;
  setRoomTitleLocal: (roomId: string, title: string) => void;
  refreshMe: () => Promise<void>;
  pendingReadingRoomIds: Set<string>;
  markReadingPending: (roomId: string) => void;
  markReadingDone: (roomId: string) => void;
};

const RoomsContext = createContext<RoomsContextValue | null>(null);

export function RoomsProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [nickname, setNickname] = useState<string | null>(null);
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [coins, setCoins] = useState<number | null>(null);
  const [countPasses, setCountPasses] = useState<CountPass[]>([]);
  const [hasBirthInfo, setHasBirthInfo] = useState(false);
  const [myTimeUnknown, setMyTimeUnknown] = useState(false);
  const [hasPartner, setHasPartner] = useState(false);
  const [partnerTimeUnknown, setPartnerTimeUnknown] = useState(false);
  const [activeTimePass, setActiveTimePass] = useState<ActiveTimePass | null>(null);
  const [timePasses, setTimePasses] = useState<TimePass[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  // 리딩 요청(handleSubmit)이 "어느 방에" 진행 중인지 — TarotChat 로컬 state가 아니라 여기 두는
  // 이유: 로딩 중에 다른 페이지로 이동했다가 돌아오면 TarotChat이 통째로 재마운트되는데, 그
  // 새 인스턴스가 "이 방은 아직 리딩이 안 끝났다"를 알 방법이 로컬 state로는 없어서 방금 물어본
  // 질문+답변이 사라진 것처럼 보이는 버그가 있었음(2026-09-14, 사용자 리포트: 로딩 중 이용권
  // 버튼 눌러서 /charge로 이동 후 뒤로가기하면 방금 대화가 없어진 것처럼 보임). 실제로는 서버가
  // 리딩 저장·코인 차감까지 다 끝내지만(원래 컴포넌트 인스턴스가 죽어도 fetch 자체는 안 끊김),
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

  const selectRoom = useCallback((roomId: string) => setActiveRoomId(roomId), []);

  const refreshMe = useCallback(async () => {
    if (!user) return;
    const idToken = await user.getIdToken();
    const res = await fetch("/api/user/me", { headers: { Authorization: `Bearer ${idToken}` } });
    if (!res.ok) return;
    const data = await res.json();
    setNickname(data.nickname);
    setProfileImage(data.profileImage ?? null);
    setEmail(data.email ?? null);
    setCoins(data.coins);
    setCountPasses(data.countPasses ?? []);
    setHasBirthInfo(Boolean(data.birthInfo?.birthDate));
    setMyTimeUnknown(Boolean(data.birthInfo?.timeUnknown));
    setHasPartner(Boolean(data.partner?.nickname));
    setPartnerTimeUnknown(Boolean(data.partner?.nickname) && !data.partner?.birthTime);
    setActiveTimePass(data.activeTimePass ?? null);
    setTimePasses(data.timePasses ?? []);
  }, [user]);

  useEffect(() => {
    return onAuthStateChanged(auth, async (u) => {
      if (!u) {
        setUser(null);
        setAuthChecked(true);
        return;
      }
      setUser(u);
      setAuthChecked(true);

      const idToken = await u.getIdToken();
      const [meRes, roomsRes] = await Promise.all([
        fetch("/api/user/me", { headers: { Authorization: `Bearer ${idToken}` } }),
        fetch("/api/tarot/rooms", { headers: { Authorization: `Bearer ${idToken}` } }),
      ]);

      if (meRes.ok) {
        const data = await meRes.json();
        setNickname(data.nickname);
        setProfileImage(data.profileImage ?? null);
        setEmail(data.email ?? null);
        setCoins(data.coins);
        setCountPasses(data.countPasses ?? []);
        setHasBirthInfo(Boolean(data.birthInfo?.birthDate));
        setMyTimeUnknown(Boolean(data.birthInfo?.timeUnknown));
        setHasPartner(Boolean(data.partner?.nickname));
        setPartnerTimeUnknown(Boolean(data.partner?.nickname) && !data.partner?.birthTime);
        setActiveTimePass(data.activeTimePass ?? null);
        setTimePasses(data.timePasses ?? []);
      }

      let roomList: Room[] = [];
      if (roomsRes.ok) {
        const data = await roomsRes.json();
        roomList = data.rooms;
      }
      if (roomList.length === 0) {
        const createRes = await fetch("/api/tarot/rooms", {
          method: "POST",
          headers: { Authorization: `Bearer ${idToken}` },
        });
        roomList = [await createRes.json()];
      }
      setRooms(roomList);
      // /tarot는 URL ?room= 파라미터가 있으면 마운트 시 selectRoom으로 덮어쓴다 — 여기서는
      // 그냥 기본값(가장 최근 방)만 잡아둔다.
      setActiveRoomId((prev) => prev ?? roomList[0]?.id ?? null);
      setLoaded(true);
    });
  }, []);

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

  const createRoom = useCallback(async (): Promise<Room | null> => {
    if (!user) return null;
    const idToken = await user.getIdToken();
    const res = await fetch("/api/tarot/rooms", {
      method: "POST",
      headers: { Authorization: `Bearer ${idToken}` },
    });
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
        profileImage,
        email,
        coins,
        countPasses,
        setCountPasses,
        setCoins,
        hasBirthInfo,
        myTimeUnknown,
        hasPartner,
        partnerTimeUnknown,
        activeTimePass,
        setActiveTimePass,
        timePasses,
        setTimePasses,
        rooms,
        activeRoomId,
        selectRoom,
        loaded,
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
