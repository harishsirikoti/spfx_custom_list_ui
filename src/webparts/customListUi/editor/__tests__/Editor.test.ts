/* eslint-disable @rushstack/no-new-null -- helper mirrors the CodeMirror CompletionSource signature, which returns null. */
import { CompletionContext, type CompletionResult } from '@codemirror/autocomplete';
import { html } from '@codemirror/lang-html';
import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';

import { getFieldSupport } from '../../templating/FieldSupport';
import { createEditorTheme } from '../editorThemes';
import { createPlaceholderCompletionSource, iconCompletionSource, placeholderHighlighter } from '../templateLanguage';

/** Runs a completion source at the end of `doc` (the cursor position). */
function complete(source: (c: CompletionContext) => CompletionResult | null | Promise<CompletionResult | null>, doc: string): CompletionResult | null {
  const state: EditorState = EditorState.create({ doc, extensions: [html()] });
  return source(new CompletionContext(state, doc.length, false)) as CompletionResult | null;
}

describe('placeholder completion', () => {
  const source = createPlaceholderCompletionSource(() => ['Title', 'EventDate']);

  it('offers repeat markers and fields after "{"', () => {
    const result = complete(source, '<p>{');
    expect(result).not.toBeNull();
    const labels = result!.options.map((o) => o.label);
    expect(labels).toEqual(['{{#each items}}', '{{/each}}', '{item.Title}', '{item.EventDate}']);
    expect(result!.from).toBe(3);
  });

  it('replaces the whole typed token, including "{{" and "item."', () => {
    expect(complete(source, 'x {{#ea')!.from).toBe(2);
    expect(complete(source, 'x {item.Ti')!.from).toBe(2);
  });

  it('does nothing outside placeholders', () => {
    expect(complete(source, '<p>hello')).toBeNull();
  });
});

describe('icon completion', () => {
  it('offers Uicons names after "fi-rr-" only', () => {
    const result = complete(iconCompletionSource, '<i class="fi fi-rr-cal');
    expect(result!.options.some((o) => o.label === 'fi-rr-calendar')).toBe(true);
    expect(complete(iconCompletionSource, '<i class="fi ')).toBeNull();
  });
});

describe('editor view', () => {
  it('can be created with the editor extensions, synchronized and destroyed', () => {
    const parent: HTMLDivElement = document.createElement('div');
    document.body.appendChild(parent);
    const view = new EditorView({
      state: EditorState.create({
        doc: '<div>{{#each items}}{item.Title}{{/each}}</div>',
        extensions: [html(), placeholderHighlighter, createEditorTheme(false), createEditorTheme(true)]
      }),
      parent
    });

    // Inserting text at the cursor (what "Insert Field" does).
    view.dispatch({ changes: { from: 0, insert: '{item.EventDate}' }, selection: { anchor: 16 } });
    expect(view.state.doc.toString().indexOf('{item.EventDate}')).toBe(0);
    expect(view.state.selection.main.anchor).toBe(16);

    view.destroy();
    parent.remove();
  });
});

describe('field support for the field picker', () => {
  it('allows simple and hyperlink fields', () => {
    expect(getFieldSupport({ title: 'Title', internalName: 'Title', typeAsString: 'Text' }).supported).toBe(true);
    expect(getFieldSupport({ title: 'Due', internalName: 'Due_x0020_Date', typeAsString: 'DateTime' }).supported).toBe(true);
    expect(getFieldSupport({ title: 'Link', internalName: 'Link', typeAsString: 'URL' }).supported).toBe(true);
    expect(getFieldSupport({ title: 'Tags', internalName: 'Tags', typeAsString: 'MultiChoice' }).supported).toBe(true);
  });

  it('marks person, lookup and managed metadata fields as unsupported with a reason', () => {
    ['User', 'UserMulti', 'Lookup', 'LookupMulti', 'TaxonomyFieldType', 'TaxonomyFieldTypeMulti'].forEach((typeAsString) => {
      const s = getFieldSupport({ title: 'X', internalName: 'X', typeAsString });
      expect(s.supported).toBe(false);
      expect(s.reason).toBeTruthy();
    });
  });

  it('requires the field to exist in the retrieved data, and a valid template name', () => {
    const field = { title: 'Notes', internalName: 'Notes', typeAsString: 'Note' };
    expect(getFieldSupport(field, { Title: 'a' }).supported).toBe(false);
    expect(getFieldSupport(field, { Notes: null }).supported).toBe(true);
    expect(getFieldSupport({ title: 'Bad', internalName: 'Bad-Name', typeAsString: 'Text' }).supported).toBe(false);
  });
});
