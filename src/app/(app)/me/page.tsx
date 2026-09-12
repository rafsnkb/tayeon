"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { onAuthStateChanged, signOut, type User } from "firebase/auth";
import { auth } from "@/lib/firebase/client";
import { TONES, type ToneKey } from "@/lib/tarot/tone";
import { JASI_RULE_LABEL, type BirthInfo, type JasiRule } from "@/lib/tarot/birthInfo";

export default function MePage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [nickname, setNickname] = useState<string | null>(null);
  const [coins, setCoins] = useState<number | null>(null);
  const [tone, setTone] = useState<ToneKey>("warm");
  const [useReversedCards, setUseReversedCards] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);

  const [calendarType, setCalendarType] = useState<BirthInfo["calendarType"]>("solar");
  const [birthDate, setBirthDate] = useState("");
  const [birthTime, setBirthTime] = useState("");
  const [timeUnknown, setTimeUnknown] = useState(false);
  const [jasiRule, setJasiRule] = useState<JasiRule>("midnight");
  const [useTrueSolarTime, setUseTrueSolarTime] = useState(false);
  const [gender, setGender] = useState<BirthInfo["gender"] | "">("");
  const [savingBirthInfo, setSavingBirthInfo] = useState(false);
  const [birthInfoError, setBirthInfoError] = useState<string | null>(null);

  useEffect(() => {
    return onAuthStateChanged(auth, async (u) => {
      if (!u) return;
      setUser(u);
      const idToken = await u.getIdToken();
      const res = await fetch("/api/user/me", {
        headers: { Authorization: `Bearer ${idToken}` },
      });
      if (res.ok) {
        const data = await res.json();
        setNickname(data.nickname);
        setCoins(data.coins);
        setTone(data.tone);
        setUseReversedCards(data.useReversedCards);

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

  async function saveSettings(next: { tone?: ToneKey; useReversedCards?: boolean }) {
    if (!user || savingSettings) return;
    setSavingSettings(true);
    try {
      const idToken = await user.getIdToken();
      await fetch("/api/user/settings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify(next),
      });
    } finally {
      setSavingSettings(false);
    }
  }

  async function handleSaveBirthInfo(e: React.FormEvent) {
    e.preventDefault();
    if (!user || savingBirthInfo || !gender) return;

    setSavingBirthInfo(true);
    setBirthInfoError(null);
    try {
      const idToken = await user.getIdToken();
      const res = await fetch("/api/user/birth-info", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
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
        setBirthInfoError(data.error ?? "저장에 실패했어요.");
      }
    } finally {
      setSavingBirthInfo(false);
    }
  }

  async function handleDeleteAccount() {
    if (!user || deleting) return;
    if (!confirm("정말 탈퇴하시겠어요? 계정 정보가 삭제됩니다.")) return;

    setDeleting(true);
    try {
      const idToken = await user.getIdToken();
      await fetch("/api/user/delete", {
        method: "POST",
        headers: { Authorization: `Bearer ${idToken}` },
      });
      await signOut(auth);
      router.replace("/login");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="flex h-full flex-col gap-6 overflow-y-auto p-4">
      <h1 className="text-xl font-bold text-bold-text">내 정보</h1>

      <div className="rounded-lg border border-border p-4">
        <span className="text-sm text-text">닉네임</span>
        <p className="text-lg text-bold-text">{nickname ?? "-"}</p>
      </div>

      <div className="flex items-center justify-between rounded-lg border border-border p-4">
        <div>
          <span className="text-sm text-text">보유 코인</span>
          <p className="text-lg text-bold-text">{coins ?? "-"}</p>
        </div>
        <Link href="/charge" className="text-sm text-point underline">
          충전하기
        </Link>
      </div>

      <div className="rounded-lg border border-border p-4">
        <span className="mb-2 block text-sm text-text">AI 말투</span>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(TONES) as ToneKey[]).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => {
                setTone(key);
                saveSettings({ tone: key });
              }}
              className={`rounded-full border px-3 py-1.5 text-sm ${
                tone === key ? "border-point bg-point-bg text-point" : "border-border text-text"
              }`}
            >
              {TONES[key].label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between rounded-lg border border-border p-4">
        <span className="text-sm text-text">역방향 카드 사용</span>
        <button
          type="button"
          onClick={() => {
            const next = !useReversedCards;
            setUseReversedCards(next);
            saveSettings({ useReversedCards: next });
          }}
          className={`h-6 w-11 rounded-full transition-colors ${
            useReversedCards ? "bg-point" : "bg-border"
          }`}
        >
          <span
            className={`block h-5 w-5 translate-y-0.5 rounded-full bg-white transition-transform ${
              useReversedCards ? "translate-x-5" : "translate-x-0.5"
            }`}
          />
        </button>
      </div>

      <form onSubmit={handleSaveBirthInfo} className="flex flex-col gap-4 rounded-lg border border-border p-4">
        <span className="text-sm text-text">생년월일시 정보 (사주/자미두수 계산에 사용돼요)</span>

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

        {birthInfoError && <p className="text-sm text-urgent">{birthInfoError}</p>}

        <button
          type="submit"
          disabled={savingBirthInfo || !gender || !birthDate}
          className="self-start rounded-full bg-cta-fill px-5 py-2 text-sm text-cta-text disabled:opacity-50"
        >
          저장하기
        </button>
      </form>

      <button
        onClick={handleDeleteAccount}
        disabled={deleting}
        className="self-start text-sm text-urgent underline disabled:opacity-50"
      >
        탈퇴하기
      </button>
    </div>
  );
}
