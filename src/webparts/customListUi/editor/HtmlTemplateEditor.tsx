import * as React from 'react';
import { autocompletion, completionKeymap } from '@codemirror/autocomplete';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { html } from '@codemirror/lang-html';
import { bracketMatching, indentOnInput } from '@codemirror/language';
import { search, searchKeymap } from '@codemirror/search';
import { Annotation, Compartment, EditorState, type Extension } from '@codemirror/state';
import {
  EditorView,
  highlightActiveLine,
  highlightActiveLineGutter,
  keymap,
  lineNumbers
} from '@codemirror/view';

import { createEditorTheme } from './editorThemes';
import {
  createPlaceholderCompletionSource,
  lucideNameCompletionSource,
  placeholderHighlighter
} from './templateLanguage';

/** Marks transactions that come from the host (React props), so they are not echoed back through onChange. */
const ExternalChange = Annotation.define<boolean>();

/** Methods the parent can call on the editor. */
export interface IHtmlTemplateEditorHandle {
  /** Replaces the selection with `text` at the cursor, moves the cursor after it and focuses the editor. */
  insertText: (text: string) => void;
  focus: () => void;
}

export interface IHtmlTemplateEditorProps {
  /** Current draft text. Changes made by the parent are synchronized into the editor without recreating it. */
  value: string;
  /** Called with the full text whenever the user edits it. */
  onChange: (value: string) => void;
  /** Internal names of the fields offered by {item.X} autocomplete. */
  fieldNames: string[];
  /** True for a dark surrounding theme, so the editor stays readable. */
  isDark: boolean;
  /** Accessible name of the editor. */
  ariaLabel: string;
}

/**
 * CodeMirror 6 editor for the HTML template: syntax highlighting, line numbers, indentation, tag closing,
 * bracket matching, tag/attribute/placeholder/icon autocomplete and search.
 *
 * The EditorView is created once when the component mounts and destroyed when it unmounts.
 */
export const HtmlTemplateEditor = React.forwardRef<IHtmlTemplateEditorHandle, IHtmlTemplateEditorProps>((props, ref) => {
  const { value, onChange, fieldNames, isDark, ariaLabel } = props;

  const host = React.useRef<HTMLDivElement>(null);
  const viewRef = React.useRef<EditorView | undefined>(undefined);
  const themeCompartment = React.useRef<Compartment>(new Compartment());

  // Latest props are read through refs so the long-lived editor never needs to be recreated.
  const onChangeRef = React.useRef(onChange);
  onChangeRef.current = onChange;
  const fieldNamesRef = React.useRef<string[]>(fieldNames);
  fieldNamesRef.current = fieldNames;
  /** The last text the editor and the host agreed on; lets us skip no-op synchronizations. */
  const lastKnownText = React.useRef<string>(value);

  // Create the editor once.
  React.useEffect(() => {
    if (!host.current) {
      return undefined;
    }

    const placeholderSource = createPlaceholderCompletionSource(() => fieldNamesRef.current);
    const extensions: Extension[] = [
      lineNumbers(),
      highlightActiveLineGutter(),
      highlightActiveLine(),
      history(),
      indentOnInput(),
      bracketMatching(),
      EditorView.lineWrapping,
      search({ top: true }),
      html({ autoCloseTags: true, matchClosingTags: true }),
      autocompletion(),
      // Extra suggestion sources next to the HTML tag/attribute completions that lang-html provides.
      EditorState.languageData.of(() => [
        { autocomplete: placeholderSource },
        { autocomplete: lucideNameCompletionSource }
      ]),
      placeholderHighlighter,
      keymap.of([...completionKeymap, ...searchKeymap, ...historyKeymap, ...defaultKeymap]),
      EditorView.contentAttributes.of({ 'aria-label': ariaLabel, 'aria-multiline': 'true' }),
      themeCompartment.current.of(createEditorTheme(isDark)),
      EditorView.updateListener.of((update) => {
        if (update.docChanged && !update.transactions.some((tr) => tr.annotation(ExternalChange))) {
          const text: string = update.state.doc.toString();
          lastKnownText.current = text;
          onChangeRef.current(text);
        }
      })
    ];

    const view: EditorView = new EditorView({
      state: EditorState.create({ doc: lastKnownText.current, extensions }),
      parent: host.current
    });
    viewRef.current = view;

    return () => {
      view.destroy();
      viewRef.current = undefined;
    };
    // The editor is created once per mount; later prop changes are applied by the effects below.
  }, []);

  // Apply text changed by the host (for example import or reset) while keeping the cursor where practical.
  React.useEffect(() => {
    const view: EditorView | undefined = viewRef.current;
    if (!view || value === lastKnownText.current) {
      return;
    }
    const current: string = view.state.doc.toString();
    lastKnownText.current = value;
    if (current !== value) {
      view.dispatch({
        changes: { from: 0, to: current.length, insert: value },
        selection: { anchor: Math.min(view.state.selection.main.anchor, value.length) },
        annotations: ExternalChange.of(true)
      });
    }
  }, [value]);

  // Switch between the light and dark theme without recreating the editor.
  React.useEffect(() => {
    viewRef.current?.dispatch({ effects: themeCompartment.current.reconfigure(createEditorTheme(isDark)) });
  }, [isDark]);

  React.useImperativeHandle(
    ref,
    () => ({
      insertText: (text: string): void => {
        const view: EditorView | undefined = viewRef.current;
        if (!view) {
          return;
        }
        const { from, to } = view.state.selection.main;
        view.dispatch({
          changes: { from, to, insert: text },
          selection: { anchor: from + text.length },
          scrollIntoView: true,
          userEvent: 'input'
        });
        view.focus();
      },
      focus: (): void => viewRef.current?.focus()
    }),
    []
  );

  // Escape closes an open autocomplete list or search bar inside the editor; it must not also dismiss the
  // surrounding panel.
  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>): void => {
    if (e.key === 'Escape' && host.current?.querySelector('.cm-tooltip-autocomplete, .cm-search')) {
      e.stopPropagation();
    }
  };

  return <div ref={host} style={{ height: '100%', minHeight: 0 }} onKeyDown={handleKeyDown} />;
});

HtmlTemplateEditor.displayName = 'HtmlTemplateEditor';
