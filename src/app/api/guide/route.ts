import { runGuide, type GuideRequest } from "@/lib/server/ai";

export const maxDuration = 60;

const MAX_BODY = 4_000_000; // stay under Vercel's 4.5 MB request limit

export async function POST(request: Request) {
  const raw = await request.text();
  if (raw.length > MAX_BODY) {
    return Response.json({ error: "Payload too large" }, { status: 413 });
  }
  let body: GuideRequest;
  try {
    body = JSON.parse(raw);
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!["en", "kn", "hi"].includes(body.lang)) body.lang = "en";
  if (!["chat", "scan", "voice"].includes(body.mode)) body.mode = "chat";
  body.messages = (Array.isArray(body.messages) ? body.messages : [])
    .filter((m) => m && typeof m.text === "string" && (m.role === "user" || m.role === "assistant"))
    .map((m) => ({ role: m.role, text: m.text.slice(0, 2000) }))
    .slice(-10);

  const result = await runGuide(body);
  return Response.json(result, { headers: { "Cache-Control": "no-store" } });
}
