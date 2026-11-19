/* eslint-disable no-script-url */
import * as React from 'react';
import { createRoot } from 'react-dom/client';

import { sanitizeHtml } from '../../templating/HtmlSanitizer';
import { DEFAULT_TEMPLATE } from '../../templating/DefaultTemplate';
import { compileTemplate, renderTemplate } from '../../templating/TemplateRenderer';
import { isSafeIconColor, normalizeIconName, parseIconSize, parseStrokeWidth } from '../iconAttributes';
import { getAllIconNames, loadIconData, resolveIconName } from '../iconRegistry';
import { searchIcons } from '../iconSearch';
import { buildIconTag } from '../iconTag';
import { LucideIconLayer } from '../LucideIconLayer';

// React 18.3 exposes act on React itself (react-dom/test-utils.act is deprecated); @types/react 18.2 does not know it yet.
const act = (React as unknown as { act: (callback: () => Promise<void> | void) => Promise<void> }).act;

const EMPTY = { legacyTitle: '', legacyDescription: '', items: [] };
const TEMPLATE = '{{#each items}}<icon name="{item.Icon}" size="20" color="#2563eb"></icon>{{/each}}';

describe('icon catalog', () => {
  it('contains the installed Lucide icons and resolves names and aliases', () => {
    expect(getAllIconNames().length).toBeGreaterThan(1500);
    expect(resolveIconName('calendar-days')).toBe('calendar-days');
    expect(resolveIconName('check-circle')).toBe('circle-check-big'); // older alias of a renamed icon
    expect(resolveIconName('not-a-real-icon')).toBeUndefined();
    expect(resolveIconName('')).toBeUndefined();
  });

  it('normalizes friendly spellings', () => {
    expect(normalizeIconName(' Calendar-Days ')).toBe('calendar-days');
    expect(normalizeIconName('CalendarDays')).toBe('calendar-days');
    expect(normalizeIconName('calendar days')).toBe('calendar-days');
    expect(normalizeIconName('calendar_days')).toBe('calendar-days');
  });

  it('searches by every word, including old alias names', () => {
    const arrows = searchIcons('arrow up');
    expect(arrows.length).toBeGreaterThan(5);
    expect(arrows.every((n) => n.indexOf('arrow') !== -1 && n.indexOf('up') !== -1)).toBe(true);
    expect(searchIcons('check-circle')).toContain('circle-check-big');
    expect(searchIcons('zzzzzz')).toEqual([]);
    expect(searchIcons('')).toEqual(getAllIconNames());
  });

  it('validates attributes strictly', () => {
    expect(parseIconSize('24')).toBe(24);
    ['7', '257', '1.5', '24px', '', '-1', 'abc'].forEach((v) => expect(parseIconSize(v)).toBeUndefined());
    ['#2563eb', '#fff', 'red', 'currentColor', 'rgb(1, 2, 3)', 'hsl(10 20% 30%)', 'rgba(0,0,0,0.5)'].forEach((v) => expect(isSafeIconColor(v)).toBe(true));
    ['url(http://x)', 'var(--x)', 'red;background:blue', 'expression(1)', '#12', 'javascript:alert(1)', 'a"b'].forEach((v) => expect(isSafeIconColor(v)).toBe(false));
    expect(parseStrokeWidth('1.5')).toBe(1.5);
    expect(parseStrokeWidth('9')).toBeUndefined();
  });

  it('builds the tag the picker inserts', () => {
    expect(buildIconTag({ name: 'user', size: 24, color: '#2563eb' })).toBe('<icon name="user" size="24" color="#2563eb"></icon>');
    expect(buildIconTag({ name: '{item.Icon}', size: 16, color: '' })).toBe('<icon name="{item.Icon}" size="16"></icon>');
  });
});

describe('<icon> tag sanitizing', () => {
  it('keeps a valid static icon in canonical form', () => {
    const r = sanitizeHtml('<icon name="Calendar-Days" size="24" color="#2563eb" stroke-width="1.5"></icon>');
    expect(r.html).toBe('<icon name="calendar-days" size="24" color="#2563eb" stroke-width="1.5"></icon>');
    expect(r.violations).toEqual([]);
    expect(r.warnings).toEqual([]);
  });

  it('accepts the alias name and writes the canonical one', () => {
    expect(sanitizeHtml('<icon name="check-circle"></icon>').html).toBe('<icon name="circle-check-big"></icon>');
  });

  it('drops unknown or malformed names with a note, without breaking the page', () => {
    const r = sanitizeHtml('<icon name="not-a-real-icon"></icon><icon name="a b!"></icon><icon name=""></icon>');
    expect(r.html).toBe('<icon></icon><icon></icon><icon></icon>');
    expect(r.violations).toEqual([]);
    expect(r.warnings.length).toBe(2);
    expect(r.warnings[0]).toContain('not in the installed Lucide catalog');
  });

  it('drops invalid size, color and stroke width with notes', () => {
    const r = sanitizeHtml('<icon name="user" size="9999" color="url(//evil/x)" stroke-width="50"></icon>');
    expect(r.html).toBe('<icon name="user"></icon>');
    expect(r.warnings.length).toBe(3);
  });

  it('does not allow anything else on the icon, or SVG markup inside it', () => {
    const r = sanitizeHtml(
      '<icon name="user" onclick="alert(1)" src="x" href="javascript:alert(1)" id="a" class="evil" data-x="1">' +
        '<svg><script>alert(1)</script><path d="M0 0"></path></svg><img src=x onerror=alert(1)></icon>'
    );
    // The icon itself carries only its name.
    expect(/<icon[^>]*>/.exec(r.html)![0]).toBe('<icon name="user">');
    expect(r.html).not.toMatch(/onclick|onerror|<script|<svg|<path|javascript|id=|evil|data-x/i);
    expect(r.violations.length).toBeGreaterThan(0);
  });

  it('keeps "name" and "size" forbidden on every other element', () => {
    const r = sanitizeHtml('<div name="x" size="24" color="red">a</div><img name="y" src="a.png" alt="">');
    expect(r.html).not.toMatch(/name=|size=|color=/);
    expect(r.violations.length).toBeGreaterThan(0);
  });
});

