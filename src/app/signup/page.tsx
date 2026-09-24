"use client";

import { useEffect, useState } from "react";
import { BirthDateField, BirthTimeField, FieldLabel, ToggleGroup } from "@/components/FormControls";
import { useRouter } from "next/navigation";
import { onAuthStateChanged, type User } from "firebase/auth";
import { auth } from "@/lib/firebase/client";
import { toCalendarMode, type BirthInfo, type CalendarMode } from "@/lib/tarot/birthInfo";
import { PRIVACY_POLICY_SECTIONS, TERMS_SECTIONS } from "@/lib/legal/content";
import { BrandBi } from "@/components/BrandBi";

const POLICY_SECTIONS: Record<"terms" | "privacy", { title: string; sections: typeof TERMS_SECTIONS }> = {
  terms: { title: "이용약관", sections: TERMS_SECTIONS },
  privacy: { title: "개인정보처리방침", sections: PRIVACY_POLICY_SECTIONS },
};

export function PolicyModal({
  policy,
  onClose,
}: {
  policy: "terms" | "privacy";
  onClose: () => void;
}) {
  const { title, sections } = POLICY_SECTIONS[policy];
  return (
    <div data-modal-overlay="true" className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="flex max-h-[80vh] w-full max-w-md flex-col gap-4 rounded-[28px] border border-border bg-topbar p-6">
        <h2 className="text-lg font-bold text-bold-text">{title}</h2>
        <div className="flex-1 overflow-y-auto">
          <div className="flex flex-col gap-4">
            {sections.map((section) => (
              <div key={section.title}>
                <h3 className="mb-1 text-sm font-bold text-bold-text">{section.title}</h3>
                <p className="whitespace-pre-wrap text-sm text-icon-muted">{section.body}</p>
              </div>
            ))}
          </div>
        </div>
        <button
          onClick={onClose}
          className="h-12 self-end rounded-full bg-point px-5 text-base font-semibold text-white"
        >
          닫기
        </button>
      </div>
    </div>
  );
}

/** 피그마 "Screen / Join" — 자시법/진태양시는 화면에 없어서(설정 화면으로 옮겨간 듯) 뺐고, 저장 시엔
 * 기본값(일반/미보정)으로 채워서 보낸다. 생년월일(과 성별)은 2026-09-19부터 닉네임과 동일하게
 * 필수 — 목업에 생년월일에도 빨간 * 표시가 있어, "나중에 프로필에서 입력" 건너뛰기를 없앴다.
 * 태어난 시간만 선택 입력으로 유지(자미두수는 태어난 시간이 있어야 가능하므로). */
export default function SignupPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [nickname, setNickname] = useState("");
  const [agreedTerms, setAgreedTerms] = useState(false);
  const [agreedPrivacy, setAgreedPrivacy] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openPolicy, setOpenPolicy] = useState<"terms" | "privacy" | null>(null);

  const [calendarMode, setCalendarMode] = useState<CalendarMode>("solar");
  const [birthDate, setBirthDate] = useState("");
  const [birthTime, setBirthTime] = useState("");
  const [timeUnknown, setTimeUnknown] = useState(false);
  const [gender, setGender] = useState<BirthInfo["gender"] | "">("");
  const [birthPlace, setBirthPlace] = useState("");

  useEffect(() => {
    return onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (!u) {
        router.replace("/login");
        return;
      }

      const idToken = await u.getIdToken();
      const res = await fetch("/api/user/me", {
        headers: { Authorization: `Bearer ${idToken}` },
      });
      if (res.ok) {
        const data = await res.json();
        if (data.nickname) setNickname(data.nickname);

        const info = data.birthInfo as BirthInfo | null;
        if (info) {
          setCalendarMode(toCalendarMode(info.calendarType, info.isLeapMonth));
          setBirthDate(info.birthDate ?? "");
          setBirthTime(info.birthTime ?? "");
          setTimeUnknown(info.timeUnknown);
          setGender(info.gender);
          setBirthPlace(info.birthPlace ?? "");
        }
      }
    });
  }, [router]);

  const birthInfoIncomplete = !birthDate.trim() || !gender;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !nickname.trim() || !agreedTerms || !agreedPrivacy || submitting) return;
    if (birthInfoIncomplete) {
      setError("생년월일과 성별을 입력해주세요.");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const idToken = await user.getIdToken();
      const res = await fetch("/api/user/signup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          nickname: nickname.trim(),
          birthInfo: {
            calendarType: calendarMode === "solar" ? "solar" : "lunar",
            isLeapMonth: calendarMode === "lunarLeap",
            birthDate,
            birthTime,
            timeUnknown,
            jasiRule: "midnight",
            useTrueSolarTime: false,
            gender,
            birthPlace,
          },
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "가입 처리에 실패했어요.");
        return;
      }

      router.replace("/?welcome=1");
    } catch {
      setError("네트워크 오류가 발생했어요.");
    } finally {
      setSubmitting(false);
    }
  }

  if (user === undefined) return null;

  const canSubmit =
    nickname.trim() && agreedTerms && agreedPrivacy && !birthInfoIncomplete && !submitting;

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-4 bg-bg p-4">
      {openPolicy && <PolicyModal policy={openPolicy} onClose={() => setOpenPolicy(null)} />}

      <div className="flex h-16 shrink-0 items-center justify-center">
        <BrandBi />
      </div>

      <form onSubmit={handleSubmit} className="flex flex-1 flex-col gap-4 overflow-y-auto">
        <div className="flex flex-col gap-4 rounded-[32px] border border-border bg-topbar p-4">
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
            <BirthDateField required value={birthDate} onChange={setBirthDate} />
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
            <BirthTimeField label="태어난 시간 (선택)" value={birthTime} onChange={setBirthTime} disabled={timeUnknown} />
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
              value={gender || "female"}
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
        </div>

        <div className="flex flex-col gap-2 px-1">
          <label className="flex items-center gap-2 text-sm text-icon-muted">
            <input
              type="checkbox"
              checked={agreedTerms}
              onChange={(e) => setAgreedTerms(e.target.checked)}
            />
            <span>
              [필수]{" "}
              <button type="button" onClick={() => setOpenPolicy("terms")} className="text-point-text underline">
                이용약관
              </button>
              에 동의합니다.
            </span>
          </label>
          <label className="flex items-center gap-2 text-sm text-icon-muted">
            <input
              type="checkbox"
              checked={agreedPrivacy}
              onChange={(e) => setAgreedPrivacy(e.target.checked)}
            />
            <span>
              [필수]{" "}
              <button type="button" onClick={() => setOpenPolicy("privacy")} className="text-point-text underline">
                개인정보처리방침
              </button>
              에 동의합니다.
            </span>
          </label>
        </div>

        {error && <p className="px-1 text-sm text-urgent">{error}</p>}

        <button
          type="submit"
          disabled={!canSubmit}
          className={`h-12 w-full shrink-0 rounded-2xl text-lg font-semibold ${
            canSubmit ? "bg-point text-white" : "bg-chip-fill text-chip-muted-text"
          }`}
        >
          타연 가입하기
        </button>
      </form>
    </main>
  );
}
