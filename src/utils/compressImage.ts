const MAX_PREVIEW_EDGE = 800;
const MAX_FILE_BYTES = 1.5 * 1024 * 1024;

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

export async function compressImage(file: File) {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error("unsupported");
  }
  try {
    const preview = await canvasToJpeg(drawContain(bitmap, MAX_PREVIEW_EDGE), 0.7);
    const thumb = await canvasToJpeg(drawCenterCrop(bitmap, 96), 0.75);
    if (preview.size > MAX_FILE_BYTES) {
      throw new Error("too-large");
    }
    return {
      preview,
      thumb,
      previewBase64: await blobToBase64(preview),
      thumbBase64: await blobToBase64(thumb),
    };
  } finally {
    bitmap.close();
  }
}
