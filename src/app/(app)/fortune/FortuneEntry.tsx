"use client";

import { useRooms } from "@/lib/tarot/RoomsContext";
import { FortuneIntro } from "./FortuneIntro";
import { FortuneScreen } from "./FortuneScreen";

/** 로그인 여부로 소개 화면과 목록을 가른다(page.tsx 주석 참고).
 *
 *  `authChecked` 전에는 아무것도 그리지 않는다 — 여기서 `!user` 를 그냥 믿으면 이미 로그인한
 *  사람에게도 세션 복원 수백 ms 동안 소개 화면이 번쩍인다(같은 함정을 드로어의 카카오 버튼이
 *  한 번 밟았다, `(app)/layout.tsx` 주석). 앱 셸이 `authChecked` 전에는 통째로 null 이라
 *  실제로는 여기까지 오지 않지만, 이 컴포넌트만 놓고도 옳아야 한다. */
export function FortuneEntry() {
  const { user, authChecked } = useRooms();
  if (!authChecked) return null;
  return user ? <FortuneScreen /> : <FortuneIntro />;
}
