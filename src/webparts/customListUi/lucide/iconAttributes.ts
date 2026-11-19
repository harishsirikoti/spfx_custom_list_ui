/**
 * Validation helpers for the attributes of the <icon> template tag:
 *
 *   <icon name="calendar-days" size="24" color="#2563eb" stroke-width="2"></icon>
 *
 * The same functions are used by the sanitizer (template validation and published rendering) and by the
 * React layer that draws the icon, so both always agree on what is acceptable.
 */

/** Attributes the sanitizer lets through on <icon>, in addition to style, role and aria-*. */
export const ICON_ATTRIBUTES: string[] = ['name', 'size', 'color', 'stroke-width'];

export const DEFAULT_ICON_SIZE: number = 24;
export const MIN_ICON_SIZE: number = 8;
export const MAX_ICON_SIZE: number = 256;

/** A Lucide icon name: lower-case words separated by single hyphens, for example "calendar-days". */
export const ICON_NAME_PATTERN: RegExp = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Hex colors, rgb()/hsl() with plain numbers, or a plain color word such as "red" or "currentColor". */
const SAFE_COLOR_PATTERN: RegExp =
  /^(?:#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})|[a-z]{3,24}|(?:rgb|hsl)a?\(\s*[0-9.]+%?(?:\s*[, ]\s*[0-9.]+%?){2}(?:\s*[,/]\s*[0-9.]+%?)?\s*\))$/i;

/**
 * Turns a user-entered value into the canonical icon-name form.
 * Accepts "calendar-days", "Calendar-Days", "calendar days", "calendar_days" and "CalendarDays".
 * The result must still pass ICON_NAME_PATTERN and exist in the catalog to be used.
 */
export function normalizeIconName(value: string): string {
  let name: string = value.trim();
  if (/[A-Z]/.test(name)) {
    // CalendarDays -> Calendar-Days
    name = name.replace(/([a-z0-9])([A-Z])/g, '$1-$2');
  }
  return name.replace(/[\s_]+/g, '-').toLowerCase();
}

/** Parses an icon size. Returns undefined unless it is a whole number from 8 to 256. */
export function parseIconSize(value: string): number | undefined {
  if (!/^\d{1,3}$/.test(value.trim())) {
    return undefined;
  }
  const size: number = parseInt(value, 10);
  return size >= MIN_ICON_SIZE && size <= MAX_ICON_SIZE ? size : undefined;
}

/** Returns true for colors that cannot do anything except set a color (no url(), no var(), no expressions). */
export function isSafeIconColor(value: string): boolean {
  return value.length <= 40 && SAFE_COLOR_PATTERN.test(value.trim());
}

/** Parses an SVG stroke width from 0.25 to 4. Returns undefined for anything else. */
export function parseStrokeWidth(value: string): number | undefined {
  if (!/^\d(?:\.\d{1,2})?$/.test(value.trim())) {
    return undefined;
  }
  const width: number = parseFloat(value);
  return width >= 0.25 && width <= 4 ? width : undefined;
}
