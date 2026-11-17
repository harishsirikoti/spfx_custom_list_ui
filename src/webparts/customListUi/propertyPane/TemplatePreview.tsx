import * as React from 'react';
import { MessageBar, MessageBarButton, MessageBarType, Spinner, SpinnerSize } from '@fluentui/react';

import * as strings from 'CustomListUiWebPartStrings';
import { TemplateOutput } from '../components/TemplateOutput';
import type { IItemsState } from '../components/useListItems';

export interface ITemplatePreviewProps {
  /** The (already debounced) unsaved draft. */
  htmlTemplate: string;
  legacyTitle: string;
  legacyDescription: string;
  listId: string;
  /** Items of the selected list, loaded once by the panel (never per keystroke). */
  itemsState: IItemsState;
  onRetry: () => void;
}

/**
 * Live preview of the draft. It renders through the same TemplateOutput component as the published web
 * part, so it uses the same parser, sanitizer and escaping. Nothing is rendered that did not pass
 * the sanitizer.
 */
export const TemplatePreview: React.FC<ITemplatePreviewProps> = (props) => {
  const { htmlTemplate, legacyTitle, legacyDescription, listId, itemsState, onRetry } = props;

  if (itemsState.status === 'loading') {
    return <Spinner size={SpinnerSize.medium} label={strings.LoadingItems} ariaLive="polite" />;
  }
  if (itemsState.status === 'error') {
    return (
      <MessageBar
        messageBarType={MessageBarType.error}
        isMultiline
        actions={
          <div>
            <MessageBarButton onClick={onRetry}>{strings.RetryButton}</MessageBarButton>
          </div>
        }
      >
        {itemsState.errorMessage}
      </MessageBar>
    );
  }
  if (htmlTemplate.trim().length === 0) {
    return <MessageBar messageBarType={MessageBarType.info}>{strings.PreviewEmptyTemplate}</MessageBar>;
  }

  return (
    <TemplateOutput
      htmlTemplate={htmlTemplate}
      legacyTitle={legacyTitle}
      legacyDescription={legacyDescription}
      items={itemsState.items}
      hasMore={itemsState.hasMore}
      hasList={!!listId && itemsState.status === 'loaded'}
      showNotes
    />
  );
};
