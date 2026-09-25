"use client";

import { useEffect, useState } from "react";
import { useRooms, type Partner } from "@/lib/tarot/RoomsContext";
import { BirthDateField, BirthTimeField, BirthTimeNotice, FieldLabel, ToggleGroup } from "@/components/FormControls";
import { toCalendarMode, type CalendarMode } from "@/lib/tarot/birthInfo";
import { onAuthStateChanged, type User } from "firebase/auth";
import { auth } from "@/lib/firebase/client";
import SubPageTopBar from "@/components/SubPageTopBar";
import InfoModal from "@/components/InfoModal";

type ProfileSnapshot = {
  nickname: string;
  calendarMode: CalendarMode;
  birthDate: string;
  birthTime: string;
  timeUnknown: boolean;
  gender: Partner["gender"];
  birthPlace: string;
};

const EMPTY_PARTNER: ProfileSnapshot = {
  nickname: "",
  calendarMode: "solar",
  birthDate: "",
  birthTime: "",
  timeUnknown: false,
  gender: "unspecified",
  birthPlace: "",
};

/** 피그마 "Screen / PartnerProfile" — MyProfile과 거의 같은 레이아웃이지만 닉네임만 필수, 나머지는
 * 전부 선택 입력. 기존엔 저장 후 "보기 모드"로 바뀌는 UI였는데, 피그마는 항상 폼을 보여주고 기존
 * 값으로 미리 채워두는 방식이라 그에 맞춰 단순화함. "초기화" 버튼은 목업에 없어 제거함(2026-09-19). */
export default function CompatibilityPage() {
  const { partner } = useRooms();
  /** 컨텍스트의 partner 를 폼이 쓰는 모양으로 편다. 저장된 상대가 없으면 빈 폼이 맞다. */
  const initial: ProfileSnapshot = partner
    ? {
        nickname: partner.nickname,
        calendarMode: toCalendarMode(partner.calendarType, partner.isLeapMonth),
        birthDate: partner.birthDate ?? "",
        birthTime: partner.birthTime ?? "",
        timeUnknown: !partner.birthTime,
        gender: partner.gender,
        birthPlace: partner.birthPlace ?? "",
      }
    : EMPTY_PARTNER;

  const [user, setUser] = useState<User | null>(null);
  // 전부 lazy 초기화다 — 함수를 넘기면 **마운트 때 한 번만** 평가된다. 그냥 값을 넘기면
  // 10 초 폴링이 partner 를 갱신할 때마다 initial 이 새로 계산되긴 하지만 state 는 안 바뀐다.
  // 함수 형태로 두는 건 의도를 못박기 위해서다: 이 폼의 출처는 "마운트 시점의 저장값"이다.
  const [nickname, setNickname] = useState(() => initial.nickname);
  const [calendarMode, setCalendarMode] = useState<CalendarMode>(() => initial.calendarMode);
  const [birthDate, setBirthDate] = useState(() => initial.birthDate);
  const [birthTime, setBirthTime] = useState(() => initial.birthTime);
  const [timeUnknown, setTimeUnknown] = useState(() => initial.timeUnknown);
  const [gender, setGender] = useState<Partner["gender"]>(() => initial.gender);
  const [birthPlace, setBirthPlace] = useState(() => initial.birthPlace);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedOpen, setSavedOpen] = useState(false);
  const [snapshot, setSnapshot] = useState<ProfileSnapshot>(() => initial);

  // 상대 정보는 **진입 시점에 이미 컨텍스트에 있다**(2026-09-26). `/api/user/me` 가 partner 를
  // 통째로 내려주고, (app) 레이아웃이 그 응답이 오기 전엔 이 화면을 아예 렌더하지 않는다.
  // 그래서 여기서는 조회도, 로딩 상태도, 실패 처리도 필요 없다 — lazy 초기화로 첫 렌더부터
  // 저장값이 들어가 있다. 예전엔 `/api/user/partner` 를 따로 불러서 (1) 같은 데이터를 두 번
  // 받고 (2) 그 사이 이미 입력해 둔 사람에게도 빈 폼이 보였다가 채워졌으며 (3) 그때 타이핑한
  // 값을 뒤늦게 도착한 응답이 덮어썼다.
  //
  // 10 초 폴링으로 partner 가 갱신돼도 이 폼은 다시 읽지 않는다(lazy 초기화는 마운트 때 한 번).
  // 편집 중에 값이 발밑에서 바뀌지 않아야 하므로 그게 맞다.
  useEffect(() => onAuthStateChanged(auth, setUser), []);

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
      <div className="flex-1 overflow-visible p-4 pt-20 xl:overflow-y-auto scroll-gutter-stable">
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
            <BirthDateField value={birthDate} onChange={setBirthDate} calendarMode={calendarMode} />
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
            nickname.trim() && isDirty ? "bg-point text-white" : "bg-chip-soft text-icon-muted"
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
