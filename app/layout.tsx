import type { Metadata } from "next";
import { IBM_Plex_Sans, IBM_Plex_Serif } from "next/font/google";
import { ConsoleShortcut } from "@/app/components/ConsoleShortcut";
import { Toaster } from "@/components/ui/sonner";
import { cn } from "@/lib/utils";
import "./globals.css";

/** Everything Mend says — human voice, SBAR, headlines. */
const ibmPlexSerif = IBM_Plex_Serif({
  subsets: ["latin"],
  weight: ["400", "500"],
  style: ["normal", "italic"],
  variable: "--font-ibm-plex-serif",
  display: "swap",
});

/** Everything the engine measures — UI chrome, vitals, tables. */
const ibmPlexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-ibm-plex-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Mend",
  description: "Voice-first post-op orthopedic recovery co-pilot",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={cn(ibmPlexSans.variable, ibmPlexSerif.variable, "antialiased")}
    >
      <body className="bg-paper font-sans text-body text-ink">
        {children}
        <ConsoleShortcut />
        <Toaster position="bottom-right" closeButton />
      </body>
    </html>
  );
}
