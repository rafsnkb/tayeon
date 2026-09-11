"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import Link from "next/link";
import { auth } from "@/lib/firebase/client";

type Partner = {
  nickname: string;
  birthDate: string | null;
  birthTime: string | null;
  gender: "male" | "female" | "unspecified";
  calendarType: "solar" | "lunar";
};

const GENDER_LABEL: Record<Partner["gender"], string> = {
  male: "남성",
  female: "여성",
  unspecified: "선택 안 함",
};

export default function CompatibilityPage() {
  const [user, setUser] = useState<User | null>(null);
  const [partner, setPartner] = useState<Partner | null | undefined>(undefined);
  const [nickname, setNickname] = useState("");
  const [calendarType, setCalendarType] = useState<Partner["calendarType"]>("solar");
  const [birthDate, setBirthDate] = useState("");
  const [birthTime, setBirthTime] = useState("");
  const [gender, setGender] = useState<Partner["gender"]>("unspecified");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
        setPartner(data.partner);
      }
    });
  }, []);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !nickname.trim() || submitting) return;

    setSubmitting(true);
    setError(null);
    try {
      const idToken = await user.getIdToken();
      const res = await fetch("/api/user/partner", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          nickname: nickname.trim(),
          calendarType,
          birthDate: birthDate || null,
          birthTime: birthTime || null,
          gender,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "저장에 실패했어요.");
        return;
      }
      setPartner({
        nickname: nickname.trim(),
        calendarType,
        birthDate: birthDate || null,
        birthTime: birthTime || null,
        gender,
      });
      setNickname("");
      setCalendarType("solar");
      setBirthDate("");
      setBirthTime("");
      setGender("unspecified");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!user || submitting) return;
    if (!confirm("저장된 상대 정보를 삭제할까요?")) return;

    setSubmitting(true);
    try {
      const idToken = await user.getIdToken();
      await fetch("/api/user/partner", {
        method: "DELETE",
        headers: { Authorization: `Bearer ${idToken}` },
      });
      setPartner(null);
    } finally {
      setSubmitting(false);
    }
  }

  if (partner === undefined) return null;

  return (
    <div className="flex h-full flex-col gap-6 overflow-y-auto p-4">
      <h1 className="text-xl font-bold text-bold-text">궁합 상대 정보</h1>
      <p className="text-sm text-text">
        궁합을 볼 상대방의 정보예요. 본명 대신 별명이나 애칭으로 입력해주세요. 정보는 한 명만 저장할 수 있어요.
      </p>

      {partner ? (
        <div className="flex flex-col gap-3 rounded-lg border border-border p-4">
          <div>
            <span className="text-sm text-text">별명</span>
            <p className="text-lg text-bold-text">{partner.nickname}</p>
          </div>
          {partner.birthDate && (
            <div>
              <span className="text-sm text-text">생년월일</span>
              <p>
                ({partner.calendarType === "lunar" ? "음력" : "양력"}) {partner.birthDate}
                {partner.birthTime ? ` ${partner.birthTime}` : ""}
              </p>
            </div>
          )}
          <div>
            <span className="text-sm text-text">성별</span>
            <p>{GENDER_LABEL[partner.gender]}</p>
          </div>
          <p className="text-sm text-text">
            <Link href="/tarot" className="text-point underline">
              타로 보기
            </Link>
            {" "}화면에서 +궁합 옵션을 켜면 {partner.nickname}님과의 궁합을 볼 수 있어요.
            {(!partner.birthDate || partner.gender === "unspecified") &&
              " (생년월일·성별을 입력하면 사주/자미두수까지 반영돼요)"}
          </p>
          <button
            onClick={handleDelete}
            disabled={submitting}
            className="self-start text-sm text-urgent underline disabled:opacity-50"
          >
            삭제하기
          </button>
        </div>
      ) : (
        <form onSubmit={handleAdd} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium text-text">상대방을 뭐라고 부를까요?</span>
            <input
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="별명이나 애칭을 입력하세요"
              className="rounded-lg border border-border bg-surface px-3 py-2 outline-none"
            />
          </label>

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
            <span className="text-sm font-medium text-text">생년월일 (선택)</span>
            <input
              type="date"
              value={birthDate}
              onChange={(e) => setBirthDate(e.target.value)}
              className="rounded-lg border border-border bg-surface px-3 py-2 outline-none"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium text-text">태어난 시간 (선택)</span>
            <input
              type="time"
              value={birthTime}
              onChange={(e) => setBirthTime(e.target.value)}
              className="rounded-lg border border-border bg-surface px-3 py-2 outline-none"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium text-text">성별 (선택)</span>
            <select
              value={gender}
              onChange={(e) => setGender(e.target.value as Partner["gender"])}
              className="rounded-lg border border-border bg-surface px-3 py-2 outline-none"
            >
              <option value="unspecified">선택 안 함</option>
              <option value="female">여성</option>
              <option value="male">남성</option>
            </select>
          </label>

          {error && <p className="text-sm text-urgent">{error}</p>}

          <button
            type="submit"
            disabled={!nickname.trim() || submitting}
            className="self-start rounded-full bg-cta-fill px-5 py-2 text-cta-text disabled:opacity-40"
          >
            저장하기
          </button>
        </form>
      )}
    </div>
  );
}
