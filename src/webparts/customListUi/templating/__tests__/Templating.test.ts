/* eslint-disable no-script-url */
import { sanitizeInlineCss } from '../CssSanitizer';
import { sanitizeHtml } from '../HtmlSanitizer';
import { parseTemplate } from '../TemplateParser';
import { DEFAULT_TEMPLATE } from '../DefaultTemplate';
import { compileTemplate, renderTemplate } from '../TemplateRenderer';

const EXAMPLE: string = `<div style="padding:20px; border:1px solid #ddd;">
  <h2>{wp_title}</h2>
  <p>{wp_description}</p>
  {{#each items}}
  <div style="padding:12px; margin-bottom:10px; border:1px solid #eee;">
    <h3>{item.Title}</h3>
  </div>
  {{/each}}
</div>`;

describe('parseTemplate', () => {
  it('accepts the documented example', () => {
    const result = parseTemplate(EXAMPLE);
    expect(result.issues).toEqual([]);
    expect(result.itemFields).toEqual(['Title']);
  });

  it('reports unknown placeholders, directives and unbalanced blocks', () => {
    expect(parseTemplate('<p>{nope}</p>').issues[0].message).toContain('Unknown placeholder {nope}');
    expect(parseTemplate('{{#each other}}{{/each}}').issues[0].message).toContain('Unsupported directive');
    expect(parseTemplate('{{#each items}}x').issues[0].message).toContain('never closed');
    expect(parseTemplate('{{/each}}').issues[0].message).toContain('no matching');
    expect(parseTemplate('<p>{item.Title}</p>').issues[0].message).toContain('between {{#each items}}');
  });

  it('rejects placeholders in style, event and unquoted attribute positions', () => {
    expect(parseTemplate('<p style="color:{wp_title}">x</p>').issues.length).toBe(1);
    expect(parseTemplate('<p onclick="{wp_title}">x</p>').issues.length).toBe(1);
    expect(parseTemplate('<p class={wp_title}>x</p>').issues.length).toBe(1);
  });

  it('leaves stray braces alone', () => {
    expect(parseTemplate('<p>{ } and {1, 2}</p>').issues).toEqual([]);
  });
});

describe('sanitizeHtml / sanitizeInlineCss', () => {
  it('removes scripts, handlers and javascript: URLs', () => {
    const result = sanitizeHtml('<script>alert(1)</script><a href="javascript:alert(1)" onclick="x()">a</a>');
    expect(result.html).not.toContain('script');
    expect(result.html).not.toContain('javascript');
    expect(result.html).not.toContain('onclick');
    expect(result.violations.length).toBeGreaterThan(0);
  });

  it('drops dangerous CSS but keeps safe declarations', () => {
    const css = sanitizeInlineCss('padding: 8px; background: url(http://x/y); position: fixed; color: red');
    expect(css.css).toBe('padding: 8px; color: red');
    expect(css.violations.length).toBe(2);
    expect(sanitizeInlineCss('width: expression(alert(1))').css).toBe('');
    expect(sanitizeInlineCss('color: \\72 ed').css).toBe('');
  });
});

