import * as React from 'react';
import {
  DefaultButton,
  Dialog,
  DialogFooter,
  DialogType,
  Dropdown,
  getTheme,
  MessageBar,
  MessageBarType,
  Panel,
  PanelType,
  PrimaryButton,
  type IDropdownOption
} from '@fluentui/react';

import * as strings from 'CustomListUiWebPartStrings';
import { format, useListItems } from '../components/useListItems';
import { HtmlTemplateEditor, type IHtmlTemplateEditorHandle } from '../editor/HtmlTemplateEditor';
import type { IFieldInfo } from '../models/ListModels';
import type { SharePointListService } from '../services/SharePointListService';
import { DEFAULT_TEMPLATE } from '../templating/DefaultTemplate';
import { getFieldSupport } from '../templating/FieldSupport';
import { compileTemplate } from '../templating/TemplateRenderer';
import { downloadSampleHtml } from './downloadSample';
import { getAllIconNames } from '../lucide/iconRegistry';
import { IconPickerDialog } from './IconPickerDialog';
import { downloadHtmlFile, downloadTextFile, readTemplateFile } from './templateFile';
import styles from './TemplateEditorPanel.module.scss';
import { TemplatePreview } from './TemplatePreview';

/** Delay between the last keystroke and the preview update. */
const PREVIEW_DEBOUNCE_MS: number = 400;

/** File name used by "Export Current HTML". */
const EXPORT_FILE_NAME: string = 'custom-list-ui-template.html';

/** File name used by "Export Icon Names". */
const ICON_NAMES_FILE_NAME: string = 'lucide-icon-names.txt';

export interface ITemplateEditorPanelProps {
  /** The template currently saved in the web part properties. */
  initialTemplate: string;
  /** Saved values of the removed title/description properties (legacy placeholders only). */
  legacyTitle: string;
  legacyDescription: string;
  /** GUID of the selected list; empty when none is selected. */
  listId: string;
  listService: SharePointListService;
  /** Called with the validated draft when the user clicks Save. The parent stores it and closes the panel. */
  onSave: (template: string) => void;
  /** Called when the panel should close without saving. */
  onDismiss: () => void;
}

/** Returns `value`, updated only after it has stopped changing for `delay` milliseconds. */
function useDebouncedValue<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = React.useState<T>(value);
  React.useEffect(() => {
    const handle: number = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(handle);
  }, [value, delay]);
  return debounced;
}

type ConfirmKind = 'discard' | 'reset' | undefined;

/**
 * Large panel with the CodeMirror HTML editor on the left, a live preview on the right, a field picker and
 * import/export actions. Edits are kept in an unsaved draft until Save is clicked.
 */
