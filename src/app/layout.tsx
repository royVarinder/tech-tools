import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "ToolNest",
  description: "All the file tools you need, in one place.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
