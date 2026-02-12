import { ApiError, ApiErrorResponse } from './types';
type RequestOptions = Omit<RequestInit, 'body'> & {
  body?: unknown; // JSON 자동 stringify
};

function isApiErrorResponse(x: unknown): x is ApiErrorResponse {
  return (
    !!x &&
    typeof x === 'object' &&
    typeof (x as Record<string, unknown>).timestamp === 'string' &&
    typeof (x as Record<string, unknown>).status === 'number' &&
    typeof (x as Record<string, unknown>).error === 'string' &&
    typeof (x as Record<string, unknown>).code === 'string' &&
    typeof (x as Record<string, unknown>).message === 'string' &&
    typeof (x as Record<string, unknown>).path === 'string'
  );
}

async function parseJsonSafe(res: Response): Promise<unknown> {
  const ct = res.headers.get('content-type') ?? '';
  if (!ct.includes('application/json')) return undefined;
  try {
    return await res.json();
  } catch {
    return undefined;
  }
}

function notifyUnauthorized(message?: string) {
  if (typeof window === 'undefined') return;
  try {
    window.dispatchEvent(
      new CustomEvent('auth:unauthorized', {
        detail: {
          message: message ?? '세션이 만료되었습니다. 다시 로그인해 주세요.',
        },
      })
    );
  } catch {
    // ignore
  }
}

export async function apiFetch<T>(
  url: string,
  options: RequestOptions = {}
): Promise<T> {
  const headers = new Headers(options.headers);

  // ✅ JWT(Bearer) 자동 주입(단일 지점)
  // - 이미 Authorization이 있으면 덮어쓰지 않음
  // - 브라우저 환경에서만 sessionStorage 접근
  if (!headers.has('Authorization') && typeof window !== 'undefined') {
    const token = window.sessionStorage.getItem('accessToken');
    if (token && token.trim().length > 0) {
      headers.set('Authorization', `Bearer ${token}`);
    }
  }

  const isFormData =
    typeof FormData !== 'undefined' && options.body instanceof FormData;
  let body: BodyInit | undefined;

  if (options.body !== undefined) {
    if (isFormData) {
      body = options.body as FormData;
    } else {
      if (!headers.has('content-type'))
        headers.set('content-type', 'application/json');
      body = JSON.stringify(options.body);
    }
  }

  const res = await fetch(url, {
    ...options,
    headers,
    body,
  });

  if (res.ok) {
    const data = await parseJsonSafe(res);
    return (data as T) ?? (undefined as T);
  }

  const payload = await parseJsonSafe(res);

  // ✅ 401(UNAUTHORIZED) 전역 처리: 토큰 만료/무효 시 단일 지점에서 로그인 UX로 유도
  if (res.status === 401) {
    const msg =
      isApiErrorResponse(payload) && payload.code === 'UNAUTHORIZED'
        ? payload.message
        : undefined;
    notifyUnauthorized(msg);
  }

  if (isApiErrorResponse(payload)) {
    throw new ApiError({
      message: payload.message,
      httpStatus: payload.status,
      code: payload.code,
      path: payload.path,
      raw: payload,
    });
  }

  throw new ApiError({
    message: `Request failed (${res.status})`,
    httpStatus: res.status,
    code: 'UNEXPECTED_ERROR_FORMAT',
    path: url,
    raw: payload,
  });
}
