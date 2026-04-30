import React, { useEffect, useMemo } from 'react';
import { Text } from 'ink';
import { Marked } from 'marked';
import { markedTerminal } from 'marked-terminal';
import { parse as parseUniTeX } from 'unitex-kokic';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkMath from 'remark-math';
import { visit } from 'unist-util-visit';
import { getTuiLocalConfig } from '../config/local-config.js';

type MathReplacement = {
  start: number;
  end: number;
  text: string;
};

function isSimpleFractionAtom(s: string): boolean {
  const value = s.trim();
  if (!value) return false;

  // Superscript/Subscript and modifier-letter ranges commonly emitted by UniTeX.
  const supSubChar = (ch: string): boolean => {
    const cp = ch.codePointAt(0);
    if (!cp) return false;
    return (
      (cp >= 0x2070 && cp <= 0x209f) || // Superscripts and Subscripts
      (cp >= 0x1d2c && cp <= 0x1d7f) || // Phonetic Extensions (superscript letters, etc.)
      (cp >= 0x02b0 && cp <= 0x02ff)    // Spacing Modifier Letters
    );
  };

  const isSupSubGrapheme = (grapheme: string): boolean => {
    let has = false;
    for (const ch of grapheme) {
      if (!supSubChar(ch)) return false;
      has = true;
    }
    return has;
  };

  const graphemes = [...new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(value)]
    .map((x) => x.segment);
  const base = graphemes.filter((g) => !isSupSubGrapheme(g));

  // "Single symbol" means exactly one non-sup/sub symbol remains.
  if (base.length !== 1) return false;

  const core = base[0];
  // Exclude obvious operators and delimiters.
  return !/[+\-*/=<>()[\]{}]/.test(core);
}

function stripRedundantFractionParens(input: string): string {
  return input.replace(/\(([^()]+)\)\/\(([^()]+)\)/g, (_m, num, den) => {
    const n = String(num).trim();
    const d = String(den).trim();
    if (isSimpleFractionAtom(n) && isSimpleFractionAtom(d)) {
      return `${n}/${d}`;
    }
    return `(${n})/(${d})`;
  });
}

interface MarkdownRendererProps {
  markdown: string;
  width: number;
  scrollOffset?: number;
  lineLimit?: number;
  onLineCountChange?: (lineCount: number) => void;
}

function renderLatexForTerminal(source: string, isBlock: boolean): string {
  const normalized = source.trim();
  const unitexInput = isBlock ? `$$${normalized}$$` : normalized;
  try {
    let parsed = parseUniTeX(unitexInput);
    // UniTeX may return an empty string for some block environments (e.g. pmatrix) when wrapped in $$...$$.
    if (isBlock && parsed.trim() === '') {
      parsed = parseUniTeX(normalized);
    }
    parsed = stripRedundantFractionParens(parsed);
    return isBlock ? parsed.trimEnd() : parsed.replace(/\s+/g, ' ').trim();
  } catch {
    // Keep a readable fallback if UniTeX fails to parse a fragment.
    return isBlock ? normalized : normalized.replace(/\s+/g, ' ').trim();
  }
}

function preprocessMathForTerminal(markdown: string): string {
  const tree = unified().use(remarkParse).use(remarkMath).parse(markdown);
  const replacements: MathReplacement[] = [];
  const mathLabel = getTuiLocalConfig().markdownMathLabel;

  visit(tree, (node: any) => {
    if (node?.type !== 'inlineMath' && node?.type !== 'math') return;
    const start = node?.position?.start?.offset;
    const end = node?.position?.end?.offset;
    if (typeof start !== 'number' || typeof end !== 'number') return;

    const raw = markdown.slice(start, end);
    const isInlineDoubleDollar =
      node.type === 'inlineMath' &&
      raw.startsWith('$$') &&
      raw.endsWith('$$');
    const isBlock = node.type === 'math' || isInlineDoubleDollar;
    const rendered = renderLatexForTerminal(String(node.value ?? ''), isBlock);
    const text = isBlock
      ? `\n[${mathLabel}\n${rendered}\n]\n`
      : `[${mathLabel} ${rendered}]`;
    replacements.push({ start, end, text });
  });

  if (replacements.length === 0) return markdown;

  let out = markdown;
  for (const r of replacements.sort((a, b) => b.start - a.start)) {
    out = out.slice(0, r.start) + r.text + out.slice(r.end);
  }
  return out;
}

export function renderMarkdownToTerminalLines(markdown: string, width: number): string[] {
  const normalized = markdown.replace(/\r\n?/g, '\n');
  const withMath = preprocessMathForTerminal(normalized);
  const parser = new Marked();

  parser.use(markedTerminal({
    reflowText: false,
    showSectionPrefix: false,
    hr: () => '-'.repeat(Math.max(3, width)),
  }) as any);

  parser.use({
    renderer: {
      text(token: any) {
        if (token && typeof token === 'object' && Array.isArray(token.tokens)) {
          return (this as any).parser.parseInline(token.tokens);
        }
        return token && typeof token === 'object' ? token.text : String(token ?? '');
      },
    },
  } as any);

  return String(parser.parse(withMath)).split('\n');
}

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({
  markdown,
  width,
  scrollOffset = 0,
  lineLimit,
  onLineCountChange,
}) => {
  const renderedLines = useMemo(
    () => renderMarkdownToTerminalLines(markdown, width),
    [markdown, width]
  );

  useEffect(() => {
    onLineCountChange?.(renderedLines.length);
  }, [renderedLines.length, onLineCountChange]);

  const visibleLines = lineLimit == null
    ? renderedLines
    : renderedLines.slice(scrollOffset, scrollOffset + lineLimit);

  return <Text>{visibleLines.join('\n')}</Text>;
};
