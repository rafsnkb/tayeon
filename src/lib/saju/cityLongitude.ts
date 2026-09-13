// 진태양시 보정용 주요 도시 경도(동경, degrees east). manseryeok 기본값은 한반도 평균(127.5°) —
// 출생지가 이 목록과 매칭되면 그 도시의 실제 경도로 대체해서 보정 정확도를 높인다(2026-09-14).
// 표준시(135°)와의 차이가 클수록(서쪽일수록) 보정폭이 커진다 — 목록은 광역시/도청 소재지 위주.
const CITY_LONGITUDE: Record<string, number> = {
  서울: 126.978,
  인천: 126.705,
  수원: 127.01,
  성남: 127.138,
  고양: 126.835,
  용인: 127.178,
  부산: 129.075,
  대구: 128.601,
  광주: 126.853,
  대전: 127.385,
  울산: 129.311,
  세종: 127.289,
  춘천: 127.73,
  강릉: 128.876,
  청주: 127.489,
  전주: 127.148,
  목포: 126.392,
  여수: 127.662,
  포항: 129.365,
  창원: 128.681,
  진주: 128.085,
  제주: 126.531,
  서귀포: 126.56,
};

/** 사용자 입력(자유 텍스트)에 알려진 도시 이름이 포함되어 있으면 그 경도를 반환, 없으면 null. */
export function lookupLongitude(place: string | null | undefined): number | null {
  if (!place) return null;
  const trimmed = place.trim();
  if (!trimmed) return null;
  for (const [city, longitude] of Object.entries(CITY_LONGITUDE)) {
    if (trimmed.includes(city)) return longitude;
  }
  return null;
}
