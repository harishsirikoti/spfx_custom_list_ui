import * as React from 'react';
import {
  DefaultButton,
  Dialog,
  DialogFooter,
  DialogType,
  Link,
  MessageBar,
  MessageBarType,
  PrimaryButton,
  SearchBox,
  Spinner,
  SpinnerSize,
  TextField
} from '@fluentui/react';

import * as strings from 'CustomListUiWebPartStrings';
import { format } from '../components/useListItems';
import { isSafeIconColor, parseIconSize, DEFAULT_ICON_SIZE } from '../lucide/iconAttributes';
import { getLoadedIconData, loadIconData, type IconDataMap } from '../lucide/iconRegistry';
import { ICON_PICKER_PAGE_SIZE, searchIcons } from '../lucide/iconSearch';
import { buildIconTag, DYNAMIC_ICON_NAME } from '../lucide/iconTag';
import { LucideIcon } from '../lucide/LucideIcon';
import styles from './IconPickerDialog.module.scss';

/** Address of the full Lucide catalog (shown as a link; the picker itself works offline from the bundled catalog). */
const CATALOG_URL: string = 'https://lucide.dev/icons/';

export interface IIconPickerDialogProps {
  /** Called with the text to insert at the editor cursor. The parent inserts it and closes the dialog. */
  onInsert: (tag: string) => void;
  onDismiss: () => void;
}

/**
 * Searchable picker for the bundled Lucide icons. Every result shows a real preview and the icon name.
 * Inserts an <icon> tag that uses the chosen name, or the dynamic {item.Icon} form.
 */
export const IconPickerDialog: React.FC<IIconPickerDialogProps> = ({ onInsert, onDismiss }) => {
  const [data, setData] = React.useState<IconDataMap | undefined>(getLoadedIconData());
  const [loadFailed, setLoadFailed] = React.useState<boolean>(false);
  const [reloadToken, setReloadToken] = React.useState<number>(0);
  const [query, setQuery] = React.useState<string>('');
  const [visibleCount, setVisibleCount] = React.useState<number>(ICON_PICKER_PAGE_SIZE);
  const [selected, setSelected] = React.useState<string | undefined>(undefined);
  const [size, setSize] = React.useState<string>(String(DEFAULT_ICON_SIZE));
  const [color, setColor] = React.useState<string>('#2563eb');

  // Load the SVG data (a separate download) the first time the picker opens.
  React.useEffect(() => {
    if (getLoadedIconData()) {
      return undefined;
    }
    let cancelled: boolean = false;
    setLoadFailed(false);
    loadIconData()
      .then((loaded) => {
        if (!cancelled) {
          setData(loaded);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setLoadFailed(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [reloadToken]);

  const results: string[] = React.useMemo(() => searchIcons(query), [query]);
  const shown: string[] = results.slice(0, visibleCount);

  const sizeValue: number | undefined = parseIconSize(size);
  const sizeError: string = sizeValue === undefined ? strings.IconInvalidSize : '';
  const colorError: string = color.trim() !== '' && !isSafeIconColor(color) ? strings.IconInvalidColor : '';
  const canInsert: boolean = sizeValue !== undefined && colorError === '';

  const insert = (name: string): void => {
    if (canInsert) {
      onInsert(buildIconTag({ name, size: sizeValue, color }));
    }
  };

  return (
    <Dialog
      hidden={false}
      onDismiss={onDismiss}
      minWidth={Math.min(760, window.innerWidth - 32)}
      maxWidth={900}
      dialogContentProps={{ type: DialogType.normal, title: strings.IconPickerTitle, subText: strings.IconPickerHint }}
      modalProps={{ isBlocking: true }}
    >
      <SearchBox
        placeholder={strings.IconSearchPlaceholder}
        ariaLabel={strings.IconSearchLabel}
        value={query}
        onChange={(_e, value) => {
          setQuery(value ?? '');
          setVisibleCount(ICON_PICKER_PAGE_SIZE);
        }}
        onClear={() => setQuery('')}
        autoFocus
      />
      <div className={styles.options}>
        <TextField
          label={strings.IconSizeLabel}
          value={size}
          onChange={(_e, value) => setSize(value ?? '')}
          errorMessage={sizeError}
          styles={{ root: { width: 140 } }}
        />
        <TextField
          label={strings.IconColorLabel}
          value={color}
          onChange={(_e, value) => setColor(value ?? '')}
          errorMessage={colorError}
          styles={{ root: { width: 200 } }}
        />
      </div>

      {loadFailed && (
        <MessageBar
          messageBarType={MessageBarType.error}
          isMultiline
          actions={
            <div>
              <DefaultButton onClick={() => setReloadToken((n) => n + 1)}>{strings.RetryButton}</DefaultButton>
            </div>
          }
        >
          {strings.IconLoadError}
        </MessageBar>
      )}
      {!data && !loadFailed && <Spinner size={SpinnerSize.medium} label={strings.IconLoading} ariaLive="polite" />}

      {data && (
        <>
          <p className={styles.count} role="status">
            {results.length === 0 ? strings.IconNoResults : format(strings.IconResultCount, results.length.toLocaleString())}
            {selected ? ` - ${format(strings.IconSelected, selected)}` : ''}
          </p>
          <div className={styles.grid} role="listbox" aria-label={strings.IconPickerTitle}>
            {shown.map((name) => (
              <button
                key={name}
                type="button"
                role="option"
                aria-selected={selected === name}
                className={selected === name ? `${styles.icon} ${styles.selected}` : styles.icon}
                onClick={() => setSelected(name)}
                onDoubleClick={() => insert(name)}
                title={name}
              >
                <LucideIcon name={name} size={24} data={data} />
                <span className={styles.name}>{name}</span>
              </button>
            ))}
          </div>
          {results.length > shown.length && (
            <DefaultButton className={styles.more} onClick={() => setVisibleCount((n) => n + ICON_PICKER_PAGE_SIZE)}>
              {strings.IconShowMore}
            </DefaultButton>
          )}
        </>
      )}

      <p className={styles.count}>
        <Link href={CATALOG_URL} target="_blank" rel="noopener noreferrer">
          {strings.IconCatalogLink}
        </Link>
      </p>

      <DialogFooter>
        <PrimaryButton text={strings.IconInsertButton} disabled={!selected || !canInsert} onClick={() => selected && insert(selected)} />
        <DefaultButton text={strings.IconInsertDynamicButton} disabled={!canInsert} onClick={() => insert(DYNAMIC_ICON_NAME)} />
        <DefaultButton text={strings.IconCloseButton} onClick={onDismiss} />
      </DialogFooter>
    </Dialog>
  );
};
