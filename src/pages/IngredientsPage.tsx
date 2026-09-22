import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { ingredientThumbUrl } from "../api/db";
import {
  Card,
  EmptyState,
  Field,
  GhostButton,
  PageTitle,
  PrimaryButton,
  Sheet,
  TextArea,
  TextInput,
  Thumb,
} from "../components/ui";
import { useAppStore } from "../store/useAppStore";
import { compressImage } from "../utils/compressImage";
import { groupLabel } from "../utils/format";
import type { Ingredient } from "../types";

export function IngredientsPage() {
  const { t } = useTranslation();
  const groups = useAppStore((s) => s.groups);
  const ingredients = useAppStore((s) => s.ingredients);
  const orders = useAppStore((s) => s.orders);
  const flash = useAppStore((s) => s.flash);
  const addGroup = useAppStore((s) => s.addGroup);
  const updateGroup = useAppStore((s) => s.updateGroup);
  const deleteGroup = useAppStore((s) => s.deleteGroup);
  const saveIngredient = useAppStore((s) => s.saveIngredient);
  const deleteIngredient = useAppStore((s) => s.deleteIngredient);

  const [groupOpen, setGroupOpen] = useState(false);
  const [editing, setEditing] = useState<Partial<Ingredient> | "new" | null>(null);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const grouped = useMemo(
    () =>
      [...groups]
        .sort((a, b) => a.sort - b.sort)
        .map((group) => ({
          group,
          items: ingredients
            .filter((item) => item.groupId === group.id)
            .sort(
              (a, b) =>
                a.code.localeCompare(b.code, "zh") ||
                a.nameEn.localeCompare(b.nameEn, "zh") ||
                a.name.localeCompare(b.name, "zh"),
            ),
        })),
    [groups, ingredients],
  );

  return (
    <div>
      <PageTitle
        title={t("ingredients.title")}
        action={
          <div className="flex flex-wrap justify-end gap-1">
            <GhostButton onClick={() => setGroupOpen(true)}>{t("groups.manage")}</GhostButton>
            <PrimaryButton onClick={() => setEditing("new")}>{t("ingredients.add")}</PrimaryButton>
          </div>
        }
      />

      {groups.length === 0 ? (
        <EmptyState text={t("groups.empty")} />
      ) : ingredients.length === 0 ? (
        <div className="space-y-3">
          <EmptyState text={t("ingredients.empty")} />
          {grouped.map(({ group }) => (
            <Card key={group.id}>
              <p className="font-semibold">{groupLabel(group, t)}</p>
              <p className="text-xs text-[var(--muted)]">0</p>
            </Card>
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {grouped.map(({ group, items }) => (
            <Card key={group.id}>
              <button
                type="button"
                className="flex w-full items-center justify-between"
                onClick={() =>
                  setCollapsed((prev) => ({ ...prev, [group.id]: !prev[group.id] }))
                }
              >
                <div>
                  <p className="font-semibold">{groupLabel(group, t)}</p>
                  <p className="text-xs text-[var(--muted)]">{items.length}</p>
                </div>
                <span className="text-[var(--muted)]">{collapsed[group.id] ? "+" : "–"}</span>
              </button>
              {!collapsed[group.id] && (
                <ul className="mt-3 space-y-2">
                  {items.map((item) => (
                    <li
                      key={item.id}
                      className="flex items-center justify-between gap-3 rounded-2xl bg-[var(--bg)] px-2 py-2"
                    >
                      <button
                        type="button"
                        className="flex min-w-0 flex-1 items-center gap-3 text-left"
                        onClick={() => setEditing(item)}
                      >
                        <Thumb
                          src={
                            item.hasImage
                              ? ingredientThumbUrl(item.id, item.imageRev)
                              : undefined
                          }
                          alt={item.nameEn || item.name}
                        />
                        <span className="min-w-0">
                          <span className="block truncate font-medium">
                            {item.nameEn || item.name}
                          </span>
                          {item.name && item.nameEn && item.name !== item.nameEn && (
                            <span className="block truncate text-sm text-[var(--ink)]">
                              {item.name}
                            </span>
                          )}
                          <span className="block truncate text-xs text-[var(--muted)]">
                            {[item.code, item.remark].filter(Boolean).join(" · ")}
                          </span>
                        </span>
                      </button>
                      <GhostButton
                        danger
                        onClick={() => {
                          const used = orders.some((order) =>
                            order.items.some((line) => line.ingredientId === item.id),
                          );
                          if (used && !window.confirm(t("ingredients.deleteConfirm"))) return;
                          void deleteIngredient(item.id)
                            .then(() => flash({ type: "ok", message: t("common.deleted") }))
                            .catch(() => flash({ type: "error", message: t("common.empty") }));
                        }}
                      >
                        {t("common.delete")}
                      </GhostButton>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          ))}
        </div>
      )}

      {groupOpen && (
        <GroupSheet
          onClose={() => setGroupOpen(false)}
          onAdd={async (name) => {
            await addGroup(name);
            flash({ type: "ok", message: t("common.saved") });
          }}
          onRename={async (id, name) => {
            await updateGroup(id, name);
            flash({ type: "ok", message: t("common.saved") });
          }}
          onDelete={async (id) => {
            try {
              await deleteGroup(id);
              flash({ type: "ok", message: t("common.deleted") });
            } catch (error) {
              flash({
                type: "error",
                message:
                  error instanceof Error && error.message === "group-in-use"
                    ? t("groups.inUse")
                    : String(error),
              });
            }
          }}
        />
      )}

      {editing && (
        <IngredientSheet
          initial={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSave={async (payload) => {
            try {
              await saveIngredient(payload);
              flash({ type: "ok", message: t("common.saved") });
              setEditing(null);
            } catch (error) {
              flash({
                type: "error",
                message:
                  error instanceof Error && error.message === "code-taken"
                    ? t("ingredients.codeTaken")
                    : String(error),
              });
            }
          }}
        />
      )}
    </div>
  );
}

function GroupSheet({
  onClose,
  onAdd,
  onRename,
  onDelete,
}: {
  onClose: () => void;
  onAdd: (name: string) => Promise<void>;
  onRename: (id: string, name: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const { t } = useTranslation();
  const groups = useAppStore((s) => s.groups);
  const [name, setName] = useState("");

  return (
    <Sheet title={t("groups.manage")} onClose={onClose}>
      <div className="space-y-3">
        {groups.map((group) => (
          <div key={group.id} className="flex items-center gap-2">
            <TextInput
              defaultValue={groupLabel(group, t)}
              onBlur={(event) => {
                const next = event.target.value.trim();
                if (next && next !== groupLabel(group, t)) void onRename(group.id, next);
              }}
            />
            <GhostButton danger onClick={() => void onDelete(group.id)}>
              {t("common.delete")}
            </GhostButton>
          </div>
        ))}
        <Field label={t("groups.add")}>
          <div className="flex gap-2">
            <TextInput value={name} onChange={(e) => setName(e.target.value)} />
            <PrimaryButton
              disabled={!name.trim()}
              onClick={() => {
                void onAdd(name.trim()).then(() => setName(""));
              }}
            >
              {t("common.add")}
            </PrimaryButton>
          </div>
        </Field>
      </div>
    </Sheet>
  );
}

function IngredientSheet({
  initial,
  onClose,
  onSave,
}: {
  initial: Partial<Ingredient> | null;
  onClose: () => void;
  onSave: (payload: {
    id?: string;
    code: string;
    name: string;
    nameEn: string;
    remark: string;
    groupId: string;
    images?: { preview: string; thumb: string };
  }) => Promise<void>;
}) {
  const { t } = useTranslation();
  const groups = useAppStore((s) => s.groups);
  const flash = useAppStore((s) => s.flash);
  const [code, setCode] = useState(initial?.code ?? "");
  const [name, setName] = useState(initial?.name ?? "");
  const [nameEn, setNameEn] = useState(initial?.nameEn ?? "");
  const [remark, setRemark] = useState(initial?.remark ?? "");
  const [groupId, setGroupId] = useState(initial?.groupId ?? groups[0]?.id ?? "");
  const [preview, setPreview] = useState(
    initial?.id && initial.hasImage
      ? ingredientThumbUrl(initial.id, initial.imageRev)
      : "",
  );
  const [images, setImages] = useState<{ preview: string; thumb: string }>();
  const [busy, setBusy] = useState(false);

  return (
    <Sheet
      title={initial?.id ? t("ingredients.edit") : t("ingredients.add")}
      onClose={onClose}
    >
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          if (!nameEn.trim()) {
            flash({ type: "error", message: t("ingredients.needNameEn") });
            return;
          }
          if (!code.trim()) {
            flash({ type: "error", message: t("ingredients.needCode") });
            return;
          }
          if (!groupId) {
            flash({ type: "error", message: t("ingredients.needGroup") });
            return;
          }
          setBusy(true);
          void onSave({
            id: initial?.id,
            code,
            name,
            nameEn,
            remark,
            groupId,
            images,
          }).finally(() => setBusy(false));
        }}
      >
        <Field label={t("ingredients.image")} hint={t("common.optional")}>
          <div className="flex items-center gap-3">
            <Thumb src={preview} alt={nameEn || name} size={72} />
            <label className="inline-flex min-h-11 cursor-pointer items-center rounded-full bg-[var(--brand-soft)] px-3 py-2 text-sm font-medium text-[var(--brand)]">
              {preview ? t("ingredients.changeImage") : t("ingredients.pickImage")}
              <input
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (!file) return;
                  void compressImage(file)
                    .then((result) => {
                      setImages({
                        preview: result.previewBase64,
                        thumb: result.thumbBase64,
                      });
                      setPreview(URL.createObjectURL(result.thumb));
                    })
                    .catch((error: Error) => {
                      flash({
                        type: "error",
                        message:
                          error.message === "too-large"
                            ? t("ingredients.tooLarge")
                            : t("ingredients.unsupported"),
                      });
                    });
                }}
              />
            </label>
          </div>
        </Field>
        <Field label={t("ingredients.code")} hint={t("common.required")}>
          <TextInput value={code} onChange={(e) => setCode(e.target.value)} />
        </Field>
        <Field label={t("ingredients.nameEn")} hint={t("common.required")}>
          <TextInput value={nameEn} onChange={(e) => setNameEn(e.target.value)} />
        </Field>
        <Field label={t("ingredients.name")} hint={t("common.optional")}>
          <TextInput value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label={t("ingredients.remark")} hint={t("common.optional")}>
          <TextArea
            value={remark}
            onChange={(e) => setRemark(e.target.value)}
            rows={3}
          />
        </Field>
        <Field label={t("ingredients.group")} hint={t("common.required")}>
          <select
            value={groupId}
            onChange={(e) => setGroupId(e.target.value)}
            className="min-h-11 w-full rounded-2xl border border-[var(--line)] bg-[var(--bg)] px-3 py-2.5 text-base"
          >
            {groups.map((group) => (
              <option key={group.id} value={group.id}>
                {groupLabel(group, t)}
              </option>
            ))}
          </select>
        </Field>
        <div className="flex justify-end gap-2">
          <GhostButton onClick={onClose}>{t("common.cancel")}</GhostButton>
          <PrimaryButton type="submit" disabled={busy}>
            {t("common.save")}
          </PrimaryButton>
        </div>
      </form>
    </Sheet>
  );
}
