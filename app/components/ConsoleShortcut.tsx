"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { matchesConsoleShortcut } from "@/lib/ui/console-shortcut";
import { DEFAULT_CAPTURE_HREF } from "@/lib/ui/capture-route";

/**
 * Global listener so the presenter can open Capture from any product
 * surface without hunting for a link. Mounted once from the root layout;
 * never renders UI of its own. Legacy `/console` redirects here too.
 */
export function ConsoleShortcut() {
  const router = useRouter();

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!matchesConsoleShortcut(event)) {
        return;
      }
      event.preventDefault();
      if (window.location.pathname === DEFAULT_CAPTURE_HREF) {
        return;
      }
      router.push(DEFAULT_CAPTURE_HREF);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [router]);

  return null;
}
