import { Schema, Config } from '@markdoc/markdoc';
import { ReactNode } from 'react';

interface MarkdocExtensions {
    nodes?: Record<string, Schema>;
    tags?: Record<string, Schema>;
    variables?: Config['variables'];
    functions?: Config['functions'];
}
/**
 * Who decides whether tags inside fences run.
 * - `document`: the document decides, per fence language and `{% process %}`.
 * - `off`: every fence is literal. The document cannot turn execution back on.
 */
type FenceTagMode = 'document' | 'off';
interface CreateMarkdocConfigOptions {
    fenceTags?: FenceTagMode;
}

declare function createMarkdocConfig(extensions?: MarkdocExtensions, options?: CreateMarkdocConfigOptions): Config;

declare function createFenceSchema(mode: FenceTagMode): Schema;
declare const builtinNodes: Record<string, Schema>;

declare const builtinTags: Record<string, Schema>;

declare function childText(node: ReactNode): string;
declare function slugify(input: string): string;

export { type CreateMarkdocConfigOptions as C, type FenceTagMode as F, type MarkdocExtensions as M, builtinTags as a, builtinNodes as b, childText as c, createMarkdocConfig as d, createFenceSchema as e, slugify as s };
