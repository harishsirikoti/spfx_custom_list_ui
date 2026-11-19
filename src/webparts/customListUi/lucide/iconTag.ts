import { DEFAULT_ICON_SIZE } from './iconAttributes';

/** Options for building an <icon> tag. */
export interface IIconTagOptions {
  /** Icon name, or a placeholder such as "{item.Icon}". */
  name: string;
  size?: number;
  /** Optional color; leave empty to inherit the text color. */
  color?: string;
}

/** The tag that takes the icon name from a list column named Icon. */
export const DYNAMIC_ICON_NAME: string = '{item.Icon}';

/** Builds the template text inserted by the icon picker. */
export function buildIconTag(options: IIconTagOptions): string {
  const color: string = options.color && options.color.trim().length > 0 ? ` color="${options.color.trim()}"` : '';
  return `<icon name="${options.name}" size="${options.size ?? DEFAULT_ICON_SIZE}"${color}></icon>`;
}
