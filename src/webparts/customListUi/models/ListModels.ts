/**
 * Shared data contracts used by the list service, the template engine and the UI.
 */

/** Basic information about a SharePoint list, used to populate the property pane dropdown. */
export interface IListInfo {
  /** List GUID (without braces). */
  id: string;
  /** Display title of the list. */
  title: string;
}

/**
 * A SharePoint list item as returned by the REST API.
 * Keys are SharePoint *internal* field names (for example "Title", "Modified", "OData__x0020_Notes").
 */
export interface IListItem {
  [internalFieldName: string]: unknown;
}

/** Result of a list item query. */
export interface IListItemsResult {
  items: IListItem[];
  /** True when SharePoint reports that more items exist than were returned. */
  hasMore: boolean;
}

/** Machine-readable categories of failures raised by the list service. */
export type ListServiceErrorKind =
  | 'invalidListId' // The configured list id is not a valid GUID.
  | 'notFound' // The list was deleted, moved, or never existed.
  | 'accessDenied' // The current user is not allowed to read the list.
  | 'network' // The request could not be completed (offline, blocked, ...).
  | 'unknown'; // Any other server-side failure.

/** Error thrown by the list service. Carries a category so the UI can show a helpful message. */
export class ListServiceError extends Error {
  public readonly kind: ListServiceErrorKind;
  public readonly status?: number;

  public constructor(kind: ListServiceErrorKind, message: string, status?: number) {
    super(message);
    // The build targets ES5, so the prototype chain must be repaired for instanceof to work.
    Object.setPrototypeOf(this, ListServiceError.prototype);
    this.name = 'ListServiceError';
    this.kind = kind;
    this.status = status;
  }
}

/** A column of a SharePoint list, as needed by the template field picker. */
export interface IFieldInfo {
  /** Display name, for example "Due Date". */
  title: string;
  /** Internal name, for example "Due_x0020_Date". This is what templates use: {item.Due_x0020_Date}. */
  internalName: string;
  /** SharePoint field type, for example "Text", "DateTime", "Lookup". */
  typeAsString: string;
}
