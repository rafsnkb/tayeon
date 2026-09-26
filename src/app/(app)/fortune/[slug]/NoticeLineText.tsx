import Link from "next/link";
import type { NoticeLine } from "./refundNotice";

/** `refundNotice.ts` 의 한 줄을 그린다. 문구는 저 파일에만 있고 여기에는 **모양만** 있다 —
 *  안내·약관·동의 문구는 버전과 함께 한 곳에 모여 있어야 "그때 무엇을 보여줬나"에 답할 수 있다
 *  (그 파일 머리말). 링크 모양은 `/charge`·`CouponTerms` 와 같은 코랄 밑줄이다. */
export function NoticeLineText({ line }: { line: NoticeLine }) {
  if (typeof line === "string") return <>{line}</>;
  return (
    <>
      {line.map((span, i) =>
        typeof span === "string" ? (
          <span key={i}>{span}</span>
        ) : (
          <Link
            key={i}
            href={span.href}
            className="font-bold text-point-text underline underline-offset-2"
          >
            {span.link}
          </Link>
        )
      )}
    </>
  );
}
