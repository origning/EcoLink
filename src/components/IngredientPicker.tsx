import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { ingredientThumbUrl } from "../api/db";
import { GhostButton, PrimaryButton, SearchInput, Sheet, Thumb } from "./ui";
import { useAppStore } from "../store/useAppStore";
import { groupLabel, ingredientMatches } from "../utils/format";
import type { Ingredient } from "../types";

const bySort = (a: { sort: number; name: string }, b: { sort: number; name: string }) =>
  a.sort - b.sort || a.name.localeCompare(b.name, "zh");

/** 选食材子界面：搜索 + 分组筛选 + 勾选，和订单录入的选食材流程一致。 */
export function IngredientPicker({
  title,
  initialIds,
  excludeIds,
  onSave,
  onClose,
}: {
  title: string;
  initialIds: string[];
  /** 已在列表里的食材不再显示，用于「只添加新食材」。 */
  excludeIds?: string[];
  onSave: (ids: string[]) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const groups = useAppStore((s) => s.groups);
  const ingredients = useAppStore((s) => s.ingredients);
  const [selected, setSelected] = useState<string[]>(initialIds);
  const [keyword, setKeyword] = useState("");
  const [groupId, setGroupId] = useState("all");

  const groupIds = useMemo(() => new Set(groups.map((group) => group.id)), [groups]);
  const tops = useMemo(
    () =>
      groups
        .filter((group) => !group.parentId || !groupIds.has(group.parentId))
        .sort(bySort),
    [groups, groupIds],
  );
  const childrenOf = (id: string) =>
    groups.filter((group) => group.parentId === id).sort(bySort);

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

  const excluded = useMemo(
    () => new Set(excludeIds ?? []),
    [excludeIds],
  );

  const matches = useMemo(() => {
    const needle = keyword.trim().toLowerCase();
    return ingredients.filter((item) => {
      if (excluded.has(item.id)) return false;
      if (activeGroupIds && !activeGroupIds.has(item.groupId)) return false;
      if (needle && !ingredientMatches(item, needle)) return false;
      return true;
    });
  }, [ingredients, excluded, activeGroupIds, keyword]);

  const sections = useMemo(() => {
    const result: { id: string; label: string; items: Ingredient[] }[] = [];
    const sortItems = (items: Ingredient[]) =>
      [...items].sort(
        (a, b) =>
          a.code.localeCompare(b.code, "zh") ||
          a.nameEn.localeCompare(b.nameEn, "zh") ||
          a.name.localeCompare(b.name, "zh"),
      );
    const pick = (id: string) =>
      sortItems(matches.filter((item) => item.groupId === id));
    for (const top of tops) {
      const direct = pick(top.id);
      if (direct.length > 0) {
        result.push({ id: top.id, label: groupLabel(top, t), items: direct });
      }
      for (const child of childrenOf(top.id)) {
        const items = pick(child.id);
        if (items.length > 0) {
          result.push({
            id: child.id,
            label: `${groupLabel(top, t)} / ${groupLabel(child, t)}`,
            items,
          });
        }
      }
    }
    return result;
  }, [groups, tops, matches, t]);

  const selectedSet = new Set(selected);
  const toggle = (id: string) =>
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );

  return (
    <Sheet title={title} onClose={onClose}>
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm text-[var(--muted)]">
            {t("buyers.commonCount", { count: selected.length })}
          </span>
          <GhostButton disabled={selected.length === 0} onClick={() => setSelected([])}>
            {t("common.clear")}
          </GhostButton>
        </div>
        <SearchInput
          value={keyword}
          onValueChange={setKeyword}
          placeholder={t("orders.searchPlaceholder")}
          clearLabel={t("common.clear")}
        />
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

        {sections.length === 0 ? (
          <p className="py-6 text-center text-sm text-[var(--muted)]">
            {t("orders.noMatch")}
          </p>
        ) : (
          <div className="space-y-3">
            {sections.map((section) => (
              <div key={section.id}>
                <p className="mb-1 text-xs font-semibold text-[var(--brand)]">
                  {section.label}
                </p>
                <ul className="space-y-1">
                  {section.items.map((item) => {
                    const on = selectedSet.has(item.id);
                    return (
                      <li key={item.id}>
                        <button
                          type="button"
                          onClick={() => toggle(item.id)}
                          className={`flex w-full items-center gap-3 rounded-2xl px-2 py-2 text-left ${
                            on ? "bg-[var(--brand-soft)]" : "bg-[var(--bg)]"
                          }`}
                        >
                          <Thumb
                            src={
                              item.hasImage
                                ? ingredientThumbUrl(item.id, item.imageRev)
                                : undefined
                            }
                            alt={item.nameEn || item.name}
                          />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate font-medium">
                              {item.nameEn || item.name}
                            </span>
                            <span className="block truncate text-xs text-[var(--muted)]">
                              {[item.code, item.name]
                                .filter(Boolean)
                                .join(" · ")}
                            </span>
                          </span>
                          <span
                            className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${
                              on
                                ? "bg-[var(--brand)] text-white"
                                : "text-[var(--muted)]"
                            }`}
                          >
                            {on ? "✓" : "+"}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        )}

        <div className="flex justify-end gap-2 border-t border-[var(--line)] pt-3">
          <GhostButton onClick={onClose}>{t("common.cancel")}</GhostButton>
          <PrimaryButton onClick={() => onSave(selected)}>
            {t("common.confirm")}
          </PrimaryButton>
        </div>
      </div>
    </Sheet>
  );
}
