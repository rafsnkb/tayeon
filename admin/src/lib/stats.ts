import { adminDb } from "@/lib/firebase/admin";

// 본체(src/lib/tarot/prompt.ts)의 TOPIC_CATEGORIES와 손으로 맞춰서 유지 — admin은 타연 본체와
// 완전히 분리된 별도 앱이라 그 파일을 import할 수 없음(위 admin/src/app/page.tsx의
// TIME_PASS_TIERS와 같은 이유).
export const TOPIC_CATEGORIES = [
  "연애/이별",
  "궁합/인연",
  "직장/취업",
  "재물/금전",
  "건강",
  "인간관계",
  "자아탐색/진로",
  "기타",
] as const;

const AGE_BRACKETS = ["10대 이하", "20대", "30대", "40대", "50대 이상"] as const;
const UNKNOWN = "미상";

export type StatsSummary = {
  totalUsers: number;
  genderCounts: Record<string, number>;
  ageBracketCounts: Record<string, number>;
  totalChargedReadings: number;
  topicCounts: Record<string, number>;
};

/** 만 나이 근사치 — 생일이 지났는지는 반영하지 않는 연도 차 기준(연령대 집계 목적이라 오차 허용). */
function getAgeBracket(birthDateStr: string): string {
  const year = Number(birthDateStr.slice(0, 4));
  if (!Number.isFinite(year) || year <= 0) return UNKNOWN;
  const age = new Date().getFullYear() - year;
  if (age < 20) return AGE_BRACKETS[0];
  if (age < 30) return AGE_BRACKETS[1];
  if (age < 40) return AGE_BRACKETS[2];
  if (age < 50) return AGE_BRACKETS[3];
  return AGE_BRACKETS[4];
}

/**
 * 성별/연령대/질문 주제 집계. 개인정보 보호법 제28조의2(가명처리 통계) 범위 안에서만 쓰도록,
 * 여기서 만드는 값은 항상 카운트뿐이지 특정 유저와 연결해서 보여주지 않는다 — 이 함수를 호출하는
 * 쪽에서도 개별 유저 단위로 다시 노출하지 말 것.
 *
 * firestore.indexes.json에 커스텀 인덱스가 없어서(admin/src/lib/moderation.ts와 같은 이유)
 * collectionGroup + where 쿼리 대신 유저→방→리딩 순으로 훑어서 메모리에서 집계한다. 지금 규모에는
 * 문제없지만, 유저/리딩 수가 크게 늘면 이 방식은 느려지므로 그때는 별도 집계 파이프라인이 필요함.
 */
export async function computeStatsSummary(): Promise<StatsSummary> {
  const genderCounts: Record<string, number> = { male: 0, female: 0, [UNKNOWN]: 0 };
  const ageBracketCounts: Record<string, number> = Object.fromEntries(
    [...AGE_BRACKETS, UNKNOWN].map((b) => [b, 0])
  );

  const usersSnap = await adminDb.collection("users").select("birthInfo").get();
  for (const doc of usersSnap.docs) {
    const birthInfo = doc.data().birthInfo as
      | { gender?: string; birthDate?: string }
      | undefined;
    if (birthInfo?.gender === "male" || birthInfo?.gender === "female") {
      genderCounts[birthInfo.gender] += 1;
    } else {
      genderCounts[UNKNOWN] += 1;
    }
    if (birthInfo?.birthDate) {
      ageBracketCounts[getAgeBracket(birthInfo.birthDate)] += 1;
    } else {
      ageBracketCounts[UNKNOWN] += 1;
    }
  }

  const topicCounts: Record<string, number> = Object.fromEntries(
    TOPIC_CATEGORIES.map((t) => [t, 0])
  );
  let totalChargedReadings = 0;

  // scanReadings(moderation.ts)와 같은 방식으로 유저→방→리딩 순으로 순차 조회 — room이 많아도
  // 한꺼번에 대량의 동시 쿼리를 쏘지 않도록 함.
  for (const userDoc of usersSnap.docs) {
    const roomsSnap = await userDoc.ref.collection("rooms").get();
    for (const room of roomsSnap.docs) {
      const readingsSnap = await room.ref.collection("readings").select("charged", "topic").get();
      for (const doc of readingsSnap.docs) {
        const data = doc.data();
        if (!data.charged) continue;
        totalChargedReadings += 1;
        const topic = typeof data.topic === "string" ? data.topic : "기타";
        topicCounts[topic] = (topicCounts[topic] ?? 0) + 1;
      }
    }
  }

  return {
    totalUsers: usersSnap.size,
    genderCounts,
    ageBracketCounts,
    totalChargedReadings,
    topicCounts,
  };
}