describe('compileTemplate / renderTemplate', () => {
  it('flags unsafe templates', () => {
    expect(compileTemplate('<script>1</script>').errors.length).toBeGreaterThan(0);
    expect(compileTemplate('<img src="x" onerror="alert(1)">').errors.length).toBeGreaterThan(0);
    expect(compileTemplate('<a href="javascript:alert(1)">x</a>').errors.length).toBeGreaterThan(0);
    expect(compileTemplate('<p style="background:url(x)">x</p>').errors.length).toBeGreaterThan(0);
  });

  it('renders the example and escapes list values', () => {
    const compiled = compileTemplate(EXAMPLE);
    expect(compiled.errors).toEqual([]);
    const result = renderTemplate(compiled.template!, {
      legacyTitle: 'My <b>list</b>',
      legacyDescription: 'line1\nline2',
      items: [{ Title: '<img src=x onerror=alert(1)>' }, { Title: 'Second' }]
    });
    expect(result.errors).toEqual([]);
    expect(result.html).toContain('My &lt;b&gt;list&lt;/b&gt;');
    expect(result.html).toContain('line1<br>line2');
    expect(result.html).toContain('&lt;img src=x onerror=alert(1)&gt;');
    expect(result.html).not.toContain('<img');
    expect(result.html.match(/<h3>/g)?.length).toBe(2);
  });

  it('neutralizes unsafe URLs that come from list data', () => {
    const compiled = compileTemplate('{{#each items}}<a href="{item.Link}">go</a>{{/each}}');
    expect(compiled.errors).toEqual([]);
    const result = renderTemplate(compiled.template!, {
      legacyTitle: '',
      legacyDescription: '',
      items: [{ Link: 'javascript:alert(1)' }, { Link: { Url: 'https://contoso.com/a' } }]
    });
    expect(result.html).not.toContain('javascript');
    expect(result.html).toContain('href="https://contoso.com/a"');
  });

  it('reports unknown list fields', () => {
    const compiled = compileTemplate('{{#each items}}{item.Missing}{{/each}}');
    const result = renderTemplate(compiled.template!, { legacyTitle: '', legacyDescription: '', items: [{ Title: 'a' }] });
    expect(result.errors[0]).toContain('Unknown list field {item.Missing}');
  });

  it('enforces the size limit', () => {
    expect(compileTemplate('a'.repeat(100001)).errors[0]).toContain('maximum');
  });
});

const EMPTY = { legacyTitle: '', legacyDescription: '', items: [] };

describe('default / sample template', () => {
  it('compiles without errors or warnings and uses icons', () => {
    const result = compileTemplate(DEFAULT_TEMPLATE);
    expect(result.errors).toEqual([]);
    expect(result.warnings).toEqual([]);
    expect(result.template!.usesIcons).toBe(true);
    expect(result.template!.hasEachBlock).toBe(true);
    expect(result.template!.itemFields).toEqual(['Title']);
  });

  it('renders header, one card per item and footer for a list with only a Title column', () => {
    const compiled = compileTemplate(DEFAULT_TEMPLATE);
    const result = renderTemplate(compiled.template!, {
      ...EMPTY,
      items: [{ Title: 'One' }, { Title: 'Two' }, { Title: 'Three' }]
    });
    expect(result.errors).toEqual([]);
    expect(result.html).toContain('<header');
    expect(result.html).toContain('<footer');
    expect(result.html.match(/<article/g)?.length).toBe(3);
    expect(result.html).toContain('>Two</h3>');
    expect(result.html).toContain('fi-rr-document');
    expect(result.html).toContain('grid-template-columns: repeat(auto-fit, minmax(220px, 1fr))');
    expect(result.html).toContain('rel="noopener noreferrer"');
    expect(result.html).not.toContain('<!--');
  });

  it('renders with zero items (empty list) without errors', () => {
    const result = renderTemplate(compileTemplate(DEFAULT_TEMPLATE).template!, EMPTY);
    expect(result.errors).toEqual([]);
    expect(result.html).toContain('<header');
    expect(result.html).not.toContain('<article');
  });

  it('survives the download then upload round trip (the file content is the template text)', () => {
    // The download writes DEFAULT_TEMPLATE verbatim and the upload reads the text back unchanged.
    expect(compileTemplate(DEFAULT_TEMPLATE.replace(/\n/g, '\r\n')).errors).toEqual([]);
    // eslint-disable-next-line no-control-regex
    expect(/^[\x09\x0a\x0d\x20-\x7e]*$/.test(DEFAULT_TEMPLATE)).toBe(true);
    expect(DEFAULT_TEMPLATE).toContain('{{#each items}}');
  });
});

