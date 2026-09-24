"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CloseIcon } from "@/app/(app)/tarot/icons";

/**
 * 아이폰 알람 같은 상하 휠 입력(목업 Wheel_Dark / Wheel_Dark-1, 2026-09-25).
 *
 * 브라우저 기본 `<input type="date">` / `type="time"` 을 대신한다. 기본 입력은 OS 마다
 * 생김새가 제각각이라 다른 컨트롤과 같은 화면에 두면 혼자 튀었다.
 *
 * 스크롤 스냅으로 만든다. `scroll-snap-type: y mandatory` 에 칸 높이를 맞춰 두면 관성 스크롤이
 * 알아서 한 칸에 멈추고, 선택값은 `scrollTop / 칸높이` 를 반올림해 읽으면 된다 — 직접
 * 드래그를 구현하면 터치/마우스/트랙패드 관성을 전부 흉내 내야 한다.
 *
 * 실측(2026-09-25 개정판): 카드 380×382, 칸 높이 32, 가운데 강조 띠 28(--chip-soft), 5 칸.
 * 세로로 16 + 제목 46 + 24 + 이름 24 + 12 + 휠 160 + 28 + 버튼 48 + 24 = 382.
 */
const ROW = 32;
const VISIBLE = 5;
const PAD = ((VISIBLE - 1) / 2) * ROW; // 가운데 칸을 중앙에 두기 위한 위아래 여백

/**
 * 아이폰처럼 글자가 **원통에 붙어 돌아가게** 하는 값들(사용자 요청, 2026-09-25).
 *
 * 기울이기만 하면 안 된다 — 32px 짜리 줄을 18도 눌러 봤자 거의 표가 안 났다. 진짜 느낌은
 * 줄이 원통 표면에 있어서 **위아래로 좁혀지는** 데서 나온다. 그래서 각 줄을 원통 위 제자리로
 * 옮긴다: 각도 θ 인 줄은 중앙에서 `R·sinθ` 만큼 떨어져 있고 `R·cosθ - R` 만큼 뒤로 물러나 있다.
 * 흐름상 위치는 `(i - offset)·ROW` 이므로 그 차이만 `translateY` 로 보정한다.
 *
 * 원근은 **줄마다** 준다(`perspective()` 함수). 스크롤 컨테이너에 `perspective` 를 걸고
 * `preserve-3d` 를 이어 붙이는 방법도 크롬에서는 같은 그림이 나오지만, `overflow` 가 있는
 * 요소는 규격상 3D 문맥이 평면으로 바뀌어서 브라우저마다 결과를 보장할 수 없다.
 *
 * 스크롤·스냅 기하는 **하나도 건드리지 않는다**. transform 은 레이아웃에 영향을 주지 않으므로
 * `scrollTop / ROW` 매핑과 실측 치수(칸 32, 5칸)가 그대로 살아 있다.
 */
const ANGLE = 22; // 한 칸당 회전 각도
const PERSPECTIVE = 420;
const MAX_TILT_ROWS = 3; // 이보다 먼 줄은 더 눕히지 않는다(뒤로 넘어가 뒤집혀 보인다)
const RADIUS = ROW / ((ANGLE * Math.PI) / 180); // 호 길이가 칸 높이와 맞는 반지름
/** 기울임을 계산해 둘 줄의 범위. 보이는 5칸보다 넉넉히 잡아 두면 굴릴 때 빈 줄이 안 생긴다. */
const PAINT_MARGIN = 4;

export type WheelColumn = {
  key: string;
  /** 칸 위에 붙는 이름 — "년", "월", "오전/오후" 처럼. */
  label: string;
  items: { value: string; label: string }[];
};

