"use client";

/* 생년월일시 입력 폼이 쓰는 작은 컨트롤 둘. 가입(`/signup`)·내 정보(`/me/profile`)·
 * 궁합(`/compatibility`) 세 화면이 거의 같은 폼을 그리는데, 이 둘이 **세 곳에 각자 복사**돼
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
              : "bg-chip-fill text-white"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
