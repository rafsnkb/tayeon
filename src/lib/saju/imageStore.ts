// 생성된 이미지의 **바이트**를 어디에 두는가.
//
// ## Firebase Storage 가 아니라 Firestore 에 둔다 (2026-09-26 결정)
//
// 기본값은 Storage 가 맞아 보인다 — 그게 파일을 두라고 있는 곳이다. 그런데 이 저장소에는
// **Storage 업로드 코드가 한 줄도 없다.** `firebase/admin.ts` 는 `adminAuth`/`adminDb` 만
// 내보내고, `storageBucket` 은 클라이언트 config 한 줄로만 있다. 즉 Storage 를 쓰려면 버킷
// 배선 + 보안 규칙 + URL 정책(서명 URL 만료냐, 공개 URL 이냐)을 지금 새로 정해야 한다.
//
// 그 셋 중 **URL 정책이 진짜 문제**다. 돈 받고 파는 리포트의 이미지를 공개 URL 로 두면 주소만
// 알면 누구나 본다. 서명 URL 은 만료되므로 화면이 매번 다시 받아야 하고, 그 갱신 경로가 또
// 코드다. 반면 Firestore 에 두고 **우리 라우트로 내보내면 접근 제어가 공짜로 정확해진다** —
// 문서가 `users/{uid}` 아래에 있으니 남의 것은 애초에 읽히지 않는다.
//
// 크기도 문제가 안 된다. webp 재인코딩 후 66KB 이고(§2), base64 로 부풀어도 약 88KB 다.
// Firestore 문서 한도 1MB 에 열 배 이상 여유가 있다.
//
// **되돌릴 수 있다.** 바깥에서 보이는 건 `image.url` 하나이고 그건 이미 우리 라우트 주소다.
// Storage 로 옮기려면 이 파일과 라우트만 바꾸면 되고, 저장된 리포트의 다른 필드는 그대로다.
//
// 대가: 이미지를 볼 때마다 Firestore 문서를 한 번 읽는다(CDN 이 아니다). 한 편에 한 장이고
// 브라우저가 ETag 로 캐시하므로 실제 호출은 거의 없다.
import { adminDb } from "@/lib/firebase/admin";
import { SAJU_ASSETS, SAJU_READINGS, USERS } from "@/lib/firestore/collections";

/** 부속물 컬렉션 안의 문서 id. 한 편에 이미지는 한 장이라 고정 id 다. */
const IMAGE_DOC = "image";

export type StoredSajuImage = {
  /** webp 바이트를 base64 로 담은 것. Firestore 에 Buffer 를 그대로 넣으면 Bytes 로 저장되는데,
   *  어드민·스크립트가 이 문서를 읽을 때 형이 달라져 혼동이 생긴다. 문자열로 통일한다. */
  base64: string;
  contentType: string;
  /** 몇 번째 그림인가. `SajuReading.image.regeneratedCount` 와 같은 값이고, 응답의 ETag 가 된다. */
  version: number;
  createdAt: string;
};

function imageRef(uid: string, id: string) {
  return adminDb
    .collection(USERS)
    .doc(uid)
    .collection(SAJU_READINGS)
    .doc(id)
    .collection(SAJU_ASSETS)
    .doc(IMAGE_DOC);
}

/**
 * 이미지가 화면에서 어떤 주소로 불리는가. `SajuReading.image.url` 에 들어가는 값이다.
 *
 * **버전을 주소에 넣지 않는다.** 다시 뽑아도 주소는 그대로고, 대신 응답의 ETag 가 바뀐다.
 * 주소에 넣으면 `saveSajuImage` 가 세는 `regeneratedCount` 를 미리 알아야 하는데, 그 값은
 * 저장 트랜잭션 안에서 정해지므로 주소를 만들 시점에는 없다.
 */
export function sajuImageUrl(readingId: string): string {
  return `/api/saju/readings/${readingId}/image`;
}

/** 바이트를 덮어쓴다. 다시 뽑기는 기능이라 덮는 게 기대 동작이다(§8). */
export async function putSajuImageBytes(args: {
  uid: string;
  id: string;
  webp: Buffer;
  contentType: string;
  version: number;
}): Promise<void> {
  await imageRef(args.uid, args.id).set({
    base64: args.webp.toString("base64"),
    contentType: args.contentType,
    version: args.version,
    createdAt: new Date().toISOString(),
  } satisfies StoredSajuImage);
}

export async function getSajuImageBytes(
  uid: string,
  id: string
): Promise<{ bytes: Buffer; contentType: string; version: number } | null> {
  const snap = await imageRef(uid, id).get();
  if (!snap.exists) return null;
  const data = snap.data() as StoredSajuImage;
  return {
    bytes: Buffer.from(data.base64, "base64"),
    contentType: data.contentType,
    version: data.version,
  };
}
