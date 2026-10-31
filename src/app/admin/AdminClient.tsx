"use client";

import { useCallback, useState } from "react";
import { btnSecondary } from "@/components/styles";
import { useT } from "@/components/LocaleProvider";
import { apiCall } from "@/lib/api";
import AdminTabs from "./AdminTabs";
import DonorsAdmin from "./DonorsAdmin";
import ReportsAdmin from "./ReportsAdmin";
import TeamAdmin from "./TeamAdmin";

type Tab = "donors" | "reports" | "team";

export default function AdminClient() {
  const t = useT();
  const [tab, setTab] = useState<Tab>("donors");

  // An expired/revoked session needs a full reload (not client routing) so the /admin Server
  // Component re-checks the cookie; same reason the login page hard-navigates on success.
  const goToLogin = useCallback((): void => {
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.href = "/admin/login";
  }, []);

  async function logout() {
    await apiCall("/api/admin/logout", "POST", {});
    goToLogin();
  }

  const tabs: Array<{ key: Tab; label: string }> = [
    { key: "donors", label: t.admin.tabDonors },
    { key: "reports", label: t.admin.tabReports },
    { key: "team", label: t.admin.tabTeam },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-ink">{t.admin.title}</h1>
        <button type="button" onClick={logout} className={`${btnSecondary} min-h-11 px-4`}>
          {t.admin.logout}
        </button>
      </div>
      <AdminTabs tabs={tabs} active={tab} onChange={setTab} label={t.admin.title} />
      <div id={`admin-panel-${tab}`} role="tabpanel" aria-labelledby={`admin-tab-${tab}`}>
        {tab === "donors" && <DonorsAdmin onUnauthorized={goToLogin} />}
        {tab === "reports" && <ReportsAdmin onUnauthorized={goToLogin} />}
        {tab === "team" && <TeamAdmin onUnauthorized={goToLogin} />}
      </div>
    </div>
  );
}
