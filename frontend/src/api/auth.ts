const API_BASE = import.meta.env.VITE_API_BASE_URL ||
  (import.meta.env.VITE_API_URL ? new URL(import.meta.env.VITE_API_URL).origin : "");

export interface UserProfile {
  id: string;
  displayName?: string;
  emails?: Array<{ value?: string }> | null;
}

export async function getCurrentUser(): Promise<UserProfile | null> {
  const res = await fetch(`${API_BASE}/api/auth/me`, {
    credentials: "include",
  });
  if (res.status === 401) return null;
  if (!res.ok) throw new Error("Failed to fetch user");
  const body = await res.json();
  return body.user ?? null;
}

export function loginWithGoogle(): void {
  // Redirect to backend auth start (auth routes are mounted under /api)
  window.location.href = `${API_BASE}/api/auth/google`;
}

export async function logout(): Promise<void> {
  await fetch(`${API_BASE}/api/auth/logout`, {
    method: "POST",
    credentials: "include",
  });
}
