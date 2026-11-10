export interface AuthUser {
  id: string;
  username: string;
  displayName?: string;
  avatarUrl?: string;
  isGuest?: boolean;
}

export interface AuthResult {
  isValid: boolean;
  user?: AuthUser;
  error?: string;
}

function base64UrlDecode(str: string): Uint8Array {
  // Add padding if needed
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4 !== 0) {
    base64 += '=';
  }
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function decodeJson<T = any>(str: string): T | null {
  try {
    const bytes = base64UrlDecode(str);
    const text = new TextDecoder().decode(bytes);
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export async function verifyJwt(
  token: string,
  secret: string
): Promise<AuthResult> {
  if (!token || typeof token !== 'string') {
    return { isValid: false, error: 'Token is missing' };
  }

  // Handle guest tokens (format: guest_local_... or guest:...)
  if (token.startsWith('guest_') || token.startsWith('guest:')) {
    const cleanId = token.trim();
    return {
      isValid: true,
      user: {
        id: cleanId,
        username: cleanId.slice(0, 15),
        displayName: `Misafir ${cleanId.slice(-4)}`,
        isGuest: true,
      },
    };
  }

  const parts = token.split('.');
  if (parts.length !== 3) {
    return { isValid: false, error: 'Invalid JWT structure' };
  }

  const [headerB64, payloadB64, signatureB64] = parts;
  const header = decodeJson<{ alg: string; typ?: string }>(headerB64);
  const payload = decodeJson<{
    userId?: string;
    id?: string;
    sub?: string;
    username?: string;
    displayName?: string;
    avatarUrl?: string;
    isGuest?: boolean;
    exp?: number;
  }>(payloadB64);

  if (!header || !payload) {
    return { isValid: false, error: 'Malformed JWT components' };
  }

  // Allow HS256 algorithm
  if (header.alg !== 'HS256') {
    return { isValid: false, error: `Unsupported algorithm: ${header.alg}` };
  }

  // Check expiration
  if (payload.exp && typeof payload.exp === 'number') {
    const nowSec = Math.floor(Date.now() / 1000);
    if (nowSec > payload.exp) {
      return { isValid: false, error: 'Token has expired' };
    }
  }

  // Verify HMAC-SHA256 signature using Web Crypto API
  try {
    const encoder = new TextEncoder();
    const dataToVerify = encoder.encode(`${headerB64}.${payloadB64}`);
    const signatureBytes = base64UrlDecode(signatureB64);

    // SECURITY: only the configured secret is accepted. The previous hardcoded
    // fallback secret was committed to a public repository, which allowed anyone
    // to forge valid identity tokens for the realtime gateway.
    if (!secret) {
      return { isValid: false, error: 'Verification secret is not configured' };
    }

    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );

    const verified = await crypto.subtle.verify(
      'HMAC',
      key,
      signatureBytes,
      dataToVerify
    );

    if (!verified) {
      return { isValid: false, error: 'Invalid token signature' };
    }

    const userId = payload.userId || payload.id || payload.sub;
    if (!userId) {
      return { isValid: false, error: 'Missing userId in payload' };
    }

    return {
      isValid: true,
      user: {
        id: String(userId),
        username: payload.username || `user_${String(userId).slice(0, 6)}`,
        displayName: payload.displayName || payload.username,
        avatarUrl: payload.avatarUrl,
        isGuest: !!payload.isGuest,
      },
    };
  } catch (err: any) {
    return { isValid: false, error: err.message || 'Signature verification error' };
  }
}
