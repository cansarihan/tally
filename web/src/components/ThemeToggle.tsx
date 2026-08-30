import { useEffect, useState } from "react";

import { applyTheme, storedTheme, type Theme } from "../lib/theme";

const ORDER: readonly Theme[] = ["system", "light", "dark"];
const LABELS: Record<Theme, string> = { system: "System", light: "Light", dark: "Dark" };

/** Cycles system → light → dark. Three states, so a switch would misrepresent it. */
export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(storedTheme);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  return (
    <button
      className="button"
      data-kind="ghost"
      onClick={() => setTheme(ORDER[(ORDER.indexOf(theme) + 1) % ORDER.length]!)}
      title="Change appearance"
    >
      {LABELS[theme]}
    </button>
  );
}
