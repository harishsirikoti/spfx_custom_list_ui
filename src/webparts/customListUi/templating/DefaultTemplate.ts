/**
 * The built-in sample template.
 *
 * This single string is used for three things, so they can never drift apart:
 *  1. the initial template of a newly added web part,
 *  2. the "Load sample template" action in the property pane,
 *  3. the file produced by "Download Sample HTML".
 *
 * It only needs a Title column, which every basic SharePoint list has. The text is plain ASCII so the
 * downloaded file opens correctly in any editor regardless of encoding.
 */
export const DEFAULT_TEMPLATE: string = `<!--
  Custom List UI - sample template

  HOW IT WORKS
  - You control the whole layout: header, content, repeated cards and footer.
  - Repeated items: everything between the "each items" start and end markers below is repeated once per list item.
      Start marker:  double opening braces, #each items, double closing braces
      End marker:    double opening braces, /each, double closing braces
  - Field values: write the SharePoint INTERNAL field name inside single braces, prefixed with "item."
      Example: item.Title shows the Title column. Use it only inside the repeated block.
      Internal names can differ from display names (for example a column shown as "Due Date" may be "Due_x0020_Date").
      Hyperlink columns support item.FieldName.url and item.FieldName.desc, for example {item.nav_link.url} and {item.nav_link.desc}.
  - Icons: use Lucide icons (free, about 2000 icons): <icon name="calendar-days" size="24" color="#2563eb"></icon>
      Browse the catalog: https://lucide.dev/icons/
      Use the icon name shown there, for example calendar-days. Names are checked against the Lucide catalog that is
      installed with the web part; unknown names show nothing and the editor shows a note. size is 8 to 256 and
      color is optional (hex such as #2563eb, rgb(), hsl() or a color name). Always write the closing </icon> tag.
      Different icon per item: store the names in a Single line of text (or Choice) column named Icon and use
        <icon name="{item.Icon}" size="24"></icon>
      inside the repeated block. In the HTML editor, the Icon Picker button searches the icons and inserts the tag,
      and Export Icon Names saves all names (one per line) for the choices of a SharePoint Choice column.
  - Styling: use inline style="..." attributes. Style tags, scripts, event handlers and external stylesheets are not allowed.
  - Responsive cards: grid-template-columns with repeat(auto-fit, minmax(220px, 1fr)) wraps cards automatically
      without media queries.
  - These comments are removed when the template is displayed.
-->
<section aria-label="List items" style="border: 1px solid #e1dfdd; border-radius: 8px; overflow: hidden; background-color: #ffffff; color: #323130;">
  <header style="padding: 20px 24px; background: #0078d4; color: #ffffff;">
    <h2 style="margin: 0; font-size: 24px; font-weight: 600;">
      <icon name="list" size="24" color="#ffffff" style="margin-right: 8px;"></icon>My list
    </h2>
    <p style="margin: 8px 0 0; font-size: 14px;"><icon name="calendar-days" size="16" color="#ffffff" style="margin-right: 6px;"></icon>Replace this text with a description of your list.</p>
  </header>

  <div style="padding: 20px 24px;">
    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 16px;">
      {{#each items}}
      <article style="display: flex; align-items: center; gap: 12px; padding: 16px; border: 1px solid #edebe9; border-radius: 6px; background-color: #faf9f8;">
        <icon name="file-text" size="22" color="#0078d4"></icon>
        <h3 style="margin: 0; font-size: 16px; font-weight: 600;">{item.Title}</h3>
      </article>
      {{/each}}
    </div>
  </div>

  <footer style="padding: 12px 24px; border-top: 1px solid #edebe9; background-color: #f3f2f1; font-size: 12px; color: #605e5c;">
    <icon name="info" size="14" color="#0078d4" style="margin-right: 6px;"></icon>Lucide icons are bundled with this web part.
  </footer>
</section>
`;

/** File name offered by the "Download Sample HTML" action. */
export const SAMPLE_FILE_NAME: string = 'custom-list-ui-sample.html';
