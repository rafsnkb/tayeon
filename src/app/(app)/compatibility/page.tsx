"use client";

import { useEffect, useState } from "react";
import { FieldLabel, ToggleGroup } from "@/components/FormControls";
import { toCalendarMode, type CalendarMode } from "@/lib/tarot/birthInfo";
import { onAuthStateChanged, type User } from "firebase/auth";
import { auth } from "@/lib/firebase/client";
import SubPageTopBar from "@/components/SubPageTopBar";
import InfoModal from "@/components/InfoModal";

type Partner = {
  nickname: string;
  birthDate: string | null;
  birthTime: string | null;
  gender: "male" | "female" | "unspecified";
  calendarType: "solar" | "lunar";
  isLeapMonth?: boolean;
  birthPlace?: string | null;
};

type ProfileSnapshot = {
  nickname: string;
  calendarMode: CalendarMode;
  birthDate: string;
  birthTime: string;
  timeUnknown: boolean;
  gender: Partner["gender"];
  birthPlace: string;
};

/** 피그마 "Screen / PartnerProfile" — MyProfile과 거의 같은 레이아웃이지만 닉네임만 필수, 나머지는
 * 전부 선택 입력. 기존엔 저장 후 "보기 모드"로 바뀌는 UI였는데, 피그마는 항상 폼을 보여주고 기존
 * 값으로 미리 채워두는 방식이라 그에 맞춰 단순화함. "초기화" 버튼은 목업에 없어 제거함(2026-09-19). */
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
  const [savedOpen, setSavedOpen] = useState(false);
  const [snapshot, setSnapshot] = useState<ProfileSnapshot>({
    nickname: "",
    calendarMode: "solar",
    birthDate: "",
    birthTime: "",
    timeUnknown: false,
    gender: "unspecified",
    birthPlace: "",
  });

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
          const loaded: ProfileSnapshot = {
            nickname: partner.nickname,
            calendarMode: toCalendarMode(partner.calendarType, partner.isLeapMonth),
            birthDate: partner.birthDate ?? "",
            birthTime: partner.birthTime ?? "",
            timeUnknown: !partner.birthTime,
            gender: partner.gender,
            birthPlace: partner.birthPlace ?? "",
          };
          setNickname(loaded.nickname);
          setCalendarMode(loaded.calendarMode);
          setBirthDate(loaded.birthDate);
          setBirthTime(loaded.birthTime);
          setTimeUnknown(loaded.timeUnknown);
          setGender(loaded.gender);
          setBirthPlace(loaded.birthPlace);
          setSnapshot(loaded);
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
    gender !== snapshot.gender ||
    birthPlace !== snapshot.birthPlace;

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !nickname.trim() || submitting || !isDirty) return;
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
      setSnapshot({ nickname: nickname.trim(), calendarMode, birthDate, birthTime, timeUnknown, gender, birthPlace });
      setSavedOpen(true);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
    <form onSubmit={handleSave} className="flex min-h-dvh flex-col overflow-visible bg-bg xl:h-full xl:overflow-hidden">
      <SubPageTopBar title="궁합 상대 프로필 관리" />
      <div className="flex-1 overflow-visible p-4 pt-20 xl:overflow-y-auto">
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 rounded-[32px] border border-border bg-topbar p-4">
          <label className="flex flex-col gap-1">
            <FieldLabel required>궁합 상대 닉네임 (변경 가능)</FieldLabel>
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
        <button
          type="submit"
          disabled={!nickname.trim() || submitting || !isDirty}
          className={`mx-auto block h-12 w-full max-w-2xl rounded-2xl text-lg font-semibold ${
            nickname.trim() && isDirty ? "bg-point text-white" : "bg-chip-fill text-chip-muted-text"
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
