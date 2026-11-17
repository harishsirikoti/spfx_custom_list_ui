import type {
  IEachNode,
  IFieldNode,
  IParsedTemplate,
  ITemplateIssue,
  PlaceholderContext,
  TemplateNode
} from './TemplateTypes';

/** Maximum template size accepted by the web part (characters). */
export const MAX_TEMPLATE_LENGTH: number = 100000;

/** Attributes whose values are URLs. */
const URL_ATTRIBUTES: string[] = ['href', 'src', 'poster', 'cite', 'action', 'formaction', 'xlink:href'];

/** Elements whose content is not regular HTML text; placeholders there are rejected. */
const RAW_TEXT_ELEMENTS: string[] = ['script', 'style', 'textarea', 'title'];

const DIRECTIVE_PATTERN: RegExp = /^\{\{\s*([^{}]*?)\s*\}\}/;
const PLACEHOLDER_PATTERN: RegExp = /^\{\s*([^{}\s]*)\s*\}/;
const WP_PROPERTY_PATTERN: RegExp = /^(wp_title|wp_description)$/;
const ITEM_FIELD_PATTERN: RegExp = /^item\.([A-Za-z_][A-Za-z0-9_]*)$/;
/** Text that is clearly meant to be a placeholder (identifier-like), as opposed to stray braces. */
const PLACEHOLDER_LIKE_PATTERN: RegExp = /^[A-Za-z_][A-Za-z0-9_.]*$/;
const START_TAG_PATTERN: RegExp = /^<(\/?)([A-Za-z][A-Za-z0-9:-]*)/;

/** Sub-states while scanning the inside of an HTML tag. */
type TagState = 'beforeName' | 'name' | 'afterName' | 'beforeValue' | 'valueDq' | 'valueSq' | 'valueUnquoted';

/** Mutable scanner state, kept in one object so helper closures can share it. */
interface IScanState {
  i: number;
  line: number;
  column: number;
  buffer: string;
  each: IEachNode | undefined;
  eachOpenedAt: { line: number; column: number } | undefined;
  inTag: boolean;
  tagState: TagState;
  tagName: string;
  isClosingTag: boolean;
  attrName: string;
  attrValue: string;
  rawTextElement: string | undefined;
}

/**
 * Parses a template into text, field and each nodes while tracking the surrounding HTML context.
 * The parser never evaluates anything; it only recognizes the documented syntax and reports every
 * deviation (unknown placeholders, unbalanced blocks, placeholders in unsafe positions).
 */
