import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { GhostButton, PrimaryButton, Sheet } from "./ui";
import type { Group, SummaryMatrix } from "../types";

type OrderSection = { groupId: string; rowIds: string[] };

type DragItem =
  | { type: "row"; sectionId: string; rowId: string }
  | { type: "group"; sectionId: string };

function buildOrder(matrix: SummaryMatrix): OrderSection[] {
  return matrix.sections.map((section) => ({
    groupId: section.group.id,
    rowIds: section.rows.map((row) => row.ingredient.id),
  }));
}

function moveItem<T>(list: T[], from: number, to: number): T[] {
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(Math.max(0, Math.min(to, next.length)), 0, item);
  return next;
}

function buildOrderedMatrix(
  matrix: SummaryMatrix,
  order: OrderSection[],
): SummaryMatrix {
  const sections = order
    .map((entry) => {
      const source = matrix.sections.find((s) => s.group.id === entry.groupId);
      if (!source) return null;
      const byId = new Map(source.rows.map((row) => [row.ingredient.id, row]));
      const rows = entry.rowIds
        .map((id) => byId.get(id))
        .filter((row): row is NonNullable<typeof row> => Boolean(row));
      return { ...source, rows };
    })
    .filter(
      (section): section is NonNullable<typeof section> =>
        Boolean(section) && section!.rows.length > 0,
    );
  return { ...matrix, sections };
}

