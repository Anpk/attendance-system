'use client';

import {
  useCallback,
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { apiFetch } from '@/lib/api/client';
import { ApiError, type AuthMeResponse } from '@/lib/api/types';

type User = {
  userId: number;
  role: 'EMPLOYEE' | 'MANAGER' | 'ADMIN';
  siteId?: number;
  active?: boolean;
};

type AuthContextType = {
  user: User | null;
  ready: boolean;
  // accessToken은 선택: 호출자가 이미 sessionStorage에 저장했으면 생략 가능
  login: (user: User, accessToken?: string) => void;
  logout: () => void;
};

const AUTH_STORAGE_KEY = 'user';
// ✅ JWT access token은 sessionStorage에 저장(브라우저 탭 단위)
const ACCESS_TOKEN_KEY = 'accessToken';
const AUTH_REVALIDATE_INTERVAL_MS = 60_000;

const AuthContext = createContext<AuthContextType | null>(null);

function getApiBaseUrl(): string {
  const raw = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8080';
  return raw.replace(/\/+$/, '');
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

type LoginReason = 'expired' | 'inactive';

function buildLoginUrl(reason: LoginReason): string {
  if (typeof window === 'undefined') return '/login';
  const nextPath = `${window.location.pathname}${window.location.search ?? ''}`;
  return `/login?reason=${reason}&next=${encodeURIComponent(nextPath)}`;
}

function toUserFromMe(me: AuthMeResponse): User {
  return {
    userId: me.userId,
    role: me.role,
    siteId: me.siteId,
    active: me.active,
  };
}

function isSameUser(a: User | null, b: User): boolean {
  if (!a) return false;
  return (
    a.userId === b.userId &&
    a.role === b.role &&
    a.siteId === b.siteId &&
    a.active === b.active
  );
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const router = useRouter();
  const unauthorizedHandledRef = useRef(false);
  const sessionRevalidateInFlightRef = useRef(false);

  const clearSessionState = useCallback(() => {
    setUser(null);
    if (typeof window !== 'undefined') {
      localStorage.removeItem(AUTH_STORAGE_KEY);
      window.sessionStorage.removeItem(ACCESS_TOKEN_KEY);
    }
  }, []);

  const redirectToLogin = useCallback(
    (reason: LoginReason) => {
      if (typeof window === 'undefined') return;
      const loginUrl = buildLoginUrl(reason);
      try {
        window.history.replaceState(null, '', loginUrl);
      } catch {
        // ignore
      }
      router.replace(loginUrl);
    },
    [router]
  );

  const forceLogout = useCallback(
    (reason: LoginReason) => {
      clearSessionState();
      setReady(true);
      redirectToLogin(reason);
    },
    [clearSessionState, redirectToLogin]
  );

  const applyAuthMe = useCallback(
    (me: AuthMeResponse): boolean => {
      if (!me.active) {
        forceLogout('inactive');
        return false;
      }

      const nextUser = toUserFromMe(me);
      setUser((prev) => (isSameUser(prev, nextUser) ? prev : nextUser));
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(nextUser));
      return true;
    },
    [forceLogout]
  );

  const revalidateSession = useCallback(async () => {
    if (typeof window === 'undefined') return;

    const token = window.sessionStorage.getItem(ACCESS_TOKEN_KEY);
    if (!token || token.trim().length === 0) return;
    if (sessionRevalidateInFlightRef.current) return;

    sessionRevalidateInFlightRef.current = true;
    try {
      const me = await apiFetch<AuthMeResponse>(`${getApiBaseUrl()}/api/auth/me`);
      applyAuthMe(me);
    } catch (e: unknown) {
      const isAuthError =
        e instanceof ApiError &&
        (e.httpStatus === 401 || e.httpStatus === 403);
      if (isAuthError) {
        forceLogout('expired');
      }
      // 네트워크/일시 오류는 다음 주기에 재시도
    } finally {
      sessionRevalidateInFlightRef.current = false;
    }
  }, [applyAuthMe, forceLogout]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    function onUnauthorized() {
      if (unauthorizedHandledRef.current) return;
      unauthorizedHandledRef.current = true;
      forceLogout('expired');

      // 연속 호출 레이스 방지(짧은 락)
      setTimeout(() => {
        unauthorizedHandledRef.current = false;
      }, 1500);
    }

    window.addEventListener('auth:unauthorized', onUnauthorized);

    function onPageShow(ev: PageTransitionEvent) {
      // BFCache 복원 시 세션이 이미 정리된 상태면 로그인으로 유도
      if (!ev.persisted) return;
      const token = window.sessionStorage.getItem(ACCESS_TOKEN_KEY);
      if (token && token.trim().length > 0) return;
      forceLogout('expired');
    }

    window.addEventListener('pageshow', onPageShow);

    return () => {
      window.removeEventListener('auth:unauthorized', onUnauthorized);
      window.removeEventListener('pageshow', onPageShow);
    };
  }, [forceLogout]);

  useEffect(() => {
    let cancelled = false;

    async function restore() {
      if (typeof window === 'undefined') {
        if (!cancelled) setReady(true);
        return;
      }

      // ✅ token이 없으면 로그인 상태로 간주하지 않음
      const token = window.sessionStorage.getItem(ACCESS_TOKEN_KEY);
      if (!token || token.trim().length === 0) {
        clearSessionState();
        if (!cancelled) {
          setReady(true);
        }
        return;
      }

      try {
        // ✅ Bearer는 apiFetch에서 자동 주입됨
        const me = await apiFetch<AuthMeResponse>(
          `${getApiBaseUrl()}/api/auth/me`
        );
        if (cancelled) return;
        applyAuthMe(me);
        setReady(true);
      } catch (e: unknown) {
        // ✅ 401/403은 재시도 금지(토큰 만료/권한 문제)
        const isAuthError =
          e instanceof ApiError &&
          (e.httpStatus === 401 || e.httpStatus === 403);

        if (!isAuthError) {
          // ✅ 네트워크/일시 장애/5xx 등: 1회 재시도
          try {
            await sleep(300);
            const me2 = await apiFetch<AuthMeResponse>(
              `${getApiBaseUrl()}/api/auth/me`
            );
            if (cancelled) return;
            applyAuthMe(me2);
            setReady(true);
            return;
          } catch {
            // fallthrough to clear
          }
        }

        // 만료/무효 토큰 또는 재시도 실패: 저장값 정리 후 비로그인 상태로 전환
        clearSessionState();
        if (!cancelled) {
          setReady(true);
        }
      }
    }

    restore();

    return () => {
      cancelled = true;
    };
  }, [applyAuthMe, clearSessionState]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!ready || !user) return;

    const onFocus = () => {
      void revalidateSession();
    };

    const onVisibilityChange = () => {
      if (document.visibilityState !== 'visible') return;
      void revalidateSession();
    };

    const timerId = window.setInterval(() => {
      void revalidateSession();
    }, AUTH_REVALIDATE_INTERVAL_MS);

    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      window.clearInterval(timerId);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [ready, revalidateSession, user]);

  function login(nextUser: User, accessToken?: string) {
    setUser(nextUser);
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(nextUser));

    // accessToken이 제공되면 sessionStorage에 저장
    if (typeof window !== 'undefined') {
      if (accessToken && accessToken.trim().length > 0) {
        window.sessionStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
      }
    }

    setReady(true);
  }

  function logout() {
    setUser(null);
    localStorage.removeItem(AUTH_STORAGE_KEY);
    if (typeof window !== 'undefined') {
      window.sessionStorage.removeItem(ACCESS_TOKEN_KEY);
    }
    setReady(true);
  }

  return (
    <AuthContext.Provider value={{ user, ready, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('AuthContext not found');
  return ctx;
}

export type RequireAuthOptions = {
  roles?: User['role'][];
};

/**
 * 공통 인증/권한 가드
 * - ready 전에는 아무 것도 하지 않음(SSR/CSR 불일치/레이스 방지)
 * - ready 후 user 없으면 /login으로 이동
 * - roles가 있으면 forbidden 계산(페이지에서 권한없음 UI 표시용)
 */
export function useRequireAuth(options: RequireAuthOptions = {}) {
  const { user, ready } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const nextPath = useMemo(() => {
    const qs = searchParams?.toString?.() ?? '';
    return qs && qs.length > 0 ? `${pathname}?${qs}` : pathname;
  }, [pathname, searchParams]);

  const allowedRoles = options.roles;

  const forbidden = useMemo(() => {
    if (!ready) return false;
    if (!user) return false;
    if (!allowedRoles || allowedRoles.length === 0) return false;
    return !allowedRoles.includes(user.role);
  }, [ready, user, allowedRoles]);

  useEffect(() => {
    if (!ready) return;
    if (!user) router.push(`/login?next=${encodeURIComponent(nextPath)}`);
  }, [ready, user, router, nextPath]);

  return { user, ready, forbidden };
}

export type FlashMessageOptions = {
  ttlMs?: number;
};

/**
 * 공통 Flash Message 훅
 * - 동일한 TTL 동작을 페이지마다 중복 구현하지 않도록 통일
 */
export function useFlashMessage(options: FlashMessageOptions = {}) {
  const ttlMs = options.ttlMs ?? 4000;

  const [message, setMessage] = useState('');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function clearMessage() {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setMessage('');
  }

  function setFlashMessage(next: string) {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setMessage(next);
    timerRef.current = setTimeout(() => {
      setMessage('');
      timerRef.current = null;
    }, ttlMs);
  }

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return { message, setFlashMessage, clearMessage };
}