describe('icons and classes', () => {
  it('keeps Uicons classes on i and span, and drops other classes with a warning', () => {
    const r = sanitizeHtml('<i class="fi fi-rr-calendar" aria-hidden="true"></i><span class="fi-rr-home ms-Grid"></span><div class="fi-rr-home evil"></div>');
    expect(r.html).toContain('<i class="fi fi-rr-calendar" aria-hidden="true"></i>');
    expect(r.html).toContain('<span class="fi-rr-home"></span>');
    expect(r.html).not.toContain('evil');
    expect(r.html).not.toContain('ms-Grid');
    expect(r.violations).toEqual([]);
    expect(r.warnings.length).toBe(3);
  });

  it('warns (without failing) about icons that are not in the bundle', () => {
    const r = compileTemplate('<i class="fi fi-rr-does-not-exist-xyz"></i>');
    expect(r.errors).toEqual([]);
    expect(r.warnings[0]).toContain('fi-rr-does-not-exist-xyz');
  });

  it('rejects other icon families and malformed names', () => {
    const r = sanitizeHtml('<i class="fi-sr-calendar fi-rr-Bad_Name"></i>');
    expect(r.html).not.toContain('class');
    expect(r.warnings.length).toBe(2);
  });
});

describe('semantic elements and responsive CSS', () => {
  it('supports header, main, section, article and footer', () => {
    const r = compileTemplate('<header>h</header><main><section><article>a</article></section></main><footer>f</footer>');
    expect(r.errors).toEqual([]);
    const html = renderTemplate(r.template!, EMPTY).html;
    ['header', 'main', 'section', 'article', 'footer'].forEach((tag) => expect(html).toContain('<' + tag + '>'));
  });

  it('keeps safe grid and flex declarations', () => {
    const css = sanitizeInlineCss(
      'display:grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap:16px; flex-wrap:wrap; padding:8px; margin:0 auto; ' +
        'border:1px solid #ddd; border-radius:6px; background-color:#fff; color:#333; font-size:1.2rem; font-weight:600'
    );
    expect(css.violations).toEqual([]);
    expect(css.css.split('; ').length).toBe(12);
  });

  it('rejects unsafe CSS values', () => {
    ['background:url(//evil/x.png)', 'color:expression(alert(1))', 'width:100px !important', 'display:grid;position:absolute', 'font-family:a;b:c'].forEach(
      (style) => expect(sanitizeInlineCss(style).violations.length).toBeGreaterThan(0)
    );
  });

  it('rejects style elements, iframes, objects and external stylesheets', () => {
    ['<style>p{}</style>', '<iframe src="https://x"></iframe>', '<object data="x"></object>', '<embed src="x">', '<link rel="stylesheet" href="https://x/a.css">'].forEach(
      (html) => expect(compileTemplate(html).errors.length).toBeGreaterThan(0)
    );
  });
});

describe('legacy placeholders (migration)', () => {
  it('still compiles and renders saved values, with a clear warning', () => {
    const src = '<h1>{wp_title}</h1><p>{wp_description}</p>';
    const compiled = compileTemplate(src, { title: 'Old title', description: 'Old description' });
    expect(compiled.errors).toEqual([]);
    expect(compiled.warnings.length).toBe(2);
    expect(compiled.warnings[0]).toContain('legacy placeholder');
    expect(compiled.warnings[0]).toContain('Old title');
    const html = renderTemplate(compiled.template!, { ...EMPTY, legacyTitle: 'Old title', legacyDescription: 'Old description' }).html;
    expect(html).toBe('<h1>Old title</h1><p>Old description</p>');
  });

  it('gives no legacy warning for templates that do not use the placeholders', () => {
    expect(compileTemplate('<p>hi</p>').warnings).toEqual([]);
  });
});

describe('errors', () => {
  it('reports unknown placeholders and missing fields clearly', () => {
    expect(compileTemplate('{{#each items}}{item.Title}{nope}{{/each}}').errors[0]).toContain('Unknown placeholder {nope}');
    expect(compileTemplate('<p>{{#each items}}').errors[0]).toContain('never closed');
    const missing = renderTemplate(compileTemplate('{{#each items}}{item.Nope}{{/each}}').template!, { ...EMPTY, items: [{ Title: 'a' }] });
    expect(missing.errors[0]).toContain('Unknown list field {item.Nope}');
  });
});
