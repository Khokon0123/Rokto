import { redirect } from "next/navigation";
import { seekerFromCookies } from "@/lib/server/seekerSession";
import AccountClient from "./AccountClient";

export default async function AccountPage() {
  const seeker = await seekerFromCookies();
  if (!seeker) redirect("/signin");
  return <AccountClient username={seeker.username} />;
}
