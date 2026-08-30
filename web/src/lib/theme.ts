export type Theme = "system" | "light" | "dark";

const KEY = "tally.theme";

/**
 * Applies a theme by stamping the root element. "system" removes the stamp so
 * the CSS media query decides, which is what most people want most of the time.
 */
export function applyTheme(theme: Theme): void {
  if (theme === "system") {
    document.documentElement.removeAttribute("data-theme");
  } else {
    document.documentElement.setAttribute("data-theme", theme);
  }
  try {
    localStorage.setItem(KEY, theme);
  } catch {
    // Private windows and blocked site data both throw here. The theme still
    // applies for this page view; it just will not be remembered.
  }
}

export function storedTheme(): Theme {
  try {
    const stored = localStorage.getItem(KEY);
    if (stored === "light" || stored === "dark" || stored === "system") return stored;
  } catch {
    // Same as above: fall through to the system default.
  }
  return "system";
}
