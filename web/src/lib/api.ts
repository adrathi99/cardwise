const BASE = '/api';

async function req<T>(method: string, url: string, body?: unknown): Promise<T> {
  const res = await fetch(BASE + url, {
    method,
    headers: body ? { 'content-type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    let message = `${res.status} ${res.statusText}`;
    try {
      const j = await res.json();
      if (j?.error) message = j.error;
    } catch {
      /* ignore */
    }
    throw new Error(message);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const api = {
  get: <T>(url: string) => req<T>('GET', url),
  post: <T>(url: string, body?: unknown) => req<T>('POST', url, body),
  patch: <T>(url: string, body?: unknown) => req<T>('PATCH', url, body),
  del: <T>(url: string) => req<T>('DELETE', url),
};

export class UploadError extends Error {
  needsPassword: boolean;
  constructor(message: string, needsPassword = false) {
    super(message);
    this.name = 'UploadError';
    this.needsPassword = needsPassword;
  }
}

export async function uploadStatement(userCardId: number, file: File, password?: string) {
  const form = new FormData();
  form.append('userCardId', String(userCardId));
  form.append('file', file);
  if (password) form.append('password', password);
  const res = await fetch(`${BASE}/statements/upload`, { method: 'POST', body: form });
  if (!res.ok) {
    let message = `${res.status} ${res.statusText}`;
    let needsPassword = false;
    try {
      const j = await res.json();
      if (j?.error) message = j.error;
      if (j?.needsPassword) needsPassword = true;
    } catch {
      /* ignore */
    }
    throw new UploadError(message, needsPassword);
  }
  return res.json();
}
