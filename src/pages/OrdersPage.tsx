import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ingredientThumbUrl } from "../api/db";
import { IngredientPicker } from "../components/IngredientPicker";
import {
  Card,
  EmptyState,
  Field,
  GhostButton,
  PageTitle,
  PrimaryButton,
  SearchInput,
  Sheet,
  TextInput,
  Thumb,
} from "../components/ui";
import { useAppStore } from "../store/useAppStore";
import { daysAgoIso, groupLabel, ingredientMatches, todayIso } from "../utils/format";
import type { Ingredient, Order, OrderTemplate, OrderTemplateKind } from "../types";

function lastOrderForBuyer(orders: Order[], buyerId: string, beforeDate: string) {
  return orders
    .filter(
      (order) =>
        order.buyerId === buyerId &&
        order.date < beforeDate &&
        order.items.some((item) => item.quantity > 0),
    )
    .sort((a, b) => b.date.localeCompare(a.date) || b.updatedAt - a.updatedAt)[0];
}

export function OrdersPage() {
  const { t } = useTranslation();
  const groups = useAppStore((s) => s.groups);
  const ingredients = useAppStore((s) => s.ingredients);
  const buyers = useAppStore((s) => s.buyers);
  const orders = useAppStore((s) => s.orders);
  const templates = useAppStore((s) => s.templates);
  const upsertOrder = useAppStore((s) => s.upsertOrder);
  const deleteOrder = useAppStore((s) => s.deleteOrder);
  const saveTemplate = useAppStore((s) => s.saveTemplate);
  const deleteTemplate = useAppStore((s) => s.deleteTemplate);
  const saving = useAppStore((s) => s.saving);
  const flash = useAppStore((s) => s.flash);
  const [date, setDate] = useState(todayIso());
  const [buyerId, setBuyerId] = useState(buyers[0]?.id ?? "");
  const [qty, setQty] = useState<Record<string, string>>({});
  const [keyword, setKeyword] = useState("");
  const [groupId, setGroupId] = useState("all");
  const [scope, setScope] = useState<"all" | "previous" | "common">("all");
  const [templateOpen, setTemplateOpen] = useState(false);
  const [activeTemplate, setActiveTemplate] = useState<OrderTemplate | null>(null);
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const previousBuyerRef = useRef("");

  const selectedBuyerId = buyers.some((buyer) => buyer.id === buyerId)
    ? buyerId
    : (buyers[0]?.id ?? "");

  const sortedBuyers = useMemo(
    () => [...buyers].sort((a, b) => a.sort - b.sort || a.name.localeCompare(b.name, "zh")),
    [buyers],
  );
  const selectedBuyer = buyers.find((buyer) => buyer.id === selectedBuyerId);
  const commonIds = useMemo(
    () => new Set(selectedBuyer?.commonIngredientIds ?? []),
    [selectedBuyer],
  );
  const hasCommon = commonIds.size > 0;

  const selectBuyer = (id: string) => {
    previousBuyerRef.current = id;
    setBuyerId(id);
    // 修改已载入的订单时保留数量，方便把订单改到正确的客户。
    if (!editingOrder) setQty({});
    setActiveTemplate(null);
    const buyer = buyers.find((item) => item.id === id);
    setScope(
      editingOrder
        ? "all"
        : buyer && buyer.commonIngredientIds.length > 0
          ? "common"
          : "all",
    );
  };

  const buyerLabel = (id: string) => {
    const buyer = buyers.find((item) => item.id === id);
    return buyer ? buyer.code || buyer.name : t("orders.historyDeletedBuyer");
  };

  // 选中客户变化时，默认切到「常用食材」（该客户有常用产品库的话）。
  useEffect(() => {
    if (previousBuyerRef.current === selectedBuyerId) return;
    previousBuyerRef.current = selectedBuyerId;
    const buyer = buyers.find((item) => item.id === selectedBuyerId);
    setScope(buyer && buyer.commonIngredientIds.length > 0 ? "common" : "all");
  }, [selectedBuyerId, buyers]);

  const groupIds = useMemo(() => new Set(groups.map((group) => group.id)), [groups]);
  const tops = useMemo(
    () =>
      groups
        .filter((group) => !group.parentId || !groupIds.has(group.parentId))
        .sort(
          (a, b) => a.sort - b.sort || a.name.localeCompare(b.name, "zh"),
        ),
    [groups, groupIds],
  );
  const childrenOf = (id: string) =>
    groups
      .filter((group) => group.parentId === id)
      .sort((a, b) => a.sort - b.sort || a.name.localeCompare(b.name, "zh"));

  // 选中的一级分组要把它下面的二级分组一起算进来。
  const activeGroupIds = useMemo(() => {
    if (groupId === "all") return null;
    const ids = new Set<string>([groupId]);
    let changed = true;
    while (changed) {
      changed = false;
      for (const group of groups) {
        if (group.parentId && ids.has(group.parentId) && !ids.has(group.id)) {
          ids.add(group.id);
          changed = true;
        }
      }
    }
    return ids;
  }, [groupId, groups]);

  const buyerTemplates = useMemo(
    () =>
      templates
        .filter((template) => template.buyerId === selectedBuyerId)
        .sort(
          (a, b) =>
            (a.kind === b.kind ? 0 : a.kind === "fixed" ? -1 : 1) ||
            a.name.localeCompare(b.name, "zh"),
        ),
    [templates, selectedBuyerId],
  );

  const activeIds = useMemo(
    () =>
      activeTemplate
        ? new Set(activeTemplate.items.map((item) => item.ingredientId))
        : null,
    [activeTemplate],
  );

  const existing = useMemo(
    () =>
      orders.find(
        (order) => order.date === date && order.buyerId === selectedBuyerId,
      ),
    [orders, date, selectedBuyerId],
  );

  const editingMoved = Boolean(
    editingOrder &&
      (editingOrder.date !== date || editingOrder.buyerId !== selectedBuyerId),
  );

  const removeOrder = (order: Order) => {
    if (
      !window.confirm(
        t("orders.deleteConfirm", {
          date: order.date,
          buyer: buyerLabel(order.buyerId),
        }),
      )
    ) {
      return;
    }
    void deleteOrder(order.id)
      .then(() => {
        if (editingOrder?.id === order.id) setEditingOrder(null);
        if (!editingOrder || editingOrder.id === order.id) setQty({});
        flash({ type: "ok", message: t("orders.deleted") });
      })
      .catch((error) => flash({ type: "error", message: String(error) }));
  };

  const loadOrderForEdit = (order: Order) => {
    // 阻止「选中客户变化」的副作用把范围切回常用食材，确保订单里的食材都能看到。
    previousBuyerRef.current = order.buyerId;
    setDate(order.date);
    setBuyerId(order.buyerId);
    setScope("all");
    setGroupId("all");
    setKeyword("");
    setActiveTemplate(null);
    setQty(
      Object.fromEntries(
        order.items.map((item) => [item.ingredientId, String(item.quantity)]),
      ),
    );
    setEditingOrder(order);
    setHistoryOpen(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
    flash({ type: "ok", message: t("orders.historyLoaded") });
  };

  const cancelEditing = () => {
    if (editingOrder) {
      previousBuyerRef.current = editingOrder.buyerId;
      setDate(editingOrder.date);
      setBuyerId(editingOrder.buyerId);
      setScope("all");
    }
    setEditingOrder(null);
    setQty({});
  };

  const previous = useMemo(
    () => lastOrderForBuyer(orders, selectedBuyerId, date),
    [orders, selectedBuyerId, date],
  );

  const lastQty = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of previous?.items ?? []) {
      if (item.quantity > 0) map.set(item.ingredientId, item.quantity);
    }
    return map;
  }, [previous]);

  const quantities = useMemo(() => {
    // 修改订单时只使用这份订单自己的数量，不把其它订单的食材带进来。
    if (editingOrder) return { ...qty };
    const next: Record<string, string> = {};
    for (const item of existing?.items ?? []) {
      next[item.ingredientId] = String(item.quantity);
    }
    return { ...next, ...qty };
  }, [editingOrder, existing, qty]);

  // 修改订单时只列出这份订单里的食材，外加手动添加的食材。
  const editingItems = useMemo(() => {
    if (!editingOrder) return [];
    const ids = new Set(
      editingOrder.items.map((item) => item.ingredientId),
    );
    for (const id of Object.keys(qty)) ids.add(id);
    return ingredients
      .filter((item) => ids.has(item.id))
      .sort(
        (a, b) =>
          a.code.localeCompare(b.code, "zh") ||
          a.nameEn.localeCompare(b.nameEn, "zh") ||
          a.name.localeCompare(b.name, "zh"),
      );
  }, [editingOrder, qty, ingredients]);

  const editingIds = useMemo(
    () => editingItems.map((item) => item.id),
    [editingItems],
  );

  const matches = useMemo(() => {
    const needle = keyword.trim().toLowerCase();
    return ingredients.filter((item) => {
      if (activeGroupIds && !activeGroupIds.has(item.groupId)) return false;
      if (scope === "previous" && !lastQty.has(item.id)) return false;
      if (scope === "common" && !commonIds.has(item.id)) return false;
      if (activeIds && !activeIds.has(item.id)) return false;
      if (needle && !ingredientMatches(item, needle)) return false;
      return true;
    });
  }, [ingredients, activeGroupIds, scope, keyword, lastQty, activeIds, commonIds]);

  const previousItems = useMemo(
    () =>
      matches
        .filter((item) => lastQty.has(item.id))
        .sort(
          (a, b) =>
            a.code.localeCompare(b.code, "zh") ||
            a.nameEn.localeCompare(b.nameEn, "zh") ||
            a.name.localeCompare(b.name, "zh"),
        ),
    [matches, lastQty],
  );

  const catalogSections = useMemo(() => {
    const sections: { id: string; label: string; items: Ingredient[] }[] = [];
    const sortItems = (items: Ingredient[]) =>
      [...items].sort(
        (a, b) =>
          a.code.localeCompare(b.code, "zh") ||
          a.nameEn.localeCompare(b.nameEn, "zh") ||
          a.name.localeCompare(b.name, "zh"),
      );
    const pick = (id: string) =>
      sortItems(
        matches.filter((item) => item.groupId === id && !lastQty.has(item.id)),
      );
    for (const top of tops) {
      const direct = pick(top.id);
      if (direct.length > 0) {
        sections.push({ id: top.id, label: groupLabel(top, t), items: direct });
      }
      for (const child of childrenOf(top.id)) {
        const items = pick(child.id);
        if (items.length > 0) {
          sections.push({
            id: child.id,
            label: `${groupLabel(top, t)} / ${groupLabel(child, t)}`,
            items,
          });
        }
      }
    }
    return sections;
  }, [groups, tops, matches, lastQty, t]);

  const setQuantity = (id: string, value: string) => {
    setQty((prev) => ({ ...prev, [id]: value }));
  };

  const fillLastQuantities = (onlyIds?: string[]) => {
    if (!previous) return;
    setQty((prev) => {
      const next = { ...prev };
      for (const item of previous.items) {
        if (item.quantity <= 0) continue;
        if (onlyIds && !onlyIds.includes(item.ingredientId)) continue;
        next[item.ingredientId] = String(item.quantity);
      }
      return next;
    });
  };

  const applyTemplate = (template: OrderTemplate) => {
    setActiveTemplate(template);
    if (template.kind === "fixed") {
      setQty((prev) => {
        const next = { ...prev };
        for (const item of template.items) {
          if (item.quantity <= 0) continue;
          // 不覆盖已有数量（包括当天已保存的数量）
          if (quantities[item.ingredientId]) continue;
          next[item.ingredientId] = String(item.quantity);
        }
        return next;
      });
    }
  };

  const currentItems = useMemo(
    () =>
      ingredients
        .map((item) => ({
          ingredientId: item.id,
          quantity: Number(quantities[item.id] || 0),
        }))
        .filter((item) => item.quantity > 0),
    [ingredients, quantities],
  );

  const saveLabel = saving
    ? t("common.saving")
    : editingMoved
      ? t("orders.saveAndMove")
      : existing
        ? t("orders.saveChanges")
        : t("common.save");

  const saveCurrentOrder = () => {
    const moving = editingMoved ? editingOrder : null;
    void (async () => {
      try {
        await upsertOrder({
          date,
          buyerId: selectedBuyerId,
          items: currentItems,
        });
        if (moving) {
          try {
            await deleteOrder(moving.id);
          } catch (error) {
            flash({
              type: "error",
              message: `${t("orders.moveDeleteFailed")} ${String(error)}`,
            });
            return;
          }
        }
        setEditingOrder(null);
        setQty({});
        flash({
          type: "ok",
          message: moving ? t("orders.moved") : t("orders.saved"),
        });
      } catch (error) {
        flash({ type: "error", message: String(error) });
      }
    })();
  };

  if (buyers.length === 0) return <EmptyState text={t("orders.needBuyer")} />;
  if (ingredients.length === 0) return <EmptyState text={t("orders.needIngredient")} />;

  const noMatch = matches.length === 0;

  return (
    <div>
      <PageTitle
        title={t("orders.title")}
        action={
          <GhostButton onClick={() => setHistoryOpen(true)}>
            {t("orders.history")}
            {orders.length > 0 ? ` (${orders.length})` : ""}
          </GhostButton>
        }
      />
      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start lg:gap-5">
      <div className="min-w-0">
      <Card className="mb-4 space-y-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label={t("orders.date")}>
            <TextInput
              type="date"
              value={date}
              onChange={(e) => {
                setDate(e.target.value);
                // 修改已载入的订单时保留数量，方便把订单改到正确的日期。
                if (!editingOrder) setQty({});
              }}
            />
          </Field>
          <Field label={t("orders.buyer")}>
            <select
              value={selectedBuyerId}
              onChange={(e) => selectBuyer(e.target.value)}
              className="min-h-11 w-full rounded-2xl border border-[var(--line)] bg-[var(--bg)] px-3 py-2.5 text-base"
            >
              {sortedBuyers.map((buyer) => (
                <option key={buyer.id} value={buyer.id}>
                  {buyer.code || buyer.name}
                </option>
              ))}
            </select>
          </Field>
        </div>
        {editingOrder && (
          <div className="space-y-2 rounded-2xl bg-[var(--brand-soft)] px-3 py-2 text-sm">
            <p className="font-medium text-[var(--brand)]">
              {t("orders.editingOrder", {
                date: editingOrder.date,
                buyer: buyerLabel(editingOrder.buyerId),
              })}
            </p>
            {editingMoved && (
              <p className="text-xs text-[var(--brand)]">
                {t("orders.editingMoved")}
              </p>
            )}
            <div className="flex flex-wrap justify-end gap-1">
              <GhostButton onClick={cancelEditing}>
                {t("orders.cancelEdit")}
              </GhostButton>
              <GhostButton danger onClick={() => removeOrder(editingOrder)}>
                {editingMoved
                  ? t("orders.deleteOriginal")
                  : t("orders.deleteOrder")}
              </GhostButton>
            </div>
          </div>
        )}
        {existing && (!editingOrder || existing.id !== editingOrder.id) && (
          <div className="flex items-center justify-between gap-2 rounded-2xl bg-[var(--bg)] px-3 py-2 text-sm">
            <span className="min-w-0">
              {editingMoved
                ? t("orders.targetExisting", {
                    count: existing.items.length,
                  })
                : t("orders.existingOrder", {
                    count: existing.items.length,
                  })}
            </span>
            <GhostButton danger onClick={() => removeOrder(existing)}>
              {t("orders.deleteOrder")}
            </GhostButton>
          </div>
        )}
        {!editingOrder && (
          <>
        <div>
          <p className="mb-2 text-sm font-medium text-[var(--muted)]">
            {t("orders.templates")}
          </p>
          <div className="flex gap-2 overflow-x-auto no-scrollbar pb-0.5">
            {buyerTemplates.map((template) => (
              <button
                key={template.id}
                type="button"
                onClick={() => applyTemplate(template)}
                className={`min-h-10 shrink-0 rounded-full px-3 py-1.5 text-sm font-medium ${
                  activeTemplate?.id === template.id
                    ? "bg-[var(--brand)] text-white"
                    : "bg-[var(--bg)] text-[var(--ink)]"
                }`}
              >
                {template.kind === "fixed"
                  ? t("orders.fixedShort")
                  : t("orders.commonShort")}
                {" · "}
                {template.name}
              </button>
            ))}
            <GhostButton onClick={() => setTemplateOpen(true)}>
              {t("orders.manageTemplates")}
            </GhostButton>
          </div>
          {activeTemplate && (
            <div className="mt-2 flex items-center justify-between gap-2 rounded-2xl bg-[var(--brand-soft)] px-3 py-2 text-sm">
              <span className="min-w-0 truncate text-[var(--brand)]">
                {t("orders.templateActive", { name: activeTemplate.name })}
              </span>
              <button
                type="button"
                onClick={() => setActiveTemplate(null)}
                className="shrink-0 font-medium text-[var(--brand)]"
              >
                {t("orders.clearTemplate")}
              </button>
            </div>
          )}
        </div>
        <Field label={t("orders.search")}>
          <SearchInput
            value={keyword}
            onValueChange={setKeyword}
            placeholder={t("orders.searchPlaceholder")}
            clearLabel={t("common.clear")}
          />
        </Field>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label={t("orders.filterGroup")}>
            <select
              value={groupId}
              onChange={(e) => setGroupId(e.target.value)}
              className="min-h-11 w-full rounded-2xl border border-[var(--line)] bg-[var(--bg)] px-3 py-2.5 text-base"
            >
              <option value="all">{t("orders.allGroups")}</option>
              {tops.map((top) => (
                <option key={top.id} value={top.id}>
                  {groupLabel(top, t)}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t("orders.filterScope")}>
            <select
              value={scope}
              onChange={(e) =>
                setScope(e.target.value as "all" | "previous" | "common")
              }
              className="min-h-11 w-full rounded-2xl border border-[var(--line)] bg-[var(--bg)] px-3 py-2.5 text-base"
            >
              <option value="all">{t("orders.allItems")}</option>
              {hasCommon && (
                <option value="common">{t("orders.commonOnly")}</option>
              )}
              <option value="previous">{t("orders.previousOnly")}</option>
            </select>
          </Field>
        </div>
          </>
        )}
      </Card>

      {editingOrder ? (
        <div className="space-y-3 pb-24">
          <Card>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-semibold">
                  {t("orders.currentItems", { count: editingItems.length })}
                </p>
                <p className="text-xs text-[var(--muted)]">
                  {t("orders.editItemsHint")}
                </p>
              </div>
              <GhostButton onClick={() => setAddOpen(true)}>
                {t("orders.addIngredient")}
              </GhostButton>
            </div>
            {editingItems.length === 0 ? (
              <p className="py-4 text-center text-sm text-[var(--muted)]">
                {t("orders.noCurrentItems")}
              </p>
            ) : (
              <IngredientList
                items={editingItems}
                quantities={quantities}
                lastQty={lastQty}
                onChange={setQuantity}
                onFill={(id, value) => setQuantity(id, String(value))}
              />
            )}
          </Card>
        </div>
      ) : noMatch ? (
        <EmptyState
          text={
            activeTemplate
              ? t("orders.noTemplateMatch")
              : scope === "previous" && !previous
                ? t("orders.noPrevious")
                : t("orders.noMatch")
          }
        />
      ) : (
        <div className="space-y-3 pb-24">
          {previousItems.length > 0 && (
            <Card>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-semibold">{t("orders.lastOrder")}</p>
                  <p className="text-xs text-[var(--muted)]">{previous?.date}</p>
                </div>
                <GhostButton onClick={() => fillLastQuantities(previousItems.map((item) => item.id))}>
                  {t("orders.fillLast")}
                </GhostButton>
              </div>
              <IngredientList
                items={previousItems}
                quantities={quantities}
                lastQty={lastQty}
                onChange={setQuantity}
                onFill={(id, value) => setQuantity(id, String(value))}
              />
            </Card>
          )}
          {catalogSections.map(({ id, label, items }) => {
            const isCollapsed = Boolean(collapsedSections[id]);
            return (
              <Card key={id}>
                <button
                  type="button"
                  className="flex w-full items-center justify-between gap-2"
                  onClick={() =>
                    setCollapsedSections((prev) => ({ ...prev, [id]: !prev[id] }))
                  }
                >
                  <span className="min-w-0 truncate font-semibold">
                    {isCollapsed ? "▸" : "▾"} {label}
                  </span>
                  <span className="shrink-0 text-[var(--muted)]">
                    {isCollapsed ? "+" : "–"}
                  </span>
                </button>
                {!isCollapsed && (
                  <div className="mt-3">
                    <IngredientList
                      items={items}
                      quantities={quantities}
                      lastQty={lastQty}
                      onChange={setQuantity}
                      onFill={(id, value) => setQuantity(id, String(value))}
                    />
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      <div className="sticky bottom-[calc(4.6rem+env(safe-area-inset-bottom))] -mx-4 mt-4 bg-[var(--bg)] px-4 py-2 lg:hidden">
        <PrimaryButton
          className="w-full py-3"
          disabled={saving}
          onClick={saveCurrentOrder}
        >
          {saveLabel}
        </PrimaryButton>
      </div>
      </div>

      <aside className="mt-4 hidden lg:sticky lg:top-24 lg:mt-0 lg:block">
        <OrderSummary
          items={currentItems}
          ingredients={ingredients}
          saveLabel={saveLabel}
          saving={saving}
          onSave={saveCurrentOrder}
        />
      </aside>
      </div>

      {addOpen && editingOrder && (
        <IngredientPicker
          title={t("orders.addIngredient")}
          initialIds={[]}
          excludeIds={editingIds}
          onSave={(ids) => {
            setQty((prev) => {
              const next = { ...prev };
              for (const id of ids) next[id] = "";
              return next;
            });
            setAddOpen(false);
          }}
          onClose={() => setAddOpen(false)}
        />
      )}

      {templateOpen && (
        <TemplateSheet
          templates={buyerTemplates}
          itemCount={currentItems.length}
          currentItems={currentItems}
          matches={matches}
          onApply={(template) => {
            applyTemplate(template);
            setTemplateOpen(false);
          }}
          onDelete={async (id) => {
            await deleteTemplate(id);
            if (activeTemplate?.id === id) setActiveTemplate(null);
            flash({ type: "ok", message: t("orders.templateDeleted") });
          }}
          onSave={async (kind, name, items) => {
            await saveTemplate({
              buyerId: selectedBuyerId,
              kind,
              name,
              items,
            });
            flash({ type: "ok", message: t("orders.templateSaved") });
          }}
          onClose={() => setTemplateOpen(false)}
        />
      )}

      {historyOpen && (
        <OrderHistorySheet
          orders={orders}
          buyers={buyers}
          ingredients={ingredients}
          onLoad={loadOrderForEdit}
          onDelete={removeOrder}
          onClose={() => setHistoryOpen(false)}
        />
      )}
    </div>
  );
}

function OrderSummary({
  items,
  ingredients,
  saveLabel,
  saving,
  onSave,
}: {
  items: { ingredientId: string; quantity: number }[];
  ingredients: Ingredient[];
  saveLabel: string;
  saving: boolean;
  onSave: () => void;
}) {
  const { t } = useTranslation();
  const ingredientMap = useMemo(
    () => new Map(ingredients.map((item) => [item.id, item])),
    [ingredients],
  );
  const rows = items
    .map((item) => ({
      ingredient: ingredientMap.get(item.ingredientId),
      quantity: item.quantity,
    }))
    .filter((row) => row.ingredient);
  const totalQty = items.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <Card className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="font-semibold">{t("orders.summaryTitle")}</p>
        <span className="text-xs text-[var(--muted)]">
          {t("orders.summaryCount", { count: items.length })}
        </span>
      </div>
      {rows.length === 0 ? (
        <p className="rounded-2xl bg-[var(--bg)] px-3 py-6 text-center text-sm text-[var(--muted)]">
          {t("orders.summaryEmpty")}
        </p>
      ) : (
        <ul className="max-h-[calc(100dvh-22rem)] space-y-1 overflow-y-auto pr-1">
          {rows.map(({ ingredient, quantity }) => (
            <li
              key={ingredient!.id}
              className="flex items-center justify-between gap-2 rounded-xl px-2 py-1.5 odd:bg-[var(--bg)]"
            >
              <span className="min-w-0 truncate text-sm">
                {ingredient!.nameEn || ingredient!.name}
              </span>
              <span className="shrink-0 text-sm font-semibold">{quantity}</span>
            </li>
          ))}
        </ul>
      )}
      <div className="flex items-center justify-between border-t border-[var(--line)] pt-2 text-sm">
        <span className="text-[var(--muted)]">{t("orders.summaryTotalQty")}</span>
        <span className="font-semibold">{totalQty}</span>
      </div>
      <PrimaryButton
        className="w-full py-3"
        disabled={saving}
        onClick={onSave}
      >
        {saveLabel}
      </PrimaryButton>
    </Card>
  );
}

function OrderHistorySheet({
  orders,
  buyers,
  ingredients,
  onLoad,
  onDelete,
  onClose,
}: {
  orders: Order[];
  buyers: ReturnType<typeof useAppStore.getState>["buyers"];
  ingredients: Ingredient[];
  onLoad: (order: Order) => void;
  onDelete: (order: Order) => void;
  onClose: () => void;
}) {
  const { t, i18n } = useTranslation();
  const separator = i18n.language.startsWith("zh") ? "、" : ", ";
  const [from, setFrom] = useState(() => daysAgoIso(90));
  const [to, setTo] = useState(() => todayIso());
  const [keyword, setKeyword] = useState("");

  const buyerMap = useMemo(
    () => new Map(buyers.map((buyer) => [buyer.id, buyer])),
    [buyers],
  );
  const ingredientMap = useMemo(
    () => new Map(ingredients.map((item) => [item.id, item])),
    [ingredients],
  );

  const filtered = useMemo(() => {
    const needle = keyword.trim().toLowerCase();
    return orders
      .filter((order) => {
        if (from && order.date < from) return false;
        if (to && order.date > to) return false;
        if (!needle) return true;
        const buyer = buyerMap.get(order.buyerId);
        const itemNames = order.items
          .map((item) => {
            const ingredient = ingredientMap.get(item.ingredientId);
            return ingredient ? ingredient.nameEn || ingredient.name : "";
          })
          .join(" ");
        return [order.date, buyer?.name ?? "", buyer?.code ?? "", itemNames]
          .join(" ")
          .toLowerCase()
          .includes(needle);
      })
      .sort((a, b) => b.date.localeCompare(a.date) || b.updatedAt - a.updatedAt);
  }, [orders, buyerMap, ingredientMap, from, to, keyword]);

  return (
    <Sheet title={t("orders.historyTitle")} onClose={onClose}>
      <div className="space-y-3">
        <p className="text-xs text-[var(--muted)]">{t("orders.historyHint")}</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label={t("orders.historyFrom")}>
            <TextInput
              type="date"
              value={from}
              onChange={(event) => setFrom(event.target.value)}
            />
          </Field>
          <Field label={t("orders.historyTo")}>
            <TextInput
              type="date"
              value={to}
              onChange={(event) => setTo(event.target.value)}
            />
          </Field>
        </div>
        <div className="flex items-center justify-between gap-2">
          <GhostButton
            onClick={() => {
              setFrom("");
              setTo("");
            }}
          >
            {t("orders.historyAllDates")}
          </GhostButton>
          <span className="text-xs text-[var(--muted)]">
            {t("orders.historyCount", { count: filtered.length })}
          </span>
        </div>
        <SearchInput
          value={keyword}
          onValueChange={setKeyword}
          placeholder={t("orders.historySearchPlaceholder")}
          clearLabel={t("common.clear")}
        />

        {orders.length === 0 ? (
          <p className="py-6 text-center text-sm text-[var(--muted)]">
            {t("orders.historyEmpty")}
          </p>
        ) : filtered.length === 0 ? (
          <p className="py-6 text-center text-sm text-[var(--muted)]">
            {t("orders.historyNoMatch")}
          </p>
        ) : (
          <ul className="space-y-2">
            {filtered.map((order) => {
              const buyer = buyerMap.get(order.buyerId);
              const itemNames = order.items
                .map((item) => {
                  const ingredient = ingredientMap.get(item.ingredientId);
                  return ingredient
                    ? ingredient.nameEn || ingredient.name
                    : t("common.deletedItem");
                })
                .filter(Boolean);
              const totalQty = order.items.reduce(
                (sum, item) => sum + item.quantity,
                0,
              );
              return (
                <li
                  key={order.id}
                  className="rounded-2xl bg-[var(--bg)] px-3 py-3"
                >
                  <p className="truncate font-medium">
                    {order.date}
                    {" · "}
                    {buyer
                      ? buyer.code || buyer.name
                      : t("orders.historyDeletedBuyer")}
                  </p>
                  <p className="mt-0.5 text-xs text-[var(--muted)]">
                    {t("orders.historyItemCount", {
                      count: order.items.length,
                    })}
                    {" · "}
                    {t("orders.historyTotalQty", { qty: totalQty })}
                  </p>
                  <p className="mt-1 text-xs text-[var(--ink)]">
                    {itemNames.length > 0
                      ? itemNames.join(separator)
                      : t("orders.emptyOrder")}
                  </p>
                  <div className="mt-2 flex justify-end gap-1">
                    <GhostButton
                      disabled={!buyer}
                      onClick={() => onLoad(order)}
                    >
                      {t("orders.historyEdit")}
                    </GhostButton>
                    <GhostButton danger onClick={() => onDelete(order)}>
                      {t("common.delete")}
                    </GhostButton>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </Sheet>
  );
}

function TemplateSheet({
  templates,
  itemCount,
  currentItems,
  matches,
  onApply,
  onDelete,
  onSave,
  onClose,
}: {
  templates: OrderTemplate[];
  itemCount: number;
  currentItems: { ingredientId: string; quantity: number }[];
  matches: Ingredient[];
  onApply: (template: OrderTemplate) => void;
  onDelete: (id: string) => Promise<void>;
  onSave: (
    kind: OrderTemplateKind,
    name: string,
    items: { ingredientId: string; quantity: number }[],
  ) => Promise<void>;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const flash = useAppStore((s) => s.flash);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  const save = (kind: OrderTemplateKind) => {
    if (!name.trim()) {
      flash({ type: "error", message: t("orders.needTemplateName") });
      return;
    }
    const items =
      kind === "fixed"
        ? currentItems
        : matches.map((item) => ({ ingredientId: item.id, quantity: 0 }));
    if (items.length === 0) {
      flash({ type: "error", message: t("orders.needTemplateItems") });
      return;
    }
    setBusy(true);
    void onSave(kind, name.trim(), items)
      .then(() => setName(""))
      .finally(() => setBusy(false));
  };

  return (
    <Sheet title={t("orders.manageTemplates")} onClose={onClose}>
      <div className="space-y-4">
        {templates.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">{t("orders.noTemplates")}</p>
        ) : (
          <ul className="space-y-2">
            {templates.map((template) => (
              <li
                key={template.id}
                className="flex items-center justify-between gap-2 rounded-2xl bg-[var(--bg)] px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">
                    <span className="mr-1 rounded-full bg-[var(--brand-soft)] px-2 py-0.5 text-xs text-[var(--brand)]">
                      {template.kind === "fixed"
                        ? t("orders.fixedShort")
                        : t("orders.commonShort")}
                    </span>
                    {template.name}
                  </p>
                  <p className="text-xs text-[var(--muted)]">
                    {t("orders.templateItemCount", { count: template.items.length })}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <GhostButton onClick={() => onApply(template)}>
                    {t("common.apply")}
                  </GhostButton>
                  <GhostButton danger onClick={() => void onDelete(template.id)}>
                    {t("common.delete")}
                  </GhostButton>
                </div>
              </li>
            ))}
          </ul>
        )}

        <div className="space-y-2 border-t border-[var(--line)] pt-4">
          <Field label={t("orders.templateName")}>
            <TextInput value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <p className="text-xs text-[var(--muted)]">{t("orders.templateHint")}</p>
          <div className="flex flex-wrap justify-end gap-2">
            <GhostButton disabled={busy} onClick={() => save("common")}>
              {t("orders.saveCommon")}
              {itemCount > 0 ? ` (${itemCount})` : ""}
            </GhostButton>
            <PrimaryButton disabled={busy} onClick={() => save("fixed")}>
              {t("orders.saveFixed")}
              {itemCount > 0 ? ` (${itemCount})` : ""}
            </PrimaryButton>
          </div>
        </div>
      </div>
    </Sheet>
  );
}

function IngredientList({
  items,
  quantities,
  lastQty,
  onChange,
  onFill,
}: {
  items: Ingredient[];
  quantities: Record<string, string>;
  lastQty: Map<string, number>;
  onChange: (id: string, value: string) => void;
  onFill: (id: string, value: number) => void;
}) {
  const { t } = useTranslation();
  return (
    <ul className="space-y-3">
      {items.map((item) => {
        const previousQty = lastQty.get(item.id);
        return (
          <li key={item.id} className="flex items-center gap-3">
            <Thumb
              src={
                item.hasImage
                  ? ingredientThumbUrl(item.id, item.imageRev)
                  : undefined
              }
              alt={item.nameEn || item.name}
            />
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{item.nameEn || item.name}</p>
              {item.name && item.nameEn && item.name !== item.nameEn && (
                <p className="truncate text-xs text-[var(--ink)]">{item.name}</p>
              )}
              <p className="truncate text-xs text-[var(--muted)]">
                {[item.code, item.remark].filter(Boolean).join(" · ")}
              </p>
              {previousQty != null && (
                <button
                  type="button"
                  className="text-xs font-medium text-[var(--brand)]"
                  onClick={() => onFill(item.id, previousQty)}
                >
                  {t("orders.lastQty", { qty: previousQty })} · {t("orders.fillThis")}
                </button>
              )}
            </div>
            <TextInput
              type="number"
              min="0"
              inputMode="decimal"
              className="w-20 shrink-0 text-center sm:w-24"
              placeholder="0"
              value={quantities[item.id] ?? ""}
              onChange={(e) => onChange(item.id, e.target.value)}
            />
          </li>
        );
      })}
    </ul>
  );
}
