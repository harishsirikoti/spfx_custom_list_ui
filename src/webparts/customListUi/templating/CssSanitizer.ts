/**
 * Allow-list based sanitizer for the contents of inline `style` attributes.
 *
 * Rather than trying to detect every dangerous construct, only well-known layout and typography
 * properties are kept, and any value containing functions, URLs, escapes or other suspicious
 * syntax is dropped.
 */

/** Result of sanitizing an inline style string. */
export interface ICssSanitizeResult {
  /** The safe declarations joined with "; ". */
  css: string;
  /** Human-readable descriptions of every declaration that was removed. */
  violations: string[];
}

/** Property names (lower case) that may appear in inline styles. */
const ALLOWED_PROPERTY: RegExp =
  /^(?:--[a-z0-9_-]+|align-(?:content|items|self)|aspect-ratio|background(?:-color|-clip|-origin|-position|-repeat|-size)?|border(?:-(?:top|right|bottom|left))?(?:-(?:color|style|width|radius))?|border-(?:top|bottom)-(?:left|right)-radius|border-collapse|border-spacing|box-shadow|box-sizing|color|column-gap|display|flex(?:-(?:basis|direction|flow|grow|shrink|wrap))?|float|clear|font(?:-(?:family|size|style|variant|weight))?|gap|grid(?:-(?:area|auto-columns|auto-flow|auto-rows|column|row|template|template-areas|template-columns|template-rows))?|height|justify-(?:content|items|self)|letter-spacing|line-height|list-style(?:-type|-position)?|margin(?:-(?:top|right|bottom|left))?|(?:max|min)-(?:height|width)|object-(?:fit|position)|opacity|order|overflow(?:-x|-y)?|overflow-wrap|padding(?:-(?:top|right|bottom|left))?|row-gap|table-layout|text-(?:align|decoration|indent|overflow|transform)|text-decoration-(?:color|line|style)|vertical-align|visibility|white-space|width|word-(?:break|spacing|wrap))$/;

/** Characters permitted in a value: no ":" (blocks "javascript:" style schemes), "\" (escapes), "<", ">", "@", "{", "}". */
const SAFE_VALUE_CHARACTERS: RegExp = /^[A-Za-z0-9\s#%.,()+\-*/"'!_]+$/;

/** Functions and keywords that are never allowed in values, even though the character check would admit them. */
const FORBIDDEN_VALUE: RegExp = /(?:url|image-set|image|element|cross-fade|paint|expression|calc-size|attr|env)\s*\(|javascript|vbscript|behavior|binding|!\s*important/i;

/** Splits a declaration list on top-level semicolons, ignoring semicolons inside quotes/parentheses. */
function splitDeclarations(style: string): string[] {
  const parts: string[] = [];
  let depth: number = 0;
  let quote: string = '';
  let current: string = '';
  for (let i: number = 0; i < style.length; i++) {
    const ch: string = style.charAt(i);
    if (quote) {
      if (ch === quote) {
        quote = '';
      }
    } else if (ch === '"' || ch === "'") {
      quote = ch;
    } else if (ch === '(') {
      depth++;
    } else if (ch === ')') {
      depth = Math.max(0, depth - 1);
    } else if (ch === ';' && depth === 0) {
      parts.push(current);
      current = '';
      continue;
    }
    current += ch;
  }
  parts.push(current);
  return parts;
}

/** Returns a reason string if the declaration must be dropped, otherwise undefined. */
function rejectionReason(property: string, value: string): string | undefined {
  if (!ALLOWED_PROPERTY.test(property)) {
    return `CSS property "${property}" is not allowed`;
  }
  if (!value || !SAFE_VALUE_CHARACTERS.test(value) || FORBIDDEN_VALUE.test(value)) {
    return `CSS value for "${property}" is not allowed`;
  }
  if (property === 'display' && /(?:^|\s)(?:contents)(?:\s|$)/i.test(value)) {
    return 'display: contents is not allowed';
  }
  return undefined;
}

/**
 * Sanitizes the value of a style attribute.
 * @param style - Raw CSS declarations, for example "padding:12px; color:#333".
 */
export function sanitizeInlineCss(style: string): ICssSanitizeResult {
  const violations: string[] = [];

  // Comments and backslash escapes are classic ways to hide dangerous tokens from filters.
  if (style.indexOf('/*') !== -1 || style.indexOf('\\') !== -1) {
    return { css: '', violations: ['Inline CSS must not contain comments or backslash escapes'] };
  }

  const kept: string[] = [];
  splitDeclarations(style).forEach((declaration) => {
    const trimmed: string = declaration.trim();
    if (!trimmed) {
      return;
    }
    const colon: number = trimmed.indexOf(':');
    if (colon < 1) {
      violations.push(`Malformed CSS declaration "${trimmed}"`);
      return;
    }
    const property: string = trimmed.substring(0, colon).trim().toLowerCase();
    const value: string = trimmed.substring(colon + 1).trim();
    const reason: string | undefined = rejectionReason(property, value);
    if (reason) {
      violations.push(reason);
    } else {
      kept.push(`${property}: ${value}`);
    }
  });

  return { css: kept.join('; '), violations };
}
