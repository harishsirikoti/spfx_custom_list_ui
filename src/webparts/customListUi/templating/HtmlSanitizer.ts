import createDOMPurify from 'dompurify';
import {
  ICON_ATTRIBUTES,
  ICON_NAME_PATTERN,
  isSafeIconColor,
  normalizeIconName,
  parseIconSize,
  parseStrokeWidth
} from '../lucide/iconAttributes';
import { LUCIDE_CATALOG_VERSION, resolveIconName } from '../lucide/iconRegistry';
import { sanitizeInlineCss } from './CssSanitizer';

/** Result of sanitizing an HTML string. */
export interface ISanitizeResult {
  /** Safe HTML that can be inserted into the page. */
  html: string;
  /** Descriptions of everything that was removed (empty when the input was already clean). */
  violations: string[];
  /** Non-blocking notes: icons that are not available. The HTML is still safe to use. */
  warnings: string[];
}

/** Elements that may appear in a template. Anything else (script, style, iframe, form, svg, ...) is removed. */
const ALLOWED_TAGS: string[] = [
  'a', 'abbr', 'address', 'article', 'aside', 'b', 'blockquote', 'br', 'caption', 'cite', 'code', 'col', 'colgroup',
  'dd', 'del', 'details', 'div', 'dl', 'dt', 'em', 'figcaption', 'figure', 'footer', 'h1', 'h2', 'h3', 'h4', 'h5',
  'h6', 'header', 'hr', 'i', 'icon', 'img', 'ins', 'li', 'main', 'mark', 'nav', 'ol', 'p', 'pre', 'q', 's', 'section',
  'small', 'span', 'strong', 'sub', 'summary', 'sup', 'table', 'tbody', 'td', 'tfoot', 'th', 'thead', 'time',
  'tr', 'u', 'ul'
];

/** Attributes that may appear on those elements. aria-* is additionally allowed; data-* and event handlers are not. */
const ALLOWED_ATTR: string[] = [
  'alt', 'colspan', 'datetime', 'dir', 'height', 'href', 'lang', 'loading', 'open', 'rel', 'role',
  'rowspan', 'scope', 'src', 'style', 'target', 'title', 'width'
];

/** Violations collected by the hooks while a single sanitize call is running. */
let currentViolations: string[] = [];
let currentWarnings: string[] = [];

/**
 * Validates one attribute of an <icon name="..." size="..." color="..." stroke-width="..."> marker.
 * Valid values are written back in canonical form and kept; anything else is dropped with a note, so a bad
 * or unknown icon never breaks the page. Nothing but these four validated attributes can reach the icon.
 */
function handleIconAttribute(
  element: Element,
  data: { attrName: string; attrValue: string; keepAttr: boolean; forceKeepAttr?: boolean }
): void {
  const raw: string = data.attrValue.trim();
  data.keepAttr = false;
  if (raw === '') {
    return; // An empty value (for example an empty list cell) simply shows no icon.
  }

  switch (data.attrName) {
    case 'name': {
      const name: string = normalizeIconName(raw);
      const canonical: string | undefined = ICON_NAME_PATTERN.test(name) && name.length <= 64 ? resolveIconName(name) : undefined;
      if (!canonical) {
        currentWarnings.push(
          `Icon "${raw}" is not in the installed Lucide catalog (lucide-react ${LUCIDE_CATALOG_VERSION}) and will not display`
        );
        return;
      }
      data.attrValue = canonical;
      break;
    }
    case 'size': {
      const size: number | undefined = parseIconSize(raw);
      if (size === undefined) {
        currentWarnings.push(`Icon size "${raw}" is not valid (use a whole number from 8 to 256); the default size is used`);
        return;
      }
      data.attrValue = String(size);
      break;
    }
    case 'color':
      if (!isSafeIconColor(raw)) {
        currentWarnings.push(`Icon color "${raw}" is not valid (use a hex value such as #2563eb, rgb(), hsl() or a color name)`);
        return;
      }
      data.attrValue = raw;
      break;
    default: {
      const width: number | undefined = parseStrokeWidth(raw);
      if (width === undefined) {
        currentWarnings.push(`Icon stroke-width "${raw}" is not valid (use a number from 0.25 to 4)`);
        return;
      }
      data.attrValue = String(width);
    }
  }
  // These attributes are not in the general allow-list (in particular "name" is not allowed anywhere else),
  // so the validated value is kept explicitly.
  // DOMPurify does not write back a changed value for force-kept attributes, so store the canonical value here.
  element.setAttribute(data.attrName, data.attrValue);
  data.keepAttr = true;
  data.forceKeepAttr = true;
}

/** Other attributes an <icon> may have: styling and accessibility only. */
function isOtherAllowedIconAttribute(attrName: string): boolean {
  return attrName === 'style' || attrName === 'role' || attrName === 'title' || attrName.indexOf('aria-') === 0;
}

/** Attributes that carry URLs and therefore need a scheme check. */
const URL_ATTRIBUTES: string[] = ['href', 'src'];

/** URL schemes that are considered safe. Relative URLs (no scheme) are also safe. */
const SAFE_SCHEMES: string[] = ['http', 'https', 'mailto', 'tel'];

/**
 * URL scheme matcher used by the sanitizer.
 */
const SCHEME_PATTERN: RegExp = /^([a-z][a-z0-9+.-]*):/;


