"use client";

// 이미지 장.
//
// ⚠️ **임시 구현 — 목업 대기 중.** 기존 토큰만 쓴다. 정해지지 않은 것: 그림을 화면 폭 전체로
// 흘릴지 카드 안에 둘지, 다시 뽑기 버튼의 위치와 문구, 다시 뽑은 횟수를 보여줄지.
//
// 두 가지는 **정해져 있고 바꾸면 안 된다.**
//
// 1. **고지 문구**(§8, 기획 6.5). 이미지는 미래의 특정 인물을 맞히는 기능이 아니라 해석에서
//    읽힌 분위기를 시각화한 것이다. 이 문구가 없으면 사용자가 예측으로 읽는다. 문구는
//    `SAJU_IMAGE_DISCLOSURE` 한 곳에서 온다 — 화면마다 따로 적으면 반드시 서로 달라진다.
// 2. **다시 뽑기는 셀링포인트다**(§8). 장당 8원이라 10번 뽑아도 80원이고, 해석은 그대로고 그림만
//    바뀌므로 결과의 일관성도 안 깨진다. 실패 보상처럼 숨기지 말 것.
import { SAJU_IMAGE_DISCLOSURE } from "@/lib/saju/generate/image";

export default function ReaderImage({
  objectUrl,
  regeneratedCount,
  busy,
  error,
  onRegenerate,
}: {
  /** blob 주소다. `<img src={image.url}>` 를 직접 걸면 401 이다 — 그 GET 이 `Authorization`
   *  헤더를 요구하고 `<img>` 는 헤더를 못 싣는다(코어의 `loadImageUrl` 주석 참고). */
  objectUrl: string | null;
  regeneratedCount: number;
  busy: boolean;
  error: string | null;
  onRegenerate: () => void;
}) {
  return (
    <section className="rounded-[32px] border border-border bg-topbar p-6">
      {/* 세로 3:2(1024×1536)다. 비율을 박아 두면 그림이 늦게 와도 레이아웃이 튀지 않는다. */}
      <div className="relative aspect-[2/3] w-full overflow-hidden rounded-2xl bg-chip-soft">
        {objectUrl ? (
          /* blob 주소라 `next/image` 의 최적화 대상이 아니다 — 원격 URL 이 아니고, 이미 webp 로
             줄여 받은 바이트다(1024폭 q82, 약 66KB). */
          // eslint-disable-next-line @next/next/no-img-element
          <img src={objectUrl} alt={SAJU_IMAGE_DISCLOSURE} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center">
            <p className="text-sm font-semibold text-icon-muted">
              {busy ? "그림을 그리고 있어요..." : (error ?? "아직 준비되지 않았어요.")}
            </p>
          </div>
        )}
      </div>

      {/* 고지는 그림 **바로 아래**에 둔다. 페이지 하단으로 밀면 그림만 보고 넘기는 사람에게는
          닿지 않는다. */}
      <p className="mt-3 text-center text-xs font-semibold text-icon-muted">{SAJU_IMAGE_DISCLOSURE}</p>

      {error && objectUrl && <p className="mt-2 text-center text-sm font-semibold text-urgent">{error}</p>}

      <div className="mt-5 flex flex-col items-center gap-2">
        <button
          type="button"
          onClick={onRegenerate}
          disabled={busy}
          className="rounded-full bg-cta-fill px-6 py-3 text-sm font-bold text-cta-text disabled:opacity-50"
        >
          {busy ? "그리는 중..." : "다시 그리기"}
        </button>
        {regeneratedCount > 0 && (
          <p className="text-xs font-semibold text-icon-muted">{regeneratedCount}번 다시 그렸어요</p>
        )}
      </div>
    </section>
  );
}
