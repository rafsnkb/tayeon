/* eslint-disable @next/next/no-img-element */
// 타연 SNS 팔로우 버튼. 쿠폰은 SNS 로 뿌리므로 "코드를 어디서 받나"의 답이 등록 화면 안에
// 있어야 한다.
//
// 로고는 각 사가 배포하는 공식 에셋 그대로다(Meta Brand Resource Center / X Brand Toolkit).
// 두 가이드라인 모두 색·비율 변형을 금지하므로 **모드별로 다른 원본 파일**을 쓴다 —
// currentColor 로 칠하거나 필터로 반전시키면 규정 위반이다.
//   라이트(밝은 면) → 검정 잉크 파일 · 다크(어두운 면) → 흰 잉크 파일
// 파일명의 접미사는 잉크가 아니라 **모드**를 가리킨다(픽셀로 확인, 2026-09-25).

const LINKS = [
  {
    label: "타연 인스타그램",
    href: "https://www.instagram.com/tayeon.ai",
    light: "/textures/Instagram_Glyph_Light.png",
    dark: "/textures/Instagram_Glyph_White.png",
  },
  {
    label: "타연 X",
    href: "https://x.com/tayeon_ai",
    light: "/textures/x_logo_Light.png",
    dark: "/textures/x_logo_Dark.png",
  },
] as const;

export default function SnsFollowLinks() {
  return (
    <div className="flex items-center justify-center gap-8">
      {LINKS.map((sns) => (
        <a
          key={sns.href}
          href={sns.href}
          target="_blank"
          // 외부 탭으로 여는 링크에는 noreferrer 까지 붙인다 — noopener 만으로는 referrer 가
          // 넘어가고, 구형 브라우저에서 window.opener 가 살아 있는 경우가 있다.
          rel="noopener noreferrer"
          aria-label={sns.label}
          className="flex h-11 w-11 items-center justify-center"
        >
          {/* 한 장만 두고 CSS 로 뒤집는 대신 두 장을 겹쳐 놓고 모드별로 숨긴다. 공식 에셋을
              변형하지 않으면서 모드 전환에 바로 따라붙는 유일한 방법이다. */}
          <img src={sns.light} alt="" className="h-7 w-7 dark:hidden" />
          <img src={sns.dark} alt="" className="hidden h-7 w-7 dark:block" />
        </a>
      ))}
    </div>
  );
}
