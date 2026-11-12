import { redirect } from "next/navigation";

// Sign-in and registration are one page now: /register opens the account, and listing yourself as
// a donor is a tick box on it. This route stays so older links and bookmarks still land somewhere
// sensible, carrying whatever destination they were headed for.
export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const next = (await searchParams).next;
  redirect(typeof next === "string" ? `/register?next=${encodeURIComponent(next)}` : "/register");
}
