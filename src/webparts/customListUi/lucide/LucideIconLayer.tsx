import * as React from 'react';
import { createPortal } from 'react-dom';

import { isSafeIconColor, normalizeIconName, parseIconSize, parseStrokeWidth, DEFAULT_ICON_SIZE } from './iconAttributes';
import { getLoadedIconData, loadIconData, type IconDataMap } from './iconRegistry';
import { LucideIcon } from './LucideIcon';

interface IIconTarget {
  element: HTMLElement;
  name: string;
  size: number;
  color: string | undefined;
  strokeWidth: number | undefined;
}

export interface ILucideIconLayerProps {
  /** The element whose sanitized HTML contains <icon> markers. */
  host: React.RefObject<HTMLElement>;
  /** The sanitized HTML currently shown in the host. The layer rescans the host whenever it changes. */
  html: string;
}

/**
 * Turns the sanitized <icon name="..." size="..." color="..."></icon> markers inside `host` into real React
 * SVG icons using portals.
 *
 * The markers are inert: the sanitizer has already validated every attribute, and the browser does not
 * need to know the element. Their attributes are validated again here, and nothing from the template is
 * used to build the SVG - only the name is used as a key into the generated Lucide catalog.
 * This one component is used by the published web part and by the editor preview.
 */
export const LucideIconLayer: React.FC<ILucideIconLayerProps> = ({ host, html }) => {
  const [targets, setTargets] = React.useState<IIconTarget[]>([]);
  const [data, setData] = React.useState<IconDataMap | undefined>(getLoadedIconData());

  // Runs after the host's HTML has been updated and before the browser paints.
  React.useLayoutEffect(() => {
    const element: HTMLElement | null = host.current;
    if (!element) {
      return undefined;
    }

    const found: HTMLElement[] = Array.prototype.slice.call(element.querySelectorAll('icon')) as HTMLElement[];
    const list: IIconTarget[] = found.map((el) => {
      const size: number | undefined = parseIconSize(el.getAttribute('size') ?? '');
      const color: string = el.getAttribute('color') ?? '';
      const strokeWidth: number | undefined = parseStrokeWidth(el.getAttribute('stroke-width') ?? '');
      // The marker must be empty: the SVG is rendered into it.
      el.textContent = '';
      return {
        element: el,
        name: normalizeIconName(el.getAttribute('name') ?? ''),
        size: size ?? DEFAULT_ICON_SIZE,
        color: color && isSafeIconColor(color) ? color : undefined,
        strokeWidth
      };
    });
    setTargets(list);

    // Download the SVG data only when a page really shows icons.
    let cancelled: boolean = false;
    if (list.length > 0 && !getLoadedIconData()) {
      loadIconData()
        .then((loaded) => {
          if (!cancelled) {
            setData(loaded);
          }
        })
        .catch(() => {
          if (!cancelled) {
            // Show nothing instead of empty boxes when the data cannot be loaded.
            setData({});
          }
        });
    } else if (list.length > 0 && !data) {
      setData(getLoadedIconData());
    }
    return () => {
      cancelled = true;
    };
    // `data` is intentionally not a dependency: the effect only needs to rescan when the HTML changes.
  }, [html, host]);

  return (
    <>
      {targets.map((t, index) =>
        createPortal(
          <LucideIcon name={t.name} size={t.size} color={t.color} strokeWidth={t.strokeWidth} data={data} />,
          t.element,
          String(index)
        )
      )}
    </>
  );
};
