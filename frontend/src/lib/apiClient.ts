const BASE_URL = '/api/v1';

export class ApiError extends Error {
  constructor(public code: string, message: string, public status: number) {
    super(message);
  }
}

// Access token kept in memory + localStorage (simplest working approach for a
// first pass — vulnerable to XSS reading localStorage; a production hardening
// pass would move to an httpOnly cookie + CSRF token instead).
let accessToken: string | null = localStorage.getItem('hrms_access_token');

export function setAccessToken(token: string | null) {
  accessToken = token;
  if (token) localStorage.setItem('hrms_access_token', token);
  else localStorage.removeItem('hrms_access_token');
}

export function getAccessToken() {
  return accessToken;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json', ...(options.headers as Record<string, string>) };
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

  const res = await fetch(`${BASE_URL}${path}`, { ...options, headers });
  const isJson = res.headers.get('content-type')?.includes('application/json');
  const body = isJson ? await res.json() : null;

  if (!res.ok) {
    const code = body?.error?.code ?? 'UNKNOWN_ERROR';
    const message = body?.error?.message ?? body?.message ?? 'Request failed';
    throw new ApiError(code, message, res.status);
  }
  return body as T;
}

export const api = {
  get: <T>(path: string) => request<T>(path, { method: 'GET' }),
  post: <T>(path: string, data?: unknown) => request<T>(path, { method: 'POST', body: data ? JSON.stringify(data) : undefined }),
  patch: <T>(path: string, data?: unknown) => request<T>(path, { method: 'PATCH', body: data ? JSON.stringify(data) : undefined }),
};
