import * as React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { DisplayMode, Version } from '@microsoft/sp-core-library';
import {
  type IPropertyPaneConfiguration,
  type IPropertyPaneDropdownOption,
  PropertyPaneDropdown,
  PropertyPaneLabel
} from '@microsoft/sp-property-pane';
import { BaseClientSideWebPart } from '@microsoft/sp-webpart-base';
import type { IReadonlyTheme } from '@microsoft/sp-component-base';

import * as strings from 'CustomListUiWebPartStrings';
import CustomListUi from './components/CustomListUi';
import type { ICustomListUiProps } from './components/ICustomListUiProps';
import type { IListInfo } from './models/ListModels';
import { PropertyPaneHtmlTemplate } from './propertyPane/PropertyPaneHtmlTemplate';
import { SharePointListService } from './services/SharePointListService';
import { DEFAULT_TEMPLATE } from './templating/DefaultTemplate';

export interface ICustomListUiWebPartProps {
  /** GUID of the selected list. */
  list: string;
  /**
   * HTML template that controls the whole layout (pasted, uploaded, or the built-in sample).
   * Undefined only for a web part that was just added; an empty string means "intentionally empty".
   */
  htmlTemplate?: string;
  /**
   * @deprecated Removed from the property pane. Still read from saved pages so that templates containing the
   * legacy {wp_title} placeholder keep rendering the same text. Never written by this web part.
   */
  wp_title?: string;
  /** @deprecated See wp_title. Used for the legacy {wp_description} placeholder. */
  wp_description?: string;
}

export default class CustomListUiWebPart extends BaseClientSideWebPart<ICustomListUiWebPartProps> {
  private _root: Root | undefined;
  private _listService: SharePointListService | undefined;

  // Property pane state for the list dropdown.
  private _listOptions: IPropertyPaneDropdownOption[] = [];
  private _listsLoaded: boolean = false;
  private _listsError: string = '';

  protected onInit(): Promise<void> {
    this._listService = new SharePointListService(this.context.spHttpClient, this.context.pageContext.web.absoluteUrl);

    // Seed the sample template for a brand new web part only. A saved template - including an intentionally
    // empty one ("") - is never touched. The property is absent only on a freshly added instance.
    if (this.properties.htmlTemplate === undefined && this.displayMode === DisplayMode.Edit) {
      this.properties.htmlTemplate = DEFAULT_TEMPLATE;
    }
    return Promise.resolve();
  }

  public render(): void {
    if (!this._listService) {
      return;
    }

    const element: React.ReactElement<ICustomListUiProps> = React.createElement(CustomListUi, {
      legacyTitle: this.properties.wp_title ?? '',
      legacyDescription: this.properties.wp_description ?? '',
      isEditMode: this.displayMode === DisplayMode.Edit,
      listId: this.properties.list ?? '',
      htmlTemplate: this.properties.htmlTemplate ?? '',
      listService: this._listService
    });

    if (!this._root) {
      this._root = createRoot(this.domElement);
    }
    this._root.render(element);
  }

  protected onThemeChanged(currentTheme: IReadonlyTheme | undefined): void {
    if (currentTheme?.semanticColors) {
      this.domElement.style.setProperty('--bodyText', currentTheme.semanticColors.bodyText || null);
    }
  }

  protected onDispose(): void {
    this._root?.unmount();
    this._root = undefined;
  }

  protected get dataVersion(): Version {
    return Version.parse('1.0');
  }

  /** Loads the lists of the current site the first time the property pane opens. */
  protected onPropertyPaneConfigurationStart(): void {
    if (this._listsLoaded || !this._listService) {
      return;
    }

    this._listService
      .getLists()
      .then((lists: IListInfo[]) => {
        this._listOptions = lists.map((l) => ({ key: l.id, text: l.title }));
        this._listsError = '';
      })
      .catch((error: unknown) => {
        this._listOptions = [];
        this._listsError = error instanceof Error ? error.message : String(error);
      })
      .then(() => {
        this._listsLoaded = true;
        this.context.propertyPane.refresh();
      })
      .catch(() => undefined);
  }

  /** Builds the dropdown options, keeping a stored selection visible even if the list is gone or inaccessible. */
  private _getListDropdownOptions(): IPropertyPaneDropdownOption[] {
    const options: IPropertyPaneDropdownOption[] = [{ key: '', text: strings.ListNoneOption }, ...this._listOptions];
    const selected: string = (this.properties.list || '').toLowerCase();
    if (this._listsLoaded && selected && !options.some((o) => String(o.key).toLowerCase() === selected)) {
      options.push({ key: this.properties.list, text: strings.ListUnavailableOption.replace('{0}', this.properties.list) });
    }
    return options;
  }

  protected getPropertyPaneConfiguration(): IPropertyPaneConfiguration {
    return {
      pages: [
        {
          header: { description: strings.PropertyPaneDescription },
          groups: [
            {
              groupName: strings.ContentGroupName,
              groupFields: [
                PropertyPaneDropdown('list', {
                  label: this._listsLoaded ? strings.ListFieldLabel : `${strings.ListFieldLabel} — ${strings.ListLoading}`,
                  options: this._getListDropdownOptions(),
                  disabled: !this._listsLoaded,
                  selectedKey: this.properties.list || ''
                }),
                ...(this._listsError
                  ? [
                      PropertyPaneLabel('listError', {
                        text: strings.ListsLoadError.replace('{0}', this._listsError)
                      })
                    ]
                  : [])
              ]
            },
            {
              groupName: strings.TemplateGroupName,
              groupFields: [
                PropertyPaneHtmlTemplate('htmlTemplate', {
                  value: this.properties.htmlTemplate || '',
                  legacy: {
                    title: this.properties.wp_title ?? '',
                    description: this.properties.wp_description ?? ''
                  },
                  listService: this._listService as SharePointListService,
                  // Read when the editor opens, so a list picked a moment ago is used.
                  getListId: () => this.properties.list || ''
                })
              ]
            }
          ]
        }
      ]
    };
  }
}