type Purifier = ReturnType<typeof createDOMPurify>;
let purifier: Purifier | undefined;

/**
 * Returns true when the URL is relative or uses an allowed scheme.
 * Control characters and whitespace are stripped first because browsers ignore them inside schemes
 * (for example "java\tscript:").
 */
export function isSafeUrl(url: string): boolean {
  // eslint-disable-next-line no-control-regex
  const compact: string = url.replace(/[\u0000- \u007f-\u009f]+/g, '').toLowerCase();
  const match: RegExpExecArray | null = SCHEME_PATTERN.exec(compact);
  return !match || SAFE_SCHEMES.indexOf(match[1]) !== -1;
}

/** Creates the DOMPurify instance on first use and installs the CSS and URL hooks. */
function getPurifier(): Purifier {
  if (purifier) {
    return purifier;
  }
  const instance: Purifier = createDOMPurify(window);

  // Check URL schemes and sanitize inline CSS on every attribute that survives the allow-list.
  instance.addHook('uponSanitizeAttribute', (node, data) => {
    if (node.nodeName === 'ICON' && ICON_ATTRIBUTES.indexOf(data.attrName) !== -1) {
      handleIconAttribute(node, data);
    } else if (data.attrName === 'class' && /(?:^|[\s,])fi(?:[\s,]|$)|fi-rr-/.test(data.attrValue.toLowerCase())) {
      currentWarnings.push('Flaticon icon classes are no longer supported; use <icon name="..."></icon> with a Lucide name');
    } else if (node.nodeName === 'ICON' && !isOtherAllowedIconAttribute(data.attrName)) {
      // Strict: an <icon> marker carries no URLs, no data and nothing else.
      data.keepAttr = false;
    } else if (data.attrName === 'style') {
      const result = sanitizeInlineCss(data.attrValue);
      currentViolations.push(...result.violations);
      data.attrValue = result.css;
      data.keepAttr = result.css.length > 0;
    } else if (URL_ATTRIBUTES.indexOf(data.attrName) !== -1 && !isSafeUrl(data.attrValue)) {
      currentViolations.push(`Unsafe URL in "${data.attrName}" attribute (only http, https, mailto, tel and relative URLs are allowed)`);
      data.keepAttr = false;
    } else if (data.attrName === 'target' && data.attrValue !== '_blank' && data.attrValue !== '_self') {
      currentViolations.push('Link target must be _blank or _self');
      data.keepAttr = false;
    }
  });

  // Links that open a new window must not expose window.opener.
  instance.addHook('afterSanitizeAttributes', (node) => {
    if (node.nodeName === 'A' && node.getAttribute('target') === '_blank') {
      node.setAttribute('rel', 'noopener noreferrer');
    }
  });

  purifier = instance;
  return instance;
}

/**
 * Sanitizes untrusted HTML. Nothing executable survives: scripts, event handlers, unsafe URLs,
 * dangerous CSS, forms, frames, embedded objects and SVG/MathML are all removed.
 * @param dirty - HTML to sanitize.
 */
export function sanitizeHtml(dirty: string): ISanitizeResult {
  const dompurify: Purifier = getPurifier();
  currentViolations = [];
  currentWarnings = [];

  const html: string = dompurify.sanitize(dirty, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    ALLOW_ARIA_ATTR: true,
    ALLOW_DATA_ATTR: false,
    ALLOW_UNKNOWN_PROTOCOLS: false,
    SANITIZE_DOM: true,
    // id and name are not in the allow-list, so there is nothing to rename; this must stay off so the validated
    // name of an <icon> is not given a prefix.
    SANITIZE_NAMED_PROPS: false,
    // Parse everything as body content so a leading <script> or <style> is reported instead of vanishing into <head>.
    FORCE_BODY: true,
    RETURN_DOM: false,
    RETURN_DOM_FRAGMENT: false
  });

  const violations: string[] = currentViolations.slice();
  const warnings: string[] = currentWarnings.slice();
  currentViolations = [];
  currentWarnings = [];

  // Translate DOMPurify's own removal log into readable messages.
  dompurify.removed.forEach((entry) => {
    if ('element' in entry && entry.element) {
      const name: string = entry.element.nodeName.toLowerCase();
      // Comments, text and the implicit document wrappers (and DOMPurify's own FORCE_BODY marker) are not template content.
      if (name !== '#comment' && name !== '#text' && name !== 'body' && name !== 'html' && name !== 'head' && name !== 'remove') {
        violations.push(`<${name}> elements are not allowed`);
      }
    } else if ('attribute' in entry && entry.attribute) {
      const name: string = entry.attribute.name.toLowerCase();
      // style/URL/target problems were already reported with a more specific message by the hooks.
      const owner: string = entry.from ? entry.from.nodeName.toLowerCase() : 'element';
      // Invalid icon attributes were already reported as notes by handleIconAttribute.
      const isIconNote: boolean = owner === 'icon' && ICON_ATTRIBUTES.indexOf(name) !== -1;
      if (name !== 'style' && name !== 'class' && URL_ATTRIBUTES.indexOf(name) === -1 && name !== 'target' && !isIconNote) {
        violations.push(`The "${name}" attribute is not allowed on <${owner}>`);
      }
    }
  });

  // De-duplicate while preserving order.
  const unique = (list: string[]): string[] => list.filter((v, i) => list.indexOf(v) === i);
  return { html, violations: unique(violations), warnings: unique(warnings) };
}
