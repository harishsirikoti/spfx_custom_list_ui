import { LUCIDE_ALIAS_ENTRIES, LUCIDE_ICON_NAMES, LUCIDE_VERSION } from './lucideNames';

/** Legacy values previously stored in SharePoint icon columns. Keys are normalized names. */
const LEGACY_ICON_ALIASES: { [alias: string]: string } = {
  'fa-search': 'search',
  'fa-user-check': 'user-check',
  'fa-arrow-right': 'arrow-right',
  'fa-arrow-left': 'arrow-left',
  'fa-arrow-up': 'arrow-up'
};

/**
 * Catalog of the Lucide icons installed with the web part.
 *
 * Two parts, to keep the main bundle small:
 *  - names and aliases (about 10 KB gzipped) are always available, so templates can be validated at once;
 *  - the SVG data of every icon (about 90 KB gzipped) is a separate chunk that is downloaded only when a
 *    page actually shows an icon (or the icon picker opens).
 * Individual icons are never imported into the main bundle.
 */

/** SVG node data of one icon: a list of [element, attributes] pairs, for example ["path", { "d": "M8 2v3" }]. */
export type IconNodeData = Array<[string, { [attribute: string]: string }]>;

/** SVG data of all icons, keyed by canonical name. */
export type IconDataMap = { [canonicalName: string]: IconNodeData };

let nameSet: { [name: string]: true } | undefined;
let aliasMap: { [alias: string]: string } | undefined;
let loadedData: IconDataMap | undefined;
let loading: Promise<IconDataMap> | undefined;

function ensureIndexes(): void {
  if (nameSet && aliasMap) {
    return;
  }
  nameSet = {};
  aliasMap = {};
  LUCIDE_ICON_NAMES.forEach((n) => {
    (nameSet as { [name: string]: true })[n] = true;
  });
  LUCIDE_ALIAS_ENTRIES.forEach((entry) => {
    const [alias, target] = entry.split('=');
    if (alias && target) {
      (aliasMap as { [alias: string]: string })[alias] = target;
    }
  });
  Object.keys(LEGACY_ICON_ALIASES).forEach((alias) => {
    (aliasMap as { [alias: string]: string })[alias] = LEGACY_ICON_ALIASES[alias];
  });
}

/** Version of lucide-react the catalog comes from. */
export const LUCIDE_CATALOG_VERSION: string = LUCIDE_VERSION;

/** All canonical icon names (not aliases), sorted. */
export function getAllIconNames(): string[] {
  return LUCIDE_ICON_NAMES;
}

/** Returns alias -> canonical entries, used by the icon search. */
export function getAliasEntries(): Array<[string, string]> {
  ensureIndexes();
  return Object.keys(aliasMap as { [alias: string]: string }).map((a) => [a, (aliasMap as { [alias: string]: string })[a]]);
}

/**
 * Returns the canonical icon name for a canonical name or an alias, or undefined when the icon is not in the
 * installed catalog. The name must already be normalized (see normalizeIconName).
 */
export function resolveIconName(name: string): string | undefined {
  ensureIndexes();
  if ((nameSet as { [name: string]: true })[name] === true) {
    return name;
  }
  const target: string | undefined = (aliasMap as { [alias: string]: string })[name];
  return target && (nameSet as { [name: string]: true })[target] === true ? target : undefined;
}

/** The icon data if it has already been loaded, otherwise undefined. */
export function getLoadedIconData(): IconDataMap | undefined {
  return loadedData;
}

/**
 * Downloads (once) and parses the SVG data of all icons.
 * The data is plain JSON: it is parsed with JSON.parse and never executed.
 */
export function loadIconData(): Promise<IconDataMap> {
  if (loadedData) {
    return Promise.resolve(loadedData);
  }
  if (!loading) {
    loading = import(/* webpackChunkName: 'custom-list-ui-lucide' */ './lucideIconData')
      .then((module) => {
        loadedData = JSON.parse(module.LUCIDE_ICON_JSON) as IconDataMap;
        return loadedData;
      })
      .catch((error: unknown) => {
        // Allow a later retry (for example after a transient network failure while loading the chunk).
        loading = undefined;
        throw error;
      });
  }
  return loading;
}
