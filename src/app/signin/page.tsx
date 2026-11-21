import { redirect } from "next/navigation";

// Signing in is a username on /search now (no phone). This route stays so older links and
// bookmarks still land somewhere sensible.
export default function SignInPage() {
  redirect("/search");
}
