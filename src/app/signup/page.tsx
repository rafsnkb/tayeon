"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged, type User } from "firebase/auth";
import { auth } from "@/lib/firebase/client";
import { JASI_RULE_LABEL, type BirthInfo, type JasiRule } from "@/lib/tarot/birthInfo";

const POLICY_CONTENT: Record<"terms" | "privacy", { title: string; body: string }> = {
  terms: {
    title: "이용약관",
    body: "이용약관은 준비 중입니다. 서비스 정식 오픈 전까지 이 내용이 업데이트될 예정입니다.",
  },
  privacy: {
    title: "개인정보처리방침",
    body: "개인정보처리방침은 준비 중입니다. 서비스 정식 오픈 전까지 이 내용이 업데이트될 예정입니다.",
  },
};

function PolicyModal({
  policy,
  onClose,
}: {
  policy: "terms" | "privacy";
  onClose: () => void;
}) {
  const { title, body } = POLICY_CONTENT[policy];
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="flex max-h-[80vh] w-full max-w-md flex-col gap-4 rounded-2xl bg-surface p-6">
        <h2 className="text-lg font-bold text-bold-text">{title}</h2>
        <p className="flex-1 overflow-y-auto text-sm text-text">{body}</p>
        <button
          onClick={onClose}
          className="self-end rounded-full bg-cta-fill px-5 py-2 text-sm text-cta-text"
        >
          닫기
        </button>
      </div>
    </div>
  );
}

