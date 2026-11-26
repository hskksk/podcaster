import type { MobileTab } from "./types";

const TABS: { id: MobileTab; icon: string; label: string }[] = [
  { id: "map", icon: "🗺", label: "地図" },
  { id: "t", icon: "📜", label: "年表" },
  { id: "f", icon: "🎛", label: "絞り込み" },
];

export function MobileTabBar(props: { tab: MobileTab; onTab: (tab: MobileTab) => void }) {
  const { tab, onTab } = props;
  return (
    <nav className="hm-tabs" aria-label="表示">
      {TABS.map((item) => (
        <button
          key={item.id}
          type="button"
          className={tab === item.id ? "on" : undefined}
          aria-current={tab === item.id ? "page" : undefined}
          onClick={() => onTab(item.id)}
        >
          {item.icon}
          <span>{item.label}</span>
        </button>
      ))}
    </nav>
  );
}
