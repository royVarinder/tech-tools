"use client";

import { useState, useRef } from "react";
import ReactCrop, { type Crop, centerCrop, makeAspectCrop } from "react-image-crop";
import "react-image-crop/dist/ReactCrop.css";
import { useTranslations } from "next-intl";
import FileDropzone from "./FileDropzone";
import { downloadBlob } from "@/lib/download";

export default function PhotoCropResize() {
  const t = useTranslations("common");
  const [imgSrc, setImgSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState<Crop>();
  const [width, setWidth] = useState(800);
  const [height, setHeight] = useState(600);
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

  function onImageLoad(e: React.SyntheticEvent<HTMLImageElement>) {
    const { width: w, height: h } = e.currentTarget;
    const initial = centerCrop(
      makeAspectCrop({ unit: "%", width: 90 }, width / height, w, h),
      w,
      h
    );
    setCrop(initial);
  }

  async function exportImage() {
    if (!imgRef.current || !crop || !crop.width || !crop.height) return;
    setBusy(true);
    try {
      const image = imgRef.current;
      const scaleX = image.naturalWidth / image.width;
      const scaleY = image.naturalHeight / image.height;

      const cropCanvas = document.createElement("canvas");
      cropCanvas.width = crop.width * scaleX;
      cropCanvas.height = crop.height * scaleY;
      const cropCtx = cropCanvas.getContext("2d");
      if (!cropCtx) return;

      cropCtx.drawImage(
        image,
        crop.x * scaleX,
        crop.y * scaleY,
        crop.width * scaleX,
        crop.height * scaleY,
        0,
        0,
        cropCanvas.width,
        cropCanvas.height
      );

      const outCanvas = document.createElement("canvas");
      outCanvas.width = width;
      outCanvas.height = height;
      const outCtx = outCanvas.getContext("2d");
      if (!outCtx) return;
      outCtx.drawImage(cropCanvas, 0, 0, width, height);

      outCanvas.toBlob(
        (blob) => {
          if (blob) downloadBlob(blob, `${fileName}-${width}x${height}.jpg`);
          setBusy(false);
        },
        "image/jpeg",
        0.92
      );
    } catch {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      {!imgSrc && <FileDropzone accept="image/*" onFiles={handleFiles} />}

      {imgSrc && (
        <div className="space-y-6">
          <div className="overflow-auto rounded-xl border border-border bg-surface p-4">
            <ReactCrop crop={crop} onChange={(c) => setCrop(c)}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img ref={imgRef} src={imgSrc} alt="to crop" onLoad={onImageLoad} className="max-h-[480px]" />
            </ReactCrop>
          </div>

          <div className="flex flex-wrap items-end gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-foreground">Width (px)</label>
              <input
                type="number"
                value={width}
                min={1}
                onChange={(e) => setWidth(Number(e.target.value))}
                className="w-28 rounded-lg border border-border px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-foreground">Height (px)</label>
              <input
                type="number"
                value={height}
                min={1}
                onChange={(e) => setHeight(Number(e.target.value))}
                className="w-28 rounded-lg border border-border px-3 py-2 text-sm"
              />
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
