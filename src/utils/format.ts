import type { TFunction } from "i18next";
import type { Group, Ingredient } from "../types";

export function todayIso() {
  const now = new Date();
  const offset = now.getTimezoneOffset();
  const local = new Date(now.getTime() - offset * 60_000);
  return local.toISOString().slice(0, 10);
}

export function groupLabel(group: Group | undefined, t: TFunction) {
  if (!group || group.id === "__deleted") return t("common.deletedItem");
  if (group.i18nKey) return t(`groups.${group.i18nKey}`);
  return group.name || t("common.unnamed");
}

export function displayName(name: string, fallback: string) {
  return name.trim() || fallback;
}

export function normalizeIngredient(
  item: Partial<Ingredient> & Pick<Ingredient, "id" | "groupId">,
): Ingredient {
  return {
    id: item.id,
    groupId: item.groupId,
    code: (item.code ?? "").trim(),
    name: (item.name ?? "").trim(),
    nameEn: (item.nameEn ?? "").trim(),
    remark: (item.remark ?? "").trim(),
    hasImage: Boolean(item.hasImage),
    imageRev: item.imageRev ?? 0,
  };
}

export function ingredientMatches(item: Ingredient, keyword: string) {
  const needle = keyword.trim().toLowerCase();
  if (!needle) return true;
  return [item.code, item.name, item.nameEn, item.remark].some((value) =>
    value.toLowerCase().includes(needle),
  );
}
