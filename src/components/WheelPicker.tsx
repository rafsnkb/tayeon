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
  const index = Math.max(0, column.items.findIndex((it) => it.value === value));
  const [active, setActive] = useState(index);
  const settle = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 바깥에서 값이 바뀌면(달이 바뀌어 일수가 줄어드는 등) 그 자리로 옮겨 놓는다.
  // 스크롤 중에는 건드리지 않는다 — 사용자가 굴리는 중에 되돌아가면 안 된다.
  useEffect(() => {
    const el = ref.current;
    if (!el || settle.current) return;
    el.scrollTop = index * ROW;
    setActive(index);
  }, [index]);

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
  }, [column.items, onChange, value]);

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
        <div style={{ paddingTop: PAD, paddingBottom: PAD }}>
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
                      : "font-semibold text-icon-muted opacity-50"
                }`}
                style={{ height: ROW }}
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
}: {
  title: string;
  columns: WheelColumn[];
  value: Record<string, string>;
  onConfirm: (next: Record<string, string>) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState(value);

  /** 앞 칸이 바뀌어 뒤 칸의 목록이 짧아졌을 때(2월인데 31일이 남아 있는 등) 마지막 값으로
   *  당겨 읽는다. 상태를 고쳐 쓰지 않고 **읽을 때** 보정한다 — effect 로 되돌리면 렌더가 한 번
   *  더 돌고, 그 사이 한 프레임 동안 없는 값이 화면에 남는다. 확정값은 onConfirm 쪽에서 같은
   *  규칙으로 한 번 더 자른다. */
  const valueFor = (col: WheelColumn) => {
    const current = draft[col.key];
    if (col.items.some((it) => it.value === current)) return current;
    return col.items[col.items.length - 1]?.value ?? "";
  };

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
        <div className="flex h-[46px] items-center justify-between">
          <div className="w-5" />
          <p className="flex-1 text-center text-lg font-bold text-bold-text">{title}</p>
          <button type="button" onClick={onClose} aria-label="닫기" className="text-icon-muted">
            <CloseIcon className="h-5 w-5" />
          </button>
        </div>

        {/* 칸 이름은 굴림판 **밖**에 둔다. 안에 넣으면 강조 띠의 "가운데"가 라벨 높이만큼
            어긋나서 선택된 줄에 안 맞는다. */}
        <div className="mt-6 flex h-6 gap-2">
          {columns.map((col) => (
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
          {columns.map((col) => (
            <Column
              key={col.key}
              column={col}
              value={valueFor(col)}
              onChange={(v) => setDraft((prev) => ({ ...prev, [col.key]: v }))}
            />
          ))}
        </div>

        <button
          type="button"
          onClick={() => onConfirm(draft)}
          className="mt-7 h-12 w-full rounded-full bg-point text-base font-bold text-white"
        >
          설정하기
        </button>
      </div>
    </div>
  );
}
