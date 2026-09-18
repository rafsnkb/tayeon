import Link from "next/link";
import {
  BUSINESS_REGISTRATION_NUMBER,
  CEO_NAME,
  COMPANY_ADDRESS,
  COMPANY_NAME_KO,
  COMPANY_PHONE,
} from "@/lib/company";

/** 채팅 화면 하단에 항상 노출되는 한 줄 사업자 정보 바. */
export function CompanyInfoBar() {
  return (
    <footer className="flex h-8 shrink-0 items-center border-t border-border bg-topbar px-3 text-[10px] text-icon-muted">
      <p className="w-full overflow-x-auto whitespace-nowrap text-center [scrollbar-width:none]">
        {COMPANY_NAME_KO} | 대표 {CEO_NAME} | 사업자등록번호 {BUSINESS_REGISTRATION_NUMBER} | {COMPANY_ADDRESS} | {COMPANY_PHONE} | {" "}
        <Link href="/terms" className="underline">이용약관</Link> | <Link href="/privacy" className="underline">개인정보처리방침</Link>
      </p>
    </footer>
  );
}
