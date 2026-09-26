// 이미지 — 골격(1단)이 나오는 즉시 부른다.
//
// doc/사주_구현설계.md §6 의 실측이 근거다. 섹션 하나가 10~14초씩 쌓여 마지막 페이지가 147초인데
// 이미지는 8초라, **섹션 생성과 병행하면 사용자가 마지막 페이지에 도달할 때 이미 준비돼 있다.**
// 반대로 맨 뒤에 붙이면 다 읽고 나서 8초를 그냥 기다리게 된다 — 그래서 이 모듈의 입력은
// 완성된 본문이 아니라 1단의 `imageBrief` 다(outline.ts 의 같은 필드 주석 참고).
//
// 이 모듈은 **바이트까지만 만든다.** 업로드해서 url 을 확정하는 일은 하지 않는다 — 저장소에
// 서버용 Firebase Storage(blob) 업로드 헬퍼가 아직 없고(`src/lib/firebase/admin.ts` 는
// auth·firestore 만 export 한다), 여기서 새로 지어내면 나중에 실제 헬퍼가 생길 때 두 벌이 된다.
//
// url 이 확정된 다음은 `saju/storage.ts` 의 `saveSajuImage` 가 받는다 — §7 의 저장 필드
// (`image: { url, regeneratedCount }`)와 다시 뽑기 횟수 증가가 **거기 한 곳**에 있다.
// 그래서 이 모듈은 그 필드를 만들지 않는다: 횟수를 올리는 코드가 두 곳이면 반드시 어긋난다.
import type { SajuProduct } from "@/lib/saju/products";

/** 이미지 모델과 호출 파라미터. **전부 실측값이라 함부로 바꾸면 원가가 움직인다**
 *  (doc/사주_구현설계.md §2 "이미지 사이즈·품질 매트릭스"):
 *
 *  | 사이즈 | low | medium | high |
 *  |---|---|---|---|
 *  | 1024×1024 | 196 | 439 | 1,756 |
 *  | **1024×1536** | **158** | 343 | 1,372 |
 *  | 512×512 | 거부 — 최소 해상도 미달 | | |
 *  | auto | 229 | 472 | 1,372 |
 *
 *  - **세로가 정사각보다 싸다.** 픽셀은 1.5배인데 토큰은 더 적다.
 *  - **1024 가 바닥이다.** 512 는 거부된다.
 *  - **`auto` 를 쓰면 안 된다.** 명시하지 않으면 비싼 쪽(229토큰)이 걸린다 — 그래서 size·quality
 *    를 기본값에 맡기지 않고 항상 실어 보낸다. */
export const SAJU_IMAGE_MODEL = "gpt-image-2.5-flare";
export const SAJU_IMAGE_SIZE = "1024x1536";
export const SAJU_IMAGE_QUALITY = "low";
/** 158 output 토큰 = 8원 = 8초. 9,900원 상품에서 장당 8원이라 **10번 다시 뽑아도 80원**이고,
 *  그래서 다시 뽑기를 실패 보상이 아니라 셀링포인트로 연다(§8). */
export const SAJU_IMAGE_EXPECTED_OUTPUT_TOKENS = 158;

/** webp 재인코딩 값. 결과 PNG 가 1.9MB 라 **재인코딩이 필수**다 — 1024폭 q82 에서 66KB, 28분의 1
 *  (§8). 방식은 `scripts/build-pass-art.cjs` 와 같다. 그쪽 품질값이 72 인 것은 상품 아트워크가
 *  사진 텍스처라 더 깎아도 버텨서이고, 이쪽은 문서가 실측한 82 를 쓴다. */
export const SAJU_IMAGE_WEBP_QUALITY = 82;

/** 결과 화면에 **반드시** 띄우는 고지(§8, 기획 6.5). 이미지는 미래의 특정 인물을 맞히는 기능이
 *  아니라 해석에서 읽힌 분위기를 시각화한 것이라, 이 문구가 없으면 사용자가 예측으로 읽는다.
 *  문구를 화면마다 따로 적으면 반드시 서로 달라지므로 여기 한 곳에 둔다 — 렌더는 화면이 한다. */
