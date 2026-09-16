import { KeyboardCode, type KeyboardCoordinateGetter } from '@dnd-kit/core';

export const COLUMN_DROP_PREFIX = 'col:';

export const dropIdFor = (columnKey: string) => `${COLUMN_DROP_PREFIX}${columnKey}`;

export function columnKeyFromDropId(id: string | number | undefined | null): string | null {
  if (typeof id !== 'string' || !id.startsWith(COLUMN_DROP_PREFIX)) return null;
  return id.slice(COLUMN_DROP_PREFIX.length);
}

/**
 * Klaviatura bilan sudrash: ↑/↓ — bitta slot (px), ←/→ — qoʻshni ustun.
 * Ustunlar droppable toʻrtburchaklari boʻyicha chapdan oʻngga tartiblanadi.
 */
export function makeCalendarKeyboardCoordinates(slotPx: number): KeyboardCoordinateGetter {
  return (event, { currentCoordinates, context }) => {
    const { droppableRects, droppableContainers, collisionRect } = context;
    switch (event.code) {
      case KeyboardCode.Up:
        return { ...currentCoordinates, y: currentCoordinates.y - slotPx };
      case KeyboardCode.Down:
        return { ...currentCoordinates, y: currentCoordinates.y + slotPx };
      case KeyboardCode.Left:
      case KeyboardCode.Right: {
        if (!collisionRect) return undefined;
        const columns = droppableContainers
          .getEnabled()
          .filter((c) => columnKeyFromDropId(c.id) !== null)
          .map((c) => ({ id: c.id, rect: droppableRects.get(c.id) }))
          .filter((c): c is { id: typeof c.id; rect: NonNullable<typeof c.rect> } => !!c.rect)
          .sort((a, b) => a.rect.left - b.rect.left);
        if (columns.length === 0) return undefined;
        const centerX = collisionRect.left + collisionRect.width / 2;
        const idx = columns.findIndex(({ rect }) => centerX >= rect.left && centerX < rect.right);
        const dir = event.code === KeyboardCode.Right ? 1 : -1;
        const targetIdx = idx === -1 ? (dir > 0 ? 0 : columns.length - 1) : idx + dir;
        const target = columns[targetIdx];
        if (!target) return undefined;
        const current = idx === -1 ? undefined : columns[idx];
        const dx = target.rect.left - (current ? current.rect.left : collisionRect.left);
        return { ...currentCoordinates, x: currentCoordinates.x + dx };
      }
      default:
        return undefined;
    }
  };
}
