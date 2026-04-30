#!/usr/bin/env tsx
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkMath from 'remark-math';
import { visit } from 'unist-util-visit';

const samples = [
  '$$\\frac{a}{b}$$',
  '$\\frac{a}{b}$',
  'text before $$\\frac{a}{b}$$ text after',
  '- $\\frac{a}{b}$',
  '$$\n\\frac{a}{b}\n$$',
];

for (const source of samples) {
  console.log('='.repeat(80));
  console.log(`SOURCE: ${source}`);

  const tree = unified().use(remarkParse).use(remarkMath).parse(source);
  const nodes: Array<Record<string, unknown>> = [];

  visit(tree, (node: any) => {
    if (node.type === 'math' || node.type === 'inlineMath') {
      nodes.push({
        type: node.type,
        value: node.value,
        start: node.position?.start,
        end: node.position?.end,
      });
    }
  });

  console.log('MATH NODES:', JSON.stringify(nodes, null, 2));
}
