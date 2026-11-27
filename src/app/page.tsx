import { redirect } from "next/navigation";
import HomeChoice from "@/components/HomeChoice";
import HomeInfo from "@/components/HomeInfo";
import VisitPing from "@/components/VisitPing";
import { prelaunch } from "@/lib/server/prelaunch";

// The find card carries the search itself; the hero (headline, lede, stat tiles) belongs to
// SiteHeader, so the red band can size itself around whatever it holds.
//
// `font-home` scopes the redesign's Bengali face (Hind Siliguri) to this page; every other route
// keeps Anek Bangla. The negative margin lifts the cards over the hero band's bottom edge.
export default function Home() {
  // Pre-launch: everyone arriving at the shared link gets the launch page. Redirecting rather than
  // rendering it here keeps /soon the single place that page lives, and keeps the URL honest.
  if (prelaunch()) redirect("/soon");
  return (
    <div className="font-home">
      {/* Renders nothing; counts this browser once for the hero's visitor tile. */}
      <VisitPing />
      <div className="relative -mt-24">
        <HomeChoice />
      </div>
      <HomeInfo />
    </div>
  );
}
