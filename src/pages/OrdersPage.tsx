import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ingredientThumbUrl } from "../api/db";
import { IngredientPicker } from "../components/IngredientPicker";
import {
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
import { useAuthStore } from "../store/useAuthStore";
import { daysAgoIso, groupLabel, ingredientMatches, todayIso } from "../utils/format";
import type {
  Buyer,
  Ingredient,
  Order,
  OrderTemplate,
  OrderTemplateKind,
} from "../types";

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

/* ---------- 未提交草稿：切换页面/刷新后自动恢复 ---------- */

const ORDER_DRAFT_PREFIX = "ecolink:order-draft:";

type OrderScope = "all" | "previous" | "common";

type OrderDraft = {
  date: string;
  buyerId: string;
  qty: Record<string, string>;
  scope: OrderScope;
  groupId: string;
  keyword: string;
  activeTemplateId?: string;
  editingOrderId?: string;
  savedAt: number;
};

function readOrderDraft(key: string): OrderDraft | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(ORDER_DRAFT_PREFIX + key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<OrderDraft> | null;
    if (!parsed || typeof parsed !== "object") return null;

    const qty: Record<string, string> = {};
    if (parsed.qty && typeof parsed.qty === "object") {
      for (const [id, value] of Object.entries(parsed.qty)) {
        if (typeof value === "string") qty[id] = value;
      }
    }

    const scope: OrderScope =
      parsed.scope === "previous" || parsed.scope === "common"
        ? parsed.scope
        : "all";

    return {
      date: typeof parsed.date === "string" ? parsed.date : todayIso(),
      buyerId: typeof parsed.buyerId === "string" ? parsed.buyerId : "",
      qty,
      scope,
      groupId: typeof parsed.groupId === "string" ? parsed.groupId : "all",
      keyword: typeof parsed.keyword === "string" ? parsed.keyword : "",
      activeTemplateId:
        typeof parsed.activeTemplateId === "string"
          ? parsed.activeTemplateId
          : undefined,
      editingOrderId:
        typeof parsed.editingOrderId === "string"
          ? parsed.editingOrderId
          : undefined,
      savedAt: typeof parsed.savedAt === "number" ? parsed.savedAt : Date.now(),
    };
  } catch {
    return null;
  }
}

function writeOrderDraft(key: string, draft: OrderDraft) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      ORDER_DRAFT_PREFIX + key,
      JSON.stringify(draft),
    );
  } catch {
    // 隐私模式或存储已满时忽略，不影响当前录单。
  }
}

