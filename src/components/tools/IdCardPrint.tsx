"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import FileDropzone from "./FileDropzone";
import { downloadBlob } from "@/lib/download";
import { canvasToJpgBlob, drawContain, inToPx, mmToPx, tileOnSheet } from "@/lib/printSheet";

type SheetSize = "4x6" | "a4";

const CARD_WIDTH_IN = 3.375;
const CARD_HEIGHT_IN = 2.125;

function sheetSizePx(size: SheetSize) {
  return size === "a4" ? { w: mmToPx(210), h: mmToPx(297) } : { w: inToPx(6), h: inToPx(4) };
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

export default function IdCardPrint() {
  const t = useTranslations("common");
  const [frontSrc, setFrontSrc] = useState<string | null>(null);
  const [backSrc, setBackSrc] = useState<string | null>(null);
  const [sheetSize, setSheetSize] = useState<SheetSize>("4x6");
  const [busy, setBusy] = useState(false);

  function readFile(file: File, onLoad: (dataUrl: string) => void) {
    const reader = new FileReader();
    reader.onload = () => onLoad(reader.result as string);
    reader.readAsDataURL(file);
  }

  async function downloadCombinedSheet() {
    if (!frontSrc) return;
    setBusy(true);
    try {
      const cardW = inToPx(CARD_WIDTH_IN);
      const cardH = inToPx(CARD_HEIGHT_IN);
      const { w, h } = sheetSizePx(sheetSize);

      const frontImage = await loadImage(frontSrc);
      const frontCard = drawContain(frontImage, cardW, cardH);

      let combined: HTMLCanvasElement;
      if (backSrc) {
        const backImage = await loadImage(backSrc);
        const backCard = drawContain(backImage, cardW, cardH);

        const halfH = Math.floor(h / 2);
        const topSheet = tileOnSheet(frontCard, { sheetWidthPx: w, sheetHeightPx: halfH, itemWidthPx: cardW, itemHeightPx: cardH });
        const bottomSheet = tileOnSheet(backCard, { sheetWidthPx: w, sheetHeightPx: h - halfH, itemWidthPx: cardW, itemHeightPx: cardH });

        combined = document.createElement("canvas");
        combined.width = w;
        combined.height = h;
        const ctx = combined.getContext("2d");
        if (ctx) {
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(0, 0, w, h);
          ctx.drawImage(topSheet, 0, 0);
          ctx.drawImage(bottomSheet, 0, halfH);
          ctx.strokeStyle = "#888888";
          ctx.setLineDash([10, 6]);
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(0, halfH);
          ctx.lineTo(w, halfH);
          ctx.stroke();
        }
      } else {
        combined = tileOnSheet(frontCard, { sheetWidthPx: w, sheetHeightPx: h, itemWidthPx: cardW, itemHeightPx: cardH });
      }

      const blob = await canvasToJpgBlob(combined);
      downloadBlob(blob, "id-card-print-sheet.jpg");
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    setFrontSrc(null);
    setBackSrc(null);
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-6 sm:grid-cols-2">
        <div>
          <p className="mb-2 text-sm font-medium text-foreground">Front side</p>
          {frontSrc ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={frontSrc} alt="ID card front" className="max-h-56 rounded-xl border border-border" />
          ) : (
            <FileDropzone accept="image/*" onFiles={(files) => files[0] && readFile(files[0], setFrontSrc)} />
          )}
        </div>
        <div>
          <p className="mb-2 text-sm font-medium text-foreground">Back side (optional)</p>
          {backSrc ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={backSrc} alt="ID card back" className="max-h-56 rounded-xl border border-border" />
          ) : (
            <FileDropzone accept="image/*" onFiles={(files) => files[0] && readFile(files[0], setBackSrc)} />
          )}
        </div>
      </div>

      {frontSrc && (
        <>
          <div className="flex flex-wrap items-end gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-foreground">Print sheet size</label>
              <select
                value={sheetSize}
                onChange={(e) => setSheetSize(e.target.value as SheetSize)}
                className="rounded-lg border border-border px-3 py-2 text-sm"
              >
                <option value="4x6">4 x 6 in</option>
                <option value="a4">A4</option>
              </select>
            </div>
            <button
              type="button"
              onClick={reset}
              className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-muted hover:bg-surface-soft"
            >
              {t("reset")}
            </button>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              disabled={busy}
              onClick={downloadCombinedSheet}
              className="w-full rounded-xl brand-pill-btn py-3 transition hover:scale-[1.02] disabled:opacity-50 disabled:hover:scale-100 sm:w-auto sm:px-8"
            >
              {busy ? t("processing") : backSrc ? "Download Print Sheet (Front + Back)" : "Download Print Sheet"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
