// Preview-only card. Not an app component — it exists so the colour set can
// be judged as a colour set.
//
// Every other card in this design system renders in light mode: the preview
// HTML hardcodes a white body and nothing applies the `dark` class, so half
// of a two-theme token set is invisible in the gallery. This card shows both
// columns side by side, and pairs them with the contrast ratio of the
// combinations the app actually ships — the number is what settles whether a
// colour is a taste question or a defect.
//
// Values come from compiled/tokens.ts, generated out of globals.css by
// make-css.mjs, so a swatch can never disagree with the stylesheet.
import React from "react";
import { DARK, LIGHT } from "./compiled/tokens";

const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

function channels(hex: string): number[] {
  const h = hex.slice(1);
  const full = h.length === 3 ? [...h].map((c) => c + c).join("") : h;
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16) / 255);
}

function luminance(hex: string): number {
  const [r, g, b] = channels(hex).map((v) =>
    v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4,
  );
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** null when either colour is non-opaque (point-bg is an rgba wash) — a ratio
 *  against a translucent layer would depend on what sits under it. */
function ratio(fg: string, bg: string): number | null {
  if (!HEX.test(fg) || !HEX.test(bg)) return null;
  const a = luminance(fg);
  const b = luminance(bg);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

const GROUPS: { title: string; tokens: string[] }[] = [
  { title: "면", tokens: ["bg", "surface", "topbar", "chip-fill", "border"] },
  {
    title: "글자",
    tokens: ["bold-text", "text", "icon-muted", "placeholder", "chip-muted-text"],
  },
  {
    title: "브랜드",
    tokens: ["point", "point-strong", "point-muted", "point-text", "point-bg", "accent", "gold"],
  },
  { title: "액션", tokens: ["cta-fill", "cta-text"] },
  {
    title: "상태",
    tokens: ["urgent", "urgent-text", "success", "success-text", "warning", "warning-text"],
  },
];

// The combinations the app ships. `fg`/`bg` are token names; a literal hex is
// allowed where the code hardcodes one (chips and the brand fill carry
// text-white in every call site, not a token).
const PAIRS: { label: string; fg: string; bg: string; exempt?: string }[] = [
  { label: "제목", fg: "bold-text", bg: "bg" },
  { label: "본문", fg: "text", bg: "surface" },
  { label: "라벨 / 아이콘", fg: "icon-muted", bg: "surface" },
  { label: "입력창 placeholder", fg: "placeholder", bg: "bg" },
  { label: "보조 문구", fg: "placeholder", bg: "surface" },
  { label: "칩 위 글씨", fg: "#ffffff", bg: "chip-fill" },
  {
    label: "비활성 버튼 라벨",
    fg: "chip-muted-text",
    bg: "chip-fill",
    exempt: "비활성 컨트롤은 WCAG 대상 아님",
  },
  { label: "분홍 링크", fg: "point-text", bg: "bg" },
  { label: "분홍 버튼", fg: "#ffffff", bg: "point" },
  { label: "환불가능 뱃지", fg: "success-text", bg: "success" },
  { label: "경고 뱃지", fg: "urgent-text", bg: "urgent" },
  { label: "안내 배너", fg: "warning-text", bg: "warning" },
  { label: "테두리", fg: "border", bg: "bg", exempt: "비텍스트 기준 3.0" },
];

const resolve = (name: string, set: Record<string, string>) =>
  HEX.test(name) ? name : (set[name] ?? "#ff00ff");

function Swatch({ name, value, onDark }: { name: string; value: string; onDark: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "3px 0" }}>
      <span
        style={{
          width: 34,
          height: 34,
          borderRadius: 8,
          background: value,
          border: `1px solid ${onDark ? "#3a3d44" : "#ddd6e8"}`,
          flex: "none",
        }}
      />
      <span style={{ minWidth: 0 }}>
        <span style={{ display: "block", fontSize: 12, fontWeight: 600 }}>{name}</span>
        <span style={{ display: "block", fontSize: 11, opacity: 0.6, fontVariantNumeric: "tabular-nums" }}>
          {value}
        </span>
      </span>
    </div>
  );
}

function PairRow({ pair, set, onDark }: { pair: (typeof PAIRS)[number]; set: Record<string, string>; onDark: boolean }) {
  const fg = resolve(pair.fg, set);
  const bg = resolve(pair.bg, set);
  const r = ratio(fg, bg);
  // 4.5 is the floor for body-size text; 3.0 is the large-text and non-text
  // floor. Exempt rows still show the number — it is context, not a verdict.
  const mark = r === null ? "–" : r >= 4.5 ? "✓" : r >= 3 ? "△" : "✗";
  const markColor =
    pair.exempt || r === null ? (onDark ? "#868b9a" : "#6b5c84") : r >= 4.5 ? "#2e7d32" : r >= 3 ? "#a8720b" : "#c8322d";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "5px 0" }}>
      <span
        style={{
          background: bg,
          color: fg,
          borderRadius: 999,
          padding: "5px 12px",
          fontSize: 12,
          fontWeight: 600,
          flex: "none",
          border: `1px solid ${onDark ? "#3a3d44" : "#ddd6e8"}`,
        }}
      >
        {pair.label}
      </span>
      <span style={{ fontSize: 12, fontVariantNumeric: "tabular-nums", color: markColor, fontWeight: 700 }}>
        {r === null ? "측정 불가" : r.toFixed(2)} {mark}
      </span>
      {pair.exempt && (
        <span style={{ fontSize: 11, opacity: 0.55 }}>{pair.exempt}</span>
      )}
    </div>
  );
}

function Column({ theme }: { theme: "light" | "dark" }) {
  const onDark = theme === "dark";
  const set = onDark ? DARK : LIGHT;
  return (
    <div
      style={{
        flex: 1,
        minWidth: 0,
        padding: 20,
        borderRadius: 16,
        background: set["bg"],
        color: set["bold-text"],
        border: `1px solid ${set["border"]}`,
        fontFamily: "var(--font-pretendard), system-ui, sans-serif",
      }}
    >
      <h3 style={{ margin: "0 0 14px", fontSize: 15, fontWeight: 700 }}>
        {onDark ? "다크" : "라이트"}
      </h3>

      {GROUPS.map((g) => (
        <section key={g.title} style={{ marginBottom: 14 }}>
          <h4 style={{ margin: "0 0 4px", fontSize: 11, fontWeight: 700, opacity: 0.55 }}>
            {g.title}
          </h4>
          {g.tokens.map((t) => (
            <Swatch key={t} name={t} value={set[t]} onDark={onDark} />
          ))}
        </section>
      ))}

      <h4 style={{ margin: "18px 0 6px", fontSize: 11, fontWeight: 700, opacity: 0.55 }}>
        조합 대비
      </h4>
      {PAIRS.map((p) => (
        <PairRow key={p.label} pair={p} set={set} onDark={onDark} />
      ))}
    </div>
  );
}

export function TokenSpecimen() {
  return (
    <div style={{ display: "flex", gap: 16, alignItems: "flex-start", padding: 4 }}>
      <Column theme="light" />
      <Column theme="dark" />
    </div>
  );
}
