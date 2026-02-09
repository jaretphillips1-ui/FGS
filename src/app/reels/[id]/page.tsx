import ReelDetailClient from "./ReelDetailClient";

export default async function ReelDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ReelDetailClient id={id} />;
}
