import * as React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import {
  PropertyPaneFieldType,
  type IPropertyPaneField,
  type IPropertyPaneCustomFieldProps
} from '@microsoft/sp-property-pane';

import type { SharePointListService } from '../services/SharePointListService';
import { HtmlTemplateField } from './HtmlTemplateField';

/** Everything the template field needs from the web part. */
export interface IPropertyPaneHtmlTemplateOptions {
  /** Current template text. */
  value: string;
  /** Saved values of the removed title/description properties (used only for migration warnings). */
  legacy: { title: string; description: string };
  listService: SharePointListService;
  /** Returns the GUID of the currently selected list (read when the editor opens, so it is always current). */
  getListId: () => string;
}

/**
 * Creates the property pane field used to edit the HTML template.
 * @param targetProperty - Name of the web part property that stores the template.
 * @param options - Current value and services.
 */
export function PropertyPaneHtmlTemplate(
  targetProperty: string,
  options: IPropertyPaneHtmlTemplateOptions
): IPropertyPaneField<IPropertyPaneCustomFieldProps> {
  // One React root per host element; the property pane may call onRender repeatedly for the same element.
  const roots: Map<HTMLElement, Root> = new Map<HTMLElement, Root>();

  // PropertyPaneCustomField is only typed in the beta API, so the equivalent field object is built here
  // from public types.
  const properties: IPropertyPaneCustomFieldProps = {
    key: `${targetProperty}-field`,
    onRender: (domElement: HTMLElement, _context, changeCallback) => {
      let root: Root | undefined = roots.get(domElement);
      if (!root) {
        root = createRoot(domElement);
        roots.set(domElement, root);
      }
      root.render(
        React.createElement(HtmlTemplateField, {
          value: options.value,
          legacyTitle: options.legacy.title,
          legacyDescription: options.legacy.description,
          listService: options.listService,
          getListId: options.getListId,
          onChange: (next: string) => changeCallback?.(targetProperty, next)
        })
      );
    },
    onDispose: (domElement: HTMLElement) => {
      roots.get(domElement)?.unmount();
      roots.delete(domElement);
    }
  };

  return { type: PropertyPaneFieldType.Custom, targetProperty, properties };
}
