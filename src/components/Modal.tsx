"use client";

export default function Modal({ open, children }: { open: boolean; children: React.ReactNode }) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
      <div className="brand-card w-full max-w-sm p-6 text-center shadow-2xl">{children}</div>
    </div>
  );
}
