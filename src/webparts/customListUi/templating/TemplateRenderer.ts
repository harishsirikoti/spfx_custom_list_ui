import type { IListItem } from '../models/ListModels';
import { sanitizeHtml } from './HtmlSanitizer';
import { MAX_TEMPLATE_LENGTH, parseTemplate } from './TemplateParser';
import type { IFieldNode, TemplateNode } from './TemplateTypes';

/** A template that parsed and validated successfully. */
export interface ICompiledTemplate {
  nodes: TemplateNode[];
  /** Internal field names referenced by {item.X}. */
  itemFields: string[];
  /** True when the template contains a {{#each items}} block. */
  hasEachBlock: boolean;
  /** True when the template uses Uicons classes, so the icon styles must be loaded. */
  usesIcons: boolean;
}

/** Outcome of compiling a template: either a compiled template or a list of readable errors. */
export interface ICompileResult {
  template?: ICompiledTemplate;
  errors: string[];
  /** Non-blocking notes (legacy placeholders, removed classes, unavailable icons). */
  warnings: string[];
}

/** Saved values of the removed web part title/description properties, used in legacy-placeholder messages. */
export interface ILegacyValues {
  title: string;
  description: string;
}

/** Values available to placeholders while rendering. */
export interface IRenderContext {
  /** Saved value of the removed wp_title property; only used by legacy {wp_title} placeholders. */
  legacyTitle: string;
  /** Saved value of the removed wp_description property; only used by legacy {wp_description} placeholders. */
  legacyDescription: string;
  items: IListItem[];
}

/** Outcome of rendering: sanitized HTML, or errors that prevented rendering. */
export interface IRenderResult {
  html: string;
  errors: string[];
}

/** Replacement values used while validating a template, where no real data exists yet. */
const SAMPLE_TEXT: string = 'x';
const SAMPLE_URL: string = 'https://example.com/x';

/** Escapes a string for use in HTML text and in quoted attribute values. */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/`/g, '&#96;');
}

/**
 * Converts a SharePoint REST field value to display text.
 * Handles nulls, primitives, multi-value fields, hyperlink and managed-metadata objects.
 */
export function formatFieldValue(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  if (Array.isArray(value)) {
    return value.map(formatFieldValue).filter((v) => v !== '').join(', ');
  }
  if (typeof value === 'object') {
    const record: Record<string, unknown> = value as Record<string, unknown>;
    // Hyperlink/picture fields expose Url, managed metadata exposes Label, lookups may expose Value/Title.
    const known: unknown = record.Url ?? record.Label ?? record.Title ?? record.Value;
    return typeof known === 'string' ? known : '';
  }
  return '';
}

/** Converts a value for insertion according to the HTML context of its placeholder. */
function encodeForContext(value: string, context: IFieldNode['context']): string {
  if (context === 'urlPart') {
    // Part of a larger URL: percent-encode so the value cannot add path segments or query parameters.
    return escapeHtml(encodeURIComponent(value));
  }
  // text, attr and urlStart: HTML-escape. URL schemes at the start are validated by the sanitizer.
  return escapeHtml(value);
}

/** Produces the HTML text for one field node. */
function fieldToHtml(
  node: IFieldNode,
  context: IRenderContext,
  item: IListItem | undefined,
  useSamples: boolean
): string {
  if (useSamples) {
    return node.context === 'urlStart' ? SAMPLE_URL : SAMPLE_TEXT;
  }
  let raw: string;
  if (node.source === 'wp_title') {
    raw = context.legacyTitle;
  } else if (node.source === 'wp_description') {
    raw = context.legacyDescription;
  } else {
    raw = item && node.fieldName ? formatFieldValue(item[node.fieldName]) : '';
  }
  const encoded: string = encodeForContext(raw, node.context);
  // Keep line breaks of the multiline description when it is shown as element text.
  return node.source === 'wp_description' && node.context === 'text' ? encoded.replace(/\r?\n/g, '<br>') : encoded;
}

/** Builds the (not yet sanitized) HTML for the whole template. */
function buildHtml(nodes: TemplateNode[], context: IRenderContext, useSamples: boolean): string {
  let html: string = '';

  const renderNodes = (list: Array<TemplateNode>, item: IListItem | undefined): void => {
    list.forEach((node) => {
      if (node.type === 'text') {
        html += node.value;
      } else if (node.type === 'field') {
        html += fieldToHtml(node, context, item, useSamples);
      } else {
        // Validation renders one sample row; real rendering renders one per item.
        const rows: Array<IListItem | undefined> = useSamples ? [undefined] : context.items;
        rows.forEach((row) => renderNodes(node.children, row));
      }
    });
  };

  renderNodes(nodes, undefined);
  return html;
}

/** Formats parser issues as "Line x, column y: message". */
function formatIssue(issue: { message: string; line: number; column: number }): string {
  return `Line ${issue.line}, column ${issue.column}: ${issue.message}`;
}

/**
 * Parses and validates a template. Validation covers size, the documented syntax, and a trial
 * render through the sanitizer, so anything the sanitizer would strip is reported as an error
 * instead of silently disappearing.
 */
export function compileTemplate(source: string, legacy?: ILegacyValues): ICompileResult {
  if (source.length > MAX_TEMPLATE_LENGTH) {
    return {
      warnings: [],
      errors: [`The template is ${source.length.toLocaleString()} characters long; the maximum is ${MAX_TEMPLATE_LENGTH.toLocaleString()}.`]
    };
  }

  const parsed = parseTemplate(source);
  if (parsed.issues.length > 0) {
    return { errors: parsed.issues.map(formatIssue), warnings: [] };
  }

  const trial = sanitizeHtml(buildHtml(parsed.nodes, { legacyTitle: '', legacyDescription: '', items: [] }, true));
  if (trial.violations.length > 0) {
    return { errors: trial.violations.map((v) => `Not allowed: ${v}.`), warnings: [] };
  }

  // Migration warnings: legacy placeholders keep working but should be replaced with plain text.
  const warnings: string[] = parsed.legacyPlaceholders.map((name) => {
    const isTitle: boolean = name === 'wp_title';
    const saved: string = legacy ? (isTitle ? legacy.title : legacy.description) : '';
    return (
      `{${name}} is a legacy placeholder. The ${isTitle ? 'title' : 'description'} property is no longer editable, ` +
      `so it keeps rendering its saved value${saved ? ` ("${saved}")` : ''}. Replace the placeholder with plain text in your HTML.`
    );
  });
  trial.warnings.forEach((w) => warnings.push(w));

  return {
    warnings,
    template: {
      nodes: parsed.nodes,
      itemFields: parsed.itemFields,
      hasEachBlock: parsed.nodes.some((n) => n.type === 'each'),
      usesIcons: /\bfi-rr-/.test(source)
    },
    errors: []
  };
}

/**
 * Renders a compiled template with real data and returns sanitized HTML.
 * Fails (with errors) when the template references a field that does not exist on the list.
 */
export function renderTemplate(template: ICompiledTemplate, context: IRenderContext): IRenderResult {
  if (context.items.length > 0) {
    const unknown: string[] = template.itemFields.filter(
      (name) => !context.items.some((item) => Object.prototype.hasOwnProperty.call(item, name))
    );
    if (unknown.length > 0) {
      return {
        html: '',
        errors: unknown.map(
          (name) =>
            `Unknown list field {item.${name}}. Use the field's internal name (for example "Title" or "OData__x0020_Notes").`
        )
      };
    }
  }

  // Final defence in depth: sanitize the complete output, which also covers values coming from list data.
  return { html: sanitizeHtml(buildHtml(template.nodes, context, false)).html, errors: [] };
}
