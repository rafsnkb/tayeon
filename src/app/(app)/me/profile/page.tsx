"use client";

import { useEffect, useState } from "react";
import { FieldLabel, ToggleGroup } from "@/components/FormControls";
import { onAuthStateChanged, type User } from "firebase/auth";
import { auth } from "@/lib/firebase/client";
import { toCalendarMode, type BirthInfo, type CalendarMode, type JasiRule } from "@/lib/tarot/birthInfo";
import SubPageTopBar from "@/components/SubPageTopBar";
import InfoModal from "@/components/InfoModal";

type ProfileSnapshot = {
  nickname: string;
  calendarMode: CalendarMode;
  birthDate: string;
  birthTime: string;
  timeUnknown: boolean;
  jasiRule: JasiRule;
  useTrueSolarTime: boolean;
  gender: BirthInfo["gender"] | "";
  birthPlace: string;
};

/** 피그마 "Screen / MyProfile" — 기존 /me에 있던 생년월일시 폼을 그대로 가져오고, 닉네임 수정
 * (피그마엔 있는데 기존엔 가입 후 수정할 방법이 없었음), 음력 윤달/출생지/성별 "선택안함"까지
 * 전부 반영(2026-09-14 — BirthInfo 타입에 이 필드들을 추가하면서 같이 뚫음). */
export default function MyProfilePage() {
  const [user, setUser] = useState<User | null>(null);
  const [nickname, setNickname] = useState("");
  const [calendarMode, setCalendarMode] = useState<CalendarMode>("solar");
  const [birthDate, setBirthDate] = useState("");
  const [birthTime, setBirthTime] = useState("");
  const [timeUnknown, setTimeUnknown] = useState(false);
  const [jasiRule, setJasiRule] = useState<JasiRule>("midnight");
  const [useTrueSolarTime, setUseTrueSolarTime] = useState(false);
  const [gender, setGender] = useState<BirthInfo["gender"] | "">("");
  const [birthPlace, setBirthPlace] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedOpen, setSavedOpen] = useState(false);
  const [snapshot, setSnapshot] = useState<ProfileSnapshot>({
    nickname: "",
    calendarMode: "solar",
    birthDate: "",
    birthTime: "",
    timeUnknown: false,
    jasiRule: "midnight",
    useTrueSolarTime: false,
    gender: "",
    birthPlace: "",
  });

  useEffect(() => {
    return onAuthStateChanged(auth, async (u) => {
      if (!u) return;
      setUser(u);
      const idToken = await u.getIdToken();
      const res = await fetch("/api/user/me", { headers: { Authorization: `Bearer ${idToken}` } });
      if (res.ok) {
        const data = await res.json();
        const nextNickname = data.nickname ?? "";
        setNickname(nextNickname);
        const info = data.birthInfo as BirthInfo | null;
        if (info) {
          const loaded: ProfileSnapshot = {
            nickname: nextNickname,
            calendarMode: toCalendarMode(info.calendarType, info.isLeapMonth),
            birthDate: info.birthDate ?? "",
            birthTime: info.birthTime ?? "",
            timeUnknown: info.timeUnknown,
            jasiRule: info.jasiRule,
            useTrueSolarTime: Boolean(info.useTrueSolarTime),
            gender: info.gender,
            birthPlace: info.birthPlace ?? "",
          };
          setCalendarMode(loaded.calendarMode);
          setBirthDate(loaded.birthDate);
          setBirthTime(loaded.birthTime);
          setTimeUnknown(loaded.timeUnknown);
          setJasiRule(loaded.jasiRule);
          setUseTrueSolarTime(loaded.useTrueSolarTime);
          setGender(loaded.gender);
          setBirthPlace(loaded.birthPlace);
          setSnapshot(loaded);
        } else {
          setSnapshot((prev) => ({ ...prev, nickname: nextNickname }));
        }
      }
    });
  }, []);

  const isDirty =
    nickname !== snapshot.nickname ||
    calendarMode !== snapshot.calendarMode ||
    birthDate !== snapshot.birthDate ||
    birthTime !== snapshot.birthTime ||
    timeUnknown !== snapshot.timeUnknown ||
    jasiRule !== snapshot.jasiRule ||
    useTrueSolarTime !== snapshot.useTrueSolarTime ||
    gender !== snapshot.gender ||
    birthPlace !== snapshot.birthPlace;

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!user || saving || !gender || !isDirty) return;
    setSaving(true);
    setError(null);
    try {
      const idToken = await user.getIdToken();
      const res = await fetch("/api/user/birth-info", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({
          nickname,
          calendarType: calendarMode === "solar" ? "solar" : "lunar",
          isLeapMonth: calendarMode === "lunarLeap",
          birthDate,
          birthTime,
          timeUnknown,
          jasiRule,
          useTrueSolarTime,
          gender,
          birthPlace,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "저장에 실패했어요.");
        return;
      }
      setSnapshot({ nickname, calendarMode, birthDate, birthTime, timeUnknown, jasiRule, useTrueSolarTime, gender, birthPlace });
      setSavedOpen(true);
    } finally {
      setSaving(false);
    }
  }

  const canSave = Boolean(gender && birthDate && nickname.trim() && isDirty);

  return (
    <>
    <form onSubmit={handleSave} className="flex min-h-dvh flex-col overflow-visible bg-bg xl:h-full xl:overflow-hidden">
      <SubPageTopBar title="내 프로필 관리" />
      <div className="flex-1 overflow-visible p-4 pt-20 xl:overflow-y-auto scroll-gutter-stable">
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 rounded-[32px] border border-border bg-topbar p-4">
          <label className="flex flex-col gap-1">
            <FieldLabel required>닉네임 (변경 가능)</FieldLabel>
            <input
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="당신을 뭐라고 부를까요?"
              className="h-12 rounded-2xl border border-border bg-bg px-3 text-lg font-semibold text-bold-text outline-none placeholder-placeholder"
            />
          </label>

          <div className="flex flex-col gap-1">
            <FieldLabel required>생년월일</FieldLabel>
            <input
              type="date"
              value={birthDate}
              onChange={(e) => setBirthDate(e.target.value)}
              className="h-12 rounded-2xl border border-border bg-bg px-3 text-lg font-semibold text-bold-text outline-none"
            />
            <ToggleGroup
              options={[
                { value: "solar", label: "양력" },
                { value: "lunar", label: "음력" },
                { value: "lunarLeap", label: "음력(윤달)" },
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
                { value: "female", label: "여성" },
                { value: "male", label: "남성" },
                { value: "unspecified", label: "선택안함" },
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
        <button
          type="submit"
          disabled={!canSave || saving}
          className={`mx-auto block h-12 w-full max-w-2xl rounded-2xl text-lg font-semibold ${
            canSave ? "bg-point text-white" : "bg-chip-fill text-chip-muted-text"
          } disabled:opacity-60`}
        >
          저장하기
        </button>
      </div>
    </form>
    {savedOpen && <InfoModal title="저장되었습니다" onClose={() => setSavedOpen(false)} />}
    </>
  );
}
