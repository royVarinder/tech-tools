"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import FileDropzone from "./FileDropzone";
import { downloadBlob } from "@/lib/download";

export default function PngToJpg() {
  const t = useTranslations("common");
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleFiles(files: File[]) {
    const selected = files[0];
    setFile(selected);
    setPreviewUrl(URL.createObjectURL(selected));
    setError(null);
  }

  async function convert() {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const img = await loadImage(file);
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas not supported");
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);

      canvas.toBlob(
        (blob) => {
          if (blob) downloadBlob(blob, file.name.replace(/\.png$/i, "") + ".jpg");
          setBusy(false);
        },
        "image/jpeg",
        0.92
      );
    } catch {
      setError("Could not convert this image. Please choose a valid PNG file.");
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <FileDropzone accept="image/png" onFiles={handleFiles} />

      {previewUrl && (
        <div className="rounded-xl border border-border bg-surface p-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={previewUrl} alt="preview" className="mx-auto max-h-64 rounded-lg" />
        </div>
      )}

      {error && <p className="text-sm text-danger">{error}</p>}

      <button
        type="button"
        disabled={!file || busy}
        onClick={convert}
        className="w-full rounded-xl brand-pill-btn py-3 transition hover:scale-[1.02] disabled:opacity-50 disabled:hover:scale-100 sm:w-auto sm:px-8"
      >
        {busy ? t("processing") : t("download") + " JPG"}
      </button>
    </div>
  );
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}
