const TOKEN_KEY = "kb_token";
const EMAIL_KEY = "kb_email";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
  // Also set a cookie so Next.js middleware can read it for route protection
  document.cookie = `kb_token=${token}; path=/; max-age=${COOKIE_MAX_AGE}; SameSite=Lax`;
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(EMAIL_KEY);
  // Expire the cookie immediately
  document.cookie = "kb_token=; path=/; max-age=0";
}

export function getStoredEmail(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(EMAIL_KEY);
}

export function setStoredEmail(email: string): void {
  localStorage.setItem(EMAIL_KEY, email);
}

const GEMINI_KEY = "kb_gemini_key";

export function getGeminiKey(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(GEMINI_KEY);
}

export function setGeminiKey(key: string): void {
  localStorage.setItem(GEMINI_KEY, key);
}

export function clearGeminiKey(): void {
  localStorage.removeItem(GEMINI_KEY);
}
