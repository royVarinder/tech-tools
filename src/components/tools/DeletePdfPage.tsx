"use client";

import { useState } from "react";
import { PDFDocument } from "pdf-lib";
import { useTranslations } from "next-intl";
import { FiX } from "react-icons/fi";
import FileDropzone from "./FileDropzone";
import { downloadBlob, bytesToBlob } from "@/lib/download";

interface PageThumb {
  index: number;
  url: string;
}

export default function DeletePdfPage() {
  const t = useTranslations("common");
  const [file, setFile] = useState<File | null>(null);
  const [thumbs, setThumbs] = useState<PageThumb[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFiles(files: File[]) {
    const picked = files[0];
    if (!picked) return;
    setFile(picked);
    setSelected(new Set());
    setThumbs([]);
    setError(null);
    setBusy(true);

    try {
      const pdfjsLib = (await import("@/lib/pdfjs")).default;
      const bytes = await picked.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: bytes.slice(0) }).promise;
      const rendered: PageThumb[] = [];

      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale: 0.6 });
        const canvas = document.createElement("canvas");
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext("2d");
        if (!ctx) continue;
        await page.render({ canvasContext: ctx, viewport, canvas }).promise;
        rendered.push({ index: i, url: canvas.toDataURL("image/jpeg", 0.8) });
      }

      setThumbs(rendered);
    } catch {
      setError("Could not read this PDF. Please choose a valid PDF file.");
    } finally {
      setBusy(false);
    }
  }

  function toggle(index: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  async function saveWithoutSelected() {
    if (!file || selected.size === 0) return;
    setBusy(true);
    setError(null);
    try {
      const bytes = await file.arrayBuffer();
      const pdfDoc = await PDFDocument.load(bytes);

      if (selected.size >= pdfDoc.getPageCount()) {
        setError("You cannot delete every page from the document.");
        setBusy(false);
        return;
      }

      const indicesToRemove = Array.from(selected)
        .map((n) => n - 1)
        .sort((a, b) => b - a);
      indicesToRemove.forEach((idx) => pdfDoc.removePage(idx));

      const outBytes = await pdfDoc.save();
      downloadBlob(bytesToBlob(outBytes, "application/pdf"), "edited.pdf");
    } catch {
      setError("Something went wrong while editing the PDF.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <FileDropzone accept="application/pdf" onFiles={handleFiles} />

      {busy && thumbs.length === 0 && <p className="text-sm text-muted">{t("processing")}</p>}
      {error && <p className="text-sm text-danger">{error}</p>}

      {thumbs.length > 0 && (
        <>
          <p className="text-sm text-muted">Click the pages you want to remove, then save.</p>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
            {thumbs.map((thumb) => {
              const isSelected = selected.has(thumb.index);
              return (
                <button
                  type="button"
                  key={thumb.index}
                  onClick={() => toggle(thumb.index)}
                  className={`relative rounded-xl border-2 p-2 text-center transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md ${
                    isSelected ? "border-danger bg-danger/10" : "border-border bg-surface hover:border-brand-light"
                  }`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={thumb.url} alt={`page ${thumb.index}`} className="mb-2 w-full rounded-lg" />
                  <span className="text-xs font-medium text-muted">Page {thumb.index}</span>
                  {isSelected && (
                    <span className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-danger text-white">
                      <FiX className="h-3 w-3" />
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <button
            type="button"
            disabled={selected.size === 0 || busy}
            onClick={saveWithoutSelected}
            className="w-full rounded-xl brand-pill-btn py-3 transition hover:scale-[1.02] disabled:opacity-50 disabled:hover:scale-100 sm:w-auto sm:px-8"
          >
            {busy ? t("processing") : `Delete ${selected.size || ""} page(s) & ${t("download")}`}
          </button>
        </>
      )}
    </div>
  );
}
