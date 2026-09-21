import { en } from "./en";

// Future: pick the active language (en / bn) here. v1 ships English only.
export const t = en;

/** Fills {placeholders}: fmt("Call {phone}", { phone: "017..." }) */
export function fmt(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => String(vars[key] ?? ""));
}

/** Maps an API / auth error code to user-facing copy. */
export function errorMessage(code: string | undefined): string {
  const errors = t.errors as Record<string, string>;
  return (code && errors[code]) || errors.generic;
}
