"use client";

// 0페이지 — 목차 + 미리보기.
//
// ⚠️ **임시 구현 — 목업 대기 중.** 기존 토큰만 쓴다. 정해지지 않은 것: 진행 표시를 점으로 할지
// 숫자로 할지, 목차 줄을 눌러 바로 그 장으로 뛸 수 있게 할지(지금은 된다), 표지 그림 유무.
//
// **이 화면이 총평이 아니다.** §1 이 총평을 마지막 장으로 옮겼으므로 여기는 "무슨 이야기를 할
// 것인가"만 보여 준다. `outline.thesis` 는 애초에 응답에 실려 오지도 않는다(`view.ts`).
import type { OutlineEntry } from "@/lib/saju/view";

export default function ReaderToc({
  title,
  entries,
  onJump,
}: {
  title: string;
  entries: OutlineEntry[];
  /** 목차 줄 → 그 장. `index` 는 화면의 장 번호이고 섹션 N 은 인덱스 N 이다. */
  onJump: (index: number) => void;
}) {
  return (
    <section className="rounded-[32px] border border-border bg-topbar p-6">
      <h1 className="text-2xl font-bold text-bold-text">{title}</h1>
      <p className="mt-2 text-sm font-semibold text-icon-muted">
        {entries.length}장으로 나눠 읽어요. 한 장씩 넘기면서 보세요.
      </p>

      <ol className="mt-6 divide-y divide-border">
        {entries.map((entry, i) => (
          <li key={i}>
            <button
              type="button"
              onClick={() => onJump(i + 1)}
              className="flex w-full items-start gap-3 py-4 text-left"
            >
              <span className="mt-0.5 shrink-0 text-sm font-bold text-point-text">{i + 1}</span>
              <span className="min-w-0 flex-1">
                <span className="block text-base font-bold text-bold-text">{entry.title}</span>
                {/* 요지는 1단이 쓴 한 줄이다. 본문이 아직 없어도 목차는 채워진다 — 그게 0페이지가
                    28초가 아니라 바로 보이는 이유다(§6). */}
                <span className="mt-1 block text-sm font-semibold text-text">{entry.gist}</span>
              </span>
            </button>
          </li>
        ))}
      </ol>
    </section>
  );
}
