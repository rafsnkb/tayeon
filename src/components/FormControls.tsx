"use client";

import { useState } from "react";
import WheelPicker, { type WheelColumn } from "@/components/WheelPicker";
import { QuestionCircleIcon } from "@/app/(app)/tarot/icons";
import { BIRTH_YEAR_MIN, dayCount, monthChoices, toBirthDate } from "@/lib/tarot/birthWheel";
import type { CalendarMode } from "@/lib/tarot/birthInfo";

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

/** "태어난 시간" 아래 안내문. 목업(MyProfile_*)이 원형 물음표를 앞에 둔다. 같은 문장이 가입·
 *  내 프로필·궁합 세 곳에 복사돼 있었다. */
export function BirthTimeNotice() {
  return (
    <p className="flex items-center gap-1.5 pt-1 text-sm font-semibold text-urgent">
      <QuestionCircleIcon className="h-4 w-4 shrink-0" />
      태어난 시간을 모르면 자미두수 기능을 사용할 수 없어요
    </p>
  );
}

const pad = (n: number) => String(n).padStart(2, "0");
const range = (from: number, to: number) =>
  Array.from({ length: to - from + 1 }, (_, i) => from + i);
const numbered = (values: number[]) => values.map((n) => ({ value: pad(n), label: pad(n) }));

/**
 * 생년월일 휠. 값은 `YYYY-MM-DD` 문자열 그대로 주고받는다 — 서버(`BirthInfo`)와 사주·자미두수
 * 계산이 그 형식을 전제하고 있어서 여기서 모양을 바꾸면 안 된다.
 */
export function BirthDateField({
  value,
  onChange,
  required,
  calendarMode = "solar",
}: {
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  /** 음력이면 달마다 29/30일이고, 윤달은 있는 달이 정해져 있다. 양력 일수를 쓰면 없는 날짜가
   *  저장된다(계산은 src/lib/tarot/birthWheel.ts, 음력 표는 manseryeok 이 들고 있다). */
  calendarMode?: CalendarMode;
}) {
  const [open, setOpen] = useState(false);
  const thisYear = new Date().getFullYear();
  const [y, m, d] = value ? value.split("-") : ["", "", ""];
  const draft = {
    year: y || String(thisYear - 30),
    month: m || "01",
    day: d || "01",
  };

  /** 칸은 **굴려 놓은 값 기준**으로 만든다. 모달을 연 시점의 값으로 미리 만들면 모달 안에서
   *  달을 옮겨도 일 칸이 따라오지 않는다(1월 31일 → 2월인데 31일이 그대로 남는다). */
  const columns = (current: Record<string, string>): WheelColumn[] => {
    const year = Number(current.year);
    const month = Number(current.month);
    return [
      { key: "year", label: "년", items: range(BIRTH_YEAR_MIN, thisYear).map((n) => ({ value: String(n), label: String(n) })) },
      { key: "month", label: "월", items: numbered(monthChoices(year, calendarMode)) },
      { key: "day", label: "일", items: numbered(range(1, dayCount(year, month, calendarMode))) },
    ];
  };

  return (
    <>
      <FieldLabel required={required}>생년월일</FieldLabel>
      <WheelField text={value ? value.replaceAll("-", ".") : ""} placeholder="YYYY.MM.DD" onClick={() => setOpen(true)} />
      {open && (
        <WheelPicker
          title="생년월일 입력"
          columns={columns}
          value={draft}
          emptyMessage="그 해에는 윤달이 없어요. 연도를 바꾸거나 '음력'을 선택해주세요."
          onClose={() => setOpen(false)}
          onConfirm={(next) => {
            const date = toBirthDate(Number(next.year), Number(next.month), Number(next.day), calendarMode);
            if (date) onChange(date);
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
  // 시간 칸은 서로 영향을 주지 않는다(몇 시든 분은 0~59). 그래도 WheelPicker 가 칸을 값에서
  // 만들기 때문에 모양은 함수로 맞춘다.
  const columns = (): WheelColumn[] => [
    { key: "meridiem", label: "", items: [{ value: "am", label: "오전" }, { value: "pm", label: "오후" }] },
    { key: "hour", label: "시", items: numbered(range(1, 12)) },
    { key: "minute", label: "분", items: numbered(range(0, 59)) },
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
