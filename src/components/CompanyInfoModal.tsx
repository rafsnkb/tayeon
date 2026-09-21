"use client";

import Link from "next/link";
import {
  BUSINESS_REGISTRATION_NUMBER,
  CEO_NAME,
  COMPANY_ADDRESS,
  COMPANY_NAME_KO,
  COMPANY_PHONE,
  FTC_BUSINESS_INFO_URL,
  MAIL_ORDER_BUSINESS_NUMBER,
  MAIL_ORDER_NUMBER_PENDING,
  SUPPORT_EMAIL,
} from "@/lib/company";

/** 전자상거래법 시행규칙 제7조③은 "출력에 제한이 있는 휴대전화 등"으로 거래하는 사업자에게,
 * 표시사항을 순차적으로 나타내고 대표자 성명·사업자등록번호·이용약관은 "확인할 수 있는 방법"을
 * 화면에 두는 것으로 갈음하도록 허용한다. 그래서 초기 화면에는 링크만 두고 내용은 이 모달이
 * 받는다 — 예전엔 한 줄에 전부 욱여넣느라 366px 폭에 605px가 들어가 주소가 잘려 있었다.
 *
 * 같은 조 ②항이 요구하는 공정위 사업자정보 공개페이지 링크도 여기 함께 둔다. */
export default function CompanyInfoModal({ onClose }: { onClose: () => void }) {
  return (
    <div
      data-modal-overlay="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-[28px] border border-border bg-topbar p-5 pt-7"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="flex flex-wrap items-center justify-center gap-x-2 text-sm font-semibold text-bold-text">
          <Link href="/privacy" onClick={onClose} className="underline">
            개인정보 처리방침
          </Link>
          <span className="text-icon-muted">|</span>
          <Link href="/terms" onClick={onClose} className="underline">
            이용약관
          </Link>
          <span className="text-icon-muted">|</span>
          <Link href="/support" onClick={onClose} className="underline">
            고객센터
          </Link>
        </p>

        <div className="mt-5 flex flex-col gap-1 text-center text-xs leading-5 text-icon-muted">
          <p>
            {COMPANY_NAME_KO} | 대표: {CEO_NAME}
          </p>
          <p>{COMPANY_ADDRESS}</p>
          <p>사업자등록번호: {BUSINESS_REGISTRATION_NUMBER}</p>
          {/* 신고 전이라 자리표시자가 들어 있는 동안에는 줄 자체를 감춘다 —
              "통신판매업신고번호: 기입예정"이 노출되는 편이 미기재보다 나쁘다. */}
          {MAIL_ORDER_BUSINESS_NUMBER !== MAIL_ORDER_NUMBER_PENDING && (
            <p>통신판매업신고번호: {MAIL_ORDER_BUSINESS_NUMBER}</p>
          )}
          <p>
            {SUPPORT_EMAIL} | {COMPANY_PHONE}
          </p>
        </div>

        <a
          href={FTC_BUSINESS_INFO_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 block text-center text-xs text-icon-muted underline"
        >
          사업자 정보확인
        </a>

        <button
          type="button"
          onClick={onClose}
          className="mt-7 h-12 w-full rounded-2xl bg-point text-base font-semibold text-white"
        >
          확인
        </button>
      </div>
    </div>
  );
}
