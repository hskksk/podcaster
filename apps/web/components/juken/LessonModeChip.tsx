import { cn } from "../../lib/cn";
import type { LessonMode } from "../../lib/juken/lesson-meta";

export function LessonModeChip(props: { mode: LessonMode; label: string; className?: string }) {
  return (
    <span
      className={cn(
        "j-mode",
        props.mode === "roleplay" ? "j-mode--roleplay" : "j-mode--observation",
        props.className,
      )}
    >
      {props.label}
    </span>
  );
}