export const SAJU_IMAGE_DISCLOSURE = "명리 해석을 바탕으로 그린 예상 이미지";

/** 상품별 값이 아니라 **모든 이미지에 공통으로 걸리는 규칙**이라 이 모듈이 붙인다(기획 6.5).
 *  상품 데이터(`product.image`)에 넣어 두면 19개 상품 중 하나만 빠뜨려도 조용히 뚫린다. */
const UNIVERSAL_RULES = [
  "실존 인물을 알아볼 수 있게 그리지 마세요. 특정인의 얼굴을 재현하지 마세요.",
  "이미지 안에 글자, 문자, 숫자, 서명, 워터마크를 넣지 마세요.",
  // 기획 6.5: "이 사람이 미래 배우자"라는 확정 표현을 쓰지 않는다. 텍스트에서 막아도 그림이
  // 증명사진처럼 한 인물을 정면으로 박아 놓으면 같은 말을 하게 되므로 그림에서도 막는다.
  "특정 인물을 확정해 보여주는 초상이 아니라, 인상과 장면의 분위기를 그립니다.",
];

/**
 * PNG 를 webp 로 다시 인코딩한다. **`sharp` 를 쓰는 유일한 자리이고, 지연 로드한다.**
 *
 * `sharp` 는 우리 의존성이 아니라 `next` 의 optionalDependencies 로 딸려 온 것이다. 모듈 최상단
 * import 로 두면 sharp 가 설치되지 않은 환경에서는 **이 파일을 불러오는 것만으로** 터진다 —
 * 프롬프트를 만드는 일까지 같이 죽는다. 지연 로드면 실패가 이 한 단계에 갇힌다.
 *
 * ⚠️ 실호출 검증 때 이미지 요청에 `output_format: "webp"` 가 먹는지 확인할 것. 먹으면 모델이
 * 바로 webp 를 주므로 **이 함수째로 삭제**하고 sharp 의존을 런타임에서 없앨 수 있다. 지금 넣지
 * 않는 이유는 미검증 파라미터라 400 이 나면 생성 경로 전체가 죽기 때문이다.
 * (생성 크기가 1024×1536 고정이라 `resize` 는 no-op 이어서 걸지 않았다 — 지금 sharp 가 하는
 *  일은 webp 인코딩 하나뿐이고, 그래서 통째로 사라질 수 있다.)
 */
async function toWebp(png: Buffer): Promise<Buffer> {
  const { default: sharp } = await import("sharp");
  return sharp(png).webp({ quality: SAJU_IMAGE_WEBP_QUALITY }).toBuffer();
}

export type SajuImage = {
  /** webp 로 재인코딩된 바이트. 업로드는 호출부가 한다(파일 맨 위 주석 참고). */
  webp: Buffer;
  contentType: "image/webp";
  /** 실제로 보낸 프롬프트. 다시 뽑기가 같은 브리프로 다른 그림을 내는 기능이라, 나중에
   *  "왜 이런 그림이 나왔나"를 볼 수 있어야 한다. */
  prompt: string;
  /** 모델이 보고한 출력 토큰. 과금 단위가 이것이라(§2) 원가를 추정으로 쌓지 않고 실측으로
   *  쌓는다. 응답에 없으면 null — 그때는 `SAJU_IMAGE_EXPECTED_OUTPUT_TOKENS` 로 갈음한다. */
  outputTokens: number | null;
};

/** 그릴 대상은 **상품이 정한다**(`product.image.subject`). 이걸 안 쓰면 모델이 브리프의 인상
 *  묘사를 내담자 본인으로 읽는다 — 솔로 연애 상품 실측에서 "예상 연인"이 아니라 "혼자 창가에
 *  앉아 미소짓는 여성"이 나왔다. */
