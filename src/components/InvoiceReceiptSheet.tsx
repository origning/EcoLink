import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  MultiPhotoPicker,
  type DraftPhoto,
} from "./MultiPhotoPicker";
import { Field, GhostButton, PrimaryButton, Sheet, TextInput } from "./ui";
import { todayIso } from "../utils/format";
import { invoiceOutstanding, invoicePaidAmount } from "../utils/payments";
import type { InvoiceRecord } from "../types";
export function InvoiceReceiptSheet({
  invoice,
  onClose,
  onAdd,
  onVoid,
}: {
  invoice: InvoiceRecord;
  onClose: () => void;
  onAdd: (input: {
    date: string;
    amount: number;
    method: string;
    note: string;
    proofPhotos: {
      id: string;
      rev: number;
      preview?: string;
      thumb?: string;
    }[];
  }) => Promise<void>;
  onVoid: (paymentId: string) => Promise<void>;
}) {
  const { t } = useTranslation();
  const paid = invoicePaidAmount(invoice);
  const outstanding = invoiceOutstanding(invoice);
  const [date, setDate] = useState(todayIso());
  const [amount, setAmount] = useState(
    outstanding > 0 ? String(outstanding) : "",
  );
  const [method, setMethod] = useState("bank");
  const [note, setNote] = useState("");
  const [proofPhotos, setProofPhotos] = useState<DraftPhoto[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <Sheet title={t("packing.receiptTitle")} onClose={onClose}>
      <div className="space-y-4">
        <div className="rounded-2xl bg-[var(--bg)] p-3 text-sm">
          <p className="font-medium">
            {invoice.invoiceNo} · {invoice.buyerName}
          </p>
          <p className="mt-1 text-xs text-[var(--muted)]">
            {t("packing.invoiceAmount")} {invoice.snapshot.total.toLocaleString()}{" "}
            · {t("packing.received")} {paid.toLocaleString()} ·{" "}
            {t("packing.unreceived")} {outstanding.toLocaleString()}
          </p>
        </div>

        {invoice.payments.length > 0 ? (
          <ul className="space-y-2">
            {invoice.payments.map((payment) => (
              <li
                key={payment.id}
                className={`flex items-center justify-between gap-2 rounded-2xl bg-[var(--bg)] px-3 py-2 text-sm ${
                  payment.voidedAt ? "opacity-60" : ""
                }`}
              >
                <div className="min-w-0">
                  <p
                    className={`font-medium ${
                      payment.voidedAt ? "line-through" : ""
                    }`}
                  >
                    {payment.date} · {payment.amount.toLocaleString()}
                    {payment.voidedAt ? (
                      <span className="ml-2 text-[10px] text-red-600">
                        {t("pickups.paymentVoided")}
                      </span>
                    ) : null}
                  </p>
                  <p className="truncate text-xs text-[var(--muted)]">
                    {[payment.method, payment.note].filter(Boolean).join(" · ")}
                  </p>
                </div>
                {!payment.voidedAt ? (
                  <GhostButton
                    danger
                    onClick={() => {
                      if (!window.confirm(t("packing.voidReceiptConfirm"))) {
                        return;
                      }
                      void onVoid(payment.id).catch((err) =>
                        setError(String(err)),
                      );
                    }}
                  >
                    {t("pickups.voidPayment")}
                  </GhostButton>
                ) : null}
              </li>
            ))}
          </ul>
        ) : null}

        {outstanding > 0 ? (
          <form
            className="space-y-3 border-t border-[var(--line)] pt-4"
            onSubmit={(event) => {
              event.preventDefault();
              const value = Number(amount);
              if (!Number.isFinite(value) || value <= 0) {
                setError(t("pickups.needPaymentAmount"));
                return;
              }
              if (value > outstanding + 0.0001) {
                setError(t("pickups.paymentOverAmount"));
                return;
              }
              setError(null);
              setBusy(true);
              void onAdd({
                date,
                amount: value,
                method,
                note,
                proofPhotos: proofPhotos.map((photo) => ({
                  id: photo.id,
                  rev: photo.rev,
                  preview: photo.previewBase64,
                  thumb: photo.thumbBase64,
                })),
              }).finally(() => setBusy(false));
            }}
          >
            <p className="text-sm font-medium text-[var(--muted)]">
              {t("packing.receivePayment")}
            </p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label={t("pickups.paymentDate")}>
                <TextInput
                  type="date"
                  value={date}
                  onChange={(event) => setDate(event.target.value)}
                />
              </Field>
              <Field label={t("packing.receiptAmount")}>
                <TextInput
                  type="number"
                  min="0"
                  step="0.01"
                  inputMode="decimal"
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                />
              </Field>
            </div>
            <Field label={t("pickups.paymentMethod")}>
              <select
                value={method}
                onChange={(event) => setMethod(event.target.value)}
                className="min-h-11 w-full rounded-2xl border border-[var(--line)] bg-[var(--bg)] px-3 py-2.5 text-base"
              >
                <option value="bank">{t("pickups.paymentBank")}</option>
                <option value="cash">{t("pickups.paymentCash")}</option>
                <option value="other">{t("pickups.paymentOther")}</option>
              </select>
            </Field>
            <Field label={t("pickups.paymentNote")} hint={t("common.optional")}>
              <TextInput
                value={note}
                onChange={(event) => setNote(event.target.value)}
              />
            </Field>
            <Field label={t("pickups.paymentProof")} hint={t("common.optional")}>
              <MultiPhotoPicker
                photos={proofPhotos}
                nextId={() => `${invoice.id}-receipt-${crypto.randomUUID()}`}
                onAdd={(photo) => setProofPhotos((prev) => [...prev, photo])}
                onRemove={(key) =>
                  setProofPhotos((prev) =>
                    prev.filter((photo) => photo.key !== key),
                  )
                }
                onError={(photoError) =>
                  setError(
                    photoError.message === "too-large"
                      ? t("pickups.tooLarge")
                      : t("pickups.unsupported"),
                  )
                }
                labels={{
                  add: t("pickups.addPaymentProof"),
                  busy: t("pickups.compressing"),
                  remove: t("common.delete"),
                  hint: t("pickups.paymentProofHint"),
                }}
              />
            </Field>
            {error ? (
              <p className="text-sm text-[var(--danger)]">{error}</p>
            ) : null}
            <div className="flex justify-end gap-2">
              <GhostButton onClick={onClose}>{t("common.close")}</GhostButton>
              <PrimaryButton type="submit" disabled={busy}>
                {busy ? t("common.saving") : t("packing.saveReceipt")}
              </PrimaryButton>
            </div>
          </form>
        ) : (
          <div className="flex justify-end">
            <GhostButton onClick={onClose}>{t("common.close")}</GhostButton>
          </div>
        )}
      </div>
    </Sheet>
  );
}

