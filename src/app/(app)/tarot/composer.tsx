"use client";

import { useEffect } from "react";
import { SPREADS, type SpreadKey } from "@/lib/tarot/pricing";
import {
  CompatibilityIcon,
  CloseIcon,
  SpreadOneIcon,
  SpreadThreeIcon,
  SpreadDualIcon,
  SpreadCelticIcon,
} from "./icons";

/* 입력창과 스프레드 선택에 딸린 조각들 — placeholder 타이핑 연출, 스프레드 아이콘·라벨 표,
 * 스프레드 선택 바텀시트와 그 안의 토글.
 *
 * TarotScreen.tsx 에서 떼어 왔다(2026-09-24). */

/** 입력창이 비어 있을 때 한 글자씩 찍히는 예시 질문들. */
const PLACEHOLDER_PHRASES = [
  "그 사람, 내 생각 하기는 할까?",
  "올해 하반기 금전운 흐름이 궁금해요",
  "우리 둘 성향 차이, 맞춰갈 수 있을까?",
  "이직 준비를 해도 괜찮은 시기일까?",
  "내가 올해 가장 조심해야 할 부분은?",
  "헤어진 그 사람한테 먼저 다가가 볼까?",
  "새로 시작하려는 일, 괜찮을까?",
  "우린 서로에게 득이 되는 인연일까?",
  "타고난 제 기운과 가장 잘 맞는 진로는?",
  "앞으로의 흐름을 알고 싶어요",
];
const TYPE_MS = 70; // 한 글자 간격
const HOLD_MS = 1000; // 다 찍은 뒤 사라지기 시작할 때까지
const FADE_MS = 1000; // 흐려지는 데 걸리는 시간

/**
 * placeholder 를 무작위 순서로 한 글자씩 찍고, 다 찍으면 잠시 뒀다가 흐려지며 사라진 뒤
 * 다음 문구로 넘어간다.
 *
 * 상태가 아니라 ref 로 DOM 을 직접 쓴다 — 이 화면은 트리가 커서 70ms 마다 리렌더하면
 * 리딩 중에 눈에 띄게 끊긴다. JSX 쪽 placeholder 는 고정 문자열이라 React 가 다시
 * 덮어쓰지 않는다(값이 안 바뀌면 DOM 을 건드리지 않는다).
 *
 * 페이드도 CSS 트랜지션이 아니라 JS 가 직접 --ph(0~1)를 깎는다. ::placeholder 는
 * 트랜지션이 사파리에서 안 먹는 경우가 있어 브라우저에 맡기면 어디선 되고 어디선
 * 안 되는 효과가 된다. 농도 계산은 globals.css 의 .typing-placeholder 가 맡는다.
 *
 * 목록을 섞어 한 바퀴 돌고 다시 섞는다. 매번 무작위로 고르면 같은 문구가 연달아
 * 나올 수 있어서다.
 */
export function useTypingPlaceholder(ref: React.RefObject<HTMLTextAreaElement | null>) {
  useEffect(() => {
    if (!ref.current) return;
    // 모션을 줄이라고 한 사용자에게는 고정 문구 하나만 보여준다.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      ref.current.placeholder = PLACEHOLDER_PHRASES[0];
      return;
    }

    let timer: ReturnType<typeof setTimeout> | undefined;
    let raf = 0;
    let queue: string[] = [];
    let cancelled = false;

    const setAlpha = (v: number) => ref.current?.style.setProperty("--ph", String(v));

    const fadeOut = (done: () => void) => {
      const start = performance.now();
      const step = (t: number) => {
        if (cancelled) return;
        const p = Math.min(1, (t - start) / FADE_MS);
        setAlpha(1 - p);
        if (p < 1) raf = requestAnimationFrame(step);
        else done();
      };
      raf = requestAnimationFrame(step);
    };

    const nextPhrase = () => {
      if (queue.length === 0) {
        queue = [...PLACEHOLDER_PHRASES];
        for (let i = queue.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [queue[i], queue[j]] = [queue[j], queue[i]];
        }
      }
      const chars = Array.from(queue.shift()!);
      let i = 0;
      // 글자를 비우기 전에 농도를 되돌린다 — 순서가 바뀌면 사라졌던 문구가 한 프레임 번쩍인다.
      setAlpha(1);
      const tick = () => {
        const el = ref.current;
        if (cancelled || !el) return;
        el.placeholder = chars.slice(0, i).join("");
        if (i < chars.length) {
          i += 1;
          timer = setTimeout(tick, TYPE_MS);
        } else {
          timer = setTimeout(() => fadeOut(nextPhrase), HOLD_MS);
        }
      };
      tick();
    };
    nextPhrase();

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      if (timer) clearTimeout(timer);
    };
  }, [ref]);
}

export const SPREAD_ICONS: Record<SpreadKey, (props: { className?: string }) => React.JSX.Element> = {
  one: SpreadOneIcon,
  three: SpreadThreeIcon,
  dual: SpreadDualIcon,
  celtic: SpreadCelticIcon,
};

