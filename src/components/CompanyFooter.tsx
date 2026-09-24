import Link from "next/link";
import {
  COMPANY_NAME_EN,
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

/** 피그마 "Screen / MyPage"·메뉴 드로어 하단에 반복되는 사업자 정보 블록 — 두 군데서 같은
 * 내용을 쓰길래 공용 컴포넌트로 뺌(2026-09-14).
 *
 * 한때 비로그인 메뉴 드로어용 plain(테두리 없는 평문) 변형이 있었는데, 그 블록 자체를
 * 걷어내면서(2026-09-23) 같이 없앴다. 지금 쓰는 곳은 /charge 와 마이페이지 둘뿐이다. */
export function CompanyFooter() {
  return (
    <div className="flex flex-col gap-2 rounded-[32px] border border-border bg-topbar p-4 text-center text-xs text-icon-muted">
      <p>
        {COMPANY_NAME_KO} | 대표: {CEO_NAME}
        <br />
        사업자등록번호: {BUSINESS_REGISTRATION_NUMBER}
        <br />
        {/* 신고 전 자리표시자가 들어 있는 동안에는 줄을 감춘다 — CompanyInfoModal과 같은 규칙. */}
        {MAIL_ORDER_BUSINESS_NUMBER !== MAIL_ORDER_NUMBER_PENDING && (
          <>
            통신판매업신고번호: {MAIL_ORDER_BUSINESS_NUMBER}
            <br />
          </>
        )}
        {COMPANY_ADDRESS}
        <br />
        {COMPANY_PHONE} | {SUPPORT_EMAIL}
      </p>
      <p>Copyright {COMPANY_NAME_EN} Inc. 2026.</p>
      <p className="flex flex-wrap items-center justify-center gap-x-2">
        <Link href="/privacy" className="underline">
          개인정보 처리방침
        </Link>
        |
        <Link href="/terms" className="underline">
          이용약관
        </Link>
        |
        <Link href="/support" className="underline">
          고객센터
        </Link>
      </p>
      {/* 시안에는 이 링크가 없지만 전자상거래법 시행규칙 제7조②가 공정위 사업자정보 공개페이지
          연결을 요구한다(2026-09-22 기록 참고, 호리에는 이 링크가 아예 없다). 목업에 맞춘다고
          지울 항목이 아니라 그대로 둔다. */}
      <a
        href={FTC_BUSINESS_INFO_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="underline"
      >
        사업자 정보확인
      </a>
    </div>
  );
}
