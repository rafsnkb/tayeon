/** 화면에 날짜·시각을 찍는 공통 형식 — `2026.09.24 16:30:05`.
 *
 * 브라우저의 로컬 타임존으로 찍는다(`Intl` 을 쓰지 않는 이유: 로캘에 따라 구분자와 자릿수가
 * 달라져서 목록의 세로줄이 어긋난다). 서버가 주는 값은 전부 ISO 문자열이다.
 *
 * 마이페이지·구매내역·받은 이용권·사용내역·정지 안내까지 **다섯 군데에 글자 단위로 같은
 * 함수가 복사**돼 있었다(2026-09-24 정리). */
export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}