export function parseTemplate(template: string): IParsedTemplate {
  const issues: ITemplateIssue[] = [];
  const itemFields: string[] = [];
  const legacyPlaceholders: Array<'wp_title' | 'wp_description'> = [];
  const root: TemplateNode[] = [];
  const s: IScanState = {
    i: 0,
    line: 1,
    column: 1,
    buffer: '',
    each: undefined,
    eachOpenedAt: undefined,
    inTag: false,
    tagState: 'beforeName',
    tagName: '',
    isClosingTag: false,
    attrName: '',
    attrValue: '',
    rawTextElement: undefined
  };

  const addIssue = (message: string, line: number, column: number): void => {
    issues.push({ message, line, column });
  };

  /** Appends a node to the open each block, or to the root. */
  const push = (node: TemplateNode): void => {
    if (s.each) {
      if (node.type !== 'each') {
        s.each.children.push(node);
      }
    } else {
      root.push(node);
    }
  };

  /** Emits buffered literal text as a text node. */
  const flushText = (): void => {
    if (s.buffer) {
      push({ type: 'text', value: s.buffer });
      s.buffer = '';
    }
  };

  /** Moves the scanner forward by `count` characters, keeping line/column up to date. */
  const advance = (count: number, emit: boolean): void => {
    for (let n: number = 0; n < count; n++) {
      const ch: string = template.charAt(s.i);
      if (emit) {
        s.buffer += ch;
      }
      if (ch === '\n') {
        s.line++;
        s.column = 1;
      } else {
        s.column++;
      }
      s.i++;
    }
  };

  /** Called when the end of a tag is reached. */
  const endTag = (): void => {
    s.inTag = false;
    const name: string = s.tagName.toLowerCase();
    if (s.isClosingTag) {
      if (s.rawTextElement === name) {
        s.rawTextElement = undefined;
      }
    } else if (RAW_TEXT_ELEMENTS.indexOf(name) !== -1) {
      s.rawTextElement = name;
    }
  };

  /** Feeds one emitted character of a tag into the attribute state machine. */
  const advanceTagState = (ch: string): void => {
    const isSpace: boolean = /\s/.test(ch);
    switch (s.tagState) {
      case 'beforeName':
        if (ch === '>') {
          endTag();
        } else if (ch !== '/' && !isSpace) {
          s.tagState = 'name';
          s.attrName = ch;
        }
        break;
      case 'name':
        if (ch === '=') {
          s.tagState = 'beforeValue';
        } else if (ch === '>') {
          endTag();
        } else if (ch === '/') {
          s.tagState = 'beforeName';
        } else if (isSpace) {
          s.tagState = 'afterName';
        } else {
          s.attrName += ch;
        }
        break;
      case 'afterName':
        if (ch === '=') {
          s.tagState = 'beforeValue';
        } else if (ch === '>') {
          endTag();
        } else if (!isSpace) {
          s.tagState = 'name';
          s.attrName = ch;
        }
        break;
      case 'beforeValue':
        if (ch === '"') {
          s.tagState = 'valueDq';
          s.attrValue = '';
        } else if (ch === "'") {
          s.tagState = 'valueSq';
          s.attrValue = '';
        } else if (ch === '>') {
          endTag();
        } else if (!isSpace) {
          s.tagState = 'valueUnquoted';
        }
        break;
      case 'valueDq':
        if (ch === '"') {
          s.tagState = 'beforeName';
        } else {
          s.attrValue += ch;
        }
        break;
      case 'valueSq':
        if (ch === "'") {
          s.tagState = 'beforeName';
        } else {
          s.attrValue += ch;
        }
        break;
      case 'valueUnquoted':
        if (ch === '>') {
          endTag();
        } else if (isSpace) {
          s.tagState = 'beforeName';
        }
        break;
    }
  };

  /**
   * Describes the placeholder context at the scanner position. Returns a PlaceholderContext, or a
   * human-readable phrase describing why a placeholder is not allowed here.
   */
  const currentContext = (): PlaceholderContext | { forbidden: string } => {
    if (!s.inTag) {
      return s.rawTextElement ? { forbidden: `inside a <${s.rawTextElement}> element` } : 'text';
    }
    if (s.tagState === 'valueDq' || s.tagState === 'valueSq') {
      const name: string = s.attrName.toLowerCase();
      if (name === 'style') {
        return { forbidden: 'inside a style attribute (use fixed CSS values)' };
      }
      if (name.indexOf('on') === 0) {
        return { forbidden: 'inside an event handler attribute' };
      }
      if (name === 'srcset') {
        return { forbidden: 'inside a srcset attribute' };
      }
      if (URL_ATTRIBUTES.indexOf(name) !== -1) {
        return s.attrValue.length === 0 ? 'urlStart' : 'urlPart';
      }
      return 'attr';
    }
    return { forbidden: 'in a tag name, an attribute name or an unquoted attribute value (wrap attribute values in quotes)' };
  };

  /** Handles a "{{…}}" directive at the scanner position. */
  const handleDirective = (rest: string): void => {
    const line: number = s.line;
    const column: number = s.column;
    const m: RegExpExecArray | null = DIRECTIVE_PATTERN.exec(rest);
    if (!m) {
      addIssue('Unclosed "{{" directive. Expected {{#each items}} or {{/each}}.', line, column);
      advance(2, false);
      return;
    }
    const directive: string = m[1];
    advance(m[0].length, false);

    if (s.inTag || s.rawTextElement) {
      addIssue(`Directive {{${directive}}} is only allowed in element text, not inside a tag.`, line, column);
    } else if (directive === '#each items') {
      if (s.each) {
        addIssue('Nested {{#each items}} blocks are not supported.', line, column);
      } else {
        flushText();
        s.each = { type: 'each', children: [] };
        s.eachOpenedAt = { line, column };
        root.push(s.each);
      }
    } else if (directive === '/each') {
      if (!s.each) {
        addIssue('{{/each}} has no matching {{#each items}}.', line, column);
      } else {
        flushText();
        s.each = undefined;
        s.eachOpenedAt = undefined;
      }
    } else {
      addIssue(`Unsupported directive {{${directive}}}. Only {{#each items}} and {{/each}} are supported.`, line, column);
    }
  };

  /** Handles a "{name}" placeholder. Returns false when the braces are just plain text. */
  const handlePlaceholder = (rest: string): boolean => {
    const m: RegExpExecArray | null = PLACEHOLDER_PATTERN.exec(rest);
    if (!m || !PLACEHOLDER_LIKE_PATTERN.test(m[1])) {
      return false; // Stray braces such as "{ }" or "{1, 2}" stay literal text.
    }
    const name: string = m[1];
    const line: number = s.line;
    const column: number = s.column;
    advance(m[0].length, false);

    const context: PlaceholderContext | { forbidden: string } = currentContext();
    if (typeof context !== 'string') {
      addIssue(`Placeholder {${name}} is not allowed ${context.forbidden}.`, line, column);
      return true;
    }

    const itemMatch: RegExpExecArray | null = ITEM_FIELD_PATTERN.exec(name);
    let node: IFieldNode;
    if (WP_PROPERTY_PATTERN.test(name)) {
      // Legacy placeholder: still rendered from the saved value so existing pages do not change.
      const legacy: 'wp_title' | 'wp_description' = name as 'wp_title' | 'wp_description';
      node = { type: 'field', source: legacy, context, line, column };
      if (legacyPlaceholders.indexOf(legacy) === -1) {
        legacyPlaceholders.push(legacy);
      }
    } else if (itemMatch) {
      if (!s.each) {
        addIssue(`{${name}} can only be used between {{#each items}} and {{/each}}.`, line, column);
        return true;
      }
      node = { type: 'field', source: 'item', fieldName: itemMatch[1], context, line, column };
      if (itemFields.indexOf(itemMatch[1]) === -1) {
        itemFields.push(itemMatch[1]);
      }
    } else {
      addIssue(
        `Unknown placeholder {${name}}. Supported placeholders: {item.InternalFieldName} (inside {{#each items}}).`,
        line,
        column
      );
      return true;
    }

    flushText();
    push(node);
    // Keep the attribute value length in sync so "first in a URL" detection stays accurate.
    if (s.inTag && (s.tagState === 'valueDq' || s.tagState === 'valueSq')) {
      s.attrValue += '\u0000';
    }
    return true;
  };

  while (s.i < template.length) {
    const ch: string = template.charAt(s.i);

    if (ch === '{') {
      const rest: string = template.substring(s.i);
      if (rest.indexOf('{{') === 0) {
        handleDirective(rest);
        continue;
      }
      if (handlePlaceholder(rest)) {
        continue;
      }
    }

    if (s.inTag) {
      advance(1, true);
      advanceTagState(ch);
      continue;
    }

    if (ch === '<') {
      if (template.indexOf('<!--', s.i) === s.i) {
        // Comments are copied verbatim (the sanitizer strips them) and never contain placeholders.
        const end: number = template.indexOf('-->', s.i + 4);
        advance(end === -1 ? template.length - s.i : end + 3 - s.i, true);
        continue;
      }
      const tag: RegExpExecArray | null = START_TAG_PATTERN.exec(template.substring(s.i, s.i + 64));
      if (tag) {
        s.inTag = true;
        s.isClosingTag = tag[1] === '/';
        s.tagName = tag[2];
        s.tagState = 'beforeName';
        s.attrName = '';
        s.attrValue = '';
        advance(tag[0].length, true);
        continue;
      }
    }
    advance(1, true);
  }

  flushText();

  if (s.each && s.eachOpenedAt) {
    addIssue('{{#each items}} is never closed. Add {{/each}}.', s.eachOpenedAt.line, s.eachOpenedAt.column);
  }
  if (s.inTag) {
    addIssue('The template ends inside an HTML tag. Check for a missing ">" or closing quote.', s.line, s.column);
  }

  return { nodes: root, issues, itemFields, legacyPlaceholders };
}
