import { recordingApi } from "@/features/recording/default-repository";

export const runtime = "nodejs";

export async function GET() {
  return recordingApi.listRecordings();
}
