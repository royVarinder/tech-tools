"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import FileDropzone from "./FileDropzone";
import { downloadBlob } from "@/lib/download";

interface PageImage {
  index: number;
  url: string;
  blob: Blob;
}

export default function PdfToJpg() {
  const t = useTranslations("common");
  const [pages, setPages] = useState<PageImage[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fileBaseName, setFileBaseName] = useState("page");

  async function handleFiles(files: File[]) {
    const file = files[0];
    if (!file) return;
    setBusy(true);
    setError(null);
    setPages([]);
    setFileBaseName(file.name.replace(/\.pdf$/i, ""));

    try {
      const pdfjsLib = (await import("@/lib/pdfjs")).default;
      const bytes = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: bytes }).promise;
      const rendered: PageImage[] = [];

      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale: 2 });
        const canvas = document.createElement("canvas");
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext("2d");
        if (!ctx) continue;
        await page.render({ canvasContext: ctx, viewport, canvas }).promise;

        const blob: Blob | null = await new Promise((resolve) =>
          canvas.toBlob(resolve, "image/jpeg", 0.92)
        );
        if (blob) {
          rendered.push({ index: i, url: URL.createObjectURL(blob), blob });
        }
      }

      setPages(rendered);
    } catch {
      setError("Could not read this PDF. Please choose a valid PDF file.");
    } finally {
      setBusy(false);
    }
  }

  function downloadAll() {
    pages.forEach((page) => {
      downloadBlob(page.blob, `${fileBaseName}-page-${page.index}.jpg`);
    });
  }

  return (
    <div className="space-y-6">
      <FileDropzone accept="application/pdf" onFiles={handleFiles} />

      {busy && <p className="text-sm text-muted">{t("processing")}</p>}
      {error && <p className="text-sm text-danger">{error}</p>}

      {pages.length > 0 && (
        <>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
            {pages.map((page) => (
              <div key={page.index} className="rounded-xl border border-border bg-surface p-2 text-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={page.url} alt={`page ${page.index}`} className="mb-2 w-full rounded-lg" />
                <button
                  type="button"
                  onClick={() => downloadBlob(page.blob, `${fileBaseName}-page-${page.index}.jpg`)}
                  className="text-xs font-medium text-brand-bright hover:underline"
                >
                  Page {page.index} — {t("download")}
                </button>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={downloadAll}
            className="w-full rounded-xl brand-pill-btn py-3 transition hover:scale-[1.02] sm:w-auto sm:px-8"
          >
            {t("download")} all
          </button>
        </>
      )}
    </div>
  );
}
