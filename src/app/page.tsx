import HomeChoice from "@/components/HomeChoice";
import HomeInfo from "@/components/HomeInfo";

// The find card carries the search itself; the hero (headline, lede, stat tiles) belongs to
// SiteHeader, so the red band can size itself around whatever it holds.
//
// `font-home` scopes the redesign's Bengali face (Hind Siliguri) to this page; every other route
// keeps Anek Bangla. The negative margin lifts the cards over the hero band's bottom edge.
export default function Home() {
  return (
    <div className="font-home">
      <div className="relative -mt-24">
        <HomeChoice />
      </div>
      <HomeInfo />
    </div>
  );
}
