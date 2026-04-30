import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parse as parseToml } from 'smol-toml';

export interface TuiLocalConfig {
  markdownMathLabel: string;
}

const DEFAULT_CONFIG: TuiLocalConfig = {
  markdownMathLabel: 'ᵐ',
};

type RawConfig = {
  tui?: {
    math_label?: unknown;
    markdown?: {
      math_label?: unknown;
    };
  };
};

class TuiLocalConfigStore {
  private static _instance: TuiLocalConfigStore | null = null;
  private cache: TuiLocalConfig | null = null;

  static instance(): TuiLocalConfigStore {
    if (!TuiLocalConfigStore._instance) {
      TuiLocalConfigStore._instance = new TuiLocalConfigStore();
    }
    return TuiLocalConfigStore._instance;
  }

  get(): TuiLocalConfig {
    if (this.cache) return this.cache;
    this.cache = this.loadFromToml();
    return this.cache;
  }

  reload(): TuiLocalConfig {
    this.cache = this.loadFromToml();
    return this.cache;
  }

  private loadFromToml(): TuiLocalConfig {
    const configPath = resolve('config.toml');
    if (!existsSync(configPath)) return DEFAULT_CONFIG;

    try {
      const raw = parseToml(readFileSync(configPath, 'utf8')) as RawConfig;
      const section = raw.tui;
      const nested = section?.markdown?.math_label;
      const flat = section?.math_label;
      const label = typeof nested === 'string'
        ? nested
        : typeof flat === 'string'
          ? flat
          : DEFAULT_CONFIG.markdownMathLabel;
      return {
        markdownMathLabel: label.trim() || DEFAULT_CONFIG.markdownMathLabel,
      };
    } catch {
      return DEFAULT_CONFIG;
    }
  }
}

export const tuiLocalConfigStore = TuiLocalConfigStore.instance();

export function getTuiLocalConfig(): TuiLocalConfig {
  return tuiLocalConfigStore.get();
}
