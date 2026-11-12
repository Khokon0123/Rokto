import { redirect } from "next/navigation";
import { accountFromCookies } from "@/lib/server/accountSession";
import AccountClient from "./AccountClient";

export default async function AccountPage() {
  const account = await accountFromCookies();
  if (!account) redirect("/signin");
  return <AccountClient username={account.username} />;
}
