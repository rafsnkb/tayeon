"use client";

import { CheckIcon } from "@/app/(app)/tarot/icons";
import type { SajuMode } from "@/lib/saju/generate/chart";
import type { SajuProduct } from "@/lib/saju/products";
import { NoticeLineText } from "./NoticeLineText";
import { REQUIRED_CONSENTS, type NoticeLine } from "./refundNotice";
import type { ConsentKey } from "./purchaseRequest";

/** 목업의 마지막 두 구역 — 모드 선택 세 줄 + 총 결제금액 + 필수 동의 둘 + 결제 버튼.
 *
 *  **결제는 실행하지 않는다.** 버튼은 `onSubmit` 을 부르는데 이 화면은 그걸 아직 아무 데도
 *  넘기지 않는다 — 결제 경로는 `src/lib/saju/purchase.ts` 쪽에서 붙인다(`purchaseRequest.ts`).
 *
 *  실측(목업 3배): 패널은 풀블리드 --surface, 위에 경계선, 패딩 16 · 모드 줄 간격 45
 *  (제목 16/19 + 부제 12/14 = 33, 줄 사이 12) · 라디오 24, 코랄 테두리 2 · 구분선 위아래 ~13
 *  · 동의 체크 24 라운드 8, 줄 간격 16, 글자 14 · 버튼 h48 라운드 full 글자 18. */
const MODE_ROWS: { mode: SajuMode; title: string; caption: string }[] = [
  { mode: "saju", title: "사주로 해석하기", caption: "오행의 조화와 대운의 흐름으로 해석" },
  { mode: "ziwei", title: "자미두수로 해석하기", caption: "12궁의 별과 사건 흐름으로 해석" },
  {
    mode: "integrated",
    title: "사주+자미두수로 통합 해석하기",
    caption: "거시적 타이밍과 미시적 예측을 통합하여 해석",
  },
];

const won = (n: number) => `${n.toLocaleString("ko-KR")}원`;

export function ModePanel({
  product,
  mode,
  onModeChange,
  blockedReason,
  consents,
  onConsentChange,
  canSubmit,
  onSubmit,
}: {
  product: SajuProduct;
  mode: SajuMode;
  onModeChange: (next: SajuMode) => void;
  /** 모드별로 "왜 못 파는가". 전부 `whyUnsellable`(과 그걸 부르는 `whyNotPurchasable`)에서
   *  나온 문장이다 — 이 화면은 §10 의 규칙을 다시 적지 않는다. */
  blockedReason: Record<SajuMode, string | null>;
  /** 동의 항목별 "언제 체크했나". 체크 안 했으면 null. 불리언이 아닌 이유는
   *  `purchaseRequest.ts` 의 `consent` 주석 참고 — 표시의무 이행을 증명할 때 시점이 필요하다. */
  consents: Record<ConsentKey, string | null>;
  onConsentChange: (key: ConsentKey, next: boolean) => void;
  canSubmit: boolean;
  onSubmit: () => void;
}) {
  return (
    <section className="mt-5 border-t border-border bg-surface p-4">
      <div>
        {MODE_ROWS.map((row, index) => {
          const blocked = blockedReason[row.mode];
          const selected = mode === row.mode;
          return (
            <button
              key={row.mode}
              type="button"
              role="radio"
              aria-checked={selected}
              disabled={Boolean(blocked)}
              onClick={() => onModeChange(row.mode)}
              className={`flex w-full items-center gap-3 text-left ${index > 0 ? "mt-3" : ""} ${
                blocked ? "opacity-40" : ""
              }`}
            >
              <span className="min-w-0 flex-1">
                <span className="block text-base font-bold text-bold-text">{row.title}</span>
                <span className="block text-xs font-semibold text-placeholder">{row.caption}</span>
                {/* 목업에 없는 줄이다. 목업은 세 모드가 전부 팔리는 상태만 그렸는데, §10 은
                    시간을 모르면 자미두수·통합을 팔지 않는다 — 이유 없이 흐려지기만 하면
                    고장으로 읽힌다. */}
                {blocked && (
                  <span className="block pt-0.5 text-xs font-semibold text-urgent">{blocked}</span>
                )}
              </span>
              <span className="shrink-0 text-base font-bold text-bold-text">
                {won(product.pricesWon[row.mode])}
              </span>
              <span
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 border-point ${
                  selected ? "" : "bg-transparent"
                }`}
              >
                {selected && <span className="h-3.5 w-3.5 rounded-full bg-point" />}
              </span>
            </button>
          );
        })}
      </div>

      <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
        <span className="text-base font-bold text-bold-text">총 결제금액</span>
        <span className="text-base font-bold text-bold-text">{won(product.pricesWon[mode])}</span>
      </div>

      {/* 동의 문구도 안내문과 **같은 버전 덩어리**에 있다 — 안내문이 "결제 패널에 별도의 동의
          항목을 표시한다"고 약속한 그 항목이라, 둘이 따로 놀면 그 약속이 깨진다. */}
      <div className="mt-4 space-y-4 border-t border-border pt-4">
        {REQUIRED_CONSENTS.map((consent) => (
          <AgreeRow
            key={consent.key}
            label={consent.label}
            checked={consents[consent.key] !== null}
            onChange={(next) => onConsentChange(consent.key, next)}
          />
        ))}
      </div>

      <button
        type="button"
        disabled={!canSubmit}
        onClick={onSubmit}
        className="mt-4 h-12 w-full rounded-full bg-point text-lg font-bold text-white disabled:opacity-40"
      >
        {won(product.pricesWon[mode])} 결제하기
      </button>
    </section>
  );
}

/** 필수 동의 한 줄. 켜면 코랄 면에 흰 체크다(목업) — 「상대방 프로필 사용」 체크와 색이 다르다.
 *  같은 모양을 `SupportCenter` 가 이미 쓰고 있어서 거기 맞췄다. */
function AgreeRow({
  label,
  checked,
  onChange,
}: {
  label: NoticeLine;
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-placeholder">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="sr-only"
      />
      <span
        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg ${
          checked ? "bg-point text-white" : "border border-border"
        }`}
      >
        <CheckIcon className={`h-3 w-3 ${checked ? "" : "opacity-0"}`} />
      </span>
      <span className="min-w-0 flex-1">
        <NoticeLineText line={label} />
      </span>
    </label>
  );
}