function Column({
  column,
  value,
  onChange,
}: {
  column: WheelColumn;
  value: string;
  onChange: (v: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const index = Math.max(0, column.items.findIndex((it) => it.value === value));
  const [active, setActive] = useState(index);
  const settle = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** 기울임을 써 둔 줄들. 벗어난 줄을 되돌리려면 어디를 건드렸는지 알아야 한다. */
  const paintedRows = useRef<number[]>([]);

  /** 굴림 위치에 맞춰 각 줄을 원통 위에 놓는다.
   *
   *  React 상태로 하지 않고 DOM 에 직접 쓴다 — 스크롤은 초당 수십 번 일어나고 연 칸은 줄이
   *  100 개에 가깝다. 다시 그릴 일이 아니라 **칠할** 일이다. 손 댄 줄만 기억해 두고 범위를
   *  벗어나면 되돌려 놓는다(안 지우면 화면 밖에 누운 줄이 남는다). */
  const paint = useCallback(() => {
    const el = ref.current;
    const list = listRef.current;
    if (!el || !list) return;
    const rows = list.children;
    const offset = el.scrollTop / ROW;
    const from = Math.max(0, Math.floor(offset) - PAINT_MARGIN);
    const to = Math.min(rows.length - 1, Math.ceil(offset) + PAINT_MARGIN);
    for (const i of paintedRows.current) {
      if (i < from || i > to) {
        const row = rows[i] as HTMLElement | undefined;
        if (row) {
          row.style.transform = "";
          row.style.opacity = "";
        }
      }
    }
    const next: number[] = [];
    for (let i = from; i <= to; i++) {
      const row = rows[i] as HTMLElement | undefined;
      if (!row) continue;
      const delta = i - offset;
      const tilt = Math.max(-MAX_TILT_ROWS, Math.min(MAX_TILT_ROWS, delta));
      const theta = (tilt * ANGLE * Math.PI) / 180;
      const dy = RADIUS * Math.sin(theta) - delta * ROW;
      const dz = RADIUS * Math.cos(theta) - RADIUS;
      row.style.transform =
        `perspective(${PERSPECTIVE}px) translateY(${dy.toFixed(2)}px)` +
        ` translateZ(${dz.toFixed(2)}px) rotateX(${(-tilt * ANGLE).toFixed(1)}deg)`;
      // 멀어질수록 흐려진다. 색 단계(아래 className)만으로는 원통 끝이 뚝 끊겨 보인다.
      row.style.opacity = Math.max(0.2, 1 - Math.abs(delta) / 3.2).toFixed(2);
      next.push(i);
    }
    paintedRows.current = next;
  }, []);

  // 바깥에서 값이 바뀌면(달이 바뀌어 일수가 줄어드는 등) 그 자리로 옮겨 놓는다.
  // 스크롤 중에는 건드리지 않는다 — 사용자가 굴리는 중에 되돌아가면 안 된다.
  useEffect(() => {
    const el = ref.current;
    if (!el || settle.current) return;
    el.scrollTop = index * ROW;
    setActive(index);
    paint();
  }, [index, paint]);

  // 줄 목록이 바뀌면(2월로 옮겨 일수가 줄는 등) React 가 줄을 새로 만들어서 기울임이 없는
  // 상태로 돌아온다. 그때 다시 칠한다.
  useEffect(() => {
    paintedRows.current = [];
    paint();
  }, [column.items, paint]);

  /** PC 에서 끌어서 굴리기. 스크롤 휠만으로는 굴림판인 줄 모르고 지나친다(사용자 지적).
   *  터치는 건드리지 않는다 — 모바일은 이미 관성 스크롤이 자연스럽고, 여기서 가로채면 그걸
   *  흉내 내야 한다. 끄는 동안에는 스냅을 꺼 둔다: 켜 둔 채로 scrollTop 을 직접 넣으면 매 프레임
   *  가장 가까운 칸으로 튕겨서 끌리지 않는다. */
  const drag = useRef<{ startY: number; startTop: number } | null>(null);

  const snapToNearest = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const i = Math.max(0, Math.min(column.items.length - 1, Math.round(el.scrollTop / ROW)));
    el.scrollTo({ top: i * ROW, behavior: "smooth" });
  }, [column.items.length]);

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el || e.pointerType !== "mouse") return;
    e.preventDefault(); // 끌 때 글자가 선택되지 않게
    drag.current = { startY: e.clientY, startTop: el.scrollTop };
    el.style.scrollSnapType = "none";
    el.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el || !drag.current) return;
    el.scrollTop = drag.current.startTop - (e.clientY - drag.current.startY);
    paint(); // scroll 이벤트로도 오지만, 끌 때는 한 프레임이라도 밀리면 눈에 띈다
  };

  const endDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el || !drag.current) return;
    drag.current = null;
    el.style.scrollSnapType = ""; // 클래스(snap-mandatory)로 되돌린다
    if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId);
    snapToNearest();
  };

  const handleScroll = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    paint();
    const i = Math.max(0, Math.min(column.items.length - 1, Math.round(el.scrollTop / ROW)));
    setActive(i);
    if (settle.current) clearTimeout(settle.current);
    // 스냅이 끝난 뒤에 확정한다. 스크롤 도중에 onChange 를 쏘면 지나가는 값마다 상위 상태가
    // 바뀌어 다른 칸(일수 등)이 스크롤 중에 다시 그려진다.
    settle.current = setTimeout(() => {
      settle.current = null;
      const item = column.items[i];
      if (item && item.value !== value) onChange(item.value);
    }, 120);
  }, [column.items, onChange, paint, value]);

  useEffect(() => () => { if (settle.current) clearTimeout(settle.current); }, []);

  return (
    // `relative` 가 필요하다 — 강조 띠가 absolute 라, 칸이 in-flow(비위치) 상태면 띠가 글자
    // **위에** 그려져서 선택된 줄만 보이지 않는다.
    <div className="relative min-w-0 flex-1">
      <div
        ref={ref}
        onScroll={handleScroll}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        // 스크롤바는 숨긴다(globals.css 의 .no-scrollbar) — 휠 칸에 막대가 보이면 목록처럼 읽힌다.
        className="no-scrollbar w-full cursor-grab select-none snap-y snap-mandatory overflow-y-auto overscroll-contain active:cursor-grabbing"
        // scroll-padding 을 주면 안 된다. 스냅 기준선이 그만큼 밀려서 `scrollTop / 칸높이` 와
        // 어긋나고, 항목이 두 개뿐인 칸(오전/오후)에서는 둘이 **같은 지점에 스냅**돼 아래 것을
        // 고를 수가 없었다(2026-09-25 실측: 오후로 굴려도 scrollTop 이 0 으로 돌아왔다).
        style={{ height: VISIBLE * ROW, scrollbarWidth: "none" }}
      >
        <div ref={listRef} style={{ paddingTop: PAD, paddingBottom: PAD }}>
          {column.items.map((item, i) => {
            const distance = Math.abs(i - active);
            return (
              <div
                key={item.value}
                className={`flex snap-center items-center justify-center text-lg tabular-nums transition-colors ${
                  distance === 0
                    ? "font-bold text-bold-text"
                    : distance === 1
                      ? "font-semibold text-placeholder"
                      : "font-semibold text-icon-muted"
                }`}
                style={{ height: ROW, backfaceVisibility: "hidden" }}
              >
                {item.label}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/**
 * 휠 한 벌을 담은 모달. 세 칸(년/월/일) 이든 두세 칸(오전·오후/시/분) 이든 같은 껍데기다.
 *
 * 값은 안에서만 굴러다니다가 "설정하기" 를 눌러야 밖으로 나간다 — 굴리는 도중의 값이 바로
 * 반영되면 취소할 방법이 없다.
 */
export default function WheelPicker({
  title,
  columns,
  value,
  onConfirm,
  onClose,
  emptyMessage,
}: {
  title: string;
  /** 지금 굴려 놓은 값을 받아 칸을 만든다. **함수여야 한다** — 2월로 옮기면 일 칸이 그 자리에서
   *  28 일까지로 줄어야 하는데, 칸을 밖에서 미리 만들어 넘기면 모달을 닫기 전까지 옛 달 기준의
   *  목록이 그대로 남는다(2026-09-25: 1월 31일에서 2월로 옮겨도 31 일이 계속 보였고, 확정할 때
   *  조용히 28 일로 바뀌었다). */
  columns: (draft: Record<string, string>) => WheelColumn[];
  value: Record<string, string>;
  onConfirm: (next: Record<string, string>) => void;
  onClose: () => void;
  /** 고를 것이 없는 칸이 생겼을 때 그 자리에 대신 보여 줄 한 줄. 없으면 버튼만 잠긴다. */
  emptyMessage?: string;
}) {
  const [draft, setDraft] = useState(value);
  const cols = columns(draft);

  /** 앞 칸이 바뀌어 뒤 칸의 목록이 짧아졌을 때(2월인데 31일이 남아 있는 등) 마지막 값으로
   *  당겨 읽는다. 상태를 고쳐 쓰지 않고 **읽을 때** 보정한다 — effect 로 되돌리면 렌더가 한 번
   *  더 돌고, 그 사이 한 프레임 동안 없는 값이 화면에 남는다. */
  const valueFor = (col: WheelColumn) => {
    const current = draft[col.key];
    if (col.items.some((it) => it.value === current)) return current;
    return col.items[col.items.length - 1]?.value ?? "";
  };

  /** 화면에 보이는 그대로를 내보낸다 — 보정한 값이 아니라 draft 를 넘기면 사용자가 "28 일"을
   *  보고 눌렀는데 "31 일"이 나간다. */
  const confirmed = () => Object.fromEntries(cols.map((col) => [col.key, valueFor(col)]));

  /** 고를 것이 하나도 없는 칸이 있으면 만들 수 있는 값이 없다 — 윤달이 없는 해를 "음력(윤달)"로
   *  고른 경우다. 연 칸은 살아 있으니 윤달이 있는 해로 굴리면 월 칸이 다시 채워진다. */
  const empty = cols.some((col) => col.items.length === 0);

  return (
    <div
      data-modal-overlay="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[380px] rounded-[28px] border border-border bg-topbar px-4 pb-6 pt-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative flex h-[46px] items-center justify-center">
          <p className="text-center text-lg font-bold text-bold-text">{title}</p>
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="absolute right-[11px] text-icon-muted"
          >
            <CloseIcon className="h-[22px] w-[22px]" />
          </button>
        </div>

        {/* 칸 이름은 굴림판 **밖**에 둔다. 안에 넣으면 강조 띠의 "가운데"가 라벨 높이만큼
            어긋나서 선택된 줄에 안 맞는다. */}
        <div className="mt-6 flex h-6 gap-2">
          {cols.map((col) => (
            <span key={col.key} className="min-w-0 flex-1 text-center text-base font-bold text-bold-text">
              {col.label || " "}
            </span>
          ))}
        </div>

        <div className="relative mt-3 flex gap-2">
          {/* 가운데 강조 띠. 칸마다 그리지 않고 뒤에 한 줄로 깔아야 칸 사이 간격까지 이어진다. */}
          <div
            className="pointer-events-none absolute inset-x-0 top-1/2 h-7 -translate-y-1/2 rounded-xl bg-chip-soft"
            aria-hidden="true"
          />
          {cols.map((col) => (
            <Column
              key={col.key}
              column={col}
              value={valueFor(col)}
              onChange={(v) => setDraft((prev) => ({ ...prev, [col.key]: v }))}
            />
          ))}
        </div>

        {empty && emptyMessage && (
          <p className="mt-3 text-center text-sm font-semibold text-urgent">{emptyMessage}</p>
        )}

        <button
          type="button"
          onClick={() => onConfirm(confirmed())}
          disabled={empty}
          className="mt-7 h-12 w-full rounded-full bg-point text-base font-bold text-white disabled:bg-chip-fill disabled:text-chip-muted-text disabled:opacity-60"
        >
          설정하기
        </button>
      </div>
    </div>
  );
}
