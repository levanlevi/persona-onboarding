// AES-GCM sealed cookies, so the Gmail access token never reaches client JS.
const enc = new TextEncoder();
const dec = new TextDecoder();

async function key() {
  const raw = await crypto.subtle.digest("SHA-256", enc.encode(process.env.SESSION_SECRET ?? ""));
  return crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["encrypt", "decrypt"]);
}

const b64 = (buf: ArrayBuffer | Uint8Array) => Buffer.from(buf as ArrayBuffer).toString("base64url");

export async function seal(data: unknown): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await key(), enc.encode(JSON.stringify(data)));
  return `${b64(iv)}.${b64(ct)}`;
}

export async function unseal<T>(value: string | undefined): Promise<T | null> {
  if (!value) return null;
  try {
    const [iv, ct] = value.split(".").map((p) => Buffer.from(p, "base64url"));
    const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, await key(), ct);
    return JSON.parse(dec.decode(pt)) as T;
  } catch {
    return null;
  }
}
