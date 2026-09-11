import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "File Uploader",
  description: "Private family file storage",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
