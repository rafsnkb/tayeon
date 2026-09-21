import type { MetadataRoute } from "next";

/**
 * QA 환경은 프로덕션과 같은 코드를 별도 Firebase 프로젝트에 배포한 것이라 내용이 사실상
 * 동일하다. 색인되면 검색 결과에서 타연 본 사이트와 경쟁하는 중복 콘텐츠가 되고, 테스트 중인
 * 미완성 화면이 노출되므로 QA만 크롤링을 막는다.
 *
 * APP_ENV는 apphosting.yaml에서 환경별로 넣는다(프로덕션에는 없거나 "production").
 */
export default function robots(): MetadataRoute.Robots {
  const isQa = process.env.APP_ENV === "qa";
  return {
    rules: isQa ? { userAgent: "*", disallow: "/" } : { userAgent: "*", allow: "/" },
  };
}
