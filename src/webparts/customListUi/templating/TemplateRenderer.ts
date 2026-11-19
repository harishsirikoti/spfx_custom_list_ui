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
  /** Non-blocking notes found while rendering real data, for example an invalid icon or hyperlink value. */
  warnings: string[];
}

/** Replacement values used while validating a template, where no real data exists yet. */
const SAMPLE_TEXT: string = 'x';
const SAMPLE_URL: string = 'https://example.com/x';
/** Samples for the attributes of the <icon> tag, so a template such as name="{item.Icon}" validates cleanly. */
const SAMPLE_ICON_ATTRIBUTES: { [attribute: string]: string } = {
  name: 'calendar-days',
  size: '24',
  color: '#2563eb',
  'stroke-width': '2'
};

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

/** Reads the requested part of a SharePoint Hyperlink field ({ Url, Description }). */
function formatHyperlinkPart(value: unknown, property: 'url' | 'desc'): string {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return '';
  }
  const record: Record<string, unknown> = value as Record<string, unknown>;
  const raw: unknown = property === 'url' ? record.Url ?? record.url : record.Description ?? record.description ?? record.desc;
  return typeof raw === 'string' ? raw : '';
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
    if (node.context === 'urlStart') {
      return SAMPLE_URL;
    }
    if (node.attrName && SAMPLE_ICON_ATTRIBUTES[node.attrName]) {
      return SAMPLE_ICON_ATTRIBUTES[node.attrName];
    }
    return SAMPLE_TEXT;
  }
  let raw: string;
  if (node.source === 'wp_title') {
    raw = context.legacyTitle;
  } else if (node.source === 'wp_description') {
    raw = context.legacyDescription;
  } else {
    if (item && node.fieldName) {
      raw = node.fieldProperty ? formatHyperlinkPart(item[node.fieldName], node.fieldProperty) : formatFieldValue(item[node.fieldName]);
    } else {
      raw = '';
    }
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
  // Unknown elements cannot be self-closing in HTML: <icon ... /> would swallow the content after it.
  return html.replace(/<icon\b([^<>]*?)\s*\/>/gi, '<icon$1></icon>');
}

/** Finds hyperlink subfield nodes anywhere in the one-level template tree. */
function getHyperlinkNodes(nodes: TemplateNode[]): IFieldNode[] {
  const found: IFieldNode[] = [];
  nodes.forEach((node) => {
    if (node.type === 'field' && node.fieldProperty) {
      found.push(node);
    } else if (node.type === 'each') {
      found.push(...getHyperlinkNodes(node.children));
    }
  });
  return found;
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
        warnings: [],
        errors: unknown.map(
          (name) =>
            `Unknown list field {item.${name}}. Use the field's internal name (for example "Title" or "OData__x0020_Notes").`
        )
      };
    }
  }

  const hyperlinkWarnings: string[] = [];
  getHyperlinkNodes(template.nodes).forEach((node) => {
    const fieldName: string = node.fieldName as string;
    context.items.forEach((item) => {
      const value: unknown = item[fieldName];
      if (value !== null && value !== undefined && (typeof value !== 'object' || Array.isArray(value))) {
        hyperlinkWarnings.push(`{item.${fieldName}.${node.fieldProperty}} requires a SharePoint Hyperlink field value`);
      }
    });
  });

  // Final defence in depth: sanitize the complete output, which also covers values coming from list data.
  const output = sanitizeHtml(buildHtml(template.nodes, context, false));
  const warnings: string[] = hyperlinkWarnings.concat(output.warnings).filter((warning, index, all) => all.indexOf(warning) === index);
  return { html: output.html, warnings, errors: [] };
}
