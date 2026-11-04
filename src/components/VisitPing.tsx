"use client";

import { useEffect } from "react";

/**
 * Counts this browser once, on the homepage, for the visitor tile. Renders nothing.
 *
 * Two guards, for two different jobs: sessionStorage stops a second call while this tab is
 * open, and the server's cookie stops it for a day across tabs. The fetch is fire and forget -
 * if it fails the tile simply does not move, which is the right failure for a decoration.
 */
export default function VisitPing() {
  useEffect(() => {
    try {
      if (sessionStorage.getItem("rk_counted")) return;
      sessionStorage.setItem("rk_counted", "1");
    } catch {
      // Private mode, or storage blocked. The server cookie still prevents a runaway count.
    }
    void fetch("/api/visit", { method: "POST", keepalive: true }).catch(() => undefined);
  }, []);

  return null;
}
