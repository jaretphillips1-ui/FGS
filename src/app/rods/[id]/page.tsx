import RodDetailClient from "./RodDetailClient";

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <RodDetailClient id={id} />;
}
