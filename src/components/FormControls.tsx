"use client";

import { useState } from "react";
import WheelPicker, { type WheelColumn } from "@/components/WheelPicker";

/* 생년월일시 입력 폼이 쓰는 작은 컨트롤들. 가입(`/signup`)·내 정보(`/me/profile`)·
 * 궁합(`/compatibility`) 세 화면이 거의 같은 폼을 그리는데, 이것들이 **세 곳에 각자 복사**돼
 * 있었다(2026-09-24 정리). */

export function FieldLabel({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <span className="text-sm font-semibold text-icon-muted">
      {children}
      {required && <span className="text-urgent">*</span>}
    </span>
  );
}

/** 가로로 꽉 채운 라디오 묶음(양력/음력/윤달, 성별 등).
 *
 *  `value` 는 `T` 다 — 복사본 중 `/me/profile` 것만 `value: string` 으로 느슨해져 있어서,
 *  options 에 없는 값을 넘겨도 타입 검사가 잡지 못했다(그러면 아무 버튼도 선택되지 않는다). */
export function ToggleGroup<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex gap-2 pt-2">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={`h-12 flex-1 rounded-2xl text-lg font-semibold ${
            value === opt.value
              ? "border border-point-strong bg-point text-white"
              : // 고르지 않은 쪽은 연한 면이다(목업 MyProfile_*, 2026-09-25 실측: 라이트
                // #e7e2e1 = --chip-soft 정확히 일치). 예전엔 --chip-fill(라이트에서 진한
                // 회색) 위에 흰 글자라, 밝은 카드 위에 검은 버튼이 얹힌 꼴이었다.
                "bg-chip-soft text-chip-soft-text"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

/** 폼 안에서 휠을 여는 칸. 값이 없으면 자리표시 글자를 흐리게 보여준다(기본 input 과 같은 모양). */
function WheelField({
  text,
  placeholder,
  disabled,
  onClick,
}: {
  text: string;
  placeholder: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="h-12 rounded-2xl border border-border bg-bg px-3 text-left text-lg font-semibold text-bold-text disabled:opacity-40"
    >
      {text || <span className="text-placeholder">{placeholder}</span>}
    </button>
  );
}

const pad = (n: number) => String(n).padStart(2, "0");
const range = (from: number, to: number) =>
  Array.from({ length: to - from + 1 }, (_, i) => from + i);

/** 그 해 그 달의 날 수. 31일이 없는 달로 옮겼을 때 31일이 남아 있으면 안 된다. */
function daysInMonth(year: number, month: number) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/**
 * 생년월일 휠. 값은 `YYYY-MM-DD` 문자열 그대로 주고받는다 — 서버(`BirthInfo`)와 사주·자미두수
 * 계산이 그 형식을 전제하고 있어서 여기서 모양을 바꾸면 안 된다.
 */
export function BirthDateField({
  value,
  onChange,
  required,
}: {
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const thisYear = new Date().getFullYear();
  const [y, m, d] = value ? value.split("-") : ["", "", ""];
  const draft = {
    year: y || String(thisYear - 30),
    month: m || "01",
    day: d || "01",
  };
  const columns: WheelColumn[] = [
    { key: "year", label: "년", items: range(1930, thisYear).map((n) => ({ value: String(n), label: String(n) })) },
    { key: "month", label: "월", items: range(1, 12).map((n) => ({ value: pad(n), label: pad(n) })) },
    {
      key: "day",
      label: "일",
      items: range(1, daysInMonth(Number(draft.year), Number(draft.month))).map((n) => ({ value: pad(n), label: pad(n) })),
    },
  ];

  return (
    <>
      <FieldLabel required={required}>생년월일</FieldLabel>
      <WheelField text={value ? value.replaceAll("-", ".") : ""} placeholder="YYYY.MM.DD" onClick={() => setOpen(true)} />
      {open && (
        <WheelPicker
          title="생년월일 입력"
          columns={columns}
          value={draft}
          onClose={() => setOpen(false)}
          onConfirm={(next) => {
            // 고른 달의 날 수를 넘으면 마지막 날로 당긴다(2월 31일 같은 값이 저장되지 않도록).
            const last = daysInMonth(Number(next.year), Number(next.month));
            const day = Math.min(Number(next.day), last);
            onChange(`${next.year}-${next.month}-${pad(day)}`);
            setOpen(false);
          }}
        />
      )}
    </>
  );
}

/**
 * 태어난 시간 휠. 목업이 24시간이 아니라 **오전/오후 + 12시제**라 안팎에서 형식을 바꾼다 —
 * 저장 형식은 계속 `HH:mm`(24시간)이다.
 */
export function BirthTimeField({
  value,
  onChange,
  disabled,
  label = "태어난 시간",
}: {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  /** 가입 화면만 "태어난 시간 (선택)" 이다. */
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const [hh, mm] = value ? value.split(":") : ["", ""];
  const hour24 = value ? Number(hh) : 0;
  const draft = {
    // 0시는 "오전 12시", 12시는 "오후 12시"다 — 12시제의 두 경계.
    meridiem: hour24 < 12 ? "am" : "pm",
    hour: pad(hour24 % 12 === 0 ? 12 : hour24 % 12),
    minute: value ? mm : "00",
  };
  const columns: WheelColumn[] = [
    { key: "meridiem", label: "", items: [{ value: "am", label: "오전" }, { value: "pm", label: "오후" }] },
    { key: "hour", label: "시", items: range(1, 12).map((n) => ({ value: pad(n), label: pad(n) })) },
    { key: "minute", label: "분", items: range(0, 59).map((n) => ({ value: pad(n), label: pad(n) })) },
  ];

  return (
    <>
      <FieldLabel>{label}</FieldLabel>
      <WheelField
        text={value ? `${draft.meridiem === "am" ? "오전" : "오후"} ${draft.hour}:${draft.minute}` : ""}
        placeholder="00:00"
        disabled={disabled}
        onClick={() => setOpen(true)}
      />
      {open && (
        <WheelPicker
          title="태어난 시간 입력"
          columns={columns}
          value={draft}
          onClose={() => setOpen(false)}
          onConfirm={(next) => {
            const h12 = Number(next.hour) % 12;
            const h24 = next.meridiem === "pm" ? h12 + 12 : h12;
            onChange(`${pad(h24)}:${next.minute}`);
            setOpen(false);
          }}
        />
      )}
    </>
  );
}
