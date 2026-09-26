import { NoticeLineText } from "./NoticeLineText";
import { REFUND_NOTICE } from "./refundNotice";

/** 목업 `Fortune_Select_*` 의 안내·약관 구역. 카드 하나 안에 글머리 목록과 옅은 상자가 섞인다.
 *
 *  **문장은 여기 없다** — 전부 `refundNotice.ts` 에 버전과 함께 모여 있다. 이 파일은 모양만
 *  안다. 환불 조건은 다툼이 생기면 "그때 무엇을 보여줬나"를 대야 하는 문장이라, 화면 코드와
 *  섞여 있으면 그 답을 git 로그에서 재구성하게 된다(그 파일 머리말).
 *
 *  실측(목업 3배): 카드 라운드 28 · 패딩 12 · 글자 14 · 옅은 상자는 카드 패딩선에 딱 맞고
 *  자기 패딩 16 을 갖는다. 줄 높이만 목업(17)이 아니라 토큰(--text-sm--line-height 21)을 쓴다
 *  — 목업 값은 피그마의 자동 행간이고, 저장소 규칙이 「목업과 토큰이 충돌하면 토큰」이다. */
export function PurchaseNotice() {
  return (
    <section className="px-4">
      <div className="mt-8 space-y-3 rounded-[28px] border border-border bg-surface p-3 text-sm font-semibold text-placeholder">
        {REFUND_NOTICE.map((block, blockIndex) => {
          if (block.kind === "callout") {
            return (
              <p key={blockIndex} className="rounded-2xl bg-chip-soft p-4">
                <NoticeLineText line={block.text} />
              </p>
            );
          }
          return (
            <ul
              key={blockIndex}
              className={
                block.kind === "calloutBullets"
                  ? "list-disc rounded-2xl bg-chip-soft p-4 pl-9"
                  : "list-disc pl-5"
              }
            >
              {block.items.map((line, i) => (
                <li key={i}>
                  <NoticeLineText line={line} />
                </li>
              ))}
            </ul>
          );
        })}
      </div>
    </section>
  );
}
