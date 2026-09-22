import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { ingredientThumbUrl } from "../api/db";
import {
  Card,
  EmptyState,
  Field,
  PageTitle,
  PrimaryButton,
  TextInput,
  Thumb,
} from "../components/ui";
import { buildSummary, useAppStore } from "../store/useAppStore";
import { exportSummary } from "../utils/exportSummary";
import { groupLabel, todayIso } from "../utils/format";

export function SummaryPage() {
  const { t } = useTranslation();
  const groups = useAppStore((s) => s.groups);
  const ingredients = useAppStore((s) => s.ingredients);
  const buyers = useAppStore((s) => s.buyers);
  const orders = useAppStore((s) => s.orders);
  const flash = useAppStore((s) => s.flash);
  const locale = useAppStore((s) => s.settings.locale);
  const [mode, setMode] = useState<"single" | "range">("single");
  const [from, setFrom] = useState(todayIso());
  const [to, setTo] = useState(todayIso());
  const [exporting, setExporting] = useState(false);

  const rangeFrom = mode === "single" ? from : from;
  const rangeTo = mode === "single" ? from : to;

  const matrix = useMemo(
    () => buildSummary({ groups, ingredients, buyers, orders }, rangeFrom, rangeTo),
    [groups, ingredients, buyers, orders, rangeFrom, rangeTo],
  );

  const deletedBuyer = (id: string) =>
    buyers.find((buyer) => buyer.id === id)?.name || t("common.deletedItem");

  return (
    <div>
      <PageTitle
        title={t("summary.title")}
        action={
          <PrimaryButton
            disabled={exporting || matrix.sections.length === 0}
            onClick={() => {
              setExporting(true);
              void exportSummary(matrix, {
                sheet: locale === "zh" ? "汇总" : "Summary",
                image: t("summary.image"),
                code: t("summary.code"),
                item: t("summary.item"),
                nameEn: t("summary.nameEn"),
                remark: t("summary.remark"),
                total: t("common.total"),
                groupName: (group) => groupLabel(group, t),
                deleted: t("common.deletedItem"),
              })
                .then(() => flash({ type: "ok", message: t("summary.exported") }))
                .catch((error) =>
                  flash({ type: "error", message: String(error) }),
                )
                .finally(() => setExporting(false));
            }}
          >
            {exporting ? t("summary.exporting") : t("summary.export")}
          </PrimaryButton>
        }
      />

      <Card className="mb-4 space-y-3">
        <div className="flex rounded-full bg-[var(--bg)] p-1">
          {(["single", "range"] as const).map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setMode(item)}
              className={`min-h-10 flex-1 rounded-full py-1.5 text-sm font-medium ${
                mode === item ? "bg-[var(--brand)] text-white" : "text-[var(--muted)]"
              }`}
            >
              {t(`summary.${item}`)}
            </button>
          ))}
        </div>
        {mode === "single" ? (
          <Field label={t("orders.date")}>
            <TextInput type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </Field>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label={t("summary.from")}>
              <TextInput type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </Field>
            <Field label={t("summary.to")}>
              <TextInput type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </Field>
          </div>
        )}
      </Card>

      {matrix.sections.length === 0 ? (
        <EmptyState text={t("summary.empty")} />
      ) : (
        <>
          <div className="space-y-3 md:hidden">
            {matrix.sections.map((section) => (
              <Card key={section.group.id}>
                <p className="mb-3 font-semibold text-[var(--brand)]">
                  {groupLabel(section.group, t)}
                </p>
                <ul className="space-y-4">
                  {section.rows.map((row) => (
                    <li
                      key={row.ingredient.id}
                      className="border-t border-[var(--line)] pt-3 first:border-t-0 first:pt-0"
                    >
                      <div className="mb-2 flex items-center gap-2">
                        <Thumb
                          src={
                            row.ingredient.hasImage
                              ? ingredientThumbUrl(
                                  row.ingredient.id,
                                  row.ingredient.imageRev,
                                )
                              : undefined
                          }
                          alt={row.ingredient.nameEn || row.ingredient.name}
                          size={36}
                        />
                        <div className="min-w-0">
                          <p className="font-medium">
                            {row.ingredient.nameEn ||
                              row.ingredient.name ||
                              t("common.deletedItem")}
                          </p>
                          {row.ingredient.name && row.ingredient.nameEn && (
                            <p className="truncate text-xs text-[var(--ink)]">
                              {row.ingredient.name}
                            </p>
                          )}
                          <p className="truncate text-xs text-[var(--muted)]">
                            {[row.ingredient.code, row.ingredient.remark]
                              .filter(Boolean)
                              .join(" · ")}
                          </p>
                        </div>
                      </div>
                      <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
                        {matrix.buyers.map((buyer) => (
                          <div
                            key={buyer.id}
                            className="flex items-baseline justify-between gap-2"
                          >
                            <dt className="truncate text-[var(--muted)]">
                              {buyer.name || t("common.deletedItem")}
                            </dt>
                            <dd className="font-medium">
                              {row.quantities[buyer.id] || "—"}
                            </dd>
                          </div>
                        ))}
                        <div className="col-span-2 flex items-baseline justify-between gap-2 border-t border-[var(--line)] pt-1 font-semibold">
                          <dt>{t("common.total")}</dt>
                          <dd>{row.total}</dd>
                        </div>
                      </dl>
                    </li>
                  ))}
                </ul>
              </Card>
            ))}
          </div>
          <div className="hidden overflow-x-auto rounded-3xl bg-white ring-1 ring-[var(--line)] md:block">
            <table className="min-w-full border-collapse text-sm">
            <thead>
              <tr className="bg-[var(--brand)] text-white">
                <th className="sticky left-0 z-10 bg-[var(--brand)] px-3 py-2 text-left font-semibold">
                  {t("summary.nameEn")}
                </th>
                {matrix.buyers.map((buyer) => (
                  <th key={buyer.id} className="px-3 py-2 font-semibold">
                    {buyer.name || deletedBuyer(buyer.id)}
                  </th>
                ))}
                <th className="px-3 py-2 font-semibold">{t("common.total")}</th>
              </tr>
            </thead>
            <tbody>
              {matrix.sections.map((section) => (
                <SectionRows
                  key={section.group.id}
                  title={groupLabel(section.group, t)}
                  colSpan={matrix.buyers.length + 2}
                  rows={section.rows}
                  buyers={matrix.buyers}
                  deletedLabel={t("common.deletedItem")}
                />
              ))}
            </tbody>
          </table>
          </div>
        </>
      )}
    </div>
  );
}

