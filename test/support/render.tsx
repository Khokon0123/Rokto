import { render } from "@testing-library/react";
import type { ReactElement } from "react";
import { LocaleProvider } from "@/components/LocaleProvider";

export function renderEn(ui: ReactElement) {
  return render(<LocaleProvider initialLocale="en">{ui}</LocaleProvider>);
}

/** A fetch stand-in: routes by "METHOD path", each handler returns [status, body] (optionally after a delay). */
export type Route = (body: unknown, url: string) => Promise<[number, unknown]> | [number, unknown];
export function fakeFetch(routes: Record<string, Route>) {
  const calls: Array<{ key: string; body: unknown }> = [];
  const fn = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const path = url.replace(/^https?:\/\/[^/]+/, "").split("?")[0];
    const key = `${init?.method ?? "GET"} ${path}`;
    const body = init?.body ? JSON.parse(String(init.body)) : undefined;
    calls.push({ key, body });
    const handler = routes[key];
    if (!handler) throw new Error(`no route for ${key}`);
    const [status, data] = await handler(body, url);
    return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
  };
  return { fn, calls };
}

export const deferred = <T,>() => {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
};
