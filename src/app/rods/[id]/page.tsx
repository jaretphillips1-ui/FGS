import RodDetailClient from "./RodDetailClient";

export default function Page({ params }: { params: { id: string } }) {
  return <RodDetailClient id={params.id} />;
}
