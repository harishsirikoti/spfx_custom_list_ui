import type { IFieldInfo, IListItem } from '../models/ListModels';

/** Whether the template engine can display a field, and why not when it cannot. */
export interface IFieldSupport {
  supported: boolean;
  /** Short explanation shown in the field picker for unsupported fields. */
  reason?: string;
}

/**
 * Field types whose REST value is a string, number, boolean or array of those, which formatFieldValue
 * in TemplateRenderer renders directly. Hyperlink fields (URL) return an object with a Url property,
 * which formatFieldValue also supports.
 */
const SUPPORTED_TYPES: string[] = [
  'Text', 'Note', 'Number', 'Integer', 'Currency', 'Boolean', 'DateTime', 'Choice', 'MultiChoice',
  'URL', 'Counter', 'Calculated', 'Guid', 'Attachments', 'AllDayEvent', 'ContentTypeId'
];

/** Types that need $expand (or return structured data) to be useful, which the renderer does not request. */
const REASONS: { [type: string]: string } = {
  Lookup: 'lookup values are not retrieved',
  LookupMulti: 'lookup values are not retrieved',
  User: 'person values are not retrieved',
  UserMulti: 'person values are not retrieved',
  TaxonomyFieldType: 'managed metadata is not retrieved',
  TaxonomyFieldTypeMulti: 'managed metadata is not retrieved',
  Thumbnail: 'image values are not supported',
  Location: 'location values are not supported',
  Geolocation: 'location values are not supported'
};

/** Internal names must match the template syntax {item.Name}. */
const TEMPLATE_NAME_PATTERN: RegExp = /^[A-Za-z_][A-Za-z0-9_]*$/;

/**
 * Decides whether the existing renderer can show a field.
 * @param field - Column metadata.
 * @param sampleItem - A retrieved list item, if any. When given, the field must actually be present in the
 *   item data, because the template engine reports fields that are missing from the data as errors.
 */
export function getFieldSupport(field: IFieldInfo, sampleItem?: IListItem): IFieldSupport {
  if (!TEMPLATE_NAME_PATTERN.test(field.internalName)) {
    return { supported: false, reason: 'name cannot be used in a template' };
  }
  if (REASONS[field.typeAsString]) {
    return { supported: false, reason: REASONS[field.typeAsString] };
  }
  if (SUPPORTED_TYPES.indexOf(field.typeAsString) === -1) {
    return { supported: false, reason: `${field.typeAsString} fields are not supported` };
  }
  if (sampleItem && !Object.prototype.hasOwnProperty.call(sampleItem, field.internalName)) {
    return { supported: false, reason: 'not returned by the list data' };
  }
  return { supported: true };
}
