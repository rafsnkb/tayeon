"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged, signOut, type User } from "firebase/auth";
import { auth } from "@/lib/firebase/client";
import { TONES, type ToneKey } from "@/lib/tarot/tone";
import { JASI_RULE_SHORT_LABEL, JASI_RULE_DESCRIPTION, type JasiRule } from "@/lib/tarot/birthInfo";
import { getStoredTheme, setStoredTheme, type Theme } from "@/lib/theme";
import SubPageTopBar from "@/components/SubPageTopBar";
import ConfirmModal from "@/components/ConfirmModal";
import { CheckIcon } from "../tarot/icons";

const PORTRAITS: Record<ToneKey, string> = {
  warm: "/portraits/warm.jpg",
  direct: "/portraits/direct.jpg",
  mystical: "/portraits/mystical.jpg",
  friendly: "/portraits/friendly.jpg",
};

// 피그마엔 이름표(루미/그레모라/셀레네아/모리)+설명 문구가 있었지만, 현재 실제 페르소나 정의
// (src/lib/tarot/tone.ts)와 어긋나는 구버전 문구였음 — 이름은 label에서 뽑고, 설명은 사용자가
// 직접 확정한 문구를 따로 둔다(2026-09-15).
function toneName(key: ToneKey): string {
  return TONES[key].label.split(" · ")[0];
}
const TONE_DESCRIPTIONS: Record<ToneKey, string> = {
  warm: "밝고 순수한 스타일",
  direct: "시크+팩폭으로 냉정하게 분석해주는 스타일",
  mystical: "신비롭고 잔잔한 스타일",
  friendly: "편안한 친구 스타일",
};
function toneDescription(key: ToneKey): string {
  return TONE_DESCRIPTIONS[key];
}

export function SectionPanel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <p className="px-1 text-base font-semibold text-icon-muted">{title}</p>
      <div className="flex flex-col gap-4 rounded-[32px] border border-border bg-topbar p-4">
        {children}
      </div>
    </div>
  );
}