describe('<icon> in templates', () => {
  const run = (items: Array<Record<string, unknown>>): ReturnType<typeof renderTemplate> => {
    const compiled = compileTemplate(TEMPLATE);
    expect(compiled.errors).toEqual([]);
    expect(compiled.warnings).toEqual([]);
    return renderTemplate(compiled.template!, { ...EMPTY, items });
  };

  it('gives each item its own icon from a list column', () => {
    const { html, errors } = run([{ Icon: 'calendar-days' }, { Icon: 'user' }, { Icon: 'Folder' }]);
    expect(errors).toEqual([]);
    expect(html).toBe(
      '<icon name="calendar-days" size="20" color="#2563eb"></icon>' +
        '<icon name="user" size="20" color="#2563eb"></icon>' +
        '<icon name="folder" size="20" color="#2563eb"></icon>'
    );
  });

  it('handles missing, empty, unknown and malicious values per item', () => {
    const result = run([
      { Icon: '' },
      { Icon: null },
      { Icon: 'nope-nope' },
      { Icon: 'user" onclick="alert(1)' },
      { Icon: '"><script>alert(1)</script>' },
      { Icon: '<img src=x onerror=alert(1)>' },
      { Icon: 'user' }
    ]);
    expect(result.errors).toEqual([]);
    expect(result.html).not.toMatch(/onclick|onerror|<script|<img/i);
    expect(result.html.match(/name="user"/g)?.length).toBe(1);
    expect(result.html.match(/<icon/g)?.length).toBe(7);
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it('reports a missing Icon column', () => {
    expect(run([{ Title: 'a' }]).errors[0]).toContain('Unknown list field {item.Icon}');
  });

  it('closes self-closing <icon ... /> so following content is not swallowed', () => {
    const compiled = compileTemplate('<p><icon name="user" /><b>after</b></p>');
    expect(compiled.errors).toEqual([]);
    expect(renderTemplate(compiled.template!, EMPTY).html).toBe('<p><icon name="user"></icon><b>after</b></p>');
  });

  it('rejects icon placeholders in unsafe positions', () => {
    expect(compileTemplate('{{#each items}}<icon style="{item.Icon}"></icon>{{/each}}').errors.length).toBe(1);
    expect(compileTemplate('{{#each items}}<icon onclick="{item.Icon}"></icon>{{/each}}').errors.length).toBe(1);
  });

  it('keeps static Lucide icons working', () => {
    const compiled = compileTemplate('<icon name="search"></icon><icon name="user"></icon>');
    expect(compiled.errors).toEqual([]);
    expect(renderTemplate(compiled.template!, EMPTY).html).toBe(
      '<icon name="search"></icon><icon name="user"></icon>'
    );
  });

  it('is used by the default sample', () => {
    const compiled = compileTemplate(DEFAULT_TEMPLATE);
    expect(compiled.errors).toEqual([]);
    expect(compiled.warnings).toEqual([]);
    expect(DEFAULT_TEMPLATE).toContain('https://lucide.dev/icons/');
    const html = renderTemplate(compiled.template!, { ...EMPTY, items: [{ Title: 'One' }] }).html;
    expect(html).toContain('<icon name="calendar-days" size="16" color="#ffffff"');
  });
});

describe('LucideIconLayer (real React SVG)', () => {
  it('draws a real SVG icon for every valid marker and nothing for unknown ones', async () => {
    (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

    const compiled = compileTemplate(TEMPLATE);
    const { html } = renderTemplate(compiled.template!, {
      ...EMPTY,
      items: [{ Icon: 'calendar-days' }, { Icon: 'nope-nope' }, { Icon: 'User' }]
    });

    const host: HTMLDivElement = document.createElement('div');
    host.innerHTML = html;
    document.body.appendChild(host);
    const container: HTMLDivElement = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(<LucideIconLayer host={{ current: host }} html={html} />);
    });
    await act(async () => {
      await loadIconData();
    });

    const svgs = host.querySelectorAll('icon svg');
    expect(svgs.length).toBe(2);
    expect(svgs[0].getAttribute('width')).toBe('20');
    expect(svgs[0].getAttribute('stroke')).toBe('#2563eb');
    expect(svgs[0].getAttribute('aria-hidden')).toBe('true');
    expect(svgs[0].querySelectorAll('path, rect, line, circle').length).toBeGreaterThan(0);
    // The marker holds nothing except the drawn SVG.
    expect(host.querySelectorAll('script, img, foreignObject').length).toBe(0);

    await act(async () => {
      root.unmount();
    });
    host.remove();
    container.remove();
  });
});
