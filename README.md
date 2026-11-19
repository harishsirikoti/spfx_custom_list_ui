# Custom List UI

Custom List UI is an SPFx 1.24.0 web part that displays SharePoint list items with a user-defined, sanitized HTML template.

## Features

- Select a list from the current SharePoint site and load up to 100 items.
- Use `{item.InternalName}` inside `{{#each items}}...{{/each}}`.
- Edit templates with CodeMirror, autocomplete, field picker, import/export, sample download, reset, Save and Cancel.
- Preview uses the same parser, sanitizer, renderer and Lucide icon layer as the published web part.
- HTML values are escaped; scripts, unsafe URLs, event handlers, unsafe CSS, SVG and external styles are rejected.

## Hyperlink fields

SharePoint Hyperlink columns use a structured REST value. Inside a repeated block, use `.url` for the URL and `.desc` for the plain-text description:

```html
{{#each items}}
  <a href="{item.nav_link.url}">{item.nav_link.desc}</a>
{{/each}}
```

Use the column's internal name (`nav_link` in this example). The supported syntax is only `.url` and `.desc`; missing parts render empty. URLs still pass the existing safe-protocol sanitizer, and descriptions are HTML-escaped.

## Lucide icons

Lucide is the only supported icon system. The web part bundles the catalog from `lucide-react` 1.65.0 and does not load icons from the internet.

Static icon:

```html
<icon name="search" size="24" color="#2563eb"></icon>
```

Dynamic icon from a SharePoint Text or Choice column named `Icon`:

```html
{{#each items}}
  <article>
    <icon name="{item.Icon}" size="24"></icon>
    <h3>{item.Title}</h3>
  </article>
{{/each}}
```

Create the `Icon` column as Single line of text or Choice. Use the exact canonical names from the downloaded `lucide-icon-names.txt` file. The editor's Icon Picker and autocomplete use the same catalog.

Names are normalized for case, spaces, underscores and PascalCase where unambiguous. Unknown names show a warning and render no SVG. Icon attributes are allow-listed and validated before React renders the SVG.

Existing values from the previous icon setup remain readable through these safe aliases:

| Existing value | Lucide icon |
| --- | --- |
| `FaSearch` | `search` |
| `FaUserCheck` | `user-check` |
| `FaArrowRight` | `arrow-right` |
| `FaArrowLeft` | `arrow-left` |
| `FaArrowUp` | `arrow-up` |

The editor's **Export Icon Names** button downloads every canonical Lucide name directly from the generated catalog, one per line, ready to paste into SharePoint Choice column choices. No icon-name list is manually maintained.

## Compatibility

Saved templates are not rewritten or deleted. Templates using the old Flaticon `<i class="fi...">` syntax will no longer display those icons because Flaticon support has been removed. Replace them manually with Lucide `<icon name="..."></icon>` tags. Existing SharePoint values such as `FaSearch` continue to work through the aliases above; new Choice values should use canonical Lucide names.

## Development

```text
npm run build
```

The project uses SPFx 1.24.0, React 18, TypeScript and Fluent UI v8. The Lucide catalog files are generated assets and should not be manually edited.

See [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md) for Lucide and DOMPurify licenses.
