// Provider wrapper for design-sync preview cards.
//
// Components lifted out of the Next.js app call `useRouter()` /
// `usePathname()` / `useSearchParams()`. Outside a Next app those throw
// "invariant expected app router to be mounted" and the card renders blank.
// Supplying Next's own client contexts with inert values is what makes the
// real component render — nothing here reimplements app behaviour.
import React from "react";
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";
import {
  PathnameContext,
  SearchParamsContext,
} from "next/dist/shared/lib/hooks-client-context.shared-runtime";
import { RoomsContext } from "../src/lib/tarot/RoomsContext";

const noop = () => {};

// AppShell (and anything else lifted out of (app)/) reads the rooms context.
// Real RoomsProvider would open Firebase auth listeners and fetch; a static
// mock is what lets the shell render its real sidebar/drawer markup offline.
const rooms = [
  { id: "r1", title: "이직 고민 상담", updatedAt: "2026-09-20T09:00:00.000Z" },
  { id: "r2", title: "올해 연애운", updatedAt: "2026-09-18T21:30:00.000Z" },
  { id: "r3", title: "새 대화", updatedAt: "2026-09-15T11:10:00.000Z" },
];
const roomsValue = {
  user: { uid: "preview-user" },
  nickname: "타연",
  profileImage: null,
  email: "preview@tayeon.kr",
  countPasses: [],
  setCountPasses: noop,
  activeCountPass: null,
  hasBirthInfo: true,
  myTimeUnknown: false,
  hasPartner: false,
  partnerTimeUnknown: false,
  activeTimePass: null,
  setActiveTimePass: noop,
  timePasses: [],
  setTimePasses: noop,
  hasUnreadNotifications: true,
  setHasUnreadNotifications: noop,
  rooms,
  activeRoomId: "r1",
  selectRoom: noop,
  loaded: true,
  authChecked: true,
  createRoom: async () => null,
  deleteRoom: async () => {},
  renameRoom: async () => {},
  setRoomTitleLocal: noop,
  refreshMe: async () => {},
  pendingReadingRoomIds: new Set<string>(),
  markReadingPending: noop,
  markReadingDone: noop,
};
const router = {
  push: noop,
  replace: noop,
  back: noop,
  forward: noop,
  refresh: noop,
  prefetch: async () => {},
};

export function DsPreviewProvider({ children }: { children: React.ReactNode }) {
  return (
    <AppRouterContext.Provider value={router as never}>
      <PathnameContext.Provider value="/">
        <SearchParamsContext.Provider value={new URLSearchParams() as never}>
          <RoomsContext.Provider value={roomsValue as never}>{children}</RoomsContext.Provider>
        </SearchParamsContext.Provider>
      </PathnameContext.Provider>
    </AppRouterContext.Provider>
  );
}
