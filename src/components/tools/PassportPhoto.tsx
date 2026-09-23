"use client";

import { useEffect, useRef, useState } from "react";
import ReactCrop, { type Crop, centerCrop, makeAspectCrop } from "react-image-crop";
import "react-image-crop/dist/ReactCrop.css";
import { useTranslations } from "next-intl";
import FileDropzone from "./FileDropzone";
import { downloadBlob } from "@/lib/download";
import { canvasToJpgBlob, inToPx, mmToPx, tileOnSheet } from "@/lib/printSheet";

type PresetKey = "india" | "pan" | "us" | "custom";

const PRESETS: Record<Exclude<PresetKey, "custom">, { label: string; widthMm: number; heightMm: number }> = {
  india: { label: "India Passport (35 x 45mm)", widthMm: 35, heightMm: 45 },
  pan: { label: "India PAN Card (25 x 35mm)", widthMm: 25, heightMm: 35 },
  us: { label: "US / Generic (2 x 2in)", widthMm: 50.8, heightMm: 50.8 },
};

const SHEET_WIDTH_IN = 6;
const SHEET_HEIGHT_IN = 4;

export default function PassportPhoto() {
  const t = useTranslations("common");
  const [imgSrc, setImgSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState<Crop>();
  const [preset, setPreset] = useState<PresetKey>("india");
  const [customWidth, setCustomWidth] = useState(35);
  const [customHeight, setCustomHeight] = useState(45);
  const [customUnit, setCustomUnit] = useState<"mm" | "in">("mm");
  const [busy, setBusy] = useState(false);
  const [fileName, setFileName] = useState("passport-photo");
  const imgRef = useRef<HTMLImageElement | null>(null);

  const targetWidthMm = preset === "custom" ? (customUnit === "in" ? customWidth * 25.4 : customWidth) : PRESETS[preset].widthMm;
  const targetHeightMm = preset === "custom" ? (customUnit === "in" ? customHeight * 25.4 : customHeight) : PRESETS[preset].heightMm;
  const aspect = targetWidthMm / targetHeightMm;

  function resetCropToAspect() {
    const image = imgRef.current;
    if (!image) return;
    const { width: w, height: h } = image;
    setCrop(centerCrop(makeAspectCrop({ unit: "%", width: 90 }, aspect, w, h), w, h));
  }

  useEffect(() => {
    if (imgSrc) resetCropToAspect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aspect, imgSrc]);

  function handleFiles(files: File[]) {
    const file = files[0];
    if (!file) return;
    setFileName(file.name.replace(/\.[^.]+$/, "") || "passport-photo");
    const reader = new FileReader();
    reader.onload = () => setImgSrc(reader.result as string);
    reader.readAsDataURL(file);
  }

  function getCroppedCanvas(): HTMLCanvasElement | null {
    if (!imgRef.current || !crop || !crop.width || !crop.height) return null;
    const image = imgRef.current;
    const scaleX = image.naturalWidth / image.width;
    const scaleY = image.naturalHeight / image.height;

    const targetW = mmToPx(targetWidthMm);
    const targetH = mmToPx(targetHeightMm);

    const canvas = document.createElement("canvas");
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    ctx.drawImage(
      image,
      crop.x * scaleX,
      crop.y * scaleY,
      crop.width * scaleX,
      crop.height * scaleY,
      0,
      0,
      targetW,
      targetH
    );
    return canvas;
  }

  async function downloadPhoto() {
    const canvas = getCroppedCanvas();
    if (!canvas) return;
    setBusy(true);
    try {
      const blob = await canvasToJpgBlob(canvas);
      downloadBlob(blob, `${fileName}-passport.jpg`);
    } finally {
      setBusy(false);
    }
  }

  async function downloadSheet() {
    const canvas = getCroppedCanvas();
    if (!canvas) return;
    setBusy(true);
    try {
      const sheet = tileOnSheet(canvas, {
        sheetWidthPx: inToPx(SHEET_WIDTH_IN),
        sheetHeightPx: inToPx(SHEET_HEIGHT_IN),
        itemWidthPx: canvas.width,
        itemHeightPx: canvas.height,
      });
      const blob = await canvasToJpgBlob(sheet);
      downloadBlob(blob, `${fileName}-passport-sheet.jpg`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      {!imgSrc && <FileDropzone accept="image/*" onFiles={handleFiles} />}

      {imgSrc && (
        <div className="space-y-6">
          <div className="overflow-auto rounded-xl border border-border bg-surface p-4">
            <ReactCrop crop={crop} aspect={aspect} onChange={(c) => setCrop(c)}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                ref={imgRef}
                src={imgSrc}
                alt="to crop"
                onLoad={resetCropToAspect}
                className="max-h-[480px]"
              />
            </ReactCrop>
          </div>

          <div className="flex flex-wrap items-end gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-foreground">Photo size</label>
              <select
                value={preset}
                onChange={(e) => setPreset(e.target.value as PresetKey)}
                className="rounded-lg border border-border px-3 py-2 text-sm"
              >
                <option value="india">{PRESETS.india.label}</option>
                <option value="pan">{PRESETS.pan.label}</option>
                <option value="us">{PRESETS.us.label}</option>
                <option value="custom">Custom size</option>
              </select>
            </div>

            {preset === "custom" && (
              <>
                <div>
                  <label className="mb-1 block text-sm font-medium text-foreground">Width</label>
                  <input
                    type="number"
                    min={1}
                    value={customWidth}
                    onChange={(e) => setCustomWidth(Number(e.target.value))}
                    className="w-24 rounded-lg border border-border px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-foreground">Height</label>
                  <input
                    type="number"
                    min={1}
                    value={customHeight}
                    onChange={(e) => setCustomHeight(Number(e.target.value))}
                    className="w-24 rounded-lg border border-border px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-foreground">Unit</label>
                  <select
                    value={customUnit}
                    onChange={(e) => setCustomUnit(e.target.value as "mm" | "in")}
                    className="rounded-lg border border-border px-3 py-2 text-sm"
                  >
                    <option value="mm">mm</option>
                    <option value="in">inch</option>
                  </select>
                </div>
              </>
            )}

            <button
              type="button"
              onClick={() => setImgSrc(null)}
              className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-muted hover:bg-surface-soft"
            >
              {t("reset")}
            </button>
          </div>

          <div className="flex flex-col flex-wrap gap-3 sm:flex-row">
            <button
              type="button"
              disabled={busy}
              onClick={downloadPhoto}
              className="w-full rounded-xl brand-pill-btn py-3 transition hover:scale-[1.02] disabled:opacity-50 disabled:hover:scale-100 sm:w-auto sm:px-8"
            >
              {busy ? t("processing") : "Download Photo"}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={downloadSheet}
              className="w-full rounded-xl border border-border px-6 py-3 text-sm font-medium text-foreground transition hover:bg-surface-soft disabled:opacity-50 sm:w-auto"
            >
              {busy ? t("processing") : "Download Print Sheet (6x4in)"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
