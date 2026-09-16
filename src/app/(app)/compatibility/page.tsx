"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { auth } from "@/lib/firebase/client";
import SubPageTopBar from "@/components/SubPageTopBar";
import ConfirmModal from "@/components/ConfirmModal";

type Partner = {
  nickname: string;
  birthDate: string | null;
  birthTime: string | null;
  gender: "male" | "female" | "unspecified";
  calendarType: "solar" | "lunar";
  isLeapMonth?: boolean;
  birthPlace?: string | null;
};

type CalendarMode = "solar" | "lunar" | "lunarLeap";

function toCalendarMode(calendarType: Partner["calendarType"], isLeapMonth?: boolean): CalendarMode {
  if (calendarType === "solar") return "solar";
  return isLeapMonth ? "lunarLeap" : "lunar";
}

function ToggleGroup<T extends string>({
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
              ? "bg-point text-white dark:border dark:border-point/50 dark:bg-point-bg dark:text-point"
              : "bg-chip-fill text-white"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <span className="text-sm font-semibold text-icon-muted">{children}</span>;
}

/** 피그마 "Screen / PartnerProfile" — MyProfile과 거의 같은 레이아웃이지만 전부 선택 입력.
 * 기존엔 저장 후 "보기 모드"로 바뀌는 UI였는데, 피그마는 항상 폼을 보여주고 기존 값으로
 * 미리 채워두는 방식이라 그에 맞춰 단순화함. 피그마엔 "삭제하기" 버튼도 있었지만 사용자
 * 요청으로 제거함(2026-09-15). */
export default function CompatibilityPage() {
  const [user, setUser] = useState<User | null>(null);
  const [nickname, setNickname] = useState("");
  const [calendarMode, setCalendarMode] = useState<CalendarMode>("solar");
  const [birthDate, setBirthDate] = useState("");
  const [birthTime, setBirthTime] = useState("");
  const [timeUnknown, setTimeUnknown] = useState(false);
  const [gender, setGender] = useState<Partner["gender"]>("unspecified");
  const [birthPlace, setBirthPlace] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);
  const [resetting, setResetting] = useState(false);

  useEffect(() => {
    return onAuthStateChanged(auth, async (u) => {
      if (!u) return;
      setUser(u);
      const idToken = await u.getIdToken();
      const res = await fetch("/api/user/partner", {
        headers: { Authorization: `Bearer ${idToken}` },
      });
      if (res.ok) {
        const data = await res.json();
        const partner = data.partner as Partner | null;
        if (partner) {
          setNickname(partner.nickname);
          setCalendarMode(toCalendarMode(partner.calendarType, partner.isLeapMonth));
          setBirthDate(partner.birthDate ?? "");
          setBirthTime(partner.birthTime ?? "");
          setTimeUnknown(!partner.birthTime);
          setGender(partner.gender);
          setBirthPlace(partner.birthPlace ?? "");
        }
      }
    });
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !nickname.trim() || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const idToken = await user.getIdToken();
      const res = await fetch("/api/user/partner", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({
          nickname: nickname.trim(),
          calendarType: calendarMode === "solar" ? "solar" : "lunar",
          isLeapMonth: calendarMode === "lunarLeap",
          birthDate: birthDate || null,
          birthTime: timeUnknown ? null : birthTime || null,
          gender,
          birthPlace,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "저장에 실패했어요.");
        return;
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function handleReset() {
    if (!user || resetting) return;
    setResetting(true);
    try {
      const idToken = await user.getIdToken();
      await fetch("/api/user/partner", {
        method: "DELETE",
        headers: { Authorization: `Bearer ${idToken}` },
      });
      setNickname("");
      setBirthDate("");
      setBirthTime("");
      setTimeUnknown(false);
      setGender("unspecified");
      setCalendarMode("solar");
      setBirthPlace("");
      setResetConfirmOpen(false);
    } finally {
      setResetting(false);
    }
  }

  return (
    <form onSubmit={handleSave} className="flex h-full flex-col overflow-hidden bg-bg">
      <SubPageTopBar title="궁합 상대 프로필 관리" />
      <div className="flex-1 overflow-y-auto p-4">
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 rounded-[32px] border border-border bg-topbar p-4">
          <label className="flex flex-col gap-1">
            <FieldLabel>궁합 상대 닉네임 (변경 가능)</FieldLabel>
            <input
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="상대방을 뭐라고 부를까요?"
              className="h-12 rounded-2xl border border-border bg-bg px-3 text-lg font-semibold text-bold-text outline-none placeholder-placeholder"
            />
          </label>

          <div className="flex flex-col gap-1">
            <FieldLabel>생년월일</FieldLabel>
            <input
              type="date"
              value={birthDate}
              onChange={(e) => setBirthDate(e.target.value)}
              className="h-12 rounded-2xl border border-border bg-bg px-3 text-lg font-semibold text-bold-text outline-none"
            />
            <ToggleGroup
              options={[
                { value: "solar" as const, label: "양력" },
                { value: "lunar" as const, label: "음력" },
                { value: "lunarLeap" as const, label: "음력(윤달)" },
              ]}
              value={calendarMode}
              onChange={setCalendarMode}
            />
          </div>

          <div className="flex flex-col gap-1">
            <FieldLabel>태어난 시간</FieldLabel>
            <input
              type="time"
              value={birthTime}
              onChange={(e) => setBirthTime(e.target.value)}
              disabled={timeUnknown}
              className="h-12 rounded-2xl border border-border bg-bg px-3 text-lg font-semibold text-bold-text outline-none disabled:opacity-40"
            />
            <label className="flex items-center gap-2 pt-2 text-sm text-icon-muted">
              <input
                type="checkbox"
                checked={timeUnknown}
                onChange={(e) => setTimeUnknown(e.target.checked)}
              />
              태어난 시간을 몰라요
            </label>
            <p className="pt-1 text-sm font-semibold text-urgent">
              태어난 시간을 모르면 자미두수 기능을 사용할 수 없어요
            </p>
          </div>

          <div className="flex flex-col gap-1">
            <FieldLabel>성별</FieldLabel>
            <ToggleGroup
              options={[
                { value: "female" as const, label: "여성" },
                { value: "male" as const, label: "남성" },
                { value: "unspecified" as const, label: "선택안함" },
              ]}
              value={gender}
              onChange={setGender}
            />
          </div>

          <label className="flex flex-col gap-1">
            <FieldLabel>출생지 (선택)</FieldLabel>
            <input
              value={birthPlace}
              onChange={(e) => setBirthPlace(e.target.value)}
              placeholder="태어난 도시를 알려주세요"
              className="h-12 rounded-2xl border border-border bg-bg px-3 text-lg font-semibold text-bold-text outline-none placeholder-placeholder"
            />
            <span className="pt-1 text-xs font-semibold text-icon-muted">
              출생지를 입력하면 사주ㆍ자미두수 분석 정확도가 올라가요
            </span>
          </label>

          {error && <p className="text-sm text-urgent">{error}</p>}
        </div>
      </div>
      <div className="shrink-0 border-t border-border bg-topbar p-4">
        <div className="mx-auto flex w-full max-w-2xl gap-2">
          <button
            type="button"
            onClick={() => setResetConfirmOpen(true)}
            className="h-12 flex-1 rounded-2xl bg-urgent text-lg font-semibold text-white"
          >
            초기화
          </button>
          <button
            type="submit"
            disabled={!nickname.trim() || submitting}
            className={`h-12 flex-[2] rounded-2xl text-lg font-semibold ${
              nickname.trim() ? "bg-point text-white" : "bg-chip-fill text-placeholder"
            } disabled:opacity-60`}
          >
            저장하기
          </button>
        </div>
      </div>
      {resetConfirmOpen && (
        <ConfirmModal
          title="상대 프로필 초기화"
          description="상대 프로필이 모두 지워집니다."
          confirmLabel="초기화"
          busy={resetting}
          onConfirm={handleReset}
          onClose={() => setResetConfirmOpen(false)}
        />
      )}
    </form>
  );
}
