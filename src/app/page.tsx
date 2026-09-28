import HomeChoice from "@/components/HomeChoice";
import HomeInfo from "@/components/HomeInfo";

// The homepage is just the choice: look for a donor, or register as one. The search tool itself
// lives at /search, so nobody's details load until someone deliberately asks to search.
export default function Home() {
  return (
    <>
      <div className="relative -mt-14">
        <HomeChoice />
      </div>
      <HomeInfo />
    </>
  );
}
