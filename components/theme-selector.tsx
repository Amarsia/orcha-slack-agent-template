"use client";

import { Laptop, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

const options = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Laptop },
] as const;

export function ThemeSelector() {
  const { theme, setTheme } = useTheme();
  return (
    <div className="theme-selector" role="radiogroup" aria-label="Color theme">
      {options.map(({ value, label, icon: Icon }) => (
        <button
          key={value}
          type="button"
          role="radio"
          aria-checked={(theme ?? "system") === value}
          aria-label={`${label} theme`}
          title={label}
          data-selected={(theme ?? "system") === value || undefined}
          onClick={() => setTheme(value)}
        >
          <Icon aria-hidden="true" />
        </button>
      ))}
    </div>
  );
}
