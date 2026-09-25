// 생일 기념 무료 이용권 일배치가 쿼리할 수 있도록 users 문서에 심어두는 정규화된 생일(MMDD).
//
// 예전에는 배치가 매일 users 컬렉션을 통째로 읽어(db.collection("users").get()) 문서마다
// 생일을 계산해서 비교했다. 사용자가 늘수록 메모리·시간·읽기 비용이 선형으로 늘어나는 구조라,
// 값을 미리 정규화해 두고 동등 쿼리 한 번으로 바꿨다(2026-09-21).
//
// 우선순위는 배치의 기존 동작 그대로다 — 카카오에서 받은 생일이 있으면 그걸 쓰고, 없으면
// 사용자가 직접 입력한 birthInfo.birthDate에서 월일만 뽑는다.

/** 카카오 생일은 "MMDD" 형식, birthInfo.birthDate는 "YYYY-MM-DD" 형식이다. */
export function normalizeBirthdayMMDD(kakaoBirthday: unknown, birthDate: unknown): string | null {
  if (typeof kakaoBirthday === "string" && /^\d{4}$/.test(kakaoBirthday)) {
    return kakaoBirthday;
  }
  if (typeof birthDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(birthDate)) {
    return birthDate.slice(5, 10).replace("-", "");
  }
  return null;
}