export default function SignupPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [nickname, setNickname] = useState("");
  const [agreedTerms, setAgreedTerms] = useState(false);
  const [agreedPrivacy, setAgreedPrivacy] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openPolicy, setOpenPolicy] = useState<"terms" | "privacy" | null>(null);

  // 생년월일시는 선택 입력 — 가입 후 /me에서 따로 채울 수도 있지만, 여기서 바로 입력하면
  // 그 수고를 덜 수 있어서 함께 받는다(2026-09-12).
  const [calendarType, setCalendarType] = useState<BirthInfo["calendarType"]>("solar");
  const [birthDate, setBirthDate] = useState("");
  const [birthTime, setBirthTime] = useState("");
  const [timeUnknown, setTimeUnknown] = useState(false);
  const [jasiRule, setJasiRule] = useState<JasiRule>("midnight");
  const [useTrueSolarTime, setUseTrueSolarTime] = useState(false);
  const [gender, setGender] = useState<BirthInfo["gender"] | "">("");

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
  }, [router]);

  // 생년월일 또는 성별 중 하나라도 손댔다면 나머지도 채워야 함 — 반쪽만 저장하면 사주/자미두수
  // 계산에 못 쓰기 때문. 아예 둘 다 비워두면 건너뛰고 나중에 /me에서 입력 가능.
  const birthInfoStarted = Boolean(birthDate.trim() || gender);
  const birthInfoIncomplete = birthInfoStarted && (!birthDate.trim() || !gender);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !nickname.trim() || !agreedTerms || !agreedPrivacy || submitting) return;
    if (birthInfoIncomplete) {
      setError("생년월일시를 입력하려면 생년월일과 성별을 모두 선택해주세요. 지금 건너뛰려면 둘 다 비워두세요.");
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
          birthInfo: birthInfoStarted
            ? { calendarType, birthDate, birthTime, timeUnknown, jasiRule, useTrueSolarTime, gender }
            : undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "가입 처리에 실패했어요.");
        return;
      }

      router.replace("/tarot?welcome=1");
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
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center gap-6 p-6">
      {openPolicy && <PolicyModal policy={openPolicy} onClose={() => setOpenPolicy(null)} />}

      <h1 className="text-xl font-bold text-bold-text">타연 가입</h1>

      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-text">닉네임</span>
          <input
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            placeholder="사용할 닉네임을 입력하세요"
            className="rounded-lg border border-border bg-surface px-3 py-2 outline-none"
          />
        </label>

        <div className="flex flex-col gap-4 rounded-lg border border-border p-4">
          <span className="text-sm text-text">
            (선택) 생년월일시 — 사주/자미두수 계산에 사용돼요. 지금 안 하면 나중에 내 정보에서
            입력할 수 있어요.
          </span>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setGender("female")}
              className={`rounded-full border px-3 py-1.5 text-sm ${
                gender === "female" ? "border-point bg-point-bg text-point" : "border-border text-text"
              }`}
            >
              여성
            </button>
            <button
              type="button"
              onClick={() => setGender("male")}
              className={`rounded-full border px-3 py-1.5 text-sm ${
                gender === "male" ? "border-point bg-point-bg text-point" : "border-border text-text"
              }`}
            >
              남성
            </button>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setCalendarType("solar")}
              className={`rounded-full border px-3 py-1.5 text-sm ${
                calendarType === "solar" ? "border-point bg-point-bg text-point" : "border-border text-text"
              }`}
            >
              양력
            </button>
            <button
              type="button"
              onClick={() => setCalendarType("lunar")}
              className={`rounded-full border px-3 py-1.5 text-sm ${
                calendarType === "lunar" ? "border-point bg-point-bg text-point" : "border-border text-text"
              }`}
            >
              음력
            </button>
          </div>

          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium text-text">생년월일</span>
            <input
              type="date"
              value={birthDate}
              onChange={(e) => setBirthDate(e.target.value)}
              className="rounded-lg border border-border bg-surface px-3 py-2 outline-none"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium text-text">태어난 시간</span>
            <input
              type="time"
              value={birthTime}
              onChange={(e) => setBirthTime(e.target.value)}
              disabled={timeUnknown}
              className="rounded-lg border border-border bg-surface px-3 py-2 outline-none disabled:opacity-50"
            />
          </label>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={timeUnknown}
              onChange={(e) => setTimeUnknown(e.target.checked)}
            />
            태어난 시간을 몰라요
          </label>
          {timeUnknown && (
            <p className="text-sm text-urgent">태어난 시간을 모르면 자미두수 기능을 사용할 수 없어요.</p>
          )}

          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium text-text">자시법</span>
            <select
              value={jasiRule}
              onChange={(e) => setJasiRule(e.target.value as JasiRule)}
              className="rounded-lg border border-border bg-surface px-3 py-2 outline-none"
            >
              {(Object.keys(JASI_RULE_LABEL) as JasiRule[]).map((key) => (
                <option key={key} value={key}>
                  {JASI_RULE_LABEL[key]}
                </option>
              ))}
            </select>
          </label>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={useTrueSolarTime}
              onChange={(e) => setUseTrueSolarTime(e.target.checked)}
            />
            진태양시 보정 사용 (사주에만 적용)
          </label>
          <p className="text-xs text-text">
            표준시(동경 135°)와 한반도 실제 경도(약 127°) 차이로 생기는 약 30분의 시차를 보정해서
            시주/일주를 계산해요. 유파마다 다른 방식이라 선택 사항이며, 자미두수 계산에는 적용되지
            않아요.
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={agreedTerms}
              onChange={(e) => setAgreedTerms(e.target.checked)}
            />
            <span>
              (필수){" "}
              <button
                type="button"
                onClick={() => setOpenPolicy("terms")}
                className="text-point underline"
              >
                이용약관
              </button>
              에 동의합니다
            </span>
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={agreedPrivacy}
              onChange={(e) => setAgreedPrivacy(e.target.checked)}
            />
            <span>
              (필수){" "}
              <button
                type="button"
                onClick={() => setOpenPolicy("privacy")}
                className="text-point underline"
              >
                개인정보처리방침
              </button>
              에 동의합니다
            </span>
          </label>
        </div>

        {error && <p className="text-sm text-urgent">{error}</p>}

        <button
          type="submit"
          disabled={!canSubmit}
          className="rounded-full bg-cta-fill px-5 py-2 text-cta-text disabled:opacity-40"
        >
          가입 완료
        </button>
      </form>
    </main>
  );
}
