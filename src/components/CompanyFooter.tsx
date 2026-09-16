import Link from "next/link";
import {
  COMPANY_NAME_EN,
  COMPANY_NAME_KO,
  CEO_NAME,
  BUSINESS_REGISTRATION_NUMBER,
  MAIL_ORDER_BUSINESS_NUMBER,
  COMPANY_ADDRESS,
  COMPANY_PHONE,
  SUPPORT_EMAIL,
} from "@/lib/company";

/** 피그마 "Screen / MyPage"·메뉴 드로어 하단에 반복되는 사업자 정보 블록 — 두 군데서 같은
 * 내용을 쓰길래 공용 컴포넌트로 뺌(2026-09-14). */
export function CompanyFooter() {
  return (
    <div className="flex flex-col gap-2 rounded-[32px] border border-border bg-topbar p-4 text-center text-xs text-icon-muted">
      <p>
        {COMPANY_NAME_KO} | 대표: {CEO_NAME}
        <br />
        사업자등록번호: {BUSINESS_REGISTRATION_NUMBER}
        <br />
        통신판매업신고번호: {MAIL_ORDER_BUSINESS_NUMBER}
        <br />
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
      <a
        href="https://www.ftc.go.kr/bizCommPop.do?wrkr_no=2771902371"
        target="_blank"
        rel="noopener noreferrer"
        className="underline"
      >
        사업자 정보확인
      </a>
    </div>
  );
}
