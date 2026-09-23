"use client";

import { useState } from "react";
import { PDFDocument } from "pdf-lib";
import { useTranslations } from "next-intl";
import { FcUp, FcDown, FcCancel, FcDocument } from "react-icons/fc";
import FileDropzone from "./FileDropzone";
import { downloadBlob, bytesToBlob } from "@/lib/download";

interface MergeFile {
  id: string;
  file: File;
  thumbnail: string | null;
}

export default function MergePdf() {
  const t = useTranslations("common");
  const [files, setFiles] = useState<MergeFile[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function addFiles(newFiles: File[]) {
    setError(null);
    const entries: MergeFile[] = newFiles.map((file) => ({
      id: `${file.name}-${file.size}-${Math.random().toString(36).slice(2)}`,
      file,
      thumbnail: null,
    }));
    setFiles((prev) => [...prev, ...entries]);

    const pdfjsLib = (await import("@/lib/pdfjs")).default;
    for (const entry of entries) {
      try {
        const bytes = await entry.file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: bytes }).promise;
        const page = await pdf.getPage(1);
        const viewport = page.getViewport({ scale: 0.4 });
        const canvas = document.createElement("canvas");
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext("2d");
        if (!ctx) continue;
        await page.render({ canvasContext: ctx, viewport, canvas }).promise;
        const thumbnail = canvas.toDataURL("image/jpeg", 0.8);
        setFiles((prev) => prev.map((f) => (f.id === entry.id ? { ...f, thumbnail } : f)));
      } catch {
        // leave thumbnail as null; a generic file icon is shown instead
      }
    }
  }

  function removeFile(id: string) {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  }

  function move(index: number, dir: -1 | 1) {
    setFiles((prev) => {
      const next = [...prev];
      const target = index + dir;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  async function merge() {
    if (files.length < 2) {
      setError("Please add at least two PDF files to merge.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const merged = await PDFDocument.create();
      for (const entry of files) {
        const bytes = await entry.file.arrayBuffer();
        const source = await PDFDocument.load(bytes);
        const copiedPages = await merged.copyPages(source, source.getPageIndices());
        copiedPages.forEach((page) => merged.addPage(page));
      }
      const mergedBytes = await merged.save();
      downloadBlob(bytesToBlob(mergedBytes, "application/pdf"), "merged.pdf");
    } catch {
      setError("Could not merge these PDFs. Please make sure all files are valid PDF documents.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <FileDropzone accept="application/pdf" multiple onFiles={addFiles} label="Add PDF files" />

      {files.length > 0 && (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {files.map((entry, index) => (
            <li
              key={entry.id}
              className="brand-card flex items-center gap-3 p-3 transition-all duration-200 hover:-translate-y-0.5 hover:border-brand-light hover:shadow-md"
            >
              <div className="flex h-16 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-surface-soft">
                {entry.thumbnail ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={entry.thumbnail} alt={entry.file.name} className="h-full w-full object-cover" />
                ) : (
                  <FcDocument className="h-7 w-7" />
                )}
              </div>

              <span className="min-w-0 flex-1 truncate text-sm text-foreground">
                {index + 1}. {entry.file.name}
              </span>

              <div className="flex shrink-0 gap-1">
                <button
                  type="button"
                  onClick={() => move(index, -1)}
                  disabled={index === 0}
                  className="rounded-full p-1 transition-transform hover:scale-110 disabled:opacity-30 disabled:hover:scale-100"
                  aria-label="Move up"
                >
                  <FcUp className="h-5 w-5" />
                </button>
                <button
                  type="button"
                  onClick={() => move(index, 1)}
                  disabled={index === files.length - 1}
                  className="rounded-full p-1 transition-transform hover:scale-110 disabled:opacity-30 disabled:hover:scale-100"
                  aria-label="Move down"
                >
                  <FcDown className="h-5 w-5" />
                </button>
                <button
                  type="button"
                  onClick={() => removeFile(entry.id)}
                  className="rounded-full p-1 transition-transform hover:scale-110"
                  aria-label="Remove"
                >
                  <FcCancel className="h-5 w-5" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {error && <p className="text-sm text-danger">{error}</p>}

      <button
        type="button"
        disabled={files.length < 2 || busy}
        onClick={merge}
        className="w-full rounded-xl brand-pill-btn py-3 transition hover:scale-[1.02] disabled:opacity-50 disabled:hover:scale-100 sm:w-auto sm:px-8"
      >
        {busy ? t("processing") : "Merge & " + t("download")}
      </button>
    </div>
  );
}
