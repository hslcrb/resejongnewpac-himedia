import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import type { ChatLine } from "./chat-router";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const publicKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const secret = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
function encryptionKey(): Buffer | null {
  const value = process.env.CHAT_ENCRYPTION_KEY || "";
  if (!/^[0-9a-f]{64}$/i.test(value)) return null;
  return Buffer.from(value, "hex");
}
export function vaultEnabled() {
  return Boolean(url && publicKey && secret && encryptionKey());
}
export async function verifiedUser(token: string): Promise<string | null> {
  if (!url || !publicKey || !token) return null;
  const auth = createClient(url, publicKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await auth.auth.getUser(token);
  return error ? null : data.user?.id || null;
}
function admin() {
  if (!vaultEnabled()) throw new Error("VAULT_NOT_CONFIGURED");
  return createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
}
function encrypt(value: ChatLine[]): string {
  const iv = randomBytes(12), key = encryptionKey()!;
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const text = Buffer.concat([cipher.update(JSON.stringify(value), "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), text].map(x => x.toString("base64url")).join(".");
}
function decrypt(blob: string): ChatLine[] {
  const [iv, tag, text] = blob.split(".").map(x => Buffer.from(x, "base64url"));
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey()!, iv);
  decipher.setAuthTag(tag);
  return JSON.parse(Buffer.concat([decipher.update(text), decipher.final()]).toString("utf8"));
}
export async function loadMessages(userId: string): Promise<ChatLine[]> {
  const { data, error } = await admin().from("ai_chat_histories").select("ciphertext").eq("user_id", userId).maybeSingle();
  if (error) throw error;
  return data?.ciphertext ? decrypt(data.ciphertext) : [];
}
export async function saveMessages(userId: string, messages: ChatLine[]): Promise<void> {
  const { error } = await admin().from("ai_chat_histories").upsert({
    user_id: userId, ciphertext: encrypt(messages.slice(-40)), updated_at: new Date().toISOString(),
  }, { onConflict: "user_id" });
  if (error) throw error;
}
