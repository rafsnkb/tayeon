// 화면에 보이는 시각은 전부 한국 시간이다.
//
// Firestore 에 들어가는 시각은 UTC ISO 문자열이다("2026-09-24T06:17:39.000Z"). 그걸 문자열로
// 잘라서 그대로 찍으면 운영자는 UTC 를 현지 시각으로 읽는다 — 15시 17분에 결제한 이용권이
// 목록에 06시 17분으로 보였다(2026-09-24). 자르지 말고 타임존을 못 박아 포맷한다.
const KST_FORMAT = new Intl.DateTimeFormat("ko-KR", {
  timeZone: "Asia/Seoul",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
});

/** UTC ISO 문자열을 한국 시간으로. 값이 없거나 해석되지 않으면 fallback. */
export function kstDateTime(value: string | null | undefined, fallback = "-"): string {
  if (!value || Number.isNaN(Date.parse(value))) return fallback;
  return KST_FORMAT.format(new Date(value));
}
