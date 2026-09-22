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
import { useAppStore } from "../store/useAppStore";
import type { Buyer } from "../types";

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
        <div className="space-y-2">
          {[...buyers]
            .sort((a, b) => a.sort - b.sort)
            .map((buyer) => (
              <Card key={buyer.id} className="flex items-center justify-between gap-3">
                <button
                  type="button"
                  className="flex-1 text-left font-medium"
                  onClick={() => setEditing(buyer)}
                >
                  {buyer.name}
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
          onSave={async (name, id) => {
            if (id) await updateBuyer(id, name);
            else await addBuyer(name);
            flash({ type: "ok", message: t("common.saved") });
            setEditing(null);
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
  onSave: (name: string, id?: string) => Promise<void>;
}) {
  const { t } = useTranslation();
  const flash = useAppStore((s) => s.flash);
  const [name, setName] = useState(initial?.name ?? "");

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
          void onSave(name.trim(), initial?.id);
        }}
      >
        <Field label={t("buyers.name")}>
          <TextInput value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        </Field>
        <div className="flex justify-end gap-2">
          <GhostButton onClick={onClose}>{t("common.cancel")}</GhostButton>
          <PrimaryButton type="submit">{t("common.save")}</PrimaryButton>
        </div>
      </form>
    </Sheet>
  );
}
