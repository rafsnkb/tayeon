import { adminDb } from "@/lib/firebase/admin";

const RATE_DOC = adminDb.collection("config").doc("usdKrwRate");
const REFRESH_INTERVAL_MS = 24 * 60 * 60 * 1000;

type CachedRate = { rate: number; fetchedAt: string };

/** USD→KRW 환율을 프랑크푸르터(ECB 기준) API에서 받아 Firestore에 24시간 캐시한다.
 * 갱신에 실패하면 오래된 캐시라도 반환하고, 캐시가 전혀 없으면 null(비용 계산 불가로 처리). */
export async function getUsdKrwRate(): Promise<number | null> {
  const snap = await RATE_DOC.get();
  const cached = snap.data() as CachedRate | undefined;
  const isFresh = cached && Date.now() - Date.parse(cached.fetchedAt) < REFRESH_INTERVAL_MS;
  if (isFresh) return cached.rate;

  try {
    const res = await fetch("https://api.frankfurter.dev/v1/latest?from=USD&to=KRW");
    if (!res.ok) throw new Error(`frankfurter ${res.status}`);
    const body = (await res.json()) as { rates?: { KRW?: number } };
    const rate = body.rates?.KRW;
    if (!rate || !Number.isFinite(rate)) throw new Error("응답에 KRW 환율이 없습니다.");

    await RATE_DOC.set({ rate, fetchedAt: new Date().toISOString() } satisfies CachedRate);
    return rate;
  } catch (error) {
    console.error("[exchangeRate] USD/KRW 환율 갱신 실패", error);
    return cached?.rate ?? null;
  }
}
