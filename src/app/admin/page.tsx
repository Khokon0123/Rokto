import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ADMIN_COOKIE, isValidAdminSession } from "@/lib/server/adminAuth";
import AdminClient from "./AdminClient";


export default async function AdminPage() {
  const jar = await cookies();
  if (!isValidAdminSession(jar.get(ADMIN_COOKIE)?.value)) redirect("/admin/login");
  return <AdminClient />;
}