function SegmentGroup<T extends string | boolean>({
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
          key={String(opt.value)}
          type="button"
          onClick={() => onChange(opt.value)}
          className={`h-12 flex-1 rounded-2xl text-base font-semibold ${
            value === opt.value
              ? "border border-point-strong bg-point text-white"
              : "bg-chip-fill text-white"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

/** 피그마 "Screen / Setting" — 원래 /me에 흩어져 있던 AI 말투/역방향 카드/진태양시/자시법/
 * 다크모드/탈퇴하기를 한 화면으로 모은 새 설정 페이지. */
export default function SettingsPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [tone, setTone] = useState<ToneKey>("warm");
  const [useReversedCards, setUseReversedCards] = useState(true);
  const [useTrueSolarTime, setUseTrueSolarTime] = useState(false);
  const [jasiRule, setJasiRule] = useState<JasiRule>("midnight");
  const [theme, setTheme] = useState<Theme>(() => getStoredTheme());
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  // 피그마의 "저장하기" 버튼은 아무것도 안 바꾸면 비활성 상태 — 처음 불러온 값을 저장해뒀다가
  // 현재 값과 비교해서 뭔가 바뀐 경우에만 버튼을 활성화한다(2026-09-14).
  const [initialSnapshot, setInitialSnapshot] = useState<string | null>(null);

  useEffect(() => {
    return onAuthStateChanged(auth, async (u) => {
      if (!u) return;
      setUser(u);
      const idToken = await u.getIdToken();
      const res = await fetch("/api/user/me", { headers: { Authorization: `Bearer ${idToken}` } });
      if (res.ok) {
        const data = await res.json();
        setTone(data.tone);
        setUseReversedCards(data.useReversedCards);
        setUseTrueSolarTime(Boolean(data.birthInfo?.useTrueSolarTime));
        setJasiRule(data.birthInfo?.jasiRule ?? "midnight");
        setInitialSnapshot(
          JSON.stringify([
            data.tone,
            data.useReversedCards,
            Boolean(data.birthInfo?.useTrueSolarTime),
            data.birthInfo?.jasiRule ?? "midnight",
          ])
        );
      }
    });
  }, []);

  const isDirty =
    initialSnapshot !== null &&
    initialSnapshot !== JSON.stringify([tone, useReversedCards, useTrueSolarTime, jasiRule]);

  async function handleSave() {
    if (!user || saving) return;
    setSaving(true);
    try {
      const idToken = await user.getIdToken();
      await fetch("/api/user/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({ tone, useReversedCards, useTrueSolarTime, jasiRule }),
      });
      router.back();
    } finally {
      setSaving(false);
    }
  }

  function handleToggleTheme(next: Theme) {
    setTheme(next);
    setStoredTheme(next);
  }

  async function handleDeleteAccount() {
    if (!user || deleting) return;
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
    <div className="flex min-h-dvh flex-col overflow-visible bg-bg xl:h-full xl:overflow-hidden">
      <SubPageTopBar title="설정" />
      <div className="flex-1 overflow-visible p-4 pt-20 xl:overflow-y-auto">
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
          <SectionPanel title="상담 설정">
            <div>
              <p className="text-sm font-semibold text-icon-muted">상담가 선택</p>
              <div className="flex justify-center gap-4 pt-2">
                {(Object.keys(TONES) as ToneKey[]).map((key) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setTone(key)}
                    className="flex shrink-0 flex-col items-center gap-2"
                  >
                    <span className="relative">
                      <span
                        className={`block h-[72px] w-[72px] overflow-hidden rounded-full border-2 ${
                          tone === key ? "border-point" : "border-border"
                        }`}
                      >
                        <img src={PORTRAITS[key]} alt="" className="h-full w-full object-cover" />
                      </span>
                      {tone === key && (
                        <span className="absolute -right-1 -top-1 flex h-7 w-7 items-center justify-center rounded-full bg-point text-white">
                          <CheckIcon className="h-3.5 w-4" />
                        </span>
                      )}
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-sm font-semibold ${
                        tone === key ? "bg-point text-white" : "bg-chip-fill text-white"
                      }`}
                    >
                      {toneName(key)}
                    </span>
                  </button>
                ))}
              </div>
              <p className="mt-3 rounded-2xl bg-bg px-3 py-3 text-center text-sm font-semibold text-icon-muted">
                {toneDescription(tone)}
              </p>
            </div>

            <div className="h-px bg-border" />

            <div>
              <p className="text-sm font-semibold text-icon-muted">타로카드 방향</p>
              <SegmentGroup
                options={[
                  { value: true, label: "정방향+역방향 사용" },
                  { value: false, label: "정방향만 사용" },
                ]}
                value={useReversedCards}
                onChange={setUseReversedCards}
              />
            </div>

            <div>
              <p className="text-sm font-semibold text-icon-muted">사주ㆍ자미두수 시간 기준</p>
              <SegmentGroup
                options={[
                  { value: false, label: "정시 기준" },
                  { value: true, label: "진태양시 보정" },
                ]}
                value={useTrueSolarTime}
                onChange={setUseTrueSolarTime}
              />
            </div>

            <div>
              <p className="text-sm font-semibold text-icon-muted">자시법</p>
              <SegmentGroup
                options={(Object.keys(JASI_RULE_SHORT_LABEL) as JasiRule[]).map((key) => ({
                  value: key,
                  label: JASI_RULE_SHORT_LABEL[key],
                }))}
                value={jasiRule}
                onChange={setJasiRule}
              />
              <p className="mt-2 rounded-2xl bg-bg px-3 py-3 text-center text-sm font-semibold text-icon-muted">
                {JASI_RULE_DESCRIPTION[jasiRule]}
              </p>
            </div>
          </SectionPanel>

          <SectionPanel title="시스템 설정">
            <div>
              <p className="text-sm font-semibold text-icon-muted">라이트/다크 모드</p>
              <SegmentGroup
                options={[
                  { value: "system", label: "시스템 설정" },
                  { value: "light", label: "라이트" },
                  { value: "dark", label: "다크" },
                ]}
                value={theme}
                onChange={handleToggleTheme}
              />
            </div>
          </SectionPanel>

          <button
            type="button"
            onClick={() => router.push("/settings/open-source")}
            className="self-center text-sm font-semibold text-point underline underline-offset-2"
          >
            오픈소스 라이선스
          </button>

          <button
            type="button"
            onClick={() => setDeleteConfirmOpen(true)}
            disabled={deleting}
            className="self-center text-sm font-semibold text-urgent disabled:opacity-50"
          >
            탈퇴하기
          </button>
        </div>
      </div>
      <div className="shrink-0 border-t border-border bg-topbar p-4">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || !isDirty}
          className={`mx-auto block h-12 w-full max-w-2xl rounded-2xl text-lg font-semibold ${
            isDirty ? "border border-point-strong bg-point text-white" : "bg-chip-fill text-placeholder"
          } disabled:opacity-60`}
        >
          저장하기
        </button>
      </div>
      {deleteConfirmOpen && (
        <ConfirmModal
          title="타연 탈퇴"
          description={"탈퇴하면 계정 정보 및 보유한 이용권과\n모든 대화가 삭제되며 복구할 수 없습니다."}
          confirmLabel="탈퇴하기"
          busy={deleting}
          onConfirm={handleDeleteAccount}
          onClose={() => setDeleteConfirmOpen(false)}
        />
      )}
    </div>
  );
}