export function ExportPreviewSheet({
  matrix,
  title,
  confirmLabel,
  groupLabel,
  onExport,
  onClose,
}: {
  matrix: SummaryMatrix;
  title: string;
  confirmLabel: string;
  groupLabel: (group: Group) => string;
  onExport: (ordered: SummaryMatrix) => Promise<void>;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [order, setOrder] = useState<OrderSection[]>(() => buildOrder(matrix));
  const [busy, setBusy] = useState(false);
  const dragRef = useRef<DragItem | null>(null);

  useEffect(() => {
    setOrder(buildOrder(matrix));
  }, [matrix]);

  const sectionById = useMemo(
    () => new Map(matrix.sections.map((section) => [section.group.id, section])),
    [matrix],
  );

  function moveRow(sectionId: string, index: number, delta: number) {
    setOrder((prev) =>
      prev.map((section) => {
        if (section.groupId !== sectionId) return section;
        const target = index + delta;
        if (target < 0 || target >= section.rowIds.length) return section;
        const rowIds = [...section.rowIds];
        [rowIds[index], rowIds[target]] = [rowIds[target], rowIds[index]];
        return { ...section, rowIds };
      }),
    );
  }

  function moveGroup(index: number, delta: number) {
    setOrder((prev) => {
      const target = index + delta;
      if (target < 0 || target >= prev.length) return prev;
      return moveItem(prev, index, target);
    });
  }

  function dropRow(targetSectionId: string, targetIndex: number | null) {
    const drag = dragRef.current;
    if (!drag || drag.type !== "row") return;
    setOrder((prev) => {
      const next = prev.map((section) => ({
        ...section,
        rowIds: [...section.rowIds],
      }));
      const from = next.find((section) => section.groupId === drag.sectionId);
      const to = next.find((section) => section.groupId === targetSectionId);
      if (!from || !to) return prev;
      const fromIndex = from.rowIds.indexOf(drag.rowId);
      if (fromIndex === -1) return prev;
      from.rowIds.splice(fromIndex, 1);
      let insert: number;
      if (targetIndex === null) {
        insert = to.rowIds.length;
      } else {
        insert = targetIndex;
        if (from.groupId === targetSectionId && fromIndex < targetIndex) insert -= 1;
      }
      insert = Math.max(0, Math.min(insert, to.rowIds.length));
      to.rowIds.splice(insert, 0, drag.rowId);
      return next;
    });
    dragRef.current = null;
  }

  function dropGroup(targetSectionId: string) {
    const drag = dragRef.current;
    if (!drag || drag.type !== "group") return;
    setOrder((prev) => {
      const from = prev.findIndex((section) => section.groupId === drag.sectionId);
      const to = prev.findIndex((section) => section.groupId === targetSectionId);
      if (from === -1 || to === -1 || from === to) return prev;
      return moveItem(prev, from, to);
    });
    dragRef.current = null;
  }

  async function confirm() {
    if (busy) return;
    setBusy(true);
    try {
      await onExport(buildOrderedMatrix(matrix, order));
      onClose();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet title={title} onClose={onClose}>
      <p className="mb-3 text-xs leading-relaxed text-[var(--muted)]">
        {t("summary.previewHint")}
      </p>

      <div className="space-y-3">
        {order.map((section, groupIndex) => {
          const source = sectionById.get(section.groupId);
          if (!source) return null;
          const rowsById = new Map(
            source.rows.map((row) => [row.ingredient.id, row]),
          );
          return (
            <div
              key={section.groupId}
              onDragOver={(event) => {
                if (dragRef.current?.type === "row") event.preventDefault();
              }}
              onDrop={(event) => {
                if (dragRef.current?.type === "row") {
                  event.preventDefault();
                  event.stopPropagation();
                  dropRow(section.groupId, null);
                }
              }}
              className="rounded-2xl bg-[var(--bg)] p-2"
            >
              <div
                draggable
                onDragStart={() => {
                  dragRef.current = { type: "group", sectionId: section.groupId };
                }}
                onDragEnd={() => {
                  dragRef.current = null;
                }}
                onDragOver={(event) => {
                  if (dragRef.current?.type === "group") event.preventDefault();
                }}
                onDrop={(event) => {
                  if (dragRef.current?.type === "group") {
                    event.preventDefault();
                    event.stopPropagation();
                    dropGroup(section.groupId);
                  }
                }}
                className="mb-2 flex cursor-grab items-center gap-2 rounded-xl bg-white px-3 py-2 ring-1 ring-[var(--line)]"
              >
                <DragHandle />
                <span className="min-w-0 flex-1 truncate text-sm font-semibold text-[var(--brand)]">
                  {groupLabel(source.group)}
                </span>
                <MoveButtons
                  upLabel={t("summary.moveUp")}
                  downLabel={t("summary.moveDown")}
                  onUp={() => moveGroup(groupIndex, -1)}
                  onDown={() => moveGroup(groupIndex, 1)}
                />
              </div>

              <ul className="space-y-1">
                {section.rowIds.map((rowId, rowIndex) => {
                  const row = rowsById.get(rowId);
                  if (!row) return null;
                  return (
                    <li
                      key={rowId}
                      draggable
                      onDragStart={() => {
                        dragRef.current = {
                          type: "row",
                          sectionId: section.groupId,
                          rowId,
                        };
                      }}
                      onDragEnd={() => {
                        dragRef.current = null;
                      }}
                      onDragOver={(event) => {
                        if (dragRef.current?.type === "row") event.preventDefault();
                      }}
                      onDrop={(event) => {
                        if (dragRef.current?.type === "row") {
                          event.preventDefault();
                          event.stopPropagation();
                          dropRow(section.groupId, rowIndex);
                        }
                      }}
                      className="flex cursor-grab items-center gap-2 rounded-xl bg-white px-3 py-1.5 ring-1 ring-[var(--line)]"
                    >
                      <DragHandle />
                      <span className="min-w-0 flex-1 truncate text-sm">
                        {row.ingredient.nameEn ||
                          row.ingredient.name ||
                          t("common.deletedItem")}
                      </span>
                      <span className="shrink-0 text-xs text-[var(--muted)]">
                        {row.ingredient.code}
                      </span>
                      <MoveButtons
                        upLabel={t("summary.moveUp")}
                        downLabel={t("summary.moveDown")}
                        onUp={() => moveRow(section.groupId, rowIndex, -1)}
                        onDown={() => moveRow(section.groupId, rowIndex, 1)}
                      />
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </div>

      <div className="mt-4 flex justify-end gap-2">
        <GhostButton onClick={onClose}>{t("common.cancel")}</GhostButton>
        <PrimaryButton disabled={busy} onClick={() => void confirm()}>
          {busy ? t("summary.exporting") : confirmLabel}
        </PrimaryButton>
      </div>
    </Sheet>
  );
}

function MoveButtons({
  upLabel,
  downLabel,
  onUp,
  onDown,
}: {
  upLabel: string;
  downLabel: string;
  onUp: () => void;
  onDown: () => void;
}) {
  return (
    <span className="flex shrink-0 gap-1">
      <button
        type="button"
        aria-label={upLabel}
        onClick={onUp}
        className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--bg)] text-[var(--muted)] ring-1 ring-[var(--line)]"
      >
        ↑
      </button>
      <button
        type="button"
        aria-label={downLabel}
        onClick={onDown}
        className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--bg)] text-[var(--muted)] ring-1 ring-[var(--line)]"
      >
        ↓
      </button>
    </span>
  );
}

function DragHandle() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      className="shrink-0 text-[var(--muted)]"
    >
      <path
        d="M8 7h.01M8 12h.01M8 17h.01M16 7h.01M16 12h.01M16 17h.01"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
    </svg>
  );
}
