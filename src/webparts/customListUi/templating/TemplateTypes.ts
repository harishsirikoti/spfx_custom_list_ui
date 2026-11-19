/**
 * Types describing the parsed form of an HTML template.
 *
 * Supported syntax (nothing else is interpreted):
 *   {{#each items}}       start of the repeated block (one level, no nesting)
 *   {{/each}}             end of the repeated block
 *   {item.FieldName}      value of a list item field (SharePoint internal name), inside a repeated block only
 *   {item.FieldName.url}  URL part of a SharePoint Hyperlink field
 *   {item.FieldName.desc} description part of a SharePoint Hyperlink field
 *
 * Legacy (read-only) syntax: {wp_title} and {wp_description} were removed from the property pane. Templates
 * saved earlier may still contain them; they keep rendering their saved values and produce a migration warning.
 */

/**
 * The HTML context a placeholder appears in. The renderer escapes values differently per context.
 *  - text:     element text content
 *  - attr:     inside a quoted attribute value (not a URL)
 *  - urlStart: first thing inside a quoted URL attribute (href/src/...); the sanitizer checks the URL scheme
 *  - urlPart:  later inside a quoted URL attribute; the value is percent-encoded
 */
export type PlaceholderContext = 'text' | 'attr' | 'urlStart' | 'urlPart';

/** Literal template text. */
export interface ITextNode {
  type: 'text';
  value: string;
}

/** A value placeholder such as {wp_title} or {item.Title}. */
export interface IFieldNode {
  type: 'field';
  /** Where the value comes from. wp_title / wp_description are legacy sources kept for saved templates. */
  source: 'wp_title' | 'wp_description' | 'item';
  /** Internal field name; only set when source is "item". */
  fieldName?: string;
  /** Optional supported subfield for a SharePoint Hyperlink value. */
  fieldProperty?: 'url' | 'desc';
  context: PlaceholderContext;
  /** Lower-case name of the attribute the placeholder is in (for example "class"); undefined in element text. */
  attrName?: string;
  /** 1-based position in the original template, for error messages. */
  line: number;
  column: number;
}

/** The repeated {{#each items}} ... {{/each}} block. */
export interface IEachNode {
  type: 'each';
  children: Array<ITextNode | IFieldNode>;
}

export type TemplateNode = ITextNode | IFieldNode | IEachNode;

/** A problem found in a template, with its location. */
export interface ITemplateIssue {
  message: string;
  line: number;
  column: number;
}

/** Result of parsing a template. */
export interface IParsedTemplate {
  nodes: TemplateNode[];
  issues: ITemplateIssue[];
  /** Internal field names referenced via {item.X}. */
  itemFields: string[];
  /** Legacy placeholders (without braces) found in the template, for the migration warning. */
  legacyPlaceholders: Array<'wp_title' | 'wp_description'>;
}
