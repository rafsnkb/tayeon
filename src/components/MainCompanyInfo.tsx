import Link from "next/link";
import {
  COMPANY_NAME_KO,
  CEO_NAME,
  BUSINESS_REGISTRATION_NUMBER,
  MAIL_ORDER_BUSINESS_NUMBER,
  MAIL_ORDER_NUMBER_PENDING,
  COMPANY_ADDRESS,
  COMPANY_PHONE,
  SUPPORT_EMAIL,
  FTC_BUSINESS_INFO_URL,
} from "@/lib/company";

/** 초기 화면(`/`) 컴포저 아래의 사업자정보. 피그마 "New/Main_{Dark,Light}" 실측(2026-09-24):
 *  4줄 top 660·672·684·696.7(줄간격 12, 잉크 9~10), 링크 줄 top 711.3, 바닥 여백 8.
 *
 *  전자상거래법 제10조① 1~6호를 **초기 화면에** 표시해야 한다(시행규칙 제7조①). 같은 조 ③항이
 *  휴대전화 등 출력 제한 기기에 링크 갈음을 허용하는 건 대표자 성명·사업자등록번호·이용약관
 *  뿐이라, 상호·주소·전화·이메일은 이렇게 글자로 노출한다. 이용약관도 "초기화면으로부터 직접
 *  연결"이어야 해서(공정위 「전자상거래 등에서의 소비자보호 지침」 Ⅱ.15.다) 여기 직접 건다.
 *
 *  마이페이지·구입 화면이 쓰는 CompanyFooter와 내용은 겹치지만 생김새가 전혀 다르다(그쪽은
 *  테두리 있는 카드). 한 컴포넌트에 변형을 또 만드는 것보다 따로 두는 편이 읽기 쉽다. */
export function MainCompanyInfo() {
  return (
    // 글자색 실측(2026-09-24): 정보 줄은 **--text 의 약 47.5%** 다. 배경이 다른 두 줄에서
    // 알파를 풀면 0.470 / 0.471 로 같은 값이 나와 모델이 확인된다(라이트는 0.481). 예전엔
    // --placeholder 불투명으로 넣어놔서 라이트는 너무 진하고(#6b6666 vs 목업 합성 #9e8d8e)
    // 다크는 너무 밝았다(#8b8786 vs #6f5f5f). 목업의 분홍기는 뒤의 코랄 글로우가 비쳐서지
    // 글자색 자체가 아니다 — 글로우를 넣으면 같은 톤이 따라온다.
    // 링크 줄은 알파 0.86~0.96 이라 사실상 불투명 --text 그대로 둔다.
    <div className="pt-3 text-center text-xs leading-3 text-text/50">
      <p>
        {COMPANY_NAME_KO} | 대표: {CEO_NAME} | 사업자등록번호: {BUSINESS_REGISTRATION_NUMBER}
        <br />
        {/* 신고 전 자리표시자가 들어 있는 동안에는 줄을 감춘다 — CompanyFooter와 같은 규칙. */}
        {MAIL_ORDER_BUSINESS_NUMBER !== MAIL_ORDER_NUMBER_PENDING && (
          <>
            통신판매업신고번호: {MAIL_ORDER_BUSINESS_NUMBER}
            <br />
          </>
        )}
        {COMPANY_ADDRESS} | {COMPANY_PHONE}
        <br />
        {SUPPORT_EMAIL}
      </p>
      <p className="mt-1.5 flex flex-wrap items-center justify-center gap-x-2 font-semibold text-text">
        <Link href="/privacy" className="underline">
          개인정보처리방침
        </Link>
        |
        <Link href="/terms" className="underline">
          이용약관
        </Link>
        |
        <Link href="/support" className="underline">
          고객센터
        </Link>
        |
        {/* 시안에는 없지만 시행규칙 제7조②가 공정위 사업자정보 공개페이지를 초기 화면에
            연결하도록 요구한다 — 목업에 맞춘다고 지울 항목이 아니다(2026-09-23 기록 참고).
            줄을 따로 만들면 시안의 세로 리듬이 한 줄만큼 밀리므로 같은 줄에 붙인다. */}
        <a
          href={FTC_BUSINESS_INFO_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="underline"
        >
          사업자 정보확인
        </a>
      </p>
    </div>
  );
}
