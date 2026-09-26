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
import InfoModal from "@/components/InfoModal";
import { CheckIcon } from "../tarot/icons";

const PORTRAITS: Record<ToneKey, string> = {
  warm: "/portraits/warm.jpg",
  direct: "/portraits/direct.jpg",
  mystical: "/portraits/mystical.jpg",
  friendly: "/portraits/friendly.jpg",
};

// 초상화 아래 칩에 들어가는 낱말. **이름이 아니다**(2026-09-26 사용자 결정: "페르소나 이름은
// 필요 없어") — 전엔 여기가 `label` 을 " · " 로 쪼개 이름(루미/그레모라/…)을 뽑아 썼지만
// `tone.ts` 에서 이름을 아예 없앴다. 지금 `label` 은 성격 낱말 한 단어라 그대로 쓴다.
//
// 칩이 아예 없으면 초상화 4개를 얼굴로만 구별해야 해서 남겼다 — 고른 톤의 자세한 설명은
// 그 아래 `TONE_DESCRIPTIONS` 가 맡는다.
function toneLabel(key: ToneKey): string {
  return TONES[key].label;
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
  const [deleteError, setDeleteError] = useState<string | null>(null);
  // 피그마의 "저장하기" 버튼은 아무것도 안 바꾸면 비활성 상태 — 처음 불러온 값을 저장해뒀다가
  // 현재 값과 비교해서 뭔가 바뀐 경우에만 버튼을 활성화한다(2026-09-14).
  const [initialSnapshot, setInitialSnapshot] = useState<string | null>(null);

  // 아래 조회가 **성공했을 때만** initialSnapshot 이 채워진다. 그래서 실패를 따로 들어야
  // 한다(2026-09-26) — 안 그러면 "불러오는 중..."에서 영원히 멈춘다. 가드를 넣기 전에는
  // 기본값 폼이라도 떴으니, 이건 어제 넣은 가드가 만든 새 버그다. 이 저장소에서 /api 가
  // 전면 401 이 되는 상황(로컬 ADC 만료)은 실제로 반복됐다.
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    return onAuthStateChanged(auth, async (u) => {
      if (!u) return;
      setUser(u);
      // getIdToken 도 fetch 도 json 도 전부 던질 수 있다. 던지면 이 async 콜백이 reject 되고
      // 파이어베이스는 그걸 잡아주지 않는다 — 실패를 반드시 여기서 끝낸다.
      try {
      const idToken = await u.getIdToken();
      const res = await fetch("/api/user/me", { headers: { Authorization: `Bearer ${idToken}` } });
      if (!res.ok) {
        setLoadFailed(true);
        return;
      }
      {
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
      } catch {
        setLoadFailed(true);
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
      const response = await fetch("/api/user/delete", {
        method: "POST",
        headers: { Authorization: `Bearer ${idToken}` },
      });
      // 응답을 보지 않고 로그아웃까지 해버리면, 서버가 막아도(환불 처리 중 409) 사용자는
      // 로그아웃돼서 메인으로 튕기고 "탈퇴됐다"고 믿는다. 계정은 그대로 살아 있는데 다시
      // 들어와 보기 전까지는 알 길이 없다(2026-09-24).
      if (!response.ok) {
        const failed = (await response.json().catch(() => ({}))) as { error?: string };
        setDeleteConfirmOpen(false);
        setDeleteError(failed.error ?? "탈퇴 처리에 실패했어요. 잠시 후 다시 시도해주세요.");
        return;
      }
      await signOut(auth);
      // 로그아웃과 같은 규칙 — 탈퇴한 사람도 로그인 카드가 아니라 메인 화면에서 나간다.
      router.replace("/");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="flex min-h-dvh flex-col overflow-visible bg-bg xl:h-full xl:overflow-hidden">
      <SubPageTopBar title="설정" />
      <div className="flex-1 overflow-visible p-4 pt-20 xl:overflow-y-auto scroll-gutter-stable">
        {/* 저장된 설정이 도착하기 전에는 폼을 그리지 않는다(2026-09-25). 네 컨트롤의 초기값이
            전부 기본값(어시스턴트 톤, 정방향만, 정시 기준, 자정 자시)이라, 그동안 화면은
            **남의 설정을 내 설정인 양** 보여준다. 눈에 거슬리는 데서 끝나지 않는다 — 그 사이에
            뭔가를 누르면 곧 도착하는 응답이 조용히 덮어써서, 분명히 바꿨는데 안 바뀐 것이 된다.
            initialSnapshot 은 응답이 왔을 때만 채워지므로 그대로 "다 왔는가"로 쓴다. */}
        {loadFailed ? (
          <p className="pt-8 text-center text-sm leading-relaxed text-icon-muted">
            설정을 불러오지 못했어요.
            <br />
            지금 저장하면 기본값이 덮어써질 수 있어 화면을 열지 않았어요.
          </p>
        ) : initialSnapshot === null ? (
          <p className="pt-8 text-center text-sm text-icon-muted">불러오는 중...</p>
        ) : (
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
                      {toneLabel(key)}
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
            className="self-center text-sm font-semibold text-point-text underline underline-offset-2"
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
        )}
      </div>
      <div className="shrink-0 border-t border-border bg-topbar p-4">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || !isDirty}
          className={`mx-auto block h-12 w-full max-w-2xl rounded-2xl text-lg font-semibold ${
            isDirty ? "border border-point-strong bg-point text-white" : "bg-chip-soft text-icon-muted"
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
      {deleteError && <InfoModal title={deleteError} tone="error" onClose={() => setDeleteError(null)} />}
    </div>
  );
}
