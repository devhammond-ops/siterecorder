import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Cable Install Recorder",
  description: "Track and record internet cable installations",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-muted/30 antialiased">{children}</body>
    </html>
  );
}
