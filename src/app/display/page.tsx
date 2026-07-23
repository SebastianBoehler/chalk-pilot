import type { Metadata } from "next";
import { DisplaySurface } from "@/components/canvas/display-surface";

export const metadata: Metadata = {
  title: "Presentation",
};

export default function DisplayPage() {
  return <DisplaySurface />;
}
