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

export type Room = { id: string; title: string; updatedAt: string };
export type ActiveTimePass = {
  passId: string;
  minutes: number;
  includesOptions: boolean;
  startedAt: string;
  expiresAt: string;
};
export type TimePass = { id: string; minutes: number; includesOptions: boolean };

type RoomsContextValue = {
  user: User | null;
  nickname: string | null;
  profileImage: string | null;
  coins: number | null;
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
  refreshMe: () => Promise<void>;
};

const RoomsContext = createContext<RoomsContextValue | null>(null);

export function RoomsProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [nickname, setNickname] = useState<string | null>(null);
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [coins, setCoins] = useState<number | null>(null);
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

  const selectRoom = useCallback((roomId: string) => setActiveRoomId(roomId), []);

  const refreshMe = useCallback(async () => {
    if (!user) return;
    const idToken = await user.getIdToken();
    const res = await fetch("/api/user/me", { headers: { Authorization: `Bearer ${idToken}` } });
    if (!res.ok) return;
    const data = await res.json();
    setNickname(data.nickname);
    setProfileImage(data.profileImage ?? null);
    setCoins(data.coins);
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
        setCoins(data.coins);
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

  return (
    <RoomsContext.Provider
      value={{
        user,
        nickname,
        profileImage,
        coins,
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
        refreshMe,
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
