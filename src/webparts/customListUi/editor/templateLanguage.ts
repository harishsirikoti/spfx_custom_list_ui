/* eslint-disable @rushstack/no-new-null -- CodeMirror's CompletionSource API is defined as returning null for "no suggestions". */
import type { Completion, CompletionContext, CompletionResult, CompletionSource } from '@codemirror/autocomplete';
import { Decoration, MatchDecorator, ViewPlugin, type DecorationSet, type EditorView, type ViewUpdate } from '@codemirror/view';

import { getAllIconNames } from '../lucide/iconRegistry';

/**
 * Editor support for the template syntax. The template language itself is unchanged; this only adds
 * highlighting and suggestions for the placeholders the engine already understands.
 */

/** Matches every token of the template syntax (including the read-only legacy placeholders). */
const TOKEN_PATTERN: RegExp = /\{\{#each items\}\}|\{\{\/each\}\}|\{item\.[A-Za-z_][A-Za-z0-9_]*\}|\{wp_(?:title|description)\}/g;

const tokenDecoration: Decoration = Decoration.mark({ class: 'cm-clui-token' });
const legacyDecoration: Decoration = Decoration.mark({ class: 'cm-clui-legacy' });

const tokenMatcher: MatchDecorator = new MatchDecorator({
  regexp: TOKEN_PATTERN,
  decoration: (match) => (match[0].indexOf('{wp_') === 0 ? legacyDecoration : tokenDecoration)
});

/** Highlights {{#each items}}, {{/each}} and {item.X} so they stand out from the surrounding HTML. */
export const placeholderHighlighter = ViewPlugin.fromClass(
  class {
    public decorations: DecorationSet;

    public constructor(view: EditorView) {
      this.decorations = tokenMatcher.createDeco(view);
    }

    public update(update: ViewUpdate): void {
      this.decorations = tokenMatcher.updateDeco(update, this.decorations);
    }
  },
  { decorations: (plugin) => plugin.decorations }
);

/**
 * Suggests the repeat block markers and {item.X} placeholders when the user types "{".
 * @param getFieldNames - Returns the internal names of fields the renderer can display (read lazily, so the
 *   list can change after the editor was created).
 */
export function createPlaceholderCompletionSource(getFieldNames: () => string[]): CompletionSource {
  return (context: CompletionContext): CompletionResult | null => {
    const match = context.matchBefore(/\{{1,2}[#/\w. ]*/);
    if (!match) {
      return null;
    }

    const options: Completion[] = [
      { label: '{{#each items}}', type: 'keyword', detail: 'start of repeated block', boost: 2 },
      { label: '{{/each}}', type: 'keyword', detail: 'end of repeated block', boost: 1 },
      ...getFieldNames().map((name) => ({ label: `{item.${name}}`, type: 'property', detail: 'list field' }))
    ];
    return { from: match.from, options, validFor: /^\{{1,2}[#/\w. ]*$/ };
  };
}

let lucideOptions: Completion[] | undefined;

/** Suggests Lucide icon names while typing the value of name="" inside an <icon ...> tag. */
export const lucideNameCompletionSource: CompletionSource = (context: CompletionContext): CompletionResult | null => {
  const line = context.state.doc.lineAt(context.pos);
  const before: string = line.text.slice(0, context.pos - line.from);
  const match = /<icon\b[^>]*\bname="([a-z0-9-]*)$/.exec(before);
  if (!match) {
    return null;
  }
  if (!lucideOptions) {
    lucideOptions = getAllIconNames().map((name) => ({ label: name, type: 'constant' }));
  }
  return { from: context.pos - match[1].length, options: lucideOptions, validFor: /^[a-z0-9-]*$/ };
};

