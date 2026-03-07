import { useAuthStore } from '../store/auth.store';

interface JwtPayload {
  sub: string;
  email: string;
  role: string;
  tenantId?: string;
  exp: number;
  iat: number;
}

export function useJwt(): JwtPayload | null {
  const token = useAuthStore(s => s.accessToken);
  if (!token) return null;
  try {
    const payload = token.split('.')[1];
    return JSON.parse(atob(payload)) as JwtPayload;
  } catch {
    return null;
  }
}

export function useIsExpired(): boolean {
  const jwt = useJwt();
  if (!jwt) return true;
  return Date.now() / 1000 > jwt.exp;
}
