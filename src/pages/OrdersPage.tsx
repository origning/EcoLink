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
  SearchInput,
  Sheet,
  TextInput,
  Thumb,
} from "../components/ui";
import { useAppStore } from "../store/useAppStore";
import { groupLabel, ingredientMatches, todayIso } from "../utils/format";
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
  const saveTemplate = useAppStore((s) => s.saveTemplate);
  const deleteTemplate = useAppStore((s) => s.deleteTemplate);
  const saving = useAppStore((s) => s.saving);
  const flash = useAppStore((s) => s.flash);
  const [date, setDate] = useState(todayIso());
  const [buyerId, setBuyerId] = useState(buyers[0]?.id ?? "");
  const [qty, setQty] = useState<Record<string, string>>({});
  const [keyword, setKeyword] = useState("");
  const [groupId, setGroupId] = useState("all");
  const [scope, setScope] = useState<"all" | "previous">("all");
  const [templateOpen, setTemplateOpen] = useState(false);
  const [activeTemplate, setActiveTemplate] = useState<OrderTemplate | null>(null);

  const selectedBuyerId = buyers.some((buyer) => buyer.id === buyerId)
    ? buyerId
    : (buyers[0]?.id ?? "");

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
    const next: Record<string, string> = {};
    for (const item of existing?.items ?? []) {
      next[item.ingredientId] = String(item.quantity);
    }
    return { ...next, ...qty };
  }, [existing, qty]);

  const matches = useMemo(() => {
    const needle = keyword.trim().toLowerCase();
    return ingredients.filter((item) => {
      if (groupId !== "all" && item.groupId !== groupId) return false;
      if (scope === "previous" && !lastQty.has(item.id)) return false;
      if (activeIds && !activeIds.has(item.id)) return false;
      if (needle && !ingredientMatches(item, needle)) return false;
      return true;
    });
  }, [ingredients, groupId, scope, keyword, lastQty, activeIds]);

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

  const catalogSections = useMemo(
    () =>
      [...groups]
        .sort((a, b) => a.sort - b.sort)
        .map((group) => ({
          group,
          items: matches
            .filter((item) => item.groupId === group.id && !lastQty.has(item.id))
            .sort(
              (a, b) =>
                a.code.localeCompare(b.code, "zh") ||
                a.nameEn.localeCompare(b.nameEn, "zh") ||
                a.name.localeCompare(b.name, "zh"),
            ),
        }))
        .filter((section) => section.items.length > 0),
    [groups, matches, lastQty],
  );

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

  if (buyers.length === 0) return <EmptyState text={t("orders.needBuyer")} />;
  if (ingredients.length === 0) return <EmptyState text={t("orders.needIngredient")} />;

  const noMatch = matches.length === 0;

  return (
    <div>
      <PageTitle title={t("orders.title")} />
      <Card className="mb-4 space-y-3">
        <Field label={t("orders.date")}>
          <TextInput
            type="date"
            value={date}
            onChange={(e) => {
              setDate(e.target.value);
              setQty({});
            }}
          />
        </Field>
        <div>
          <p className="mb-2 text-sm font-medium text-[var(--muted)]">{t("orders.buyer")}</p>
        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-0.5">
            {buyers.map((buyer) => (
              <button
                key={buyer.id}
                type="button"
                onClick={() => {
                  setBuyerId(buyer.id);
                  setQty({});
                  setActiveTemplate(null);
                }}
                className={`min-h-10 shrink-0 rounded-full px-3 py-1.5 text-sm font-medium ${
                  buyer.id === selectedBuyerId
                    ? "bg-[var(--brand)] text-white"
                    : "bg-[var(--bg)] text-[var(--ink)]"
                }`}
              >
                {buyer.name}
              </button>
            ))}
          </div>
        </div>
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
        <ChipRow
          items={[
            { id: "all", label: t("orders.allGroups") },
            ...[...groups]
              .sort((a, b) => a.sort - b.sort)
              .map((group) => ({ id: group.id, label: groupLabel(group, t) })),
          ]}
          value={groupId}
          onChange={setGroupId}
        />
        <ChipRow
          items={[
            { id: "all", label: t("orders.allItems") },
            { id: "previous", label: t("orders.previousOnly") },
          ]}
          value={scope}
          onChange={(id) => setScope(id as "all" | "previous")}
        />
      </Card>

      {noMatch ? (
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
          {catalogSections.map(({ group, items }) => (
            <Card key={group.id}>
              <p className="mb-3 font-semibold">{groupLabel(group, t)}</p>
              <IngredientList
                items={items}
                quantities={quantities}
                lastQty={lastQty}
                onChange={setQuantity}
                onFill={(id, value) => setQuantity(id, String(value))}
              />
            </Card>
          ))}
        </div>
      )}

      <div className="sticky bottom-[calc(4.6rem+env(safe-area-inset-bottom))] -mx-4 mt-4 bg-[var(--bg)] px-4 py-2">
        <PrimaryButton
          className="w-full py-3"
          disabled={saving}
          onClick={() => {
            const items = ingredients
              .map((item) => ({
                ingredientId: item.id,
                quantity: Number(quantities[item.id] || 0),
              }))
              .filter((item) => item.quantity > 0);
            void upsertOrder({
              date,
              buyerId: selectedBuyerId,
              items,
            })
              .then(() => flash({ type: "ok", message: t("orders.saved") }))
              .catch((error) => flash({ type: "error", message: String(error) }));
          }}
        >
          {saving ? t("common.saving") : t("common.save")}
        </PrimaryButton>
      </div>

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
    </div>
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

function ChipRow({
  items,
  value,
  onChange,
}: {
  items: { id: string; label: string }[];
  value: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className="flex gap-2 overflow-x-auto no-scrollbar pb-0.5">
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => onChange(item.id)}
          className={`min-h-10 shrink-0 rounded-full px-3 py-1.5 text-sm font-medium ${
            item.id === value
              ? "bg-[var(--brand)] text-white"
              : "bg-[var(--bg)] text-[var(--ink)]"
          }`}
        >
          {item.label}
        </button>
      ))}
    </div>
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
