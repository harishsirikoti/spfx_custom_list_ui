import * as React from 'react';

import * as strings from 'CustomListUiWebPartStrings';
import { ListServiceError, type IListItem } from '../models/ListModels';
import { DEFAULT_ITEM_LIMIT, type SharePointListService } from '../services/SharePointListService';

/** Loading state of the list items. */
export interface IItemsState {
  status: 'idle' | 'loading' | 'loaded' | 'error';
  items: IListItem[];
  hasMore: boolean;
  errorMessage: string;
}

const INITIAL_STATE: IItemsState = { status: 'idle', items: [], hasMore: false, errorMessage: '' };

/** Replaces {0}, {1}, ... in a localized string. */
export function format(template: string, ...values: string[]): string {
  return template.replace(/\{(\d+)\}/g, (_m, index: string) => values[Number(index)] ?? '');
}

/** Converts a failure from the list service into a message that tells the user what to do. */
export function describeError(error: unknown): string {
  if (error instanceof ListServiceError) {
    switch (error.kind) {
      case 'notFound':
        return strings.ErrorNotFound;
      case 'accessDenied':
        return strings.ErrorAccessDenied;
      case 'network':
        return strings.ErrorNetwork;
      case 'invalidListId':
        return strings.ErrorInvalidListId;
      default:
        return format(strings.ErrorUnknown, error.message);
    }
  }
  return format(strings.ErrorUnknown, error instanceof Error ? error.message : String(error));
}

/**
 * Loads up to 100 items of a list as the current user. Reloads only when the list changes or `reload`
 * is called - never because of anything else, so it is safe to use next to a live editor.
 */
export function useListItems(
  listService: SharePointListService,
  listId: string
): { state: IItemsState; reload: () => void } {
  const [state, setState] = React.useState<IItemsState>(INITIAL_STATE);
  const [reloadToken, setReloadToken] = React.useState<number>(0);

  React.useEffect(() => {
    if (!listId) {
      setState(INITIAL_STATE);
      return undefined;
    }

    // Ignore results of requests that were superseded by a newer one or by unmounting.
    let cancelled: boolean = false;
    setState({ ...INITIAL_STATE, status: 'loading' });

    listService
      .getItems(listId, DEFAULT_ITEM_LIMIT)
      .then((result) => {
        if (!cancelled) {
          setState({ status: 'loaded', items: result.items, hasMore: result.hasMore, errorMessage: '' });
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setState({ status: 'error', items: [], hasMore: false, errorMessage: describeError(error) });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [listId, listService, reloadToken]);

  const reload = React.useCallback(() => setReloadToken((n) => n + 1), []);
  return { state, reload };
}
