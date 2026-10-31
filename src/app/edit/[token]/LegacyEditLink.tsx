"use client";

import { useEffect } from "react";
import EditClient from "../EditClient";

export default function LegacyEditLink({ token }: { token: string }) {
  useEffect(() => {
    window.history.replaceState(null, "", `/edit#${token}`);
  }, [token]);
  return <EditClient token={token} />;
}
