import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Enchant — Outreach Tracker",
  description: "Priority outreach queue for Enchant contact segments",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
