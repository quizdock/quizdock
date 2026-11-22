import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * Sortable row of a dnd-kit list (an `<li>`, or a `<div>`): hands its drag handle to the
 * row, which keeps its arrows for the keyboard and assistive technologies.
 */
export function SortableRow({
  id,
  handleLabel,
  as: Tag = 'li',
  className,
  handleClassName = '-ml-1',
  children,
}: {
  id: string;
  /** What the handle is for, read by screen readers. */
  handleLabel: string;
  as?: 'li' | 'div';
  className?: string;
  /** Where the handle sits in the row. */
  handleClassName?: string;
  children: (handle: ReactNode) => ReactNode;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });
  const handle = (
    <button
      type="button"
      ref={setActivatorNodeRef}
      aria-label={handleLabel}
      className={cn(
        'text-muted-foreground hover:text-foreground cursor-grab touch-none rounded p-1 active:cursor-grabbing',
        handleClassName,
      )}
      {...attributes}
      {...listeners}
    >
      <GripVertical className="size-4" />
    </button>
  );
  return (
    <Tag
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(className, isDragging && 'bg-background relative z-10 shadow-md')}
    >
      {children(handle)}
    </Tag>
  );
}