function clearOrderDraft(key: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(ORDER_DRAFT_PREFIX + key);
  } catch {
    // 忽略。
  }
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
  const user = useAuthStore((s) => s.user);
  const draftKey = user?.id ?? "local";
  const [initialDraft] = useState(() => readOrderDraft(draftKey));
  const [draftRestored] = useState(() =>
    Boolean(
      initialDraft &&
        (Object.values(initialDraft.qty).some((value) => value.trim() !== "") ||
          initialDraft.editingOrderId),
    ),
  );
  const draftNoticeShownRef = useRef(false);
  const [date, setDate] = useState(initialDraft?.date ?? todayIso());
  const [buyerId, setBuyerId] = useState(() => {
    const saved = initialDraft?.buyerId;
    return saved && buyers.some((buyer) => buyer.id === saved)
      ? saved
      : (buyers[0]?.id ?? "");
  });
  const [qty, setQty] = useState<Record<string, string>>(
    initialDraft?.qty ?? {},
  );
  const [keyword, setKeyword] = useState(initialDraft?.keyword ?? "");
  const [groupId, setGroupId] = useState(initialDraft?.groupId ?? "all");
  const [scope, setScope] = useState<OrderScope>(initialDraft?.scope ?? "all");
  const [templateOpen, setTemplateOpen] = useState(false);
  const [activeTemplate, setActiveTemplate] = useState<OrderTemplate | null>(
    () =>
      initialDraft?.activeTemplateId
        ? (templates.find(
            (template) => template.id === initialDraft.activeTemplateId,
          ) ?? null)
        : null,
  );
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});
  const [editingOrder, setEditingOrder] = useState<Order | null>(() =>
    initialDraft?.editingOrderId
      ? (orders.find((order) => order.id === initialDraft.editingOrderId) ?? null)
      : null,
  );
  const [historyOpen, setHistoryOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const previousBuyerRef = useRef(
    initialDraft?.buyerId &&
      buyers.some((buyer) => buyer.id === initialDraft.buyerId)
      ? initialDraft.buyerId
      : (buyers[0]?.id ?? ""),
  );

  const selectedBuyerId = buyers.some((buyer) => buyer.id === buyerId)
    ? buyerId
    : (buyers[0]?.id ?? "");

  useEffect(() => {
    if (!draftRestored || draftNoticeShownRef.current) return;
    draftNoticeShownRef.current = true;
    flash({ type: "ok", message: t("orders.draftRestored") });
  }, [draftRestored, flash, t]);

  // 录单草稿：只要还有数量或正在修改订单，就自动保存在本机。
  useEffect(() => {
    const hasContent =
      Boolean(editingOrder) ||
      Object.values(qty).some((value) => value.trim() !== "");
    if (!hasContent) {
      clearOrderDraft(draftKey);
      return;
    }
    const timer = window.setTimeout(() => {
      writeOrderDraft(draftKey, {
        date,
        buyerId: selectedBuyerId,
        qty,
        scope,
        groupId,
        keyword,
        activeTemplateId: activeTemplate?.id,
        editingOrderId: editingOrder?.id,
        savedAt: Date.now(),
      });
    }, 250);
    return () => window.clearTimeout(timer);
  }, [
    activeTemplate?.id,
    date,
    draftKey,
    editingOrder,
    groupId,
    keyword,
    qty,
    scope,
    selectedBuyerId,
  ]);


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

  const adjustQuantity = (id: string, delta: number) => {
    setQty((prev) => {
      const current = Number(quantities[id] || 0);
      const next = Math.max(0, current + delta);
      return { ...prev, [id]: next > 0 ? String(next) : "" };
    });
  };

  const removeQuantity = (id: string) => {
    setQty((prev) => ({ ...prev, [id]: "" }));
  };

  const clearQuantities = () => {
    setQty({});
    setActiveTemplate(null);
    clearOrderDraft(draftKey);
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
        clearOrderDraft(draftKey);
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
          <div className="flex items-center gap-2">
            <GhostButton onClick={() => setHistoryOpen(true)}>
              <HistoryIcon />
              {t("orders.history")}
              {orders.length > 0 ? ` (${orders.length})` : ""}
            </GhostButton>
            <div className="hidden sm:block">
              <PrimaryButton onClick={() => setTemplateOpen(true)}>
                <PlusIcon />
                {t("orders.manageTemplates")}
              </PrimaryButton>
            </div>
          </div>
        }
      />
      <div className="grid items-start gap-4 lg:grid-cols-[240px_minmax(0,1fr)] xl:grid-cols-[240px_minmax(0,1fr)_320px]">
        <aside className="lg:sticky lg:top-[80px]">
          <div className="overflow-hidden rounded-[20px] border border-[var(--line)] bg-white shadow-[var(--shadow-sm)]">
            <div className="flex items-center justify-between border-b border-[var(--line)] px-4 py-3">
              <p className="text-xs font-bold tracking-[0.06em]">
                {t("orders.settings")}
              </p>
              <span className="text-[10px] font-semibold text-[var(--muted-2)]">
                01
              </span>
            </div>
            <div className="space-y-3 p-4">
              <Field label={t("orders.date")}>
                <TextInput
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </Field>
              <Field label={t("orders.buyer")}>
                <select
                  value={selectedBuyerId}
                  onChange={(e) => selectBuyer(e.target.value)}
                  className="min-h-10 w-full rounded-[10px] border border-[var(--line)] bg-white px-3 py-2 text-base text-[var(--ink)] sm:text-sm"
                >
                  {sortedBuyers.map((buyer) => (
                    <option key={buyer.id} value={buyer.id}>
                      {buyer.code || buyer.name}
                    </option>
                  ))}
                </select>
              </Field>

              {editingOrder && (
                <div className="space-y-2 rounded-[10px] border border-[rgba(234,88,12,0.16)] bg-[var(--brand-soft)] px-3 py-2 text-xs">
                  <p className="font-semibold text-[var(--brand-ink)]">
                    {t("orders.editingOrder", {
                      date: editingOrder.date,
                      buyer: buyerLabel(editingOrder.buyerId),
                    })}
                  </p>
                  {editingMoved && (
                    <p className="text-[var(--brand-ink)]/80">
                      {t("orders.editingMoved")}
                    </p>
                  )}
                  <div className="flex flex-wrap justify-end gap-1">
                    <GhostButton
                      className="min-h-8 px-2 text-xs"
                      onClick={cancelEditing}
                    >
                      {t("orders.cancelEdit")}
                    </GhostButton>
                    <GhostButton
                      className="min-h-8 px-2 text-xs"
                      danger
                      onClick={() => removeOrder(editingOrder)}
                    >
                      {editingMoved
                        ? t("orders.deleteOriginal")
                        : t("orders.deleteOrder")}
                    </GhostButton>
                  </div>
                </div>
              )}

              {existing && (!editingOrder || existing.id !== editingOrder.id) && (
                <div className="flex items-center justify-between gap-2 rounded-[10px] bg-[var(--surface)] px-3 py-2 text-xs">
                  <span className="min-w-0">
                    {editingMoved
                      ? t("orders.targetExisting", {
                          count: existing.items.length,
                        })
                      : t("orders.existingOrder", {
                          count: existing.items.length,
                        })}
                  </span>
                  <GhostButton
                    className="min-h-8 px-2 text-xs"
                    danger
                    onClick={() => removeOrder(existing)}
                  >
                    {t("orders.deleteOrder")}
                  </GhostButton>
                </div>
              )}

              {!editingOrder && (
                <>
                  <button
                    type="button"
                    onClick={() => setFiltersOpen((open) => !open)}
                    className="flex w-full items-center justify-between rounded-[9px] border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-xs font-semibold text-[var(--muted)] transition hover:text-[var(--ink)] lg:hidden"
                  >
                    <span>
                      {filtersOpen
                        ? t("orders.hideFilters")
                        : t("orders.showFilters")}
                    </span>
                    <span className="text-[var(--muted-2)]">
                      {filtersOpen ? "−" : "+"}
                    </span>
                  </button>
                  <div
                    className={`${filtersOpen ? "block" : "hidden"} space-y-3 lg:block`}
                  >
                  <Field label={t("orders.search")}>
                    <SearchInput
                      value={keyword}
                      onValueChange={setKeyword}
                      placeholder={t("orders.searchPlaceholder")}
                      clearLabel={t("common.clear")}
                    />
                  </Field>

                  <div className="space-y-1.5">
                    <span className="text-xs font-semibold text-[var(--muted)]">
                      {t("orders.filterScope")}
                    </span>
                    <div
                      className={`grid gap-0.5 rounded-[9px] border border-[var(--line)] bg-[var(--surface)] p-0.5 ${
                        hasCommon ? "grid-cols-3" : "grid-cols-2"
                      }`}
                    >
                      {(["all", "common", "previous"] as const)
                        .filter((value) => value !== "common" || hasCommon)
                        .map((value) => (
                          <button
                            key={value}
                            type="button"
                            onClick={() => setScope(value)}
                            className={`min-h-7 rounded-[7px] px-1 text-[10.5px] font-semibold transition ${
                              scope === value
                                ? "bg-white text-[var(--ink)] shadow-[var(--shadow-xs)]"
                                : "text-[var(--muted)] hover:text-[var(--ink)]"
                            }`}
                          >
                            {t(
                              value === "all"
                                ? "orders.allItems"
                                : value === "common"
                                  ? "orders.commonOnly"
                                  : "orders.previousOnly",
                            )}
                          </button>
                        ))}
                    </div>
                  </div>

                  <Field label={t("orders.filterGroup")}>
                    <select
                      value={groupId}
                      onChange={(e) => setGroupId(e.target.value)}
                      className="min-h-10 w-full rounded-[10px] border border-[var(--line)] bg-white px-3 py-2 text-base text-[var(--ink)] sm:text-sm"
                    >
                      <option value="all">{t("orders.allGroups")}</option>
                      {tops.map((top) => (
                        <option key={top.id} value={top.id}>
                          {groupLabel(top, t)}
                        </option>
                      ))}
                    </select>
                  </Field>

                  <div className="h-px bg-[var(--line)]" />

                  <div className="space-y-1.5">
                    <span className="text-xs font-semibold text-[var(--muted)]">
                      {t("orders.templates")}
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {buyerTemplates.map((template) => (
                        <button
                          key={template.id}
                          type="button"
                          onClick={() => applyTemplate(template)}
                          className={`min-h-7 shrink-0 rounded-[7px] border px-2 py-1 text-[10.5px] font-medium transition ${
                            activeTemplate?.id === template.id
                              ? "border-[var(--ink)] bg-[var(--ink)] text-white"
                              : "border-[var(--line)] bg-white text-[var(--muted)] hover:border-[var(--line-strong)] hover:text-[var(--ink)]"
                          }`}
                        >
                          {template.kind === "fixed"
                            ? t("orders.fixedShort")
                            : t("orders.commonShort")}
                          {" · "}
                          {template.name}
                        </button>
                      ))}
                      <GhostButton
                        className="min-h-7 px-2 text-[10.5px]"
                        onClick={() => setTemplateOpen(true)}
                      >
                        {t("orders.manageTemplates")}
                      </GhostButton>
                    </div>
                    {activeTemplate && (
                      <div className="flex items-center justify-between gap-2 rounded-[8px] bg-[var(--brand-soft)] px-2 py-1.5 text-[10.5px]">
                        <span className="min-w-0 truncate text-[var(--brand-ink)]">
                          {t("orders.templateActive", {
                            name: activeTemplate.name,
                          })}
                        </span>
                        <button
                          type="button"
                          onClick={() => setActiveTemplate(null)}
                          className="shrink-0 font-semibold text-[var(--brand-ink)]"
                        >
                          {t("orders.clearTemplate")}
                        </button>
                      </div>
                    )}
                  </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </aside>

        <div className="min-w-0">
      {editingOrder ? (
        <div className="space-y-3">
          <div className="overflow-hidden rounded-[20px] border border-[var(--line)] bg-white shadow-[var(--shadow-sm)]">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--line)] px-4 py-3">
              <div>
                <p className="text-[13px] font-bold">
                  {t("orders.currentItems", { count: editingItems.length })}
                </p>
                <p className="mt-0.5 text-[11px] text-[var(--muted)]">
                  {t("orders.editItemsHint")}
                </p>
              </div>
              <GhostButton onClick={() => setAddOpen(true)}>
                <PlusIcon />
                {t("orders.addIngredient")}
              </GhostButton>
            </div>
            {editingItems.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-[var(--muted)]">
                {t("orders.noCurrentItems")}
              </p>
            ) : (
              <div className="px-4 py-1">
                <IngredientList
                  items={editingItems}
                  quantities={quantities}
                  lastQty={lastQty}
                  onChange={setQuantity}
                  onFill={(id, value) => setQuantity(id, String(value))}
                />
              </div>
            )}
          </div>
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
        <div className="space-y-3">
          {previousItems.length > 0 && (
            <div className="overflow-hidden rounded-[20px] border border-[var(--line)] bg-white shadow-[var(--shadow-sm)]">
              <div className="flex items-center justify-between gap-2 border-b border-[var(--line)] px-4 py-3">
                <div>
                  <p className="text-[12px] font-bold">{t("orders.lastOrder")}</p>
                  <p className="mt-0.5 text-[10px] text-[var(--muted)]">
                    {previous?.date}
                  </p>
                </div>
                <GhostButton
                  className="min-h-8 px-2 text-[11px]"
                  onClick={() =>
                    fillLastQuantities(previousItems.map((item) => item.id))
                  }
                >
                  {t("orders.fillLast")}
                </GhostButton>
              </div>
              <div className="px-4 py-1">
                <IngredientList
                  items={previousItems}
                  quantities={quantities}
                  lastQty={lastQty}
                  onChange={setQuantity}
                  onFill={(id, value) => setQuantity(id, String(value))}
                />
              </div>
            </div>
          )}

          <div className="overflow-hidden rounded-[20px] border border-[var(--line)] bg-white shadow-[var(--shadow-sm)]">
            <div className="flex items-center justify-between gap-2 border-b border-[var(--line)] px-4 py-3">
              <div className="flex min-w-0 items-center gap-2">
                <p className="text-[13px] font-bold">{t("orders.listTitle")}</p>
                <span className="rounded-[6px] bg-[var(--brand-soft)] px-1.5 py-0.5 text-[10px] font-bold text-[var(--brand-ink)]">
                  {t("orders.selectedCount", { count: currentItems.length })}
                </span>
              </div>
              <button
                type="button"
                onClick={clearQuantities}
                className="rounded-[6px] px-2 py-1 text-[11px] font-medium text-[var(--muted)] transition hover:bg-[var(--surface)] hover:text-[var(--ink)]"
              >
                {t("orders.clearAll")}
              </button>
            </div>
            {catalogSections.map(({ id, label, items }) => {
              const isCollapsed = Boolean(collapsedSections[id]);
              return (
                <div
                  key={id}
                  className="border-t border-[var(--line)] first:border-t-0"
                >
                  <button
                    type="button"
                    className="flex w-full items-center justify-between gap-2 bg-[var(--surface)] px-4 py-2 text-left transition hover:bg-[var(--brand-soft-2)]"
                    onClick={() =>
                      setCollapsedSections((prev) => ({
                        ...prev,
                        [id]: !prev[id],
                      }))
                    }
                  >
                    <span className="min-w-0 truncate text-[10.5px] font-bold uppercase tracking-[0.08em] text-[var(--muted)]">
                      {label}
                    </span>
                    <span className="text-[11px] text-[var(--muted-2)]">
                      {isCollapsed ? "+" : "−"}
                    </span>
                  </button>
                  {!isCollapsed && (
                    <div className="px-4 py-1">
                      <IngredientList
                        items={items}
                        quantities={quantities}
                        lastQty={lastQty}
                        onChange={setQuantity}
                        onFill={(id, value) => setQuantity(id, String(value))}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="sticky bottom-[calc(5.8rem+env(safe-area-inset-bottom))] z-20 mt-4 rounded-[14px] border border-[var(--line)] bg-[color-mix(in_srgb,white_92%,transparent)] p-2 shadow-[0_18px_36px_-18px_rgba(23,23,23,0.35)] backdrop-blur xl:hidden">
        <PrimaryButton
          className="w-full py-2.5"
          disabled={saving}
          onClick={saveCurrentOrder}
        >
          {saveLabel}
        </PrimaryButton>
      </div>

      <div className="mt-4 xl:hidden">
        <details className="group overflow-hidden rounded-[20px] border border-[var(--line)] bg-white shadow-[var(--shadow-sm)]">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 text-[13px] font-semibold [&::-webkit-details-marker]:hidden">
            <span>{t("orders.summaryTitle")}</span>
            <span className="flex items-center gap-1 text-[11px] font-medium text-[var(--muted)]">
              {t("orders.summaryCount", { count: currentItems.length })}
              <span className="text-[var(--muted-2)] transition group-open:rotate-180">
                ▾
              </span>
            </span>
          </summary>
          <div className="border-t border-[var(--line)] p-2">
            <OrderSummary
              items={currentItems}
              ingredients={ingredients}
              date={date}
              buyerId={selectedBuyerId}
              buyers={sortedBuyers}
              onDateChange={setDate}
              onBuyerChange={selectBuyer}
              onAdjust={adjustQuantity}
              onRemove={removeQuantity}
              saveLabel={saveLabel}
              saving={saving}
              onSave={saveCurrentOrder}
            />
          </div>
        </details>
      </div>

      </div>

      <aside className="hidden xl:sticky xl:top-[80px] xl:block">
        <OrderSummary
          items={currentItems}
          ingredients={ingredients}
          date={date}
          buyerId={selectedBuyerId}
          buyers={sortedBuyers}
          onDateChange={setDate}
          onBuyerChange={selectBuyer}
          onAdjust={adjustQuantity}
          onRemove={removeQuantity}
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
  date,
  buyerId,
  buyers,
  onDateChange,
  onBuyerChange,
  onAdjust,
  onRemove,
  saveLabel,
  saving,
  onSave,
}: {
  items: { ingredientId: string; quantity: number }[];
  ingredients: Ingredient[];
  date: string;
  buyerId: string;
  buyers: Buyer[];
  onDateChange: (value: string) => void;
  onBuyerChange: (id: string) => void;
  onAdjust: (id: string, delta: number) => void;
  onRemove: (id: string) => void;
  saveLabel: string;
  saving: boolean;
  onSave: () => void;
}) {
  const { t } = useTranslation();
  const ingredientMap = useMemo(
    () => new Map(ingredients.map((item) => [item.id, item])),
    [ingredients],
  );
  const rows = items.flatMap((item) => {
    const ingredient = ingredientMap.get(item.ingredientId);
    return ingredient ? [{ ingredient, quantity: item.quantity }] : [];
  });
  const totalQty = items.reduce((sum, item) => sum + item.quantity, 0);
  const totalLabel = Number.isInteger(totalQty)
    ? String(totalQty)
    : totalQty.toFixed(2).replace(/\.?0+$/, "");

  return (
    <div className="rounded-[20px] bg-[var(--dark)] p-4 text-white shadow-[0_24px_48px_-28px_rgba(23,23,23,0.65)]">
      <div className="mb-4 flex items-center justify-between gap-2">
        <p className="text-[13px] font-bold">{t("orders.summaryTitle")}</p>
        <span className="rounded-[6px] bg-white/10 px-2 py-0.5 text-[9.5px] font-medium text-white/60">
          {t("orders.summaryCount", { count: items.length })}
        </span>
      </div>

      <div className="summary-field space-y-2.5">
        <label className="block">
          <span className="mb-1 block text-[10px] font-medium text-white/45">
            {t("orders.buyer")}
          </span>
          <select
            value={buyerId}
            onChange={(event) => onBuyerChange(event.target.value)}
            className="w-full rounded-[9px] border border-white/15 bg-white/[0.06] px-2.5 py-2 text-xs text-white outline-none"
          >
            {buyers.map((buyer) => (
              <option key={buyer.id} value={buyer.id} className="text-[var(--ink)]">
                {buyer.code || buyer.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-[10px] font-medium text-white/45">
            {t("orders.date")}
          </span>
          <input
            type="date"
            value={date}
            onChange={(event) => onDateChange(event.target.value)}
            className="w-full rounded-[9px] border border-white/15 bg-white/[0.06] px-2.5 py-2 text-xs text-white outline-none"
          />
        </label>
      </div>

      <div className="my-3.5 h-px bg-white/10" />

      <div className="flex items-center justify-between text-[10px] font-medium text-white/45">
        <span>{t("orders.summaryItems")}</span>
        <span>{t("orders.summaryCount", { count: items.length })}</span>
      </div>

      {rows.length === 0 ? (
        <p className="px-2 py-6 text-center text-[11px] leading-relaxed text-white/35">
          {t("orders.summaryEmpty")}
        </p>
      ) : (
        <ul className="mt-1 max-h-[min(38vh,300px)] space-y-0.5 overflow-y-auto pr-0.5">
          {rows.map(({ ingredient, quantity }) => (
            <li
              key={ingredient.id}
              className="group flex items-center gap-2 rounded-[8px] px-1.5 py-1.5 transition hover:bg-white/[0.06]"
            >
              <span className="min-w-0 flex-1 truncate text-[11.5px] text-white/80">
                {ingredient.nameEn || ingredient.name}
              </span>
              <span className="shrink-0 text-[9.5px] text-white/30">
                {ingredient.unit}
              </span>
              <div className="flex shrink-0 items-center overflow-hidden rounded-[7px] border border-white/15 bg-white/[0.04]">
                <button
                  type="button"
                  onClick={() => onAdjust(ingredient.id, -1)}
                  aria-label={t("orders.decrease")}
                  className="grid h-6 w-6 place-items-center text-[12px] text-white/60 transition hover:bg-white/10 hover:text-white"
                >
                  −
                </button>
                <span className="w-6 text-center text-[11px] font-semibold tabular-nums">
                  {quantity}
                </span>
                <button
                  type="button"
                  onClick={() => onAdjust(ingredient.id, 1)}
                  aria-label={t("orders.increase")}
                  className="grid h-6 w-6 place-items-center text-[12px] text-white/60 transition hover:bg-white/10 hover:text-white"
                >
                  +
                </button>
              </div>
              <button
                type="button"
                onClick={() => onRemove(ingredient.id)}
                aria-label={t("orders.remove")}
                title={t("orders.remove")}
                className="grid h-5 w-5 shrink-0 place-items-center rounded-full text-[12px] text-white/25 opacity-100 transition hover:bg-white/10 hover:text-white sm:opacity-0 sm:group-hover:opacity-100"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-3 flex items-end justify-between border-t border-white/10 pt-3">
        <span className="text-[10px] text-white/45">
          {t("orders.summaryTotalQty")}
        </span>
        <span className="text-[28px] font-bold leading-none tracking-tight tabular-nums">
          {totalLabel}
          <span className="ml-1 text-[10px] font-medium text-white/40">
            {t("orders.qtyUnit")}
          </span>
        </span>
      </div>

      <PrimaryButton
        className="mt-4 w-full py-2.5"
        disabled={saving}
        onClick={onSave}
      >
        {saveLabel}
      </PrimaryButton>
      <p className="mt-2 text-center text-[9.5px] leading-relaxed text-white/30">
        {t("orders.summaryEditHint")}
      </p>
    </div>
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
    <ul className="divide-y divide-[var(--line)]">
      {items.map((item) => {
        const previousQty = lastQty.get(item.id);
        const meta = [
          item.name && item.nameEn && item.name !== item.nameEn ? item.name : "",
          item.code,
          item.remark,
        ]
          .filter(Boolean)
          .join(" · ");
        return (
          <li
            key={item.id}
            className="grid grid-cols-[40px_minmax(0,1fr)_auto] items-center gap-3 py-2.5 sm:grid-cols-[40px_minmax(0,1fr)_44px_92px]"
          >
            <Thumb
              size={40}
              src={
                item.hasImage
                  ? ingredientThumbUrl(item.id, item.imageRev)
                  : undefined
              }
              alt={item.nameEn || item.name}
            />
            <div className="min-w-0">
              <p className="truncate text-[13px] font-medium">
                {item.nameEn || item.name}
              </p>
              <p className="mt-0.5 truncate text-[10.5px] text-[var(--muted)]">
                {meta || "—"}
              </p>
              {previousQty != null && (
                <button
                  type="button"
                  className="mt-0.5 text-[10.5px] font-semibold text-[var(--brand)]"
                  onClick={() => onFill(item.id, previousQty)}
                >
                  {t("orders.lastQty", { qty: previousQty })} ·{" "}
                  {t("orders.fillThis")}
                </button>
              )}
            </div>
            <span className="hidden text-center text-[10.5px] text-[var(--muted-2)] sm:block">
              {item.unit || "—"}
            </span>
            <TextInput
              type="number"
              min="0"
              inputMode="decimal"
              className="w-20 shrink-0 text-center sm:w-full"
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

function HistoryIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      className="shrink-0"
    >
      <path
        d="M3.5 12a8.5 8.5 0 1 0 2.6-6.1"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="M3.5 4.5V10H9M12 7.5V12l3 2"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      className="shrink-0"
    >
      <path
        d="M12 5v14M5 12h14"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}
