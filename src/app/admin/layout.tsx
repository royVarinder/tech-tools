import type { Metadata } from "next";
import { SessionProvider } from "@/components/SessionProvider";
import { ThemeProvider } from "@/components/ThemeProvider";
import "../globals.css";

export const metadata: Metadata = {
  title: "Admin · PrintBro",
  description: "Internal admin panel.",
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased flex min-h-screen flex-col bg-background text-foreground">
        <ThemeProvider>
          <SessionProvider>{children}</SessionProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
