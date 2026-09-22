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
  TextInput,
  Thumb,
} from "../components/ui";
import { useAppStore } from "../store/useAppStore";
import { groupLabel, ingredientMatches, todayIso } from "../utils/format";
import type { Ingredient, Order } from "../types";

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
  const upsertOrder = useAppStore((s) => s.upsertOrder);
  const flash = useAppStore((s) => s.flash);
  const [date, setDate] = useState(todayIso());
  const [buyerId, setBuyerId] = useState(buyers[0]?.id ?? "");
  const [qty, setQty] = useState<Record<string, string>>({});
  const [keyword, setKeyword] = useState("");
  const [groupId, setGroupId] = useState("all");
  const [scope, setScope] = useState<"all" | "previous">("all");

  const selectedBuyerId = buyers.some((buyer) => buyer.id === buyerId)
    ? buyerId
    : (buyers[0]?.id ?? "");

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
      if (needle && !ingredientMatches(item, needle)) return false;
      return true;
    });
  }, [ingredients, groupId, scope, keyword, lastQty]);

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
        <Field label={t("orders.search")}>
          <TextInput
            value={keyword}
            placeholder={t("orders.searchPlaceholder")}
            onChange={(e) => setKeyword(e.target.value)}
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
            scope === "previous" && !previous
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
            }).then(() => flash({ type: "ok", message: t("orders.saved") }));
          }}
        >
          {t("common.save")}
        </PrimaryButton>
      </div>
    </div>
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
