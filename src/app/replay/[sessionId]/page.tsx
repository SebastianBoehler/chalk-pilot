import type { Metadata } from "next";
import { ReplaySessionLoader } from "@/components/replay/replay-session-loader";

export const metadata: Metadata = { title: "Session replay" };

export default async function ReplaySessionPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  return <ReplaySessionLoader sessionId={sessionId} />;
}