function SectionRows({
  title,
  colSpan,
  rows,
  buyers,
  deletedLabel,
}: {
  title: string;
  colSpan: number;
  rows: ReturnType<typeof buildSummary>["sections"][number]["rows"];
  buyers: ReturnType<typeof buildSummary>["buyers"];
  deletedLabel: string;
}) {
  return (
    <>
      <tr>
        <td
          colSpan={colSpan}
          className="bg-[var(--brand-soft)] px-3 py-2 font-semibold text-[var(--brand)]"
        >
          {title}
        </td>
      </tr>
      {rows.map((row) => (
        <tr key={row.ingredient.id} className="border-t border-[var(--line)]">
          <td className="sticky left-0 bg-white px-3 py-2">
            <div className="flex items-center gap-2">
              <Thumb
                src={
                  row.ingredient.hasImage
                    ? ingredientThumbUrl(row.ingredient.id, row.ingredient.imageRev)
                    : undefined
                }
                alt={row.ingredient.nameEn || row.ingredient.name}
                size={36}
              />
              <div className="min-w-0">
                <p className="font-medium">
                  {row.ingredient.nameEn || row.ingredient.name || deletedLabel}
                </p>
                {row.ingredient.name && row.ingredient.nameEn && (
                  <p className="text-xs text-[var(--ink)]">
                    {row.ingredient.name}
                  </p>
                )}
                <p className="text-xs text-[var(--muted)]">
                  {[row.ingredient.code, row.ingredient.remark]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </div>
            </div>
          </td>
          {buyers.map((buyer) => (
            <td key={buyer.id} className="px-3 py-2 text-center">
              {row.quantities[buyer.id] ? row.quantities[buyer.id] : ""}
            </td>
          ))}
          <td className="px-3 py-2 text-center font-semibold">{row.total}</td>
        </tr>
      ))}
    </>
  );
}