const TemplateEditorPanel: React.FC<ITemplateEditorPanelProps> = (props) => {
  const { initialTemplate, legacyTitle, legacyDescription, listId, listService, onSave, onDismiss } = props;

  const [draft, setDraft] = React.useState<string>(initialTemplate);
  const debouncedDraft: string = useDebouncedValue(draft, PREVIEW_DEBOUNCE_MS);
  const [confirm, setConfirm] = React.useState<ConfirmKind>(undefined);
  const [message, setMessage] = React.useState<{ type: MessageBarType; text: string } | undefined>(undefined);
  const [isIconPickerOpen, setIsIconPickerOpen] = React.useState<boolean>(false);
  const [selectedField, setSelectedField] = React.useState<string | undefined>(undefined);
  const [fields, setFields] = React.useState<IFieldInfo[]>([]);
  const [fieldsStatus, setFieldsStatus] = React.useState<'idle' | 'loading' | 'loaded' | 'error'>('idle');
  const [fieldsError, setFieldsError] = React.useState<string>('');

  const editorRef = React.useRef<IHtmlTemplateEditorHandle>(null);
  const fileInput = React.useRef<HTMLInputElement>(null);

  // Items are loaded once for the panel (and again only when the user retries) - never per keystroke.
  const { state: itemsState, reload } = useListItems(listService, listId);

  // Load the list's columns once for the field picker.
  React.useEffect(() => {
    if (!listId) {
      setFields([]);
      setFieldsStatus('idle');
      return undefined;
    }
    let cancelled: boolean = false;
    setFieldsStatus('loading');
    listService
      .getFields(listId)
      .then((result) => {
        if (!cancelled) {
          setFields(result);
          setFieldsStatus('loaded');
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setFieldsError(error instanceof Error ? error.message : String(error));
          setFieldsStatus('error');
        }
      });
    return () => {
      cancelled = true;
    };
  }, [listId, listService]);

  // Describe each column: insertable only when the renderer can display it (and the list data contains it).
  const sampleItem = itemsState.status === 'loaded' ? itemsState.items[0] : undefined;
  const fieldOptions: IDropdownOption[] = React.useMemo(
    () =>
      fields.map((f) => {
        const support = getFieldSupport(f, sampleItem);
        return {
          key: f.internalName,
          text: support.supported
            ? format(strings.FieldOption, f.title, f.internalName)
            : format(strings.FieldOptionUnsupported, f.title, f.internalName, support.reason ?? ''),
          disabled: !support.supported
        };
      }),
    [fields, sampleItem]
  );
  const supportedFieldNames: string[] = React.useMemo(
    () => fieldOptions.filter((o) => !o.disabled).map((o) => String(o.key)),
    [fieldOptions]
  );

  const pickerDisabled: boolean = !listId || fieldsStatus !== 'loaded' || supportedFieldNames.length === 0;
  let pickerHint: string = '';
  if (!listId) {
    pickerHint = strings.FieldPickerNoList;
  } else if (fieldsStatus === 'loading') {
    pickerHint = strings.FieldPickerLoading;
  } else if (fieldsStatus === 'error') {
    pickerHint = format(strings.FieldPickerError, fieldsError);
  } else if (fieldsStatus === 'loaded' && supportedFieldNames.length === 0) {
    pickerHint = strings.FieldPickerNoFields;
  }

  const isDark: boolean = !!getTheme().isInverted;
  const isDirty: boolean = draft !== initialTemplate;

  const requestClose = (): void => {
    if (isDirty) {
      setConfirm('discard');
    } else {
      onDismiss();
    }
  };

  const handleSave = (): void => {
    const trimmedEmpty: boolean = draft.trim().length === 0;
    const result = trimmedEmpty ? undefined : compileTemplate(draft, { title: legacyTitle, description: legacyDescription });
    if (result && result.errors.length > 0) {
      setMessage({ type: MessageBarType.error, text: strings.SaveBlockedErrors });
      return;
    }
    onSave(trimmedEmpty ? '' : draft);
  };

  const handleImportSelected = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const file: File | undefined = e.target.files?.[0];
    // Reset so selecting the same file again still fires a change event.
    e.target.value = '';
    if (!file) {
      return;
    }
    readTemplateFile(file)
      .then((content) => {
        setDraft(content);
        setMessage(undefined);
      })
      .catch((err: Error) => setMessage({ type: MessageBarType.error, text: err.message }));
  };

  const handleReset = (): void => {
    if (isDirty) {
      setConfirm('reset');
    } else {
      setDraft(DEFAULT_TEMPLATE);
      setMessage(undefined);
    }
  };

  /** Inserts the icon tag chosen in the picker at the editor cursor. */
  const handleInsertIcon = (tag: string): void => {
    setIsIconPickerOpen(false);
    editorRef.current?.insertText(tag);
  };

  /** One icon name per line, ready to paste into the choices of a SharePoint Choice column. */
  const handleExportIconNames = (): void => {
    downloadTextFile(ICON_NAMES_FILE_NAME, getAllIconNames().join('\r\n'), 'text/plain');
  };

  const handleInsertField = (): void => {
    if (selectedField) {
      editorRef.current?.insertText(`{item.${selectedField}}`);
    }
  };

  const renderFooter = (): JSX.Element => (
    <div>
      <p className={styles.footerNote}>{strings.SaveReminder}</p>
      <PrimaryButton onClick={handleSave} text={strings.SaveButton} styles={{ root: { marginRight: 8 } }} />
      <DefaultButton onClick={requestClose} text={strings.CancelButton} />
    </div>
  );

  return (
    <>
      <Panel
        isOpen
        type={PanelType.custom}
        customWidth="min(1400px, 96vw)"
        headerText={strings.EditorPanelTitle}
        closeButtonAriaLabel={strings.CancelButton}
        isBlocking
        isLightDismiss={false}
        onDismiss={requestClose}
        isFooterAtBottom
        onRenderFooterContent={renderFooter}
      >
        <div className={styles.root}>
          <div className={styles.toolbar}>
            <Dropdown
              className={styles.fieldPicker}
              label={strings.FieldPickerLabel}
              placeholder={strings.FieldPickerPlaceholder}
              options={fieldOptions}
              selectedKey={selectedField ?? null}
              onChange={(_e, option) => setSelectedField(option ? String(option.key) : undefined)}
              disabled={pickerDisabled}
            />
            <DefaultButton
              iconProps={{ iconName: 'Add' }}
              text={strings.InsertFieldButton}
              onClick={handleInsertField}
              disabled={pickerDisabled || !selectedField}
            />
            <DefaultButton iconProps={{ iconName: 'Upload' }} text={strings.ImportButton} onClick={() => fileInput.current?.click()} />
            <DefaultButton iconProps={{ iconName: 'Download' }} text={strings.DownloadSampleButton} onClick={downloadSampleHtml} />
            <DefaultButton
              iconProps={{ iconName: 'Export' }}
              text={strings.ExportButton}
              onClick={() => downloadHtmlFile(EXPORT_FILE_NAME, draft)}
            />
            <DefaultButton iconProps={{ iconName: 'Refresh' }} text={strings.ResetSampleButton} onClick={handleReset} />
            <DefaultButton iconProps={{ iconName: 'Emoji2' }} text={strings.IconPickerButton} onClick={() => setIsIconPickerOpen(true)} />
            <DefaultButton iconProps={{ iconName: 'TextDocument' }} text={strings.ExportIconNamesButton} onClick={handleExportIconNames} />
            {/* Hidden native file picker; the chosen file is read locally with FileReader and never uploaded. */}
            <input
              ref={fileInput}
              type="file"
              accept=".html,.htm,text/html"
              onChange={handleImportSelected}
              style={{ display: 'none' }}
              tabIndex={-1}
              aria-hidden="true"
            />
          </div>
          {pickerHint && (
            <p className={styles.hint} role="status">
              {pickerHint}
            </p>
          )}
          {message && (
            <MessageBar messageBarType={message.type} isMultiline onDismiss={() => setMessage(undefined)}>
              {message.text}
            </MessageBar>
          )}

          <div className={styles.split}>
            <div className={styles.column}>
              <h3 className={styles.heading}>{strings.EditorHeading}</h3>
              <div className={styles.editorHost}>
                <HtmlTemplateEditor
                  ref={editorRef}
                  value={draft}
                  onChange={setDraft}
                  fieldNames={supportedFieldNames}
                  isDark={isDark}
                  ariaLabel={strings.EditorAriaLabel}
                />
              </div>
            </div>
            <div className={styles.column}>
              <h3 className={styles.heading}>{strings.PreviewHeading}</h3>
              <div className={styles.previewHost} role="region" aria-label={strings.PreviewHeading} aria-live="polite">
                <TemplatePreview
                  htmlTemplate={debouncedDraft}
                  legacyTitle={legacyTitle}
                  legacyDescription={legacyDescription}
                  listId={listId}
                  itemsState={itemsState}
                  onRetry={reload}
                />
              </div>
            </div>
          </div>
        </div>
      </Panel>

      {isIconPickerOpen && <IconPickerDialog onInsert={handleInsertIcon} onDismiss={() => setIsIconPickerOpen(false)} />}

      <Dialog
        hidden={confirm === undefined}
        onDismiss={() => setConfirm(undefined)}
        dialogContentProps={{
          type: DialogType.normal,
          title: confirm === 'reset' ? strings.ResetConfirmTitle : strings.DiscardConfirmTitle,
          subText: confirm === 'reset' ? strings.ResetConfirmText : strings.DiscardConfirmText
        }}
      >
        <DialogFooter>
          <PrimaryButton
            text={confirm === 'reset' ? strings.ResetButton : strings.DiscardButton}
            onClick={() => {
              if (confirm === 'reset') {
                setDraft(DEFAULT_TEMPLATE);
                setMessage(undefined);
                setConfirm(undefined);
              } else {
                onDismiss();
              }
            }}
          />
          <DefaultButton text={strings.KeepEditingButton} onClick={() => setConfirm(undefined)} />
        </DialogFooter>
      </Dialog>
    </>
  );
};

export default TemplateEditorPanel;
