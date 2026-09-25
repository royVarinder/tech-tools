export const DPI = 300;

export function mmToPx(mm: number): number {
  return Math.round((mm / 25.4) * DPI);
}

export function inToPx(inches: number): number {
  return Math.round(inches * DPI);
}

export function canvasToJpgBlob(canvas: HTMLCanvasElement, quality = 0.92): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Canvas export failed"))),
      "image/jpeg",
      quality
    );
  });
}

/**
 * Binary-searches JPEG quality so the exported blob lands at or under `targetBytes`.
 * Falls back to the lowest-quality attempt if even that can't fit the target.
 */
export async function compressToTargetBytes(canvas: HTMLCanvasElement, targetBytes: number): Promise<Blob> {
  let lo = 0.05;
  let hi = 1;
  let best: Blob | null = null;
  let smallest: Blob | null = null;

  for (let i = 0; i < 8; i++) {
    const mid = (lo + hi) / 2;
    const blob = await canvasToJpgBlob(canvas, mid);
    if (!smallest || blob.size < smallest.size) smallest = blob;

    if (blob.size <= targetBytes) {
      best = blob;
      lo = mid;
    } else {
      hi = mid;
    }
  }

  return best ?? smallest ?? canvasToJpgBlob(canvas, 0.05);
}

/** Draws `image` centered inside a boxW x boxH box, scaled to fit without cropping, on a white background. */
export function drawContain(
  image: CanvasImageSource & { naturalWidth?: number; naturalHeight?: number; width?: number; height?: number },
  boxW: number,
  boxH: number
): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = boxW;
  canvas.height = boxH;
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, boxW, boxH);

  const srcW = image.naturalWidth ?? image.width ?? boxW;
  const srcH = image.naturalHeight ?? image.height ?? boxH;
  const scale = Math.min(boxW / srcW, boxH / srcH);
  const w = srcW * scale;
  const h = srcH * scale;
  ctx.drawImage(image, (boxW - w) / 2, (boxH - h) / 2, w, h);

  return canvas;
}

export interface TileSheetOptions {
  sheetWidthPx: number;
  sheetHeightPx: number;
  itemWidthPx: number;
  itemHeightPx: number;
  gutterPx?: number;
  marginPx?: number;
}

/** Tiles a repeated image across a print sheet, centered, with dashed cut guides around each copy. */
export function tileOnSheet(source: CanvasImageSource, options: TileSheetOptions): HTMLCanvasElement {
  const { sheetWidthPx, sheetHeightPx, itemWidthPx, itemHeightPx, gutterPx = 20, marginPx = 30 } = options;

  const canvas = document.createElement("canvas");
  canvas.width = sheetWidthPx;
  canvas.height = sheetHeightPx;
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, sheetWidthPx, sheetHeightPx);

  const cols = Math.max(1, Math.floor((sheetWidthPx - marginPx * 2 + gutterPx) / (itemWidthPx + gutterPx)));
  const rows = Math.max(1, Math.floor((sheetHeightPx - marginPx * 2 + gutterPx) / (itemHeightPx + gutterPx)));

  const gridWidth = cols * itemWidthPx + (cols - 1) * gutterPx;
  const gridHeight = rows * itemHeightPx + (rows - 1) * gutterPx;
  const offsetX = (sheetWidthPx - gridWidth) / 2;
  const offsetY = (sheetHeightPx - gridHeight) / 2;

  ctx.strokeStyle = "#b0b0b0";
  ctx.lineWidth = 1;
  ctx.setLineDash([6, 4]);

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = offsetX + c * (itemWidthPx + gutterPx);
      const y = offsetY + r * (itemHeightPx + gutterPx);
      ctx.drawImage(source, x, y, itemWidthPx, itemHeightPx);
      ctx.strokeRect(x, y, itemWidthPx, itemHeightPx);
    }
  }

  return canvas;
}
