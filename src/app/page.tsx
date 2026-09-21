import HomeInfo from "@/components/HomeInfo";
import SearchClient from "@/components/SearchClient";

// The homepage IS the search: public, no login. The red hero band is in the layout header;
// the search card is pulled up over its rounded bottom edge, and the info sections sit below.
export default function Home() {
  return (
    <>
      <div className="relative -mt-14">
        <SearchClient />
      </div>
      <HomeInfo />
    </>
  );
}
