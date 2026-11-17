import createDOMPurify from 'dompurify';
import { UICON_NAMES } from '../icons/uiconNames';
import { sanitizeInlineCss } from './CssSanitizer';

/** Result of sanitizing an HTML string. */
export interface ISanitizeResult {
  /** Safe HTML that can be inserted into the page. */
  html: string;
  /** Descriptions of everything that was removed (empty when the input was already clean). */
  violations: string[];
  /** Non-blocking notes: removed classes and icons that are not available. The HTML is still safe to use. */
  warnings: string[];
}

/** Elements that may appear in a template. Anything else (script, style, iframe, form, svg, ...) is removed. */
const ALLOWED_TAGS: string[] = [
  'a', 'abbr', 'address', 'article', 'aside', 'b', 'blockquote', 'br', 'caption', 'cite', 'code', 'col', 'colgroup',
  'dd', 'del', 'details', 'div', 'dl', 'dt', 'em', 'figcaption', 'figure', 'footer', 'h1', 'h2', 'h3', 'h4', 'h5',
  'h6', 'header', 'hr', 'i', 'img', 'ins', 'li', 'main', 'mark', 'nav', 'ol', 'p', 'pre', 'q', 's', 'section',
  'small', 'span', 'strong', 'sub', 'summary', 'sup', 'table', 'tbody', 'td', 'tfoot', 'th', 'thead', 'time',
  'tr', 'u', 'ul'
];

/** Attributes that may appear on those elements. aria-* is additionally allowed; data-* and event handlers are not. */
const ALLOWED_ATTR: string[] = [
  'alt', 'class', 'colspan', 'datetime', 'dir', 'height', 'href', 'lang', 'loading', 'open', 'rel', 'role',
  'rowspan', 'scope', 'src', 'style', 'target', 'title', 'width'
];

/** Attributes that carry URLs and therefore need a scheme check. */
const URL_ATTRIBUTES: string[] = ['href', 'src'];

/** URL schemes that are considered safe. Relative URLs (no scheme) are also safe. */
const SAFE_SCHEMES: string[] = ['http', 'https', 'mailto', 'tel'];

/**
 * Class tokens are limited to the Flaticon Uicons naming pattern (regular rounded set), plus the marker class "fi".
 * Arbitrary classes are removed because they could pick up styles from the SharePoint page.
 */
const ICON_CLASS_PATTERN: RegExp = /^fi-rr-[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Elements that may carry icon classes. */
const ICON_ELEMENTS: string[] = ['I', 'SPAN'];

let iconNameSet: Record<string, true> | undefined;

function isKnownIcon(className: string): boolean {
  if (!iconNameSet) {
    iconNameSet = {};
    UICON_NAMES.forEach((n) => {
      (iconNameSet as Record<string, true>)[n] = true;
    });
  }
  return iconNameSet[className] === true;
}

const SCHEME_PATTERN: RegExp = /^([a-z][a-z0-9+.-]*):/;

/** Violations collected by the hooks while a single sanitize call is running. */
let currentViolations: string[] = [];
let currentWarnings: string[] = [];

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
    if (data.attrName === 'class') {
      const allowedHere: boolean = ICON_ELEMENTS.indexOf(node.nodeName) !== -1;
      const kept: string[] = [];
      data.attrValue.split(/\s+/).filter((c) => c.length > 0).forEach((c) => {
        if (allowedHere && (c === 'fi' || ICON_CLASS_PATTERN.test(c))) {
          kept.push(c);
          if (c !== 'fi' && !isKnownIcon(c)) {
            currentWarnings.push(`Icon "${c}" is not part of the bundled Uicons set and will not display`);
          }
        } else {
          currentWarnings.push(`Class "${c}" was removed (only Flaticon Uicons classes such as fi-rr-calendar on <i> or <span> are allowed)`);
        }
      });
      data.attrValue = kept.join(' ');
      data.keepAttr = kept.length > 0;
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
    SANITIZE_NAMED_PROPS: true,
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
      if (name !== 'style' && name !== 'class' && URL_ATTRIBUTES.indexOf(name) === -1 && name !== 'target') {
        const owner: string = entry.from ? entry.from.nodeName.toLowerCase() : 'element';
        violations.push(`The "${name}" attribute is not allowed on <${owner}>`);
      }
    }
  });

  // De-duplicate while preserving order.
  const unique = (list: string[]): string[] => list.filter((v, i) => list.indexOf(v) === i);
  return { html, violations: unique(violations), warnings: unique(warnings) };
}
