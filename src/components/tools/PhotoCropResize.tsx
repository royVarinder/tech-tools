"use client";

import { useState, useRef } from "react";
import ReactCrop, { type Crop, centerCrop, makeAspectCrop } from "react-image-crop";
import "react-image-crop/dist/ReactCrop.css";
import { useTranslations } from "next-intl";
import FileDropzone from "./FileDropzone";
import { downloadBlob } from "@/lib/download";
import { canvasToJpgBlob, compressToTargetBytes } from "@/lib/printSheet";

type ResizeUnit = "px" | "percent";
type SizeUnit = "KB" | "MB";

export default function PhotoCropResize() {
  const t = useTranslations("common");
  const [imgSrc, setImgSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState<Crop>();
  const [width, setWidth] = useState(800);
  const [height, setHeight] = useState(600);
  const [resizeUnit, setResizeUnit] = useState<ResizeUnit>("px");
  const [widthPercent, setWidthPercent] = useState(100);
  const [heightPercent, setHeightPercent] = useState(100);
  const [targetSize, setTargetSize] = useState<number | "">("");
  const [targetSizeUnit, setTargetSizeUnit] = useState<SizeUnit>("KB");
  const [busy, setBusy] = useState(false);
  const [fileName, setFileName] = useState("photo");
  const imgRef = useRef<HTMLImageElement | null>(null);

  function handleFiles(files: File[]) {
    const file = files[0];
    if (!file) return;
    setFileName(file.name.replace(/\.[^.]+$/, ""));
    const reader = new FileReader();
    reader.onload = () => setImgSrc(reader.result as string);
    reader.readAsDataURL(file);
  }

  const pxAspect = width > 0 && height > 0 ? width / height : undefined;

  function resetCropToAspect(targetAspect: number | undefined) {
    const image = imgRef.current;
    if (!image) return;
    const { width: w, height: h } = image;
    setCrop(
      targetAspect
        ? centerCrop(makeAspectCrop({ unit: "%", width: 90 }, targetAspect, w, h), w, h)
        : centerCrop({ unit: "%", width: 90, height: 90, x: 5, y: 5 }, w, h)
    );
  }

  function onImageLoad(e: React.SyntheticEvent<HTMLImageElement>) {
    const { width: w, height: h } = e.currentTarget;
    const initial = pxAspect
      ? centerCrop(makeAspectCrop({ unit: "%", width: 90 }, pxAspect, w, h), w, h)
      : centerCrop({ unit: "%", width: 90, height: 90, x: 5, y: 5 }, w, h);
    setCrop(initial);
  }

  async function exportImage() {
    if (!imgRef.current || !crop || !crop.width || !crop.height) return;
    setBusy(true);
    try {
      const image = imgRef.current;
      const scaleX = image.naturalWidth / image.width;
      const scaleY = image.naturalHeight / image.height;
      const croppedWidth = crop.width * scaleX;
      const croppedHeight = crop.height * scaleY;

      const cropCanvas = document.createElement("canvas");
      cropCanvas.width = croppedWidth;
      cropCanvas.height = croppedHeight;
      const cropCtx = cropCanvas.getContext("2d");
      if (!cropCtx) return;

      cropCtx.drawImage(
        image,
        crop.x * scaleX,
        crop.y * scaleY,
        croppedWidth,
        croppedHeight,
        0,
        0,
        cropCanvas.width,
        cropCanvas.height
      );

      const outWidth =
        resizeUnit === "percent" ? Math.max(1, Math.round((croppedWidth * widthPercent) / 100)) : width;
      const outHeight =
        resizeUnit === "percent" ? Math.max(1, Math.round((croppedHeight * heightPercent) / 100)) : height;

      const outCanvas = document.createElement("canvas");
      outCanvas.width = outWidth;
      outCanvas.height = outHeight;
      const outCtx = outCanvas.getContext("2d");
      if (!outCtx) return;
      outCtx.drawImage(cropCanvas, 0, 0, outWidth, outHeight);

      const blob =
        targetSize && targetSize > 0
          ? await compressToTargetBytes(outCanvas, targetSize * (targetSizeUnit === "MB" ? 1024 * 1024 : 1024))
          : await canvasToJpgBlob(outCanvas, 0.92);

      downloadBlob(blob, `${fileName}-${outWidth}x${outHeight}.jpg`);
    } catch {
      // ignore
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
            <ReactCrop crop={crop} aspect={resizeUnit === "px" ? pxAspect : undefined} onChange={(c) => setCrop(c)}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img ref={imgRef} src={imgSrc} alt="to crop" onLoad={onImageLoad} className="max-h-[480px]" />
            </ReactCrop>
          </div>
          {resizeUnit === "px" && (
            <p className="text-xs text-muted">
              The crop box is locked to the {width}×{height} ratio so the preview always matches your download.
            </p>
          )}

          <div className="flex flex-wrap items-end gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-foreground">Resize by</label>
              <select
                value={resizeUnit}
                onChange={(e) => {
                  const unit = e.target.value as ResizeUnit;
                  setResizeUnit(unit);
                  resetCropToAspect(unit === "px" ? pxAspect : undefined);
                }}
                className="rounded-lg border border-border px-3 py-2 text-sm"
              >
                <option value="px">Pixels</option>
                <option value="percent">Percentage</option>
              </select>
            </div>

            {resizeUnit === "px" ? (
              <>
                <div>
                  <label className="mb-1 block text-sm font-medium text-foreground">Width (px)</label>
                  <input
                    type="number"
                    value={width}
                    min={1}
                    onChange={(e) => {
                      const newWidth = Math.max(1, Number(e.target.value) || 1);
                      setWidth(newWidth);
                      resetCropToAspect(newWidth / height);
                    }}
                    className="w-28 rounded-lg border border-border px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-foreground">Height (px)</label>
                  <input
                    type="number"
                    value={height}
                    min={1}
                    onChange={(e) => {
                      const newHeight = Math.max(1, Number(e.target.value) || 1);
                      setHeight(newHeight);
                      resetCropToAspect(width / newHeight);
                    }}
                    className="w-28 rounded-lg border border-border px-3 py-2 text-sm"
                  />
                </div>
              </>
            ) : (
              <>
                <div>
                  <label className="mb-1 block text-sm font-medium text-foreground">Width (%)</label>
                  <input
                    type="number"
                    value={widthPercent}
                    min={1}
                    max={500}
                    onChange={(e) => setWidthPercent(Number(e.target.value))}
                    className="w-28 rounded-lg border border-border px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-foreground">Height (%)</label>
                  <input
                    type="number"
                    value={heightPercent}
                    min={1}
                    max={500}
                    onChange={(e) => setHeightPercent(Number(e.target.value))}
                    className="w-28 rounded-lg border border-border px-3 py-2 text-sm"
                  />
                </div>
              </>
            )}

            <div>
              <label className="mb-1 block text-sm font-medium text-foreground">Compress to (optional)</label>
              <div className="flex gap-2">
                <input
                  type="number"
                  value={targetSize}
                  min={1}
                  placeholder="e.g. 200"
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

          <button
            type="button"
            disabled={busy}
            onClick={exportImage}
            className="w-full rounded-xl brand-pill-btn py-3 transition hover:scale-[1.02] disabled:opacity-50 disabled:hover:scale-100 sm:w-auto sm:px-8"
          >
            {busy ? t("processing") : t("download")}
          </button>
        </div>
      )}
    </div>
  );
}
