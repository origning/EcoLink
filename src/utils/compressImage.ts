const DEFAULT_MAX_EDGE = 800;
const DEFAULT_QUALITY = 0.7;
const DEFAULT_MAX_BYTES = 300 * 1024;
const DEFAULT_THUMB_SIZE = 96;

export type CompressedImage = {
  preview: Blob;
  thumb: Blob;
  previewBase64: string;
  thumbBase64: string;
  /** 压缩后的预览图大小（字节） */
  bytes: number;
};

function canvasToJpeg(canvas: HTMLCanvasElement, quality: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("toBlob failed"))),
      "image/jpeg",
      quality,
    );
  });
}

function drawContain(source: ImageBitmap, maxEdge: number) {
  const scale = Math.min(1, maxEdge / Math.max(source.width, source.height));
  const width = Math.max(1, Math.round(source.width * scale));
  const height = Math.max(1, Math.round(source.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unsupported");
  ctx.drawImage(source, 0, 0, width, height);
  return canvas;
}

function drawCenterCrop(source: ImageBitmap, size: number) {
  const side = Math.min(source.width, source.height);
  const sx = (source.width - side) / 2;
  const sy = (source.height - side) / 2;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unsupported");
  ctx.drawImage(source, sx, sy, side, side, 0, 0, size, size);
  return canvas;
}

export function blobToBase64(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result ?? "");
      resolve(result.includes(",") ? (result.split(",")[1] ?? "") : result);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

/**
 * 通用照片压缩：
 * - 食材图：800px / 0.7 / 300KB
 * - 取货、打包照片：1600px / 0.8 / 600KB
 * 如果一次压缩超过目标大小，会自动逐级降低质量。
 */
export async function compressPhoto(
  file: File,
  options: {
    maxEdge?: number;
    quality?: number;
    maxBytes?: number;
    thumbSize?: number;
  } = {},
): Promise<CompressedImage> {
  const maxEdge = options.maxEdge ?? DEFAULT_MAX_EDGE;
  const quality = options.quality ?? DEFAULT_QUALITY;
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;
  const thumbSize = options.thumbSize ?? DEFAULT_THUMB_SIZE;

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    try {
      bitmap = await createImageBitmap(file);
    } catch {
      throw new Error("unsupported");
    }
  }

  try {
    let preview: Blob | null = null;
    const qualities = [quality, 0.72, 0.62, 0.52, 0.42];
    for (const edge of [maxEdge, Math.round(maxEdge * 0.8)]) {
      const canvas = drawContain(bitmap, edge);
      for (const value of qualities) {
        const blob = await canvasToJpeg(canvas, value);
        if (!preview || blob.size < preview.size) preview = blob;
        if (blob.size <= maxBytes) {
          preview = blob;
          break;
        }
      }
      if (preview && preview.size <= maxBytes) break;
    }

    if (!preview || preview.size > maxBytes) throw new Error("too-large");

    const thumb = await canvasToJpeg(drawCenterCrop(bitmap, thumbSize), 0.75);
    return {
      preview,
      thumb,
      previewBase64: await blobToBase64(preview),
      thumbBase64: await blobToBase64(thumb),
      bytes: preview.size,
    };
  } finally {
    bitmap.close();
  }
}

/** 兼容原食材图片调用 */
export async function compressImage(file: File) {
  return compressPhoto(file, {
    maxEdge: DEFAULT_MAX_EDGE,
    quality: DEFAULT_QUALITY,
    maxBytes: DEFAULT_MAX_BYTES,
    thumbSize: DEFAULT_THUMB_SIZE,
  });
}
