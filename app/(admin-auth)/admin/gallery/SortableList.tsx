"use client";

import { useState, useTransition } from "react";
import {
  DndContext,
  PointerSensor,
  KeyboardSensor,
  closestCenter,
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
import { reorderGalleryAction } from "@/app/actions/gallery";
import { formatCategory } from "@/lib/content/categories";
import DeleteButton from "./DeleteButton";

type Item = {
  id: number;
  title: string;
  slug: string;
  tag: string;
  image_url: string;
};

export default function SortableList({ initialItems }: { initialItems: Item[] }) {
  const [items, setItems] = useState(initialItems);
  const [pending, start] = useTransition();
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function persist(orderedIds: number[]) {
    setError(null);
    start(async () => {
      const res = await reorderGalleryAction(orderedIds);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setSavedAt(new Date().toLocaleTimeString());
    });
  }

  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    setItems((curr) => {
      const oldIndex = curr.findIndex((i) => i.id === Number(active.id));
      const newIndex = curr.findIndex((i) => i.id === Number(over.id));
      if (oldIndex < 0 || newIndex < 0) return curr;
      const next = arrayMove(curr, oldIndex, newIndex);
      persist(next.map((i) => i.id));
      return next;
    });
  }

  return (
    <>
      {error ? <div className="form-error" role="alert">{error}</div> : null}
      {savedAt && !error ? (
        <div
          style={{
            background: "var(--cream-100)",
            padding: "var(--s-12)",
            borderRadius: "var(--radius-card)",
            color: "var(--ink-600)",
            fontSize: "var(--fs-14)",
            marginBottom: "var(--s-12)",
          }}
          role="status"
        >
          Order saved at {savedAt}.
        </div>
      ) : null}
      <p className="muted" style={{ fontSize: "var(--fs-14)", marginBottom: "var(--s-12)" }}>
        Drag the grab handle on the left to reorder. Changes save automatically.
        {pending ? " Saving..." : ""}
      </p>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={onDragEnd}
      >
        <SortableContext
          items={items.map((i) => i.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="admin-sortable-list">
            {items.map((g) => (
              <Row key={g.id} item={g} />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </>
  );
}

function Row({ item }: { item: Item }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="admin-sortable-row">
      <button
        type="button"
        className="drag-handle"
        aria-label={`Drag to reorder ${item.title}`}
        {...attributes}
        {...listeners}
      >
        ⋮⋮
      </button>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={item.image_url} alt="" />
      <div style={{ flex: 1 }}>
        <strong>{item.title}</strong>
        <div className="meta">{formatCategory(item.tag)} · {item.slug}</div>
        <div className="actions">
          <a href={`/admin/gallery/${item.id}`} className="btn">Edit</a>
          <DeleteButton id={item.id} title={item.title} />
        </div>
      </div>
    </div>
  );
}
