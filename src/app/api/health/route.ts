import { aiStatus } from "@/lib/server/ai";

export const dynamic = "force-dynamic";

export function GET() {
  return Response.json({ ok: true, ai: aiStatus(), time: new Date().toISOString() });
}
