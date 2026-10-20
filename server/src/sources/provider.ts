export interface SourceCheckResult {
  status: 'ok' | 'error' | 'unavailable' | 'blocked';
  httpStatus?: number;
  notes?: string;
}

/**
 * Fetch a source URL to record freshness. Network failures are treated as
 * non-fatal: the goal is to surface status, never to block the app.
 */
export async function checkSource(url: string, timeoutMs = 8000): Promise<SourceCheckResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    let res = await fetch(url, { method: 'HEAD', redirect: 'follow', signal: controller.signal, headers: { 'user-agent': 'CARDWISE/0.1 source-check' } });
    if (res.status === 405 || res.status === 501) {
      res = await fetch(url, { method: 'GET', redirect: 'follow', signal: controller.signal, headers: { 'user-agent': 'CARDWISE/0.1 source-check' } });
    }
    if (res.status === 403 || res.status === 401) return { status: 'blocked', httpStatus: res.status, notes: 'Access blocked (auth/anti-bot). Requires manual verification.' };
    if (!res.ok) return { status: 'error', httpStatus: res.status };
    return { status: 'ok', httpStatus: res.status };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { status: 'unavailable', notes: message };
  } finally {
    clearTimeout(timer);
  }
}
