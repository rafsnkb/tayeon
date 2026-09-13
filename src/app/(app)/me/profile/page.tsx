"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { auth } from "@/lib/firebase/client";
import type { BirthInfo, JasiRule } from "@/lib/tarot/birthInfo";
import SubPageTopBar from "@/components/SubPageTopBar";

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
              ? "bg-point-bg border border-point/50 text-point"
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

/** 피그마 "Screen / MyProfile" — 기존 /me에 있던 생년월일시 폼을 그대로 가져오되(백엔드 데이터
 * 구조는 안 바꿈 — 음력 윤달/출생지는 BirthInfo 타입에 없어서 이번 패스에선 뺌), 닉네임 수정만
 * 새로 추가함(피그마엔 있는데 기존엔 가입 후 수정할 방법이 없었음 — /api/user/birth-info가
 * 선택적 nickname도 같이 받도록 확장). */
export default function MyProfilePage() {
  const [user, setUser] = useState<User | null>(null);
  const [nickname, setNickname] = useState("");
  const [calendarType, setCalendarType] = useState<BirthInfo["calendarType"]>("solar");
  const [birthDate, setBirthDate] = useState("");
  const [birthTime, setBirthTime] = useState("");
  const [timeUnknown, setTimeUnknown] = useState(false);
  const [jasiRule, setJasiRule] = useState<JasiRule>("midnight");
  const [useTrueSolarTime, setUseTrueSolarTime] = useState(false);
  const [gender, setGender] = useState<BirthInfo["gender"] | "">("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    return onAuthStateChanged(auth, async (u) => {
      if (!u) return;
      setUser(u);
      const idToken = await u.getIdToken();
      const res = await fetch("/api/user/me", { headers: { Authorization: `Bearer ${idToken}` } });
      if (res.ok) {
        const data = await res.json();
        setNickname(data.nickname ?? "");
        const info = data.birthInfo as BirthInfo | null;
        if (info) {
          setCalendarType(info.calendarType);
          setBirthDate(info.birthDate ?? "");
          setBirthTime(info.birthTime ?? "");
          setTimeUnknown(info.timeUnknown);
          setJasiRule(info.jasiRule);
          setUseTrueSolarTime(Boolean(info.useTrueSolarTime));
          setGender(info.gender);
        }
      }
    });
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!user || saving || !gender) return;
    setSaving(true);
    setError(null);
    try {
      const idToken = await user.getIdToken();
      const res = await fetch("/api/user/birth-info", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({
          nickname,
          calendarType,
          birthDate,
          birthTime,
          timeUnknown,
          jasiRule,
          useTrueSolarTime,
          gender,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "저장에 실패했어요.");
      }
    } finally {
      setSaving(false);
    }
  }

  const canSave = Boolean(gender && birthDate && nickname.trim());

  return (
    <form onSubmit={handleSave} className="flex h-full flex-col overflow-hidden bg-bg">
      <SubPageTopBar title="내 프로필 관리" />
      <div className="flex-1 overflow-y-auto p-4">
        <div className="flex flex-col gap-4 rounded-[32px] border border-border bg-topbar p-4">
          <label className="flex flex-col gap-1">
            <FieldLabel>닉네임 (변경 가능)</FieldLabel>
            <input
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="당신을 뭐라고 부를까요?"
              className="h-12 rounded-2xl border border-border bg-bg px-3 text-lg font-semibold text-white outline-none placeholder-placeholder"
            />
          </label>

          <div className="flex flex-col gap-1">
            <FieldLabel>생년월일</FieldLabel>
            <input
              type="date"
              value={birthDate}
              onChange={(e) => setBirthDate(e.target.value)}
              className="h-12 rounded-2xl border border-border bg-bg px-3 text-lg font-semibold text-white outline-none"
            />
            <ToggleGroup
              options={[
                { value: "solar", label: "양력" },
                { value: "lunar", label: "음력" },
              ]}
              value={calendarType}
              onChange={setCalendarType}
            />
          </div>

          <div className="flex flex-col gap-1">
            <FieldLabel>태어난 시간</FieldLabel>
            <input
              type="time"
              value={birthTime}
              onChange={(e) => setBirthTime(e.target.value)}
              disabled={timeUnknown}
              className="h-12 rounded-2xl border border-border bg-bg px-3 text-lg font-semibold text-white outline-none disabled:opacity-40"
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
                { value: "female", label: "여성" },
                { value: "male", label: "남성" },
              ]}
              value={gender || "female"}
              onChange={setGender}
            />
          </div>

          {error && <p className="text-sm text-urgent">{error}</p>}
        </div>
      </div>
      <div className="shrink-0 border-t border-border bg-topbar p-4">
        <button
          type="submit"
          disabled={!canSave || saving}
          className={`h-12 w-full rounded-2xl text-lg font-semibold ${
            canSave ? "bg-point text-white" : "bg-chip-fill text-placeholder"
          } disabled:opacity-60`}
        >
          저장하기
        </button>
      </div>
    </form>
  );
}
