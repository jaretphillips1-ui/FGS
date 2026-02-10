import { LuresCategoryPage, type SeedItem } from "../_components/LuresCategoryPage";

const ITEMS: SeedItem[] = [
  { model: "Casting Jigs", notes: "Later: weights + trailers + skirt colors.", status: "wishlist" },
  { model: "Swim Jigs", notes: "Later: head style + skirt colors + trailer pairing.", status: "wishlist" },
  { model: "Finesse Jigs", notes: "Later: small profile options.", status: "wishlist" },
];

export default function Page() {
  return (
    <LuresCategoryPage
      title="Lures"
      subtitle="Jigs — type-first. Then we add weights, trailers, and technique tie-ins."
      typeLabel="Jigs"
      items={ITEMS}
    />
  );
}
