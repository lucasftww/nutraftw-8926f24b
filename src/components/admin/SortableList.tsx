import { ReactNode } from "react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";

/**
 * Lista ordenável reusável. O caller controla rendering — passamos
 * apenas o id e a função de mover. Funciona com tabela, ul, ou grid.
 */
export function SortableList<T extends { id: string }>({
  items,
  onReorder,
  children,
}: {
  items: T[];
  onReorder: (newOrder: T[]) => void;
  children: ReactNode;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIdx = items.findIndex((i) => i.id === active.id);
    const newIdx = items.findIndex((i) => i.id === over.id);
    if (oldIdx < 0 || newIdx < 0) return;
    onReorder(arrayMove(items, oldIdx, newIdx));
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
        {children}
      </SortableContext>
    </DndContext>
  );
}

/** Hook helper: aplica refs/listeners a uma row e devolve o handle visual. */
export function useSortableRow(id: string) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.55 : 1,
    zIndex: isDragging ? 30 : undefined,
    position: "relative" as const,
  };
  const handleProps = { ...attributes, ...listeners };
  return { setNodeRef, style, handleProps, isDragging };
}

/** Botão visual de "arraste" — passe handleProps do useSortableRow. */
export function DragHandle({ handleProps, label = "Arrastar para reordenar" }: { handleProps: any; label?: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      {...handleProps}
      className="cursor-grab active:cursor-grabbing inline-flex items-center justify-center h-8 w-8 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted touch-none"
    >
      <GripVertical className="h-4 w-4" />
    </button>
  );
}