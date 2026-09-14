function toHex(bytes: Uint8Array) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function fromHex(value: string) {
  const bytes = new Uint8Array(value.length / 2);
  for (let index = 0; index < bytes.length; index += 1)
    bytes[index] = Number.parseInt(value.slice(index * 2, index * 2 + 2), 16);
  return bytes;
}

function randomHex(length = 16) {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return toHex(bytes);
}

export async function hashPassword(password: string, salt = randomHex()) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      salt: fromHex(salt),
      // Cloudflare Workers currently caps PBKDF2 at 100,000 iterations.
      iterations: 100_000,
    },
    key,
    256,
  );
  return { hash: toHex(new Uint8Array(bits)), salt };
}

export async function verifyPassword(
  password: string,
  expectedHash: string,
  salt: string,
) {
  const actual = await hashPassword(password, salt);
  if (actual.hash.length !== expectedHash.length) return false;
  let difference = 0;
  for (let index = 0; index < actual.hash.length; index += 1)
    difference |= actual.hash.charCodeAt(index) ^ expectedHash.charCodeAt(index);
  return difference === 0;
}

export async function hashOtp(challengeId: string, code: string) {
  const value = new TextEncoder().encode(`${challengeId}:${code}`);
  return toHex(new Uint8Array(await crypto.subtle.digest("SHA-256", value)));
}
