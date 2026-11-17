import * as React from 'react';
import { DefaultButton, MessageBar, MessageBarType, PrimaryButton, Spinner, SpinnerSize } from '@fluentui/react';

import * as strings from 'CustomListUiWebPartStrings';
import { format } from '../components/useListItems';
import type { SharePointListService } from '../services/SharePointListService';
import { compileTemplate } from '../templating/TemplateRenderer';
import { downloadSampleHtml } from './downloadSample';

// The editor (and CodeMirror with it) is a separate webpack chunk that is downloaded only when an editor
// clicks "Open HTML Editor". Visitors and the normal web part never load it.
const TemplateEditorPanel = React.lazy(() => import(/* webpackChunkName: 'custom-list-ui-editor' */ './TemplateEditorPanel'));

export interface IHtmlTemplateFieldProps {
  /** The template currently stored in the web part properties. */
  value: string;
  /** Saved value of the removed title property; only used to word migration warnings. */
  legacyTitle: string;
  /** Saved value of the removed description property; only used to word migration warnings. */
  legacyDescription: string;
  listService: SharePointListService;
  /** Returns the GUID of the list selected at the moment the editor is opened. */
  getListId: () => string;
  /** Called with the new template when the editor's Save is clicked. */
  onChange: (value: string) => void;
}

/** Catches a failed editor download so the property pane keeps working. */
class EditorErrorBoundary extends React.Component<{ onClose: () => void; children: React.ReactNode }, { failed: boolean }> {
  public state: { failed: boolean } = { failed: false };

  public static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }

  public render(): React.ReactNode {
    if (this.state.failed) {
      return (
        <MessageBar messageBarType={MessageBarType.error} isMultiline onDismiss={this.props.onClose}>
          {format(strings.ErrorUnknown, 'the editor could not be loaded')}
        </MessageBar>
      );
    }
    return this.props.children;
  }
}

/**
 * Compact property pane entry for the HTML template: a button that opens the full editor, a button to
 * download the sample, and a short status of the saved template.
 */
export const HtmlTemplateField: React.FC<IHtmlTemplateFieldProps> = (props) => {
  const { value, legacyTitle, legacyDescription, listService, getListId, onChange } = props;
  const [current, setCurrent] = React.useState<string>(value);
  const [isOpen, setIsOpen] = React.useState<boolean>(false);
  const lastSaved = React.useRef<string>(value);

  // Pick up changes made outside this field.
  React.useEffect(() => {
    if (value !== lastSaved.current) {
      lastSaved.current = value;
      setCurrent(value);
    }
  }, [value]);

  const status = React.useMemo(
    () => (current.trim().length === 0 ? undefined : compileTemplate(current, { title: legacyTitle, description: legacyDescription })),
    [current, legacyTitle, legacyDescription]
  );

  const handleSave = (template: string): void => {
    lastSaved.current = template;
    setCurrent(template);
    setIsOpen(false);
    onChange(template);
  };

  return (
    <div>
      <p style={{ fontSize: 12, margin: '0 0 8px' }}>{strings.TemplateFieldHelp}</p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, margin: '8px 0' }}>
        <PrimaryButton iconProps={{ iconName: 'Code' }} onClick={() => setIsOpen(true)}>
          {strings.EditorOpenButton}
        </PrimaryButton>
        <DefaultButton iconProps={{ iconName: 'Download' }} onClick={downloadSampleHtml}>
          {strings.TemplateDownloadSampleButton}
        </DefaultButton>
      </div>

      {!status && <MessageBar messageBarType={MessageBarType.info}>{strings.TemplateStatusEmpty}</MessageBar>}
      {status && status.errors.length > 0 && (
        <MessageBar messageBarType={MessageBarType.error} isMultiline>
          <strong>{strings.TemplateStatusErrors}</strong>
          <ul style={{ margin: '4px 0 0', paddingLeft: 20 }}>
            {status.errors.map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
        </MessageBar>
      )}
      {status && status.errors.length === 0 && status.warnings.length > 0 && (
        <MessageBar messageBarType={MessageBarType.warning} isMultiline>
          <strong>{strings.TemplateNotesHeading}</strong>
          <ul style={{ margin: '4px 0 0', paddingLeft: 20 }}>
            {status.warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </MessageBar>
      )}
      {status && status.errors.length === 0 && status.warnings.length === 0 && (
        <MessageBar messageBarType={MessageBarType.success}>
          {format(strings.TemplateStatusSet, current.length.toLocaleString())} {strings.TemplateStatusValid}
        </MessageBar>
      )}

      {isOpen && (
        <EditorErrorBoundary onClose={() => setIsOpen(false)}>
          <React.Suspense fallback={<Spinner size={SpinnerSize.small} label={strings.EditorLoading} ariaLive="polite" />}>
            <TemplateEditorPanel
              initialTemplate={current}
              legacyTitle={legacyTitle}
              legacyDescription={legacyDescription}
              listId={getListId()}
              listService={listService}
              onSave={handleSave}
              onDismiss={() => setIsOpen(false)}
            />
          </React.Suspense>
        </EditorErrorBoundary>
      )}
    </div>
  );
};
