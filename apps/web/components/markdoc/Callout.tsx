import { AlertCircle, AlertTriangle, Info } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "../../lib/cn";

const icons = {
  note: Info,
  warning: AlertTriangle,
  error: AlertCircle,
} as const;

export function Callout(props: { type?: string; children?: ReactNode }) {
  const type = (props.type || "note") as keyof typeof icons;
  const Icon = icons[type] ?? Info;
  return (
    <aside className={cn("callout", `callout-${type}`)}>
      <div className="flex gap-3">
        <Icon className="mt-0.5 size-4 shrink-0 opacity-80" strokeWidth={1.75} />
        <div className="min-w-0 flex-1">{props.children}</div>
      </div>
    </aside>
  );
}
