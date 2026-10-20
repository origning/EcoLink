import { useState } from "react";
import { compressPhoto } from "../utils/compressImage";

export type DraftPhoto = {
  key: string;
  id: string;
  rev: number;
  previewUrl: string;
  previewBase64?: string;
  thumbBase64?: string;
  bytes?: number;
};

export function MultiPhotoPicker({
  photos,
  nextId,
  onAdd,
  onRemove,
  onError,
  labels,
}: {
  photos: DraftPhoto[];
  nextId: () => string;
  onAdd: (photo: DraftPhoto) => void;
  onRemove: (key: string) => void;
  onError: (error: Error) => void;
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
        const result = await compressPhoto(file, {
          maxEdge: 1600,
          quality: 0.8,
          maxBytes: 600 * 1024,
          thumbSize: 160,
        });
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
            <img
              src={photo.previewUrl}
              alt=""
              className="h-full w-full object-cover"
            />
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
            accept="image/*"
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
