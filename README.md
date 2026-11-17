# Custom List UI

A SharePoint Framework (SPFx) web part that shows items from a SharePoint list using **your own HTML**.

## Contents

- [Overview](#overview)
- [Features](#features)
- [How to use](#how-to-use)
- [HTML template syntax](#html-template-syntax)
- [Flaticon icons](#flaticon-icons)
- [Import and export](#import-and-export)
- [Troubleshooting](#troubleshooting)
- [Developer information](#developer-information)
- [Third-party notices](#third-party-notices)

---

## Overview

Custom List UI connects to a list on the **current SharePoint site** and shows its items with an HTML template that you write or import.

- You choose the list. The web part reads up to **100 items** as the signed-in user, so normal SharePoint permissions apply. No Microsoft Graph permission is needed.
- You write the HTML for everything: header, footer, repeating cards and inline CSS styles.
- You can use [Flaticon](https://www.flaticon.com/uicons) icons (one supported icon set, see [Flaticon icons](#flaticon-icons)).
- A built-in editor (based on CodeMirror 6) has syntax highlighting and a **live preview**, so you can see the result before saving.
- Templates are checked and cleaned before they are shown. Scripts and other unsafe content are not allowed.

If no template is set, the web part shows a simple list of item titles.

## Features

These features are implemented in the current code.

**List and data**

- Choose a list from the lists of the current site (hidden, catalog and system lists are not shown).
- Items are read with SharePoint REST as the current user (first 100 items). If the list has more items, a note says only the first 100 are shown.
- States for loading, empty list, deleted or moved list, permission denied and network errors.

**HTML editor** (opens in a wide panel from the Property Pane)

- HTML syntax highlighting, line numbers, automatic indentation, auto-closing tags and bracket matching.
- Autocomplete for HTML tags and attributes, for template placeholders (type `{`), and for icon names (type `fi-rr-`).
- Search and replace (Ctrl+F).
- Light or dark editor colors, chosen from the SharePoint theme.
- **Live preview** next to the editor (below it on narrow screens). It uses the same rendering code as the published web part and updates about 0.4 seconds after you stop typing. List items are loaded once when the editor opens, not on every key press.
- **SharePoint field picker**: lists the columns of the selected list with display name and internal name, and inserts `{item.InternalName}` at the cursor.
- **Import HTML**, **Download Sample**, **Export Current HTML** and **Reset to Sample** buttons.
- **Save** and **Cancel**, with a confirmation if you close the editor with unsaved changes.

**Templates**

- A default sample template (header, description, responsive cards, footer, icons). New web parts start with it. It works with any list that has a Title column.
- Safe rendering: the HTML and CSS are sanitized, list values are escaped, and a template with problems shows clear error messages instead of rendering.
- Flaticon Uicons icons, bundled with the web part (nothing is loaded from the internet).

## How to use

1. **Add the web part.** Edit a modern SharePoint page, click **+**, and add **Custom List UI**. A new web part starts with the sample template.
2. **Open the Property Pane.** Click the pencil (Edit web part) icon.
3. **Select a list.** Use the **List** dropdown. Wait until the lists have loaded.
4. **Open the editor.** Click **Open HTML Editor**.
5. **Edit the HTML.** Type in the left side, or click **Import HTML** to load a `.html` file.
6. **Insert fields.** Choose a column in the field picker and click **Insert Field**. Place the cursor inside a `{{#each items}} ... {{/each}}` block first (see [syntax](#html-template-syntax)).
7. **Check the live preview** on the right. Fix any errors it shows.
8. **Save the template.** Click **Save** in the editor. The web part updates.
9. **Save or publish the page.** Saving the template does **not** publish the page. Use **Save as draft** or **Publish** / **Republish** on the page.

> If you leave the editor with **Cancel** (or the X or Esc), your unsaved edits are discarded. The previously saved template is kept.

## HTML template syntax

A template is normal HTML plus a few special parts. Nothing else is interpreted.

| Syntax | What it does |
| --- | --- |
| `{{#each items}}` | Starts the part that is repeated once for every list item. |
| `{{/each}}` | Ends the repeated part. |
| `{item.Title}` | Shows the value of the **Title** column of the current item. |
| `{item.InternalFieldName}` | Shows the value of any other column. |

Rules:

- `{item.X}` works **only between** `{{#each items}}` and `{{/each}}`.
- You can have one repeated block. Blocks cannot be nested.
- Use the SharePoint **internal field name**, not the display name. The two can differ. A column displayed as `Due Date` usually has the internal name `Due_x0020_Date`. The field picker shows internal names in brackets. You can also open the column in **List settings** and read `Field=` in the page address.
- Names are case-sensitive.
- Values are escaped, so text such as `<b>` in a list item is shown as text and does not become HTML.
- Dates are shown as SharePoint returns them (for example `2026-11-17T08:00:00Z`). Multi-value columns are joined with commas. Hyperlink columns show their URL.
- If a column is missing from the list data, the preview and the web part show an "Unknown list field" error.
- Text in a template that is not a placeholder, such as `{ }`, is left as it is.
- Placeholders are allowed in text and inside **quoted** attributes (for example `title="{item.Title}"` or `href="{item.Link}"`). They are not allowed in `style` attributes, event attributes, `srcset`, unquoted attributes, tag names, or inside `<script>` / `<style>`.
- HTML comments `<!-- ... -->` are allowed and are removed from the displayed page.
- The template can be up to **100,000 characters**.

### Header, footer and repeating cards

```html
<section style="border: 1px solid #e1dfdd; border-radius: 8px; overflow: hidden;">

  <header style="padding: 16px 24px; background-color: #0078d4; color: #ffffff;">
    <h2 style="margin: 0; font-size: 24px; font-weight: 600;">My tasks</h2>
    <p style="margin: 8px 0 0;">Everything we are working on.</p>
  </header>

  <div style="padding: 16px 24px;">
    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 16px;">
      {{#each items}}
      <article style="padding: 16px; border: 1px solid #edebe9; border-radius: 6px;">
        <h3 style="margin: 0; font-size: 16px;">{item.Title}</h3>
      </article>
      {{/each}}
    </div>
  </div>

  <footer style="padding: 12px 24px; background-color: #f3f2f1; font-size: 12px;">
    Updated by the team
  </footer>

</section>
```

- The **header** and **footer** are outside the repeated block, so they appear once.
- The **card** (`<article>`) is inside the block, so it appears once per item.

### Inline styles

Use `style="..."` attributes. These CSS properties are allowed: `display`, `grid` and `grid-template-*`, `gap`, `flex` and `flex-*`, `align-*`, `justify-*`, `margin`, `padding`, `border` (and its parts), `border-radius`, `background`, `background-color`, `color`, `font-*`, `line-height`, `letter-spacing`, `text-*`, `width`, `height`, `min-*`, `max-*`, `overflow`, `box-shadow`, `list-style` and a few similar layout and text properties.

Not allowed (they are removed, and the editor reports it): `url(...)`, `position`, `!important`, comments and backslashes in CSS, and unknown properties.

**Responsive layout.** `<style>` elements, `<link>` elements and media queries are not allowed. For cards that adapt to the screen width, use `display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));` as in the example, or `display: flex; flex-wrap: wrap;`.

### Allowed HTML

Common structure and text elements work: `header`, `main`, `section`, `article`, `aside`, `nav`, `footer`, `div`, `span`, headings, `p`, lists, `table` elements, `a`, `img`, `blockquote`, `pre`, `code` and similar.

Not allowed: `script`, `style`, `link`, `iframe`, `object`, `embed`, forms and form controls, SVG, `id` and `name` attributes, `data-*` attributes and event handler attributes such as `onclick`. Links may use `http`, `https`, `mailto`, `tel` or relative addresses only. Links that open in a new tab get `rel="noopener noreferrer"` automatically.

> The SharePoint page already has a main landmark, so the sample uses `<section>` instead of `<main>` for the content area.

## Flaticon icons

The web part includes the **Flaticon Uicons** icon font (package `@flaticon/flaticon-uicons` 3.3.1), **"regular rounded" style only**. The icons are bundled and loaded only when a template uses them.

**Working example**

```html
<i class="fi fi-rr-calendar" aria-hidden="true"></i>
```

You can add `style` to change the size and color:

```html
<i class="fi fi-rr-calendar" aria-hidden="true" style="font-size: 22px; color: #0078d4;"></i>
```

**To explore icons**, visit:

https://www.flaticon.com/packs/search?word=third%20party&color=black

Important:

- The website has many icon packs and styles. **Not everything on the website works in this web part.** Only the installed Uicons "regular rounded" set is supported.
- An icon class must look like `fi-rr-name`, for example `fi-rr-calendar`, `fi-rr-home` or `fi-rr-list`. Icon names from other styles (for example `fi-sr-...` or `fi-br-...`) and icons from other packs will not display.
- The editor helps you: type `fi-rr-` in a class and it suggests the supported names.
- Use the classes on `<i>` or `<span>` elements. On other elements the class is removed.
- Other classes (for example SharePoint page classes) are removed, and the editor shows a note.
- If a class looks right but is not in the installed set, the editor shows a note (for example "Icon ... is not part of the bundled Uicons set") and nothing is drawn. The page still works.
- Icon styles apply only inside the template area, so they do not change the rest of the SharePoint page.
- Add `aria-hidden="true"` to decorative icons so screen readers skip them.

**Licensing and attribution.** The Uicons package uses the Flaticon License, not an open-source license. At the time of writing, Flaticon's package documentation says free use asks for a visible credit link, for example `Uicons by <a href="https://www.flaticon.com/uicons">Flaticon</a>`, placed near the icons or in the page footer. The sample template includes this credit in its footer; if you replace the footer, keep a credit unless your organization has a Flaticon Premium subscription or other permission. Read the current terms at https://www.freepikcompany.com/legal#nav-flaticon and ask your licensing owner if unsure. See also `THIRD-PARTY-NOTICES.md`.

## Import and export

All of these buttons are inside the **HTML editor** panel. Files are read and written **in your browser only**. Nothing is uploaded to SharePoint or to a document library.

- **Import HTML** – Choose a `.html` or `.htm` file from your computer. Its text replaces the editor content as an **unsaved draft**. Large files and other file types are rejected with a message. Click **Save** to keep it.
- **Download Sample** – Saves the built-in sample template as `custom-list-ui-sample.html`. It does not change your draft and does not include your own HTML. The Property Pane has a **Download Sample HTML** button as well.
- **Export Current HTML** – Saves the text currently in the editor (including unsaved changes) as `custom-list-ui-template.html`.
- **Reset to Sample** – Replaces the editor content with the built-in sample. If you have unsaved changes, you are asked to confirm. The change is still a draft until you click **Save**.

A file you exported or downloaded can be imported again.

## Troubleshooting

**The SharePoint list does not appear in the dropdown**
- Only lists of the **current site** are shown. Hidden, catalog and system lists are not shown.
- You must have permission to see the list.
- Wait for the dropdown to finish loading. If it shows an error, reload the page.
- If the saved list was deleted or you lost access, the dropdown shows "Unavailable list" and the web part shows an error message. Choose another list.

**A field placeholder does not render**
- Make sure you used the **internal name**, with the right capital letters, for example `{item.Due_x0020_Date}`.
- Put `{item.X}` between `{{#each items}}` and `{{/each}}`.
- Use the field picker so the name is inserted for you.
- Person, Lookup and managed metadata columns are marked "not supported" in the picker because their values are not retrieved.
- An "Unknown list field" error means the column is not in the data returned for the list.

**HTML validation errors**
- Read the message. Syntax errors show a line and column. "Not allowed" messages name the blocked element, attribute, URL or CSS.
- Typical causes: a `<script>` or `<style>` element, an `onclick` attribute, a `javascript:` link, `url(...)` or `position` in CSS, a placeholder in a `style` attribute, a missing `{{/each}}`, or an unknown placeholder such as `{title}`.
- The editor cannot save a template that has errors.

**A Flaticon icon does not appear**
- Use the exact `fi-rr-` class, on an `<i>` or `<span>`, for example `<i class="fi fi-rr-calendar" aria-hidden="true"></i>`.
- Check for a note about an unknown icon. The name may not exist in the installed set.
- Icons from other styles or packs on the Flaticon website are not supported.
- Some organizations block certain content on SharePoint pages. The icon font is embedded in the web part's own code, but this has not been tested against every tenant security policy.

**The live preview is not updating**
- Wait about half a second after typing.
- Check for an error message in the preview. Errors stop the preview from showing the new HTML.
- If list data failed to load, click **Try again** in the preview.
- Items are loaded once when the editor opens. If you changed list items in another tab, close and reopen the editor.

**Changes do not appear after saving the page**
- Clicking **Save** in the editor changes the web part only. Save or publish the page as well.
- Refresh the page. If the page is in draft, other people see the old version until it is published.
- The editor changes the template, but not the selected list. Check the list in the Property Pane.

**Old `{wp_title}` or `{wp_description}` placeholders**
- The title and description boxes were removed from the Property Pane. Existing templates that still use these placeholders keep showing the text that was saved before, and the editor shows a warning. Replace the placeholders with plain text in your HTML.

## Developer information

| Item | Value |
| --- | --- |
| SharePoint Framework | 1.24.0 (SharePoint Online only) |
| React | 18.3.1 |
| UI library | Fluent UI v8 (`@fluentui/react` ^8.106.4) |
| TypeScript | ~5.8 |
| Build tool | Heft 1.3.2 (project-local) |
| Node.js | `>=22.14.0 <23` (also 24 and 26 are allowed by `package.json`); developed on 22.23.3 |
| HTML editor | CodeMirror 6: `@codemirror/view` 6.43.15, `state` 6.7.6, `lang-html` 6.4.12, `commands` 6.11.1, `autocomplete` 6.20.4, `language` 6.13.1, `search` 6.7.2, and `@lezer/highlight` 1.2.5 |
| HTML sanitizer | DOMPurify 3.4.18 |
| Icons | `@flaticon/flaticon-uicons` 3.3.1 (dev dependency; bundled output is generated) |

**Prerequisites**

- Node.js 22 (see above) and npm.
- A Microsoft 365 tenant with a SharePoint Online site, to test in the hosted workbench.
- Permission to upload to the tenant App Catalog or site collection App Catalog, to deploy.

**Local development**

```
npm install
npm run start
```

`npm run start` runs `heft start --clean`, which serves the web part at `https://localhost:4321`. The first time, trust the local development certificate:

```
npx heft trust-dev-cert
```

**Build**

```
npm run build
```

This runs the lint, the unit tests and the production package build.

**Package output**

`sharepoint/solution/custom-list-ui.sppkg`

Upload this file to your App Catalog to deploy. Deployment is not automatic.

**Hosted workbench testing**

1. Run `npm run start` and leave it running.
2. Open `https://<your-tenant>.sharepoint.com/sites/<your-site>/_layouts/15/workbench.aspx`.
3. Add **Custom List UI**, pick a list, and open the HTML editor.
4. Accept the browser warning for `localhost` the first time if the web part does not load.

The hosted workbench uses real lists and your real permissions.

**Where things are** (`src/webparts/customListUi/`)

| Folder / file | Purpose |
| --- | --- |
| `CustomListUiWebPart.ts` | Web part class, Property Pane, saved properties |
| `components/` | Web part UI and the shared `TemplateOutput` renderer |
| `services/SharePointListService.ts` | Reads lists, fields and items |
| `templating/` | Template parser, renderer, HTML and CSS sanitizers |
| `templating/DefaultTemplate.ts` | **The one source of the built-in sample HTML** |
| `propertyPane/` | Property Pane field, editor panel, live preview, import/export |
| `editor/` | CodeMirror editor component, themes, autocomplete |
| `icons/` | Generated Flaticon icon assets and loader |

**The sample template.** `DEFAULT_TEMPLATE` in `templating/DefaultTemplate.ts` is used for new web parts, **Download Sample**, **Download Sample HTML** and **Reset to Sample**, so they always match. Edit it only in that file.

**Saved properties**: `list` (list GUID) and `htmlTemplate` (template text). `wp_title` and `wp_description` are no longer shown or written, but old values are kept so that legacy placeholders keep working.

**Regenerating the icon assets** (only needed if the pinned icon package version changes):

```
node scripts/generate-uicons.js
```

## Third-party notices

See [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md) for Flaticon Uicons and DOMPurify licensing.

## Disclaimer

**THIS CODE IS PROVIDED _AS IS_ WITHOUT WARRANTY OF ANY KIND, EITHER EXPRESS OR IMPLIED, INCLUDING ANY IMPLIED WARRANTIES OF FITNESS FOR A PARTICULAR PURPOSE, MERCHANTABILITY, OR NON-INFRINGEMENT.**
