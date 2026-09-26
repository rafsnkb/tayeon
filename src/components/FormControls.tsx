"use client";

import { useState } from "react";
import WheelPicker, { type WheelColumn } from "@/components/WheelPicker";
import { SearchIcon } from "@/app/(app)/tarot/icons";
import ModalShell, { ModalButton } from "@/components/ModalShell";
import { BIRTH_YEAR_MIN, dayCount, monthChoices, toBirthDate } from "@/lib/tarot/birthWheel";
import type { CalendarMode } from "@/lib/tarot/birthInfo";
import { SlidingSegments } from "@/components/SlidingSegments";

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
  const selected = options.findIndex((opt) => opt.value === value);

  return (
    <div className="pt-2">
      {/* 트랙이 없는 세그먼트다 — 칸이 `gap-2` 로 벌어져 있어서, 알약은 그 **간격을 건너뛰며**
          미끄러진다(`SlidingSegments` 가 gap 을 계산에 넣는다). 고르지 않은 칸은 연한 면을
          그대로 깔아 두고(목업 MyProfile_*, 라이트 #e7e2e1 = --chip-soft 정확히 일치) 그 위로
          알약이 지나간다. 예전엔 --chip-fill(라이트에서 진한 회색) 위에 흰 글자라, 밝은 카드
          위에 검은 버튼이 얹힌 꼴이었다. */}
      <SlidingSegments
        count={options.length}
        index={selected}
        gap={8}
        className="flex gap-2"
        indicatorClassName="rounded-2xl border border-point-strong bg-point"
      >
        {options.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            // 선택된 칸에 배경을 주지 않는다 — 알약이 뒤에 깔려 있어서 배경을 칠하면 그걸 가린다.
            // `relative` 는 알약(absolute) 위로 글자를 올리기 위한 것이다.
            className={`relative h-12 flex-1 rounded-2xl text-lg font-semibold transition-colors motion-reduce:transition-none ${
              value === opt.value ? "text-white" : "bg-chip-soft text-chip-soft-text"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </SlidingSegments>
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

/** 경고 옆 돋보기를 눌렀을 때 뜨는 설명(목업 `asset/Screen/ZeweiTimeInfo.png`).
 *
 *  **왜** 시간이 필요한지가 없으면 그 경고는 "안 됩니다"로만 읽힌다 — 시간을 모르는 사람이
 *  아무 값이나 찍어 넣는 것보다, 왜 필요한지 알고 확인해 오는 쪽이 낫다.
 *
 *  목업은 구버전 디자인이라(사용자 확인) 색은 지금 토큰으로 옮겼다. 실측한 것은 **관계**다:
 *  모달 면 #19191d 위에 본문이 한 단 밝은 박스 #2a2c31 로 얹혀 있고, 본문은 muted(#868b9a)
 *  에 강조만 흰색이다. 이 "면 위의 한 단 밝은 박스"는 스프레드 시트의 안쪽 패널과 같은 관계라
 *  같은 토큰 짝(bg-bg / dark:bg-chip-fill)을 쓴다.
 *
 *  목업에는 하단 버튼이 없지만 여기서는 둔다 — 알림형 모달을 ModalForm 한 폼으로 통일한
 *  결정(2026-09-25)이 더 뒤에 내려졌고, 버튼 없는 모달만 혼자 다른 모양이 된다. */
function BirthTimeWhyModal({ onClose }: { onClose: () => void }) {
  return (
    <ModalShell
      title="자미두수에 태어난 시간이 꼭 필요한 이유"
      onClose={onClose}
      footer={<ModalButton onClick={onClose}>확인</ModalButton>}
    >
      <div className="flex flex-col gap-4 rounded-2xl bg-bg p-4 text-left text-icon-muted dark:bg-chip-fill">
        <p>
          태어난 월과 <b className="text-bold-text">[시간]</b>을 조합해야 내 운명의 중심인{" "}
          <b className="text-bold-text">[명궁]</b>의 위치가 정해져요.
        </p>
        <p>
          태어난 시간이 2시간만 달라져도 명궁의 위치가 바뀌고, 그러면 다른 별의 배치까지 완전히
          바뀌어 <b className="text-bold-text">전혀 다른 사람의 운명표</b>가 되어버립니다.
        </p>
        <p>
          결론적으로 태어난 시간은 내 운명의 지도를 그리기 위한{" "}
          <b className="text-bold-text">&apos;시작점의 정확한 좌표&apos;</b> 역할을 해요.
        </p>
        <p>
          좌표가 없거나 틀리면 지도를 아예 펼칠 수 없거나 남의 지도를 읽게 되기 때문에{" "}
          <b className="text-bold-text">시간이 반드시 필요합니다.</b>
        </p>
      </div>
    </ModalShell>
  );
}

/** "태어난 시간" 아래 안내문. 같은 문장이 가입·내 프로필·궁합 세 곳에 복사돼 있었다. */
export function BirthTimeNotice() {
  const [whyOpen, setWhyOpen] = useState(false);
  return (
    // 예전엔 `?` 아이콘이 <p> 안의 **장식**이었다(2026-09-25 휠 커밋에서 들어옴). 물음표
    // 동그라미는 누르면 설명이 나오는 표시라, 눌러 본 사용자가 아무 반응 없는 것을 버그로
    // 겪었다(2026-09-26 리포트). 실제 버튼으로 만들고 모양은 마이페이지의 "자세히 보기"
    // 돋보기 알약과 맞췄다(사용자 지시) — 같은 뜻의 조작이 같은 모양이어야 한다.
    //
    // 모달은 반드시 이 <p> **밖**이다. 안에 넣었더니 모달 본문의 <p> 가 중첩돼
    // "`<p>` cannot be a descendant of `<p>`" 하이드레이션 에러가 났다.
    <>
      <p className="flex items-center gap-1.5 pt-1 text-sm font-semibold text-urgent">
        <button
          type="button"
          onClick={() => setWhyOpen(true)}
          aria-label="자미두수에 태어난 시간이 꼭 필요한 이유 보기"
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-chip-soft text-chip-soft-text"
        >
          <SearchIcon className="h-3 w-3" />
        </button>
        태어난 시간을 모르면 자미두수 기능을 사용할 수 없어요
      </p>
      {whyOpen && <BirthTimeWhyModal onClose={() => setWhyOpen(false)} />}
    </>
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
  label = "생년월일",
}: {
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  /** 음력이면 달마다 29/30일이고, 윤달은 있는 달이 정해져 있다. 양력 일수를 쓰면 없는 날짜가
   *  저장된다(계산은 src/lib/tarot/birthWheel.ts, 음력 표는 manseryeok 이 들고 있다). */
  calendarMode?: CalendarMode;
  /** 유료 운세 구매 화면만 "상대방 생년월일" 이다 — 그 화면은 내 정보와 상대 정보가 한
   *  카드 안에 있어서 누구 것인지 라벨이 말해 줘야 한다. `BirthTimeField` 와 같은 장치다. */
  label?: string;
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
      <FieldLabel required={required}>{label}</FieldLabel>
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