export const INPUT_MODE_SPREAD_LABEL: Record<SpreadKey, string> = {
  one: "원 카드",
  three: "쓰리 카드",
  dual: "양자택일",
  celtic: "켈틱 크로스",
};
const SPREAD_DESCRIPTIONS: Record<SpreadKey, string> = {
  one: "간단한 질문에 추천",
  three: "제일 범용성 높은 스프레드",
  dual: "어느 한쪽을 선택해야 할 때 추천",
  celtic: "세부적인 심층 분석에 추천",
};
/** 피그마 "Screen / SpreadSelect"의 List_Spread — 스프레드 4종을 설명+가격과 함께 고르는 바텀시트 */
export function SpreadSelectSheet({
  spread,
  remainingBySpread,
  timePassActive,
  onSelect,
  includeCompatibility,
  hasPartner,
  onToggleCompatibility,
  onClose,
}: {
  spread: SpreadKey;
  remainingBySpread: Record<SpreadKey, number>;
  timePassActive: boolean;
  onSelect: (key: SpreadKey) => void;
  includeCompatibility: boolean;
  hasPartner: boolean;
  onToggleCompatibility: () => void;
  onClose: () => void;
}) {
  return (
    <div data-modal-overlay="true" className="fixed inset-0 z-50 flex items-end bg-black/50" onClick={onClose}>
      <div
        className="w-full xl:mx-auto xl:max-w-4xl rounded-t-[28px] border border-border bg-topbar p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-2 flex items-center gap-3 p-3">
          <div className="w-5" />
          <div className="flex-1 text-center">
            <p className="text-lg font-bold text-bold-text">스프레드 선택</p>
            <p className="text-sm font-semibold text-icon-muted">원하는 스프레드를 선택할 수 있어요</p>
          </div>
          <button type="button" onClick={onClose} aria-label="닫기" className="text-bold-text">
            <CloseIcon className="h-5 w-5" />
          </button>
        </div>
        {/* 안쪽 패널 면색은 아래 "궁합 해석 추가" 박스와 **같아야 한다**(2026-09-26 사용자 지적).
            목업 실측: 시트 면 #19191d 위에 두 박스가 **둘 다 #2a2c31**(SpreadSelect.png ·
            SpreadSelect-2.png), 라이트는 #f7f4fb 위에 둘 다 #fcfbfd. 여기만 bg-border/40 을
            쓰고 있었는데 그건 --topbar(#1a1616) 위에 #1f1b1b 를 40% 얹은 값이라 ≈#1c1818 —
            시트와 거의 구분되지 않아 다크에서 두 박스가 눈에 띄게 달라 보였다.
            목업의 hex 를 그대로 베끼지 않고 토큰으로 옮긴다(목업↔토큰 충돌 시 토큰 우선). */}
        <div className="flex flex-col gap-1 rounded-2xl bg-bg p-2 dark:bg-chip-fill">
          {(Object.keys(SPREADS) as SpreadKey[]).map((key, i) => {
            const Icon = SPREAD_ICONS[key];
            const selected = spread === key;
            return (
              <div key={key}>
                {i > 0 && <div className="h-px bg-border" />}
                <button
                  type="button"
                  onClick={() => {
                    onSelect(key);
                    onClose();
                  }}
                  className="flex w-full items-center gap-2 rounded-lg p-2 text-left"
                >
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center text-bold-text">
                    <Icon className="h-5 w-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1">
                      <span className="text-lg font-semibold text-bold-text">{SPREADS[key].label} 스프레드</span>
                      {selected && (
                        <span className="shrink-0 rounded-full bg-point px-2 py-0.5 text-xs font-semibold text-white">
                          선택됨
                        </span>
                      )}
                    </span>
                    <span className="block text-sm font-semibold text-icon-muted">
                      {SPREAD_DESCRIPTIONS[key]}
                    </span>
                  </span>
                  <span className="flex shrink-0 flex-col items-end gap-0.5">
                    <span className="text-xs font-semibold text-icon-muted">남은 횟수</span>
                    <span className="text-base font-semibold text-gold">{timePassActive ? "무제한" : `${remainingBySpread[key]}회`}</span>
                  </span>
                </button>
              </div>
            );
          })}
        </div>

        <section className="mt-3">
          <p className="text-center text-lg font-bold text-bold-text">궁합 해석 추가</p>
          <p className="text-center text-sm font-semibold text-icon-muted">사주ㆍ자미두수 정보를 기반으로 궁합까지 타로 리딩</p>
          <p className="text-center text-sm font-semibold text-urgent [word-break:keep-all]">궁합 해석을 추가하려면 상대방 프로필 정보가 필요합니다.</p>
          <div className="mt-2 rounded-2xl bg-bg dark:bg-chip-fill">
            <div className="flex items-center gap-3 px-4 py-2">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center text-icon-muted dark:text-bold-text"><CompatibilityIcon className="h-5 w-5" /></span>
              <span className="min-w-0 flex-1">
                <span className="block text-lg font-semibold text-bold-text">궁합 해석 추가</span>
                <span className="block text-sm font-semibold text-icon-muted">상대방과의 궁합을 더 자세하게 분석</span>
              </span>
              <Switch checked={includeCompatibility} onChange={onToggleCompatibility} disabled={!hasPartner} />
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

/** 피그마 "Screen / SpreadSelect"(궁합 추가 시트)가 쓰던 on/off 스위치 — 기존 코드베이스엔
 * 세그먼트 버튼(ToggleGroup)만 있고 iOS류 스위치가 없어서 신설. 스프레드 선택 시트 하단의 궁합
 * 스위치가 그대로 재사용한다(2026-09-18, 사주/자미두수는 이용권 조합 고정으로 별도 시트 제거됨). */
export function Switch({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={onChange}
      disabled={disabled}
      className={`relative h-7 w-[72px] shrink-0 rounded-full transition-colors disabled:opacity-40 ${
        checked ? "bg-point" : "bg-icon-muted"
      }`}
    >
      <span
        className={`absolute left-0 top-0.5 h-6 w-6 rounded-full transition-transform ${
          checked ? "translate-x-[46px] bg-white" : "translate-x-[2px] bg-white dark:bg-cta-fill"
        }`}
      />
    </button>
  );
}
