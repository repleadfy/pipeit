import * as jose from "jose";

function getSecret(): Uint8Array {
  const s = process.env.JWT_SECRET;
  if (!s) throw new Error("JWT_SECRET is not set");
  return new TextEncoder().encode(s);
}

export interface JwtPayload {
  sub: string;
  email: string;
  name?: string;
  [key: string]: unknown;
}

export async function signJwt(payload: JwtPayload, expiresIn: string = "30d"): Promise<string> {
  return new jose.SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(getSecret());
}

export async function verifyJwt(token: string): Promise<JwtPayload> {
  const { payload } = await jose.jwtVerify(token, getSecret());
  return payload as unknown as JwtPayload;
}
