import { aiModels, aiStatus } from "@/lib/server/ai";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const withModels = new URL(request.url).searchParams.get("models") === "1";
  return Response.json({
    ok: true,
    ai: aiStatus(),
    ...(withModels ? { models: await aiModels() } : {}),
    time: new Date().toISOString(),
  });
}
