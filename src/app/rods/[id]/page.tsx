import RodDetailClient from "./RodDetailClient";

export default async function Page(props: { params: Promise<{ id: string }> | { id: string } }) {
  const params = await props.params;
  return <RodDetailClient id={params.id} />;
}