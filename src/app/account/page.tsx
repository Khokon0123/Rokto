import { redirect } from "next/navigation";
import { loadAccountDetail } from "@/lib/server/accounts";
import { accountFromCookies } from "@/lib/server/accountSession";
import { byPhone, loadProfile } from "@/lib/server/donors";
import AccountClient from "./AccountClient";

/** Whether this person is also listed as a donor. Not being one is normal, not an error. */
async function hasListing(phone: string): Promise<boolean> {
  try {
    await loadProfile(byPhone(phone));
    return true;
  } catch {
    return false;
  }
}

export default async function AccountPage() {
  const session = await accountFromCookies();
  if (!session) redirect("/signin");
  const account = await loadAccountDetail(session.accountId);
  if (!account) redirect("/signin");

  return (
    <AccountClient
      username={account.username}
      phone={account.phone}
      memberSince={account.createdAt ? account.createdAt.toISOString().slice(0, 10) : null}
      listed={await hasListing(account.phone)}
    />
  );
}