export function buildImagePrompt(
  image: NonNullable<SajuProduct["image"]>,
  imageBrief: string
): string {
  return [
    `그릴 대상: ${image.subject}`,
    "",
    "## 담을 요소",
    ...image.elements.map((element) => `- ${element}`),
    "",
    // 브리프는 1단이 명반 해석에서 뽑아낸 것이다. 외모를 단정하는 키워드가 아니라 인상·장면·화풍
    // 이라, 요소 목록 뒤에 붙여 그 요소들을 어떻게 채울지의 근거로 읽히게 한다(기획 6.5).
    "## 해석에서 읽힌 분위기",
    imageBrief,
    "",
    "## 반드시 지킬 것",
    ...UNIVERSAL_RULES.map((rule) => `- ${rule}`),
  ].join("\n");
}

/** 이미지 생성 API 의 응답 중 이 모듈이 읽는 부분만. `openai` 패키지를 의존성에 넣지 않고
 *  `fetch` 로 직접 치기 때문에(저장소는 `@anthropic-ai/sdk` 하나만 쓴다) 타입을 여기 적는다. */
type ImagesResponse = {
  data?: { b64_json?: string }[];
  usage?: { output_tokens?: number };
};

/**
 * 리포트 한 편의 이미지 한 장. 다시 뽑기는 **같은 인자로 다시 부르는 것**이고, 그 결과를 저장할
 * 때 `storage.ts` 의 `saveSajuImage` 가 `regeneratedCount` 를 올린다.
 *
 * 실패해도 리포트를 버리지 않는다는 판단은 호출부의 몫이라 여기서는 그냥 던진다 — 텍스트 10섹션
 * (약 197원)이 이미 나온 뒤에 8원짜리 이미지가 실패했다고 편을 통째로 무르는 건 말이 안 되지만,
 * 그 결정을 라이브러리가 조용히 내려 버리면 호출부가 실패를 알 방법이 없어진다.
 */
export async function generateSajuImage(args: {
  product: SajuProduct;
  /** 1단의 `SajuOutline.imageBrief`. */
  imageBrief: string | null;
}): Promise<SajuImage> {
  const { product, imageBrief } = args;

  // 이미지 지원 상품은 셋뿐이다(솔로·결혼 시기·자녀). 나머지는 `product.image` 가 null 이고,
  // 그 경우 1단도 `imageBrief` 를 null 로 두므로 여기 오는 것 자체가 호출부의 버그다.
  if (!product.image) throw new Error(`SAJU_IMAGE_UNSUPPORTED_PRODUCT:${product.slug}`);
  if (!imageBrief?.trim()) throw new Error(`SAJU_IMAGE_BRIEF_MISSING:${product.slug}`);

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("SAJU_IMAGE_NO_API_KEY");

  const prompt = buildImagePrompt(product.image, imageBrief.trim());

  const response = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: SAJU_IMAGE_MODEL,
      prompt,
      // size·quality 를 반드시 실어 보낸다 — 위 상수 주석의 `auto` 항목 참고.
      size: SAJU_IMAGE_SIZE,
      quality: SAJU_IMAGE_QUALITY,
      n: 1,
    }),
  });

  if (!response.ok) {
    // 본문에 거부 사유가 들어 있다(실측 3연속 생성에서 거부는 0회였지만, 인물을 그리는
    // 기능이라 정책 거부가 언제든 날 수 있다). 앞부분만 붙여서 원인을 남긴다.
    const body = await response.text().catch(() => "");
    throw new Error(`SAJU_IMAGE_HTTP_${response.status}:${body.slice(0, 300)}`);
  }

  const parsed = (await response.json()) as ImagesResponse;
  const b64 = parsed.data?.[0]?.b64_json;
  if (!b64) throw new Error("SAJU_IMAGE_EMPTY_RESPONSE");

  const webp = await toWebp(Buffer.from(b64, "base64"));

  return {
    webp,
    contentType: "image/webp",
    prompt,
    outputTokens: parsed.usage?.output_tokens ?? null,
  };
}
