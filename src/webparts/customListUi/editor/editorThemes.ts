import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import type { Extension } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { tags } from '@lezer/highlight';

/** Colors for one editor theme. All text/background pairs meet WCAG AA contrast (4.5:1). */
interface IPalette {
  background: string;
  text: string;
  gutterBackground: string;
  gutterText: string;
  selection: string;
  activeLine: string;
  tagName: string;
  attributeName: string;
  attributeValue: string;
  comment: string;
  punctuation: string;
  keyword: string;
  tokenBackground: string;
  tokenText: string;
  legacyBackground: string;
  legacyText: string;
}

const LIGHT: IPalette = {
  background: '#ffffff',
  text: '#201f1e',
  gutterBackground: '#f3f2f1',
  gutterText: '#605e5c',
  selection: '#b3d6f2',
  activeLine: '#f3f9fd',
  tagName: '#0b5394',
  attributeName: '#8a3b00',
  attributeValue: '#a31515',
  comment: '#556b2f',
  punctuation: '#605e5c',
  keyword: '#7a2d8f',
  tokenBackground: '#deecf9',
  tokenText: '#004578',
  legacyBackground: '#fff4ce',
  legacyText: '#5c3d00'
};

const DARK: IPalette = {
  background: '#1b1a19',
  text: '#f3f2f1',
  gutterBackground: '#252423',
  gutterText: '#c8c6c4',
  selection: '#264f78',
  activeLine: '#252423',
  tagName: '#7cc0f4',
  attributeName: '#f0b57a',
  attributeValue: '#ec9a85',
  comment: '#9fc08f',
  punctuation: '#bebbb8',
  keyword: '#d7a6e8',
  tokenBackground: '#0e3a5a',
  tokenText: '#c7e0f4',
  legacyBackground: '#4d3b00',
  legacyText: '#fff4ce'
};

/**
 * Builds the editor theme (chrome plus syntax colors) for light or dark surroundings.
 * @param dark - True when the surrounding SharePoint theme is dark, so the editor stays readable.
 */
export function createEditorTheme(dark: boolean): Extension {
  const p: IPalette = dark ? DARK : LIGHT;

  const chrome: Extension = EditorView.theme(
    {
      '&': { height: '100%', backgroundColor: p.background, color: p.text, fontSize: '13px' },
      '&.cm-focused': { outline: '2px solid #0078d4', outlineOffset: '-2px' },
      '.cm-scroller': {
        overflow: 'auto',
        fontFamily: 'Consolas, "Courier New", monospace',
        lineHeight: '1.5'
      },
      '.cm-content': { caretColor: p.text },
      '.cm-cursor, .cm-dropCursor': { borderLeftColor: p.text },
      '.cm-gutters': { backgroundColor: p.gutterBackground, color: p.gutterText, border: 'none' },
      '.cm-activeLine': { backgroundColor: p.activeLine },
      '.cm-activeLineGutter': { backgroundColor: p.activeLine },
      '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection': {
        backgroundColor: p.selection
      },
      '.cm-matchingBracket': { backgroundColor: p.selection, outline: `1px solid ${p.punctuation}` },
      '.cm-clui-token': {
        backgroundColor: p.tokenBackground,
        color: p.tokenText,
        borderRadius: '3px',
        fontWeight: '600'
      },
      '.cm-clui-legacy': { backgroundColor: p.legacyBackground, color: p.legacyText, borderRadius: '3px' },
      '.cm-tooltip': { backgroundColor: p.background, color: p.text, border: `1px solid ${p.gutterText}` },
      '.cm-tooltip-autocomplete ul li[aria-selected]': { backgroundColor: p.selection, color: p.text },
      '.cm-panels': { backgroundColor: p.gutterBackground, color: p.text },
      '.cm-panels input, .cm-panels button': { fontSize: '12px' }
    },
    { dark }
  );

  const highlight: HighlightStyle = HighlightStyle.define([
    { tag: tags.tagName, color: p.tagName },
    { tag: tags.angleBracket, color: p.punctuation },
    { tag: tags.attributeName, color: p.attributeName },
    { tag: [tags.attributeValue, tags.string], color: p.attributeValue },
    { tag: tags.comment, color: p.comment, fontStyle: 'italic' },
    { tag: [tags.keyword, tags.documentMeta], color: p.keyword },
    { tag: tags.punctuation, color: p.punctuation }
  ]);

  return [chrome, syntaxHighlighting(highlight)];
}
