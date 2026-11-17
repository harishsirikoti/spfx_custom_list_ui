import { SPHttpClient, type SPHttpClientResponse } from '@microsoft/sp-http';
import {
  ListServiceError,
  type IFieldInfo,
  type IListInfo,
  type IListItem,
  type IListItemsResult
} from '../models/ListModels';

/** Default number of items requested from a list. */
export const DEFAULT_ITEM_LIMIT: number = 100;

/** Strict GUID matcher. Used to keep untrusted values out of REST URLs. */
const GUID_PATTERN: RegExp = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Shape of the "nometadata" list collection response. */
interface IListsResponse {
  value: Array<{ Id: string; Title: string; Hidden: boolean; IsCatalog: boolean; IsSystemList: boolean }>;
}

/** Shape of the "nometadata" list items response. */
interface IItemsResponse {
  value: IListItem[];
  'odata.nextLink'?: string;
  '@odata.nextLink'?: string;
}

/**
 * Reads lists and list items from the current site through SPHttpClient.
 * All calls run as the signed-in user, so SharePoint permissions are always respected
 * and no Microsoft Graph permissions are required.
 */
export class SharePointListService {
  private readonly _http: SPHttpClient;
  private readonly _webUrl: string;

  public constructor(http: SPHttpClient, webUrl: string) {
    this._http = http;
    this._webUrl = webUrl.replace(/\/+$/, '');
  }

  /** Returns true when the value looks like a list GUID. */
  public static isValidListId(value: string | undefined): value is string {
    return !!value && GUID_PATTERN.test(value);
  }

  /** Lists visible, non-system lists and libraries of the current site that the user can see. */
  public async getLists(): Promise<IListInfo[]> {
    const url: string =
      `${this._webUrl}/_api/web/lists?$select=Id,Title,Hidden,IsCatalog,IsSystemList` +
      `&$filter=Hidden eq false&$orderby=Title`;
    const response: SPHttpClientResponse = await this._get(url);
    const json: IListsResponse = (await response.json()) as IListsResponse;

    return json.value
      .filter((l) => !l.IsCatalog && !l.IsSystemList)
      .map((l) => ({ id: l.Id.toLowerCase(), title: l.Title }));
  }

  /**
   * Retrieves up to `top` items from a list. Items contain SharePoint internal field names.
   * @param listId - List GUID.
   * @param top - Maximum number of items to retrieve.
   */
  public async getItems(listId: string, top: number = DEFAULT_ITEM_LIMIT): Promise<IListItemsResult> {
    if (!SharePointListService.isValidListId(listId)) {
      throw new ListServiceError('invalidListId', 'The configured list identifier is not a valid GUID.');
    }

    const url: string = `${this._webUrl}/_api/web/lists(guid'${listId}')/items?$top=${top}`;
    const response: SPHttpClientResponse = await this._get(url);
    const json: IItemsResponse = (await response.json()) as IItemsResponse;

    return {
      items: json.value,
      hasMore: !!(json['odata.nextLink'] || json['@odata.nextLink'])
    };
  }

  /**
   * Retrieves the visible columns of a list (hidden fields are excluded by SharePoint).
   * @param listId - List GUID.
   */
  public async getFields(listId: string): Promise<IFieldInfo[]> {
    if (!SharePointListService.isValidListId(listId)) {
      throw new ListServiceError('invalidListId', 'The configured list identifier is not a valid GUID.');
    }
    const url: string =
      `${this._webUrl}/_api/web/lists(guid'${listId}')/fields?$select=Title,InternalName,TypeAsString,Hidden` +
      '&$filter=Hidden eq false&$orderby=Title';
    const response: SPHttpClientResponse = await this._get(url);
    const json: { value: Array<{ Title: string; InternalName: string; TypeAsString: string }> } = (await response.json()) as {
      value: Array<{ Title: string; InternalName: string; TypeAsString: string }>;
    };
    return json.value.map((f) => ({ title: f.Title, internalName: f.InternalName, typeAsString: f.TypeAsString }));
  }

  /** Executes a GET request and converts failures to categorized ListServiceError instances. */
  private async _get(url: string): Promise<SPHttpClientResponse> {
    let response: SPHttpClientResponse;
    try {
      response = await this._http.get(url, SPHttpClient.configurations.v1, {
        headers: { Accept: 'application/json;odata=nometadata' }
      });
    } catch {
      throw new ListServiceError('network', 'The request to SharePoint could not be completed.');
    }

    if (response.ok) {
      return response;
    }

    // Prefer SharePoint's own error text when the body contains one.
    let serverMessage: string = response.statusText;
    try {
      const body: { error?: { message?: string | { value?: string } } } = await response.json();
      const m: string | { value?: string } | undefined = body.error?.message;
      serverMessage = (typeof m === 'string' ? m : m?.value) || serverMessage;
    } catch {
      // Body was not JSON; keep the status text.
    }

    if (response.status === 401 || response.status === 403) {
      throw new ListServiceError('accessDenied', serverMessage, response.status);
    }
    if (response.status === 404) {
      throw new ListServiceError('notFound', serverMessage, response.status);
    }
    throw new ListServiceError('unknown', serverMessage, response.status);
  }
}
