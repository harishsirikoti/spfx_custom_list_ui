import * as React from 'react';
import { MessageBar, MessageBarButton, MessageBarType, Spinner, SpinnerSize, Text } from '@fluentui/react';

import * as strings from 'CustomListUiWebPartStrings';
import { DEFAULT_ITEM_LIMIT } from '../services/SharePointListService';
import styles from './CustomListUi.module.scss';
import type { ICustomListUiProps } from './ICustomListUiProps';
import { TemplateOutput } from './TemplateOutput';
import { format, useListItems } from './useListItems';

/** Root component: loads list items and shows them with the custom HTML template or the minimal fallback layout. */
const CustomListUi: React.FC<ICustomListUiProps> = (props) => {
  const { legacyTitle, legacyDescription, isEditMode, listId, htmlTemplate, listService } = props;
  const { state, reload } = useListItems(listService, listId);

  const hasTemplate: boolean = htmlTemplate.trim().length > 0;

  const renderBody = (): JSX.Element => {
    if (state.status === 'loading') {
      return <Spinner size={SpinnerSize.medium} label={strings.LoadingItems} ariaLive="polite" />;
    }
    if (state.status === 'error') {
      return (
        <MessageBar
          messageBarType={MessageBarType.error}
          isMultiline
          actions={
            <div>
              <MessageBarButton onClick={reload}>{strings.RetryButton}</MessageBarButton>
            </div>
          }
        >
          {state.errorMessage}
        </MessageBar>
      );
    }

    // Custom template ---------------------------------------------------------------------------
    if (hasTemplate) {
      return (
        <TemplateOutput
          htmlTemplate={htmlTemplate}
          legacyTitle={legacyTitle}
          legacyDescription={legacyDescription}
          items={state.items}
          hasMore={state.hasMore}
          hasList={!!listId && state.status === 'loaded'}
          showNotes={isEditMode}
        />
      );
    }

    // Minimal Fluent UI fallback layout ---------------------------------------------------------
    return (
      <>
        {isEditMode && (legacyTitle || legacyDescription) && (
          <MessageBar messageBarType={MessageBarType.warning} isMultiline className={styles.status}>
            {format(strings.LegacyFallbackNotice, legacyTitle, legacyDescription)}
          </MessageBar>
        )}
        {!listId && <MessageBar messageBarType={MessageBarType.info}>{strings.NoListSelected}</MessageBar>}
        {listId && state.items.length === 0 && state.status === 'loaded' && (
          <MessageBar messageBarType={MessageBarType.info}>{strings.EmptyList}</MessageBar>
        )}
        {state.items.length > 0 && (
          <ul className={styles.items} aria-label={strings.ListRegionLabel}>
            {state.items.map((item, index) => {
              const itemTitle: string = typeof item.Title === 'string' ? item.Title.trim() : '';
              return (
                <li key={typeof item.Id === 'number' ? item.Id : index} className={styles.item}>
                  <Text variant="medium" className={itemTitle ? styles.itemTitle : styles.missingTitle}>
                    {itemTitle || strings.NoTitle}
                  </Text>
                </li>
              );
            })}
          </ul>
        )}
        {state.hasMore && (
          <MessageBar messageBarType={MessageBarType.info} className={styles.status}>
            {format(strings.ItemsTruncated, String(DEFAULT_ITEM_LIMIT))}
          </MessageBar>
        )}
      </>
    );
  };

  return <section className={styles.customListUi}>{renderBody()}</section>;
};

export default CustomListUi;
