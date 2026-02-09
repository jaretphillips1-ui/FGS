import ReelDetailClient from "./ReelDetailClient";

export default function ReelDetailPage({ params }: { params: { id: string } }) {
  return <ReelDetailClient id={params.id} />;
}