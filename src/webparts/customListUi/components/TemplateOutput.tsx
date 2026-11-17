import * as React from 'react';
import { MessageBar, MessageBarType } from '@fluentui/react';

import * as strings from 'CustomListUiWebPartStrings';
import { ensureIconStyles } from '../icons/IconLoader';
import type { IListItem } from '../models/ListModels';
import { DEFAULT_ITEM_LIMIT } from '../services/SharePointListService';
import {
  compileTemplate,
  renderTemplate,
  type ICompileResult,
  type IRenderResult
} from '../templating/TemplateRenderer';
import styles from './CustomListUi.module.scss';
import { format } from './useListItems';

export interface ITemplateOutputProps {
  /** Non-empty HTML template to compile and render. */
  htmlTemplate: string;
  legacyTitle: string;
  legacyDescription: string;
  /** Items to render (already loaded). */
  items: IListItem[];
  /** True when SharePoint has more items than were loaded. */
  hasMore: boolean;
  /** Whether a list is selected and loaded; used to decide whether an empty-list notice makes sense. */
  hasList: boolean;
  /** Show template notes/warnings (editors and the editor preview only). */
  showNotes: boolean;
}

/**
 * Compiles and renders a template with the shared, sanitizing template engine.
 *
 * This is the single rendering path: the published web part and the editor's live preview both use it,
 * so the preview always matches what visitors see.
 */
export const TemplateOutput: React.FC<ITemplateOutputProps> = (props) => {
  const { htmlTemplate, legacyTitle, legacyDescription, items, hasMore, hasList, showNotes } = props;

  // Parse and validate the template only when its text changes.
  const compiled: ICompileResult = React.useMemo(
    () => compileTemplate(htmlTemplate, { title: legacyTitle, description: legacyDescription }),
    [htmlTemplate, legacyTitle, legacyDescription]
  );

  // Load the bundled icon styles (once per page) only when the template actually uses icons.
  const usesIcons: boolean = !!compiled.template?.usesIcons;
  React.useEffect(() => {
    if (usesIcons) {
      ensureIconStyles().catch(() => undefined);
    }
  }, [usesIcons]);

  const rendered: IRenderResult | undefined = React.useMemo(
    () => (compiled.template ? renderTemplate(compiled.template, { legacyTitle, legacyDescription, items }) : undefined),
    [compiled, items, legacyTitle, legacyDescription]
  );

  const renderErrors = (errors: string[]): JSX.Element => (
    <MessageBar messageBarType={MessageBarType.error} isMultiline>
      <strong>{strings.TemplateErrorHeading}</strong>
      <ul>
        {errors.map((e, i) => (
          <li key={i}>{e}</li>
        ))}
      </ul>
    </MessageBar>
  );

  if (compiled.errors.length > 0) {
    return renderErrors(compiled.errors);
  }
  if (rendered && rendered.errors.length > 0) {
    return renderErrors(rendered.errors);
  }

  return (
    <>
      {/* Migration warnings and notes are only useful to editors, so visitors never see them. */}
      {showNotes && compiled.warnings.length > 0 && (
        <MessageBar messageBarType={MessageBarType.warning} isMultiline className={styles.status}>
          <strong>{strings.TemplateNotesHeading}</strong>
          <ul>
            {compiled.warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </MessageBar>
      )}
      {compiled.template?.hasEachBlock && hasList && items.length === 0 && (
        <MessageBar messageBarType={MessageBarType.info} className={styles.status}>
          {strings.EmptyList}
        </MessageBar>
      )}
      {/* The HTML below has been through the allow-list sanitizer (DOMPurify + CSS filter) in renderTemplate. */}
      <div className={styles.templateHost} data-clui-host="" dangerouslySetInnerHTML={{ __html: rendered?.html ?? '' }} />
      {hasMore && (
        <MessageBar messageBarType={MessageBarType.info} className={styles.status}>
          {format(strings.ItemsTruncated, String(DEFAULT_ITEM_LIMIT))}
        </MessageBar>
      )}
    </>
  );
};
