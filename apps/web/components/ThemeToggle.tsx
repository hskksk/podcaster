"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { cn } from "../lib/cn";
import { useTheme } from "./ThemeProvider";

const options = [
  { value: "light" as const, icon: Sun, label: "ライト" },
  { value: "dark" as const, icon: Moon, label: "ダーク" },
  { value: "system" as const, icon: Monitor, label: "システム" },
];

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme();

  return (
    <div
      className={cn(
        "inline-flex items-center rounded-lg border border-border bg-muted/50 p-0.5 text-muted-fg",
        className,
      )}
      role="group"
      aria-label="テーマ"
    >
      {options.map(({ value, icon: Icon, label }) => (
        <button
          key={value}
          type="button"
          title={label}
          aria-label={label}
          aria-pressed={theme === value}
          onClick={() => setTheme(value)}
          className={cn(
            "rounded-md p-1.5 transition-colors",
            theme === value
              ? "bg-surface text-fg shadow-sm"
              : "hover:text-fg",
          )}
        >
          <Icon className="size-4" strokeWidth={1.75} />
        </button>
      ))}
    </div>
  );
}
