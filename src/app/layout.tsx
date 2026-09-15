import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Bond Analyzer",
  description: "Portfolio view of Bangladesh Government Treasury Bond holdings, sourced from Google Sheets",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-zinc-50 text-zinc-900 antialiased dark:bg-black dark:text-zinc-100">{children}</body>
    </html>
  );
}
