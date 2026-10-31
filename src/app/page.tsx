import HomeChoice from "@/components/HomeChoice";
import HomeInfo from "@/components/HomeInfo";

// The homepage is just the choice: look for a donor, or register as one. The search tool itself
// lives at /search, so nobody's details load until someone deliberately asks to search.
//
// `font-home` scopes the redesign's Bengali face (Hind Siliguri) to this page; every other route
// keeps Anek Bangla. The negative margin lifts the action cards over the hero band's bottom edge.
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
