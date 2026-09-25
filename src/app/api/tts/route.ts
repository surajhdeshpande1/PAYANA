import { synthesize } from "@/lib/server/ai";
import type { Lang } from "@/lib/types";

export const maxDuration = 60;

export async function POST(request: Request) {
  let text = "";
  let lang: Lang = "en";
  try {
    const body = await request.json();
    text = String(body.text || "").slice(0, 900);
    lang = ["en", "kn", "hi"].includes(body.lang) ? body.lang : "en";
  } catch {
    return new Response("bad request", { status: 400 });
  }
  if (!text.trim()) return new Response("empty", { status: 400 });
  const wav = await synthesize(text, lang);
  if (typeof wav === "number") {
    return new Response(wav === 429 ? "rate limited" : "tts unavailable", {
      status: wav,
      headers: wav === 429 ? { "Retry-After": "60" } : undefined,
    });
  }
  return new Response(new Uint8Array(wav), {
    headers: { "Content-Type": "audio/wav", "Cache-Control": "no-store" },
  });
}
