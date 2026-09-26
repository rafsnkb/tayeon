"use client";

// 상세 화면과 **결제 경로**를 잇는 얇은 껍데기.
//
// `page.tsx` 는 서버 컴포넌트라 콜백을 못 넘긴다. 그렇다고 결제를 `FortuneDetailScreen` 안으로
// 넣으면 그 파일이 "값을 모으는 화면"과 "돈을 움직이는 코드" 둘 다가 된다 — 그 경계를 지키려고
// `onPurchase` 를 prop 으로 뽑아 뒀던 것이므로, 여기서 이어 붙인다.
import SuspensionModal from "@/components/SuspensionModal";
import type { SajuProduct } from "@/lib/saju/products";
import { FortuneDetailScreen } from "./FortuneDetailScreen";
import { useFortunePurchase, type PurchasePhase } from "./useFortunePurchase";

/** 단계마다 다른 말을 한다. 특히 `opening` 은 29초짜리라, 같은 "처리 중"으로 두면 멈춘 것처럼
 *  보인다 — 사용자가 그 사이에 새로고침하면 결제는 끝났는데 리포트가 없는 화면을 만난다. */
const PHASE_LABEL: Record<PurchasePhase, string> = {
  preparing: "결제를 준비하고 있어요...",
  paying: "결제창에서 이어서 진행해주세요.",
  completing: "결제를 확인하고 있어요...",
  opening: "명식을 계산하고 리포트를 만들고 있어요. 30초쯤 걸려요.",
};

export function FortuneDetail({ product }: { product: SajuProduct }) {
  const { phase, error, suspension, purchase, retryOpen, dismissError, dismissSuspension } =
    useFortunePurchase();

  return (
    <>
      <FortuneDetailScreen product={product} onPurchase={purchase} busy={phase !== null} />

      {/* 진행 중에는 화면 전체를 덮는다. **`opening` 단계에서 뒤로 가거나 다시 누르면 안 된다** —
          결제는 이미 끝났고, 여기서 벗어나면 사용자는 "리포트를 만드는 중"이라는 사실을 잃는다.
          `aria-live` 로 문구가 바뀔 때마다 읽히게 한다. */}
      {phase && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-bg/85 px-8 backdrop-blur-sm">
          <p aria-live="polite" className="text-center text-base font-bold leading-relaxed text-bold-text">
            {PHASE_LABEL[phase]}
          </p>
        </div>
      )}

      {error && (
        <div className="fixed inset-x-0 bottom-0 z-50 px-4 pb-6">
          <div className="mx-auto w-full max-w-2xl rounded-2xl border border-border bg-surface p-4">
            <p className="text-base font-semibold leading-relaxed text-bold-text">{error.message}</p>
            <div className="mt-3 flex justify-end gap-2">
              {/* 결제가 끝난 뒤의 실패에만 나온다. 여기서 "닫기"만 주면 사용자는 돈을 낸 채로
                  아무 데도 못 간다 — `open` 은 멱등해서 다시 눌러도 리포트가 둘이 되지 않는다. */}
              {error.retryOpenPaymentId && (
                <button
                  type="button"
                  onClick={() => void retryOpen(error.retryOpenPaymentId!)}
                  className="rounded-full bg-point px-5 py-2 text-sm font-bold text-white"
                >
                  리포트 다시 열기
                </button>
              )}
              <button
                type="button"
                onClick={dismissError}
                className="rounded-full bg-chip-soft px-5 py-2 text-sm font-bold text-chip-soft-text"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}

      {suspension && <SuspensionModal info={suspension} onClose={dismissSuspension} />}
    </>
  );
}
