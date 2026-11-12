"use client";

import { useEffect } from "react";
import EditClient, { tokenTransport } from "../EditClient";

export default function LegacyEditLink({ token }: { token: string }) {
  useEffect(() => {
    window.history.replaceState(null, "", `/edit#${token}`);
  }, [token]);
  return <EditClient transport={tokenTransport(token)} />;
}
