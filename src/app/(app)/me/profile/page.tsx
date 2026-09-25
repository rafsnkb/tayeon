"use client";

import { useEffect, useState } from "react";
import { BirthDateField, BirthTimeField, BirthTimeNotice, FieldLabel, ToggleGroup } from "@/components/FormControls";
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
  /** 저장된 프로필이 도착했는가. 폼을 그려도 되는 시점을 가르는 용도다(2026-09-25) —
   *  아래 state 초기값이 전부 빈 값/기본값이라, 조회가 끝나기 전에 그리면 **이미 입력해 둔
   *  사람에게도 빈 폼**이 보였다가 채워진다. 그 사이에 손댄 값은 도착한 응답이 덮어쓴다. */
  const [loaded, setLoaded] = useState(false);
  /** 조회가 실패했는가. 여기서 빈 폼을 보여주면 안 된다(2026-09-26) — snapshot 이 전부 빈
   *  값이라 한 글자만 쳐도 isDirty 가 켜지고, 저장하면 **멀쩡한 프로필이 빈 값으로 덮인다**.
   *  (2026-09-25 에 이 자리 주석은 "실패해도 true 로 둔다"고 적었지만 실제로 그렇게 동작한
   *  적이 없다 — `!res.ok` 도 throw 도 setLoaded 에 닿지 못했다. 의도와 코드가 어긋나 있었다.) */
  const [loadFailed, setLoadFailed] = useState(false);
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
      // getIdToken·fetch·json 은 전부 던진다. 던지면 이 async 콜백이 reject 되고 파이어베이스는
      // 잡아주지 않아 setLoaded(true) 에 못 닿는다 — 화면이 "불러오는 중..."으로 굳는다.
      try {
      const idToken = await u.getIdToken();
      const res = await fetch("/api/user/me", { headers: { Authorization: `Bearer ${idToken}` } });
      if (!res.ok) {
        setLoadFailed(true);
        return;
      }
      {
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
      setLoaded(true);
      } catch {
        setLoadFailed(true);
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
        {loadFailed ? (
          <p className="pt-8 text-center text-sm leading-relaxed text-icon-muted">
            프로필을 불러오지 못했어요.
            <br />
            지금 저장하면 기존 정보가 지워질 수 있어 화면을 열지 않았어요.
          </p>
        ) : !loaded ? (
          <p className="pt-8 text-center text-sm text-icon-muted">불러오는 중...</p>
        ) : (
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
            <BirthDateField required value={birthDate} onChange={setBirthDate} calendarMode={calendarMode} />
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
            <BirthTimeField value={birthTime} onChange={setBirthTime} disabled={timeUnknown} />
            <label className="flex items-center gap-2 pt-2 text-sm text-icon-muted">
              <input
                type="checkbox"
                checked={timeUnknown}
                onChange={(e) => setTimeUnknown(e.target.checked)}
              />
              태어난 시간을 몰라요
            </label>
            <BirthTimeNotice />
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
        )}
      </div>
      <div className="shrink-0 border-t border-border bg-topbar p-4">
        <button
          type="submit"
          disabled={!canSave || saving}
          className={`mx-auto block h-12 w-full max-w-2xl rounded-2xl text-lg font-semibold ${
            canSave ? "bg-point text-white" : "bg-chip-soft text-icon-muted"
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
