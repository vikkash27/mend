import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Mend",
  description: "Voice-first post-op orthopaedic recovery co-pilot",
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
