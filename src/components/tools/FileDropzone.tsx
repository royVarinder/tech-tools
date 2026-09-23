"use client";

import { useCallback, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { FcUpload } from "react-icons/fc";

export default function FileDropzone({
  accept,
  multiple = false,
  onFiles,
  label,
}: {
  accept: string;
  multiple?: boolean;
  onFiles: (files: File[]) => void;
  label?: string;
}) {
  const t = useTranslations("common");
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);

  const handleFiles = useCallback(
    (fileList: FileList | null) => {
      if (!fileList || fileList.length === 0) return;
      onFiles(Array.from(fileList));
    },
    [onFiles]
  );

  return (
    <div
      onClick={() => inputRef.current?.click()}
      onDragOver={(e) => {
        e.preventDefault();
        setDragActive(true);
      }}
      onDragLeave={() => setDragActive(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragActive(false);
        handleFiles(e.dataTransfer.files);
      }}
      className={`flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed px-6 py-12 text-center transition-all duration-200 ${
        dragActive
          ? "scale-[1.01] border-brand-light bg-surface-soft"
          : "border-border bg-surface-soft hover:border-brand-light hover:bg-surface"
      }`}
    >
      <FcUpload
        className={`h-10 w-10 transition-transform duration-200 ${dragActive ? "-translate-y-1 scale-110" : ""}`}
      />
      <p className="text-sm font-medium text-muted">{label ?? t("upload")}</p>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
    </div>
  );
}
