"use client";

import { useSyncExternalStore } from "react";
import { useT } from "@/components/LocaleProvider";
import EditClient from "./EditClient";

const subscribe = (cb: () => void) => {
  window.addEventListener("hashchange", cb);
  return () => window.removeEventListener("hashchange", cb);
};
const readHash = () => window.location.hash.replace(/^#/, "");

/** Reads the edit token from the #fragment (never sent to any server). */
export default function EditFromFragment() {
  const t = useT();
  const token = useSyncExternalStore(subscribe, readHash, () => null);
  if (token === null) return <p className="pt-6 text-base text-muted">{t.edit.loading}</p>;
  return <EditClient token={token} />;
}
