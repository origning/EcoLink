import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Card,
  EmptyState,
  Field,
  GhostButton,
  PageTitle,
  PrimaryButton,
  Sheet,
  TextInput,
} from "../components/ui";
import { IngredientPicker } from "../components/IngredientPicker";
import { useAppStore } from "../store/useAppStore";
import type { Buyer } from "../types";

type BuyerInput = {
  id?: string;
  name: string;
  code: string;
  address: string;
  phone: string;
  logistics: string;
  commonIngredientIds: string[];
};

export function BuyersPage() {
  const { t } = useTranslation();
  const buyers = useAppStore((s) => s.buyers);
  const orders = useAppStore((s) => s.orders);
  const addBuyer = useAppStore((s) => s.addBuyer);
  const updateBuyer = useAppStore((s) => s.updateBuyer);
  const deleteBuyer = useAppStore((s) => s.deleteBuyer);
  const flash = useAppStore((s) => s.flash);
  const [editing, setEditing] = useState<Buyer | "new" | null>(null);

  return (
    <div>
      <PageTitle
        title={t("buyers.title")}
        action={<PrimaryButton onClick={() => setEditing("new")}>{t("buyers.add")}</PrimaryButton>}
      />
      {buyers.length === 0 ? (
        <EmptyState text={t("buyers.empty")} />
      ) : (
        <div className="space-y-2 lg:grid lg:grid-cols-2 lg:gap-3 lg:space-y-0 xl:grid-cols-3">
          {[...buyers]
            .sort((a, b) => a.sort - b.sort)
            .map((buyer) => (
              <Card key={buyer.id} className="flex items-center justify-between gap-3">
                <button
                  type="button"
                  className="min-w-0 flex-1 text-left"
                  onClick={() => setEditing(buyer)}
                >
                  <span className="block truncate font-medium">
                    {buyer.code && (
                      <span className="mr-1 rounded-md bg-[var(--brand-soft)] px-1.5 py-0.5 text-xs font-semibold text-[var(--brand)]">
                        {buyer.code}
                      </span>
                    )}
                    {buyer.name}
                  </span>
                  {(buyer.address || buyer.phone || buyer.logistics) && (
                    <span className="block truncate text-xs text-[var(--muted)]">
                      {[buyer.address, buyer.phone, buyer.logistics]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  )}
                </button>
                <GhostButton
                  danger
                  onClick={() => {
                    const used = orders.some((order) => order.buyerId === buyer.id);
                    if (used && !window.confirm(t("buyers.deleteConfirm"))) return;
                    void deleteBuyer(buyer.id).then(() =>
                      flash({ type: "ok", message: t("common.deleted") }),
                    );
                  }}
                >
                  {t("common.delete")}
                </GhostButton>
              </Card>
            ))}
        </div>
      )}

      {editing && (
        <BuyerSheet
          initial={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSave={async (payload) => {
            const input = {
              name: payload.name,
              code: payload.code,
              address: payload.address,
              phone: payload.phone,
              logistics: payload.logistics,
              commonIngredientIds: payload.commonIngredientIds,
            };
            try {
              if (payload.id) await updateBuyer(payload.id, input);
              else await addBuyer(input);
              flash({ type: "ok", message: t("common.saved") });
              setEditing(null);
            } catch (error) {
              flash({
                type: "error",
                message:
                  error instanceof Error && error.message === "code-taken"
                    ? t("buyers.codeTaken")
                    : String(error),
              });
            }
          }}
        />
      )}
    </div>
  );
}

function BuyerSheet({
  initial,
  onClose,
  onSave,
}: {
  initial: Buyer | null;
  onClose: () => void;
  onSave: (input: BuyerInput) => Promise<void>;
}) {
  const { t } = useTranslation();
  const flash = useAppStore((s) => s.flash);
  const [name, setName] = useState(initial?.name ?? "");
  const [code, setCode] = useState(initial?.code ?? "");
  const [address, setAddress] = useState(initial?.address ?? "");
  const [phone, setPhone] = useState(initial?.phone ?? "");
  const [logistics, setLogistics] = useState(initial?.logistics ?? "");
  const [commonIngredientIds, setCommonIngredientIds] = useState<string[]>(
    initial?.commonIngredientIds ?? [],
  );
  const [pickerOpen, setPickerOpen] = useState(false);

  return (
    <Sheet title={initial ? t("buyers.edit") : t("buyers.add")} onClose={onClose}>
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          if (!name.trim()) {
            flash({ type: "error", message: t("buyers.needName") });
            return;
          }
          void onSave({
            id: initial?.id,
            name: name.trim(),
            code: code.trim(),
            address: address.trim(),
            phone: phone.trim(),
            logistics: logistics.trim(),
            commonIngredientIds,
          });
        }}
      >
        <Field label={t("buyers.name")}>
          <TextInput value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        </Field>
        <Field label={t("buyers.code")} hint={t("common.optional")}>
          <TextInput value={code} onChange={(e) => setCode(e.target.value)} />
        </Field>
        <Field label={t("buyers.address")} hint={t("common.optional")}>
          <TextInput value={address} onChange={(e) => setAddress(e.target.value)} />
        </Field>
        <Field label={t("buyers.phone")} hint={t("common.optional")}>
          <TextInput value={phone} onChange={(e) => setPhone(e.target.value)} />
        </Field>
        <Field label={t("buyers.logistics")} hint={t("common.optional")}>
          <TextInput value={logistics} onChange={(e) => setLogistics(e.target.value)} />
        </Field>
        <div className="space-y-1.5">
          <span className="text-sm font-medium text-[var(--muted)]">
            {t("buyers.commonLibrary")}
          </span>
          <div className="flex items-center gap-2">
            <PrimaryButton type="button" onClick={() => setPickerOpen(true)}>
              {commonIngredientIds.length > 0
                ? t("buyers.commonLibraryEdit")
                : t("buyers.commonLibraryAdd")}
            </PrimaryButton>
            <span className="text-sm text-[var(--muted)]">
              {t("buyers.commonCount", { count: commonIngredientIds.length })}
            </span>
          </div>
          <p className="text-xs text-[var(--muted)] opacity-70">
            {t("buyers.commonLibraryHint")}
          </p>
        </div>
        <div className="flex justify-end gap-2">
          <GhostButton onClick={onClose}>{t("common.cancel")}</GhostButton>
          <PrimaryButton type="submit">{t("common.save")}</PrimaryButton>
        </div>
      </form>

      {pickerOpen && (
        <IngredientPicker
          title={t("buyers.commonLibrary")}
          initialIds={commonIngredientIds}
          onSave={(ids) => {
            setCommonIngredientIds(ids);
            setPickerOpen(false);
          }}
          onClose={() => setPickerOpen(false)}
        />
      )}
    </Sheet>
  );
}
