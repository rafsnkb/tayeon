export const THEME_STORAGE_KEY = "tayeon-theme";

export type Theme = "light" | "dark" | "system";
type ResolvedTheme = "light" | "dark";

function prefersDark(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export function resolveTheme(theme: Theme): ResolvedTheme {
  if (theme === "system") return prefersDark() ? "dark" : "light";
  return theme;
}

export function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle("dark", resolveTheme(theme) === "dark");
}

export function getStoredTheme(): Theme {
  if (typeof window === "undefined") return "system";
  const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
  return stored === "dark" || stored === "light" ? stored : "system";
}

export function setStoredTheme(theme: Theme) {
  window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  applyTheme(theme);
}

/** Inlined in <head> as a blocking script to avoid a flash of the wrong theme before hydration.
 * No stored value (or "system") falls back to the OS preference via matchMedia. */
export const THEME_INIT_SCRIPT = `
(function () {
  try {
    var theme = localStorage.getItem("${THEME_STORAGE_KEY}");
    var dark = theme === "dark" || (theme !== "light" && window.matchMedia("(prefers-color-scheme: dark)").matches);
    if (dark) document.documentElement.classList.add("dark");
  } catch (e) {}
})();
`;
