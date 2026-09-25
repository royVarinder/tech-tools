"use client";

import { useEffect, useRef, useState } from "react";
import ReactCrop, { type Crop, centerCrop, makeAspectCrop } from "react-image-crop";
import "react-image-crop/dist/ReactCrop.css";
import { useTranslations } from "next-intl";
import FileDropzone from "./FileDropzone";
import { downloadBlob } from "@/lib/download";
import { canvasToJpgBlob, compressToTargetBytes, inToPx, mmToPx, tileOnSheet } from "@/lib/printSheet";

type PresetKey = "india" | "pan" | "us" | "custom";
type ResizeUnit = "px" | "percent";
type SizeUnit = "KB" | "MB";

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
  const [resizeUnit, setResizeUnit] = useState<ResizeUnit>("px");
  const [widthOverridePx, setWidthOverridePx] = useState<number | null>(null);
  const [heightOverridePx, setHeightOverridePx] = useState<number | null>(null);
  const [scalePercent, setScalePercent] = useState(100);
  const [targetSize, setTargetSize] = useState<number | "">("");
  const [targetSizeUnit, setTargetSizeUnit] = useState<SizeUnit>("KB");
  const [busy, setBusy] = useState(false);
  const [fileName, setFileName] = useState("passport-photo");
  const imgRef = useRef<HTMLImageElement | null>(null);

  const targetWidthMm = preset === "custom" ? (customUnit === "in" ? customWidth * 25.4 : customWidth) : PRESETS[preset].widthMm;
  const targetHeightMm = preset === "custom" ? (customUnit === "in" ? customHeight * 25.4 : customHeight) : PRESETS[preset].heightMm;
  const aspect = targetWidthMm / targetHeightMm;
  const baseWidthPx = mmToPx(targetWidthMm);
  const baseHeightPx = mmToPx(targetHeightMm);
  const outputWidthPx = widthOverridePx ?? baseWidthPx;
  const outputHeightPx = heightOverridePx ?? baseHeightPx;

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

    const targetW =
      resizeUnit === "percent"
        ? Math.max(1, Math.round((baseWidthPx * scalePercent) / 100))
        : Math.max(1, Math.round(outputWidthPx));
    const targetH =
      resizeUnit === "percent"
        ? Math.max(1, Math.round((baseHeightPx * scalePercent) / 100))
        : Math.max(1, Math.round(outputHeightPx));

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

  async function exportBlob(canvas: HTMLCanvasElement): Promise<Blob> {
    if (targetSize && targetSize > 0) {
      return compressToTargetBytes(canvas, targetSize * (targetSizeUnit === "MB" ? 1024 * 1024 : 1024));
    }
    return canvasToJpgBlob(canvas);
  }

  async function downloadPhoto() {
    const canvas = getCroppedCanvas();
    if (!canvas) return;
    setBusy(true);
    try {
      const blob = await exportBlob(canvas);
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
      const blob = await exportBlob(sheet);
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
                onChange={(e) => {
                  setPreset(e.target.value as PresetKey);
                  setWidthOverridePx(null);
                  setHeightOverridePx(null);
                }}
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
                    onChange={(e) => {
                      setCustomWidth(Number(e.target.value));
                      setWidthOverridePx(null);
                      setHeightOverridePx(null);
                    }}
                    className="w-24 rounded-lg border border-border px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-foreground">Height</label>
                  <input
                    type="number"
                    min={1}
                    value={customHeight}
                    onChange={(e) => {
                      setCustomHeight(Number(e.target.value));
                      setWidthOverridePx(null);
                      setHeightOverridePx(null);
                    }}
                    className="w-24 rounded-lg border border-border px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-foreground">Unit</label>
                  <select
                    value={customUnit}
                    onChange={(e) => {
                      setCustomUnit(e.target.value as "mm" | "in");
                      setWidthOverridePx(null);
                      setHeightOverridePx(null);
                    }}
                    className="rounded-lg border border-border px-3 py-2 text-sm"
                  >
                    <option value="mm">mm</option>
                    <option value="in">inch</option>
                  </select>
                </div>
              </>
            )}

            <div>
              <label className="mb-1 block text-sm font-medium text-foreground">Resize by</label>
              <select
                value={resizeUnit}
                onChange={(e) => setResizeUnit(e.target.value as ResizeUnit)}
                className="rounded-lg border border-border px-3 py-2 text-sm"
              >
                <option value="px">Pixels</option>
                <option value="percent">Percentage</option>
              </select>
            </div>

            {resizeUnit === "px" ? (
              <>
                <div>
                  <label className="mb-1 block text-sm font-medium text-foreground">Output width (px)</label>
                  <input
                    type="number"
                    min={1}
                    value={outputWidthPx}
                    onChange={(e) => setWidthOverridePx(Number(e.target.value))}
                    className="w-28 rounded-lg border border-border px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-foreground">Output height (px)</label>
                  <input
                    type="number"
                    min={1}
                    value={outputHeightPx}
                    onChange={(e) => setHeightOverridePx(Number(e.target.value))}
                    className="w-28 rounded-lg border border-border px-3 py-2 text-sm"
                  />
                </div>
              </>
            ) : (
              <div>
                <label className="mb-1 block text-sm font-medium text-foreground">Scale (%)</label>
                <input
                  type="number"
                  min={1}
                  max={500}
                  value={scalePercent}
                  onChange={(e) => setScalePercent(Number(e.target.value))}
                  className="w-24 rounded-lg border border-border px-3 py-2 text-sm"
                />
              </div>
            )}

            <div>
              <label className="mb-1 block text-sm font-medium text-foreground">Compress to (optional)</label>
              <div className="flex gap-2">
                <input
                  type="number"
                  value={targetSize}
                  min={1}
                  placeholder="e.g. 50"
                  onChange={(e) => setTargetSize(e.target.value === "" ? "" : Number(e.target.value))}
                  className="w-24 rounded-lg border border-border px-3 py-2 text-sm"
                />
                <select
                  value={targetSizeUnit}
                  onChange={(e) => setTargetSizeUnit(e.target.value as SizeUnit)}
                  className="rounded-lg border border-border px-3 py-2 text-sm"
                >
                  <option value="KB">KB</option>
                  <option value="MB">MB</option>
                </select>
              </div>
            </div>

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
