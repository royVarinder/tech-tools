"use client";

import { useState } from "react";
import { PDFDocument } from "pdf-lib";
import { useTranslations } from "next-intl";
import { FcCancel } from "react-icons/fc";
import FileDropzone from "./FileDropzone";
import { downloadBlob, bytesToBlob } from "@/lib/download";

interface ImageFile {
  id: string;
  file: File;
  previewUrl: string;
}

export default function ImageToPdf({ format }: { format: "jpg" | "png" }) {
  const t = useTranslations("common");
  const [files, setFiles] = useState<ImageFile[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function addFiles(newFiles: File[]) {
    const entries = newFiles.map((file) => ({
      id: `${file.name}-${file.size}-${Math.random().toString(36).slice(2)}`,
      file,
      previewUrl: URL.createObjectURL(file),
    }));
    setFiles((prev) => [...prev, ...entries]);
    setError(null);
  }

  function removeFile(id: string) {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  }

  async function convert() {
    if (files.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      const pdfDoc = await PDFDocument.create();

      for (const entry of files) {
        const bytes = await entry.file.arrayBuffer();
        const image = format === "jpg" ? await pdfDoc.embedJpg(bytes) : await pdfDoc.embedPng(bytes);
        const page = pdfDoc.addPage([image.width, image.height]);
        page.drawImage(image, { x: 0, y: 0, width: image.width, height: image.height });
      }

      const pdfBytes = await pdfDoc.save();
      downloadBlob(bytesToBlob(pdfBytes, "application/pdf"), "converted.pdf");
    } catch {
      setError("Could not convert these images. Please make sure they are valid " + format.toUpperCase() + " files.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <FileDropzone
        accept={format === "jpg" ? "image/jpeg" : "image/png"}
        multiple
        onFiles={addFiles}
      />

      {files.length > 0 && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
          {files.map((entry) => (
            <div
              key={entry.id}
              className="brand-card group relative overflow-hidden p-2 transition-all duration-200 hover:-translate-y-0.5 hover:border-brand-light hover:shadow-md"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={entry.previewUrl} alt={entry.file.name} className="aspect-square w-full rounded-lg object-cover" />
              <p className="mt-2 truncate text-xs text-muted">{entry.file.name}</p>
              <button
                type="button"
                onClick={() => removeFile(entry.id)}
                className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-background/90 opacity-0 shadow transition-all duration-200 hover:scale-110 group-hover:opacity-100"
                aria-label="Remove"
              >
                <FcCancel className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {error && <p className="text-sm text-danger">{error}</p>}

      <button
        type="button"
        disabled={files.length === 0 || busy}
        onClick={convert}
        className="w-full rounded-xl brand-pill-btn py-3 transition hover:scale-[1.02] disabled:opacity-50 disabled:hover:scale-100 sm:w-auto sm:px-8"
      >
        {busy ? t("processing") : t("download") + " PDF"}
      </button>
    </div>
  );
}
