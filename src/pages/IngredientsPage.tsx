import { Fragment, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { ingredientThumbUrl } from "../api/db";
import {
  Card,
  EmptyState,
  Field,
  GhostButton,
  PageTitle,
  PrimaryButton,
  SearchInput,
  Sheet,
  TextArea,
  TextInput,
  Thumb,
} from "../components/ui";
import { useAppStore } from "../store/useAppStore";
import { compressImage } from "../utils/compressImage";
import { groupLabel, ingredientMatches } from "../utils/format";
import type { Group, Ingredient } from "../types";

const bySort = (a: Group, b: Group) =>
  a.sort - b.sort || a.name.localeCompare(b.name, "zh");

function sortItems(items: Ingredient[]) {
  return [...items].sort(
    (a, b) =>
      a.code.localeCompare(b.code, "zh") ||
      a.nameEn.localeCompare(b.nameEn, "zh") ||
      a.name.localeCompare(b.name, "zh"),
  );
}

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
  const [subCollapsed, setSubCollapsed] = useState<Record<string, boolean>>({});
  const [keyword, setKeyword] = useState("");

  const groupIds = useMemo(() => new Set(groups.map((group) => group.id)), [groups]);
  const tops = useMemo(
    () =>
      groups
        .filter((group) => !group.parentId || !groupIds.has(group.parentId))
        .sort(bySort),
    [groups, groupIds],
  );
  const childrenOf = useMemo(
    () => (id: string) => groups.filter((group) => group.parentId === id).sort(bySort),
    [groups],
  );

  const matches = useMemo(() => {
    const needle = keyword.trim();
    return (item: Ingredient) => !needle || ingredientMatches(item, needle);
  }, [keyword]);

  const itemsOf = (groupId: string) =>
    sortItems(ingredients.filter((item) => item.groupId === groupId && matches(item)));

  const grouped = useMemo(
    () =>
      tops.map((top) => ({
        group: top,
        direct: itemsOf(top.id),
        subs: childrenOf(top.id).map((group) => ({
          group,
          items: itemsOf(group.id),
        })),
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tops, groups, ingredients, keyword],
  );

  const searching = keyword.trim().length > 0;
  const visible = grouped.filter(
    (entry) =>
      !searching ||
      entry.direct.length > 0 ||
      entry.subs.some((sub) => sub.items.length > 0),
  );
  const totalMatches = grouped.reduce(
    (sum, entry) =>
      sum + entry.direct.length + entry.subs.reduce((s, sub) => s + sub.items.length, 0),
    0,
  );

  const renderItems = (items: Ingredient[]) => (
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
                {[
                  item.code,
                  item.remark,
                  item.unit,
                  item.price > 0 ? `¥${item.price}` : "",
                ]
                  .filter(Boolean)
                  .join(" · ")}
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
      ) : (
        <div className="space-y-3">
          <div className="lg:max-w-xl">
            <SearchInput
              value={keyword}
              onValueChange={setKeyword}
              placeholder={t("ingredients.searchPlaceholder")}
              clearLabel={t("common.clear")}
            />
          </div>

          <div className="lg:grid lg:grid-cols-2 lg:items-start lg:gap-3">
          {totalMatches === 0 ? (
            <EmptyState
              text={searching ? t("ingredients.noMatch") : t("ingredients.empty")}
            />
          ) : (
            visible.map((entry) => {
              const count =
                entry.direct.length +
                entry.subs.reduce((sum, sub) => sum + sub.items.length, 0);
              const showDirectHeading =
                entry.direct.length > 0 && entry.subs.some((sub) => sub.items.length > 0);
              return (
                <Card key={entry.group.id}>
                  <button
                    type="button"
                    className="flex w-full items-center justify-between"
                    onClick={() =>
                      setCollapsed((prev) => ({
                        ...prev,
                        [entry.group.id]: !prev[entry.group.id],
                      }))
                    }
                  >
                    <div className="text-left">
                      <p className="font-semibold">{groupLabel(entry.group, t)}</p>
                      <p className="text-xs text-[var(--muted)]">{count}</p>
                    </div>
                    <span className="text-[var(--muted)]">
                      {collapsed[entry.group.id] ? "+" : "–"}
                    </span>
                  </button>
                  {(!collapsed[entry.group.id] || searching) && (
                    <div className="mt-3 space-y-4">
                      {entry.direct.length > 0 && (
                        <div>
                          {showDirectHeading && (
                            <p className="text-xs font-medium text-[var(--muted)]">
                              {groupLabel(entry.group, t)}
                            </p>
                          )}
                          {renderItems(entry.direct)}
                        </div>
                      )}
                      {entry.subs.map((sub) => {
                        if (searching && sub.items.length === 0) return null;
                        const isCollapsed = Boolean(subCollapsed[sub.group.id]) && !searching;
                        return (
                          <div key={sub.group.id}>
                            <button
                              type="button"
                              className="flex w-full items-center justify-between gap-2 pl-3"
                              onClick={() =>
                                setSubCollapsed((prev) => ({
                                  ...prev,
                                  [sub.group.id]: !prev[sub.group.id],
                                }))
                              }
                            >
                              <span className="min-w-0 truncate text-sm font-medium text-[var(--brand)]">
                                {isCollapsed ? "▸" : "▾"} {groupLabel(sub.group, t)}
                                <span className="ml-1 text-xs text-[var(--muted)]">
                                  {sub.items.length}
                                </span>
                              </span>
                              <span className="shrink-0 text-[var(--muted)]">
                                {isCollapsed ? "+" : "–"}
                              </span>
                            </button>
                            {!isCollapsed && renderItems(sub.items)}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </Card>
              );
            })
          )}
          </div>
        </div>
      )}

      {groupOpen && (
        <GroupSheet
          onClose={() => setGroupOpen(false)}
          onAdd={async (name, parentId) => {
            await addGroup(name, parentId);
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
  onAdd: (name: string, parentId?: string) => Promise<void>;
  onRename: (id: string, name: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const { t } = useTranslation();
  const groups = useAppStore((s) => s.groups);
  const [name, setName] = useState("");
  const [subNames, setSubNames] = useState<Record<string, string>>({});

  const groupIds = new Set(groups.map((group) => group.id));
  const tops = groups
    .filter((group) => !group.parentId || !groupIds.has(group.parentId))
    .sort(bySort);
  const childrenOf = (id: string) =>
    groups.filter((group) => group.parentId === id).sort(bySort);

  return (
    <Sheet title={t("groups.manage")} onClose={onClose}>
      <div className="space-y-4">
        {tops.map((top) => {
          const children = childrenOf(top.id);
          const subName = subNames[top.id] ?? "";
          return (
            <div key={top.id} className="space-y-2 rounded-2xl bg-[var(--bg)] p-3">
              <div className="flex items-center gap-2">
                <TextInput
                  defaultValue={groupLabel(top, t)}
                  onBlur={(event) => {
                    const next = event.target.value.trim();
                    if (next && next !== groupLabel(top, t)) void onRename(top.id, next);
                  }}
                />
                <GhostButton danger onClick={() => void onDelete(top.id)}>
                  {t("common.delete")}
                </GhostButton>
              </div>
              <div className="space-y-2 pl-4">
                {children.map((child) => (
                  <div key={child.id} className="flex items-center gap-2">
                    <TextInput
                      defaultValue={groupLabel(child, t)}
                      onBlur={(event) => {
                        const next = event.target.value.trim();
                        if (next && next !== groupLabel(child, t)) {
                          void onRename(child.id, next);
                        }
                      }}
                    />
                    <GhostButton danger onClick={() => void onDelete(child.id)}>
                      {t("common.delete")}
                    </GhostButton>
                  </div>
                ))}
                <div className="flex gap-2">
                  <TextInput
                    value={subName}
                    placeholder={t("groups.subName")}
                    onChange={(e) =>
                      setSubNames((prev) => ({ ...prev, [top.id]: e.target.value }))
                    }
                  />
                  <PrimaryButton
                    disabled={!subName.trim()}
                    onClick={() => {
                      void onAdd(subName.trim(), top.id).then(() =>
                        setSubNames((prev) => ({ ...prev, [top.id]: "" })),
                      );
                    }}
                  >
                    {t("common.add")}
                  </PrimaryButton>
                </div>
              </div>
            </div>
          );
        })}
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
    unit: string;
    price: number;
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
  const [unit, setUnit] = useState(initial?.unit ?? "");
  const [price, setPrice] = useState(
    initial?.price ? String(initial.price) : "",
  );

  const groupIds = new Set(groups.map((group) => group.id));
  const tops = groups
    .filter((group) => !group.parentId || !groupIds.has(group.parentId))
    .sort(bySort);
  const childrenOf = (id: string) =>
    groups.filter((group) => group.parentId === id).sort(bySort);
  const leafGroups = tops.flatMap((top) => {
    const children = childrenOf(top.id);
    return children.length > 0 ? children : [top];
  });
  const [groupId, setGroupId] = useState(
    initial?.groupId ?? leafGroups[0]?.id ?? "",
  );
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
            unit,
            price: Number(price) > 0 ? Number(price) : 0,
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
        <Field label={t("ingredients.price")} hint={t("common.optional")}>
          <TextInput
            type="number"
            min="0"
            step="0.01"
            inputMode="decimal"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
          />
        </Field>
        <Field label={t("ingredients.unit")} hint={t("common.optional")}>
          <TextInput
            value={unit}
            placeholder="kg / ctn / pcs"
            onChange={(e) => setUnit(e.target.value)}
          />
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
            {tops.map((top) => {
              const children = childrenOf(top.id);
              return (
                <Fragment key={top.id}>
                  <option value={top.id}>{groupLabel(top, t)}</option>
                  {children.map((child) => (
                    <option key={child.id} value={child.id}>
                      {"　└ "}
                      {groupLabel(child, t)}
                    </option>
                  ))}
                </Fragment>
              );
            })}
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
