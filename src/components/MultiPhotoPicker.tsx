import { useState } from "react";
import { blobToBase64, compressPhoto } from "../utils/compressImage";

const MAX_PDF_BYTES = 10 * 1024 * 1024;

export type DraftPhoto = {
  key: string;
  id: string;
  rev: number;
  previewUrl: string;
  previewBase64?: string;
  thumbBase64?: string;
  bytes?: number;
  /** PDF 附件使用文件图标展示，点击后在新窗口打开 */
  isPdf?: boolean;
};

function isPdfFile(file: File) {
  return (
    file.type === "application/pdf" || /\.pdf$/i.test(file.name)
  );
}

async function pdfThumbnail() {
  const canvas = document.createElement("canvas");
  canvas.width = 160;
  canvas.height = 160;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unsupported");
  ctx.fillStyle = "#fef2f2";
  ctx.fillRect(0, 0, 160, 160);
  ctx.fillStyle = "#dc2626";
  ctx.fillRect(34, 22, 92, 116);
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 28px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("PDF", 80, 82);
  return canvas.toDataURL("image/jpeg", 0.8).split(",")[1] ?? "";
}

export function MultiPhotoPicker({
  photos,
  nextId,
  onAdd,
  onRemove,
  onError,
  labels,
  variant = "standard",
}: {
  photos: DraftPhoto[];
  nextId: () => string;
  onAdd: (photo: DraftPhoto) => void;
  onRemove: (key: string) => void;
  onError: (error: Error) => void;
  /** 发票等文字材料使用高清晰度压缩 */
  variant?: "standard" | "document";
  labels: {
    add: string;
    busy: string;
    remove: string;
    hint?: string;
  };
}) {
  const [busy, setBusy] = useState(false);

  const handleFiles = async (files: File[]) => {
    if (files.length === 0) return;
    setBusy(true);
    try {
      for (const file of files) {
        if (isPdfFile(file)) {
          if (file.size > MAX_PDF_BYTES) throw new Error("too-large");
          const baseId = nextId();
          const id = baseId.endsWith("-pdf") ? baseId : `${baseId}-pdf`;
          onAdd({
            key: id,
            id,
            rev: 1,
            previewUrl: URL.createObjectURL(file),
            previewBase64: await blobToBase64(file),
            thumbBase64: await pdfThumbnail(),
            bytes: file.size,
            isPdf: true,
          });
          continue;
        }
        const result = await compressPhoto(
          file,
          variant === "document"
            ? {
                maxEdge: 3000,
                quality: 0.9,
                maxBytes: 1.8 * 1024 * 1024,
                thumbSize: 200,
              }
            : {
                maxEdge: 1600,
                quality: 0.8,
                maxBytes: 600 * 1024,
                thumbSize: 160,
              },
        );
        const id = nextId();
        onAdd({
          key: id,
          id,
          rev: 1,
          previewUrl: URL.createObjectURL(result.preview),
          previewBase64: result.previewBase64,
          thumbBase64: result.thumbBase64,
          bytes: result.bytes,
        });
      }
    } catch (error) {
      onError(error instanceof Error ? error : new Error(String(error)));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {photos.map((photo) => (
          <div
            key={photo.key}
            className="relative h-20 w-20 overflow-hidden rounded-2xl bg-[var(--brand-soft)]"
          >
            {photo.isPdf ? (
              <a
                href={photo.previewUrl}
                target="_blank"
                rel="noreferrer"
                className="flex h-full w-full flex-col items-center justify-center bg-red-50 text-red-700"
                title="PDF"
              >
                <span className="text-xl font-bold leading-none">PDF</span>
              </a>
            ) : (
              <img
                src={photo.previewUrl}
                alt=""
                className="h-full w-full object-cover"
              />
            )}
            <button
              type="button"
              aria-label={labels.remove}
              onClick={() => {
                if (photo.previewUrl.startsWith("blob:")) {
                  URL.revokeObjectURL(photo.previewUrl);
                }
                onRemove(photo.key);
              }}
              className="absolute right-0.5 top-0.5 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-sm leading-none text-white"
            >
              ×
            </button>
          </div>
        ))}
        <label className="flex h-20 w-20 cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-[var(--line)] bg-[var(--bg)] text-center text-[11px] font-medium text-[var(--brand)]">
          <span className="text-xl leading-none">＋</span>
          <span className="mt-1 px-1">{busy ? labels.busy : labels.add}</span>
          <input
            type="file"
            accept="image/*,application/pdf"
            multiple
            className="sr-only"
            disabled={busy}
            onChange={(event) => {
              const files = Array.from(event.target.files ?? []);
              event.target.value = "";
              void handleFiles(files);
            }}
          />
        </label>
      </div>
      {labels.hint ? (
        <p className="text-xs text-[var(--muted)]">{labels.hint}</p>
      ) : null}
    </div>
  );
}
