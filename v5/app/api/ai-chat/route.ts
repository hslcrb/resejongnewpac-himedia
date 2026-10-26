import { NextRequest, NextResponse } from "next/server";
import { routeChat, type ChatLine } from "../../../src/lib/chat-router";
import { verifiedUser, vaultEnabled, loadMessages, saveMessages } from "../../../src/lib/chat-vault";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const MAX_MESSAGES = 20;
function validMessages(value: unknown): value is ChatLine[] {
  return Array.isArray(value) && value.length > 0 && value.length <= MAX_MESSAGES &&
    value.every(v => v && typeof v === "object" &&
      ["user", "assistant"].includes(v.role) &&
      typeof v.content === "string" && v.content.length > 0 && v.content.length <= 2500);
}
function headers() { return { "Cache-Control": "no-store" }; }
async function identify(request: NextRequest) {
  const bearer = request.headers.get("authorization") || "";
  return bearer.startsWith("Bearer ") ? verifiedUser(bearer.slice(7)) : null;
}
export async function GET(request: NextRequest) {
  if (!vaultEnabled()) return NextResponse.json({ messages: [], persistence: "unavailable" }, { headers: headers() });
  const user = await identify(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: headers() });
  try { return NextResponse.json({ messages: await loadMessages(user) }, { headers: headers() }); }
  catch { return NextResponse.json({ error: "History unavailable" }, { status: 503, headers: headers() }); }
}
export async function POST(request: NextRequest) {
  if (request.headers.get("content-type")?.split(";")[0] !== "application/json" ||
      Number(request.headers.get("content-length") || 0) > 64000) {
    return NextResponse.json({ error: "Invalid content" }, { status: 415, headers: headers() });
  }
  const origin = request.headers.get("origin");
  if (origin && origin !== request.nextUrl.origin) return NextResponse.json({ error: "Forbidden" }, { status: 403, headers: headers() });
  let payload: unknown;
  try { payload = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400, headers: headers() }); }
  const messages = (payload as { messages?: unknown })?.messages;
  if (!validMessages(messages) || messages.at(-1)?.role !== "user") {
    return NextResponse.json({ error: "Invalid messages" }, { status: 400, headers: headers() });
  }
  const user = vaultEnabled() ? await identify(request) : null;
  try {
    const text = await routeChat(messages);
    let stored = false;
    if (user) {
      try { await saveMessages(user, [...messages, { role: "assistant", content: text }]); stored = true; }
      catch { /* Response remains available when DB is down. */ }
    }
    return NextResponse.json({ text, stored }, { headers: headers() });
  } catch (error) {
    const config = error instanceof Error && error.message === "LLM_NOT_CONFIGURED";
    return NextResponse.json({ error: config ? "AI 상담이 아직 설정되지 않았습니다." : "현재 상담 연결이 원활하지 않습니다." }, { status: 503, headers: headers() });
  }
}
