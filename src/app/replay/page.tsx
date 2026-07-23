import type { Metadata } from "next";
import { ReplayLibraryLoader } from "@/components/replay/replay-library-loader";

export const metadata: Metadata = { title: "Replay Studio" };

export default function ReplayPage() {
  return <ReplayLibraryLoader />;
}
