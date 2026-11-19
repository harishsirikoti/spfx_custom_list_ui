import * as React from 'react';
import { Icon } from 'lucide-react';

import { DEFAULT_ICON_SIZE } from './iconAttributes';
import { resolveIconName, type IconDataMap, type IconNodeData } from './iconRegistry';

type LucideNode = React.ComponentProps<typeof Icon>['iconNode'];

export interface ILucideIconProps {
  /** Icon name (canonical or alias, already normalized). */
  name: string;
  size?: number;
  color?: string;
  strokeWidth?: number;
  /** Loaded icon data. While undefined, an empty box of the right size keeps the layout stable. */
  data: IconDataMap | undefined;
}

/** Adds the React keys that Lucide's Icon expects (they are not stored in the generated data). */
function toLucideNode(node: IconNodeData): LucideNode {
  return node.map(([tag, attributes], index) => [tag, { ...attributes, key: String(index) }]) as unknown as LucideNode;
}

/**
 * Draws one Lucide icon as a real React SVG element using lucide-react's own Icon component.
 * Unknown names render nothing. Only data from the generated catalog is ever drawn.
 */
export const LucideIcon: React.FC<ILucideIconProps> = ({ name, size = DEFAULT_ICON_SIZE, color, strokeWidth, data }) => {
  const canonical: string | undefined = resolveIconName(name);
  const node: IconNodeData | undefined = canonical && data ? data[canonical] : undefined;
  const iconNode: LucideNode | undefined = React.useMemo(() => (node ? toLucideNode(node) : undefined), [node]);

  if (!canonical) {
    return null;
  }
  if (!iconNode) {
    // Data not loaded yet (or failed to load): reserve the space so the page does not jump.
    return data ? null : <span aria-hidden="true" style={{ display: 'inline-block', width: size, height: size }} />;
  }
  return <Icon iconNode={iconNode} size={size} color={color} strokeWidth={strokeWidth} />;
};
