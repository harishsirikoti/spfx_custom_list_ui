import { getAliasEntries, getAllIconNames } from './iconRegistry';

/**
 * Searches the icon catalog for the icon picker.
 *
 * Every word of the query must appear in the icon name (or in one of its older alias names). Names that
 * start with the first word come first, then names that contain it, each group in alphabetical order.
 * @param query - Text typed by the user, for example "arrow up".
 * @returns Canonical icon names.
 */
export function searchIcons(query: string): string[] {
  const terms: string[] = query.toLowerCase().split(/[\s-]+/).filter((t) => t.length > 0);
  const names: string[] = getAllIconNames();
  if (terms.length === 0) {
    return names;
  }

  const matches = (text: string): boolean => terms.every((t) => text.indexOf(t) !== -1);
  const found: { [name: string]: true } = {};
  names.forEach((n) => {
    if (matches(n)) {
      found[n] = true;
    }
  });
  getAliasEntries().forEach(([alias, target]) => {
    if (matches(alias)) {
      found[target] = true;
    }
  });

  const results: string[] = names.filter((n) => found[n] === true);
  const starts: string[] = results.filter((n) => n.indexOf(terms[0]) === 0);
  const others: string[] = results.filter((n) => n.indexOf(terms[0]) !== 0);
  return starts.concat(others);
}

/** Number of results shown per page in the icon picker. */
export const ICON_PICKER_PAGE_SIZE: number = 120;
