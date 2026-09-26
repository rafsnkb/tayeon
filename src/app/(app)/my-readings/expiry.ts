/** 보관 만료까지 남은 시간을 배지 한 칸으로 줄이는 자리. **화면(.tsx) 밖에 둔다** —
 *  `node --test` 는 JSX 를 못 읽어서 컴포넌트 안에 있으면 테스트가 손을 못 댄다
 *  (`expiry.test.mjs`). 경계가 애매한 계산이라 테스트가 꼭 필요한 쪽이기도 하다.
 *
 *  목업 `MyFortuneStorage_Dark/Light` 의 썸네일 좌하단 배지가 이 값을 쓴다 — 세 카드가 각각
 *  `보관만료 D-29` · `보관만료 14h` · `보관만료 9m` 이라 **남은 기간에 따라 단위가 바뀐다**.
 *
 *  ⚠️ `expiresAt` 은 아직 `GET /api/saju/readings` 응답에 없다(sub_2 가 만드는 중). 값이 없으면
 *  배지를 그리지 않는다 — 없는 날짜를 지어내느니 자리를 비우는 게 낫다. */

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** 배지에 찍을 남은 시간. 만료됐거나 값이 없으면 `null`.
 *
 *  **전부 내림이다 — 남은 시간을 실제보다 많게 말하지 않는다.** 29일 23시간은 `D-29` 이고
 *  `D-30` 이 아니다. 딱 하나 예외가 마지막 1분 미만인데, 내림하면 `0m` 이 되어 "이미 없다"고
 *  말하는 꼴이라 `1m` 으로 받친다. 아직 목록에 떠 있다는 건 아직 안 사라졌다는 뜻이다.
 *
 *  만료된 건은 애초에 목록에 오지 않는다(2026-09-26 사용자 결정 — 보관함은 "읽을 수 있는 것"의
 *  목록이고, 환불·만료 기록은 결제 내역이 맡는다). API 가 걸러 주므로 화면은 다시 거르지
 *  않지만, 시계가 어긋나거나 목록을 열어 둔 채 시간이 지날 수는 있어서 `null` 을 돌려준다. */
export function expiryLabel(expiresAt: string | null | undefined, now: Date = new Date()): string | null {
  if (!expiresAt) return null;
  const left = new Date(expiresAt).getTime() - now.getTime();
  if (!Number.isFinite(left) || left <= 0) return null;
  if (left >= DAY) return `D-${Math.floor(left / DAY)}`;
  if (left >= HOUR) return `${Math.floor(left / HOUR)}h`;
  return `${Math.max(1, Math.floor(left / MINUTE))}m`;
}

/** 배지 전체 문구. 목업이 값 앞에 「보관만료」를 붙여 둔다. */
export function expiryBadgeText(expiresAt: string | null | undefined, now?: Date): string | null {
  const label = expiryLabel(expiresAt, now);
  return label === null ? null : `보관만료 ${label}`;
}
