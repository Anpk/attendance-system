'use client';

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useRouter } from 'next/navigation';

type User = {
  userId: number;
  role: 'EMPLOYEE' | 'MANAGER' | 'ADMIN';
};

type AuthContextType = {
  user: User | null;
  ready: boolean;
  // accessToken은 선택: 호출자가 이미 sessionStorage에 저장했으면 생략 가능
  login: (user: User, accessToken?: string) => void;
  logout: () => void;
};

// ✅ localStorage 복원 시 런타임 검증(최소 보강)
// - 잘못된 값/구버전 포맷/수동 편집 등으로 role 기반 UI가 깨지는 것을 방지
const AUTH_STORAGE_KEY = 'user';
// ✅ JWT access token은 sessionStorage에 저장(브라우저 탭 단위)
const ACCESS_TOKEN_KEY = 'accessToken';

const ALLOWED_ROLES = ['EMPLOYEE', 'MANAGER', 'ADMIN'] as const;

type AllowedRole = (typeof ALLOWED_ROLES)[number];

function isAllowedRole(v: unknown): v is AllowedRole {
  return (
    typeof v === 'string' && (ALLOWED_ROLES as readonly string[]).includes(v)
  );
}

function isStoredUser(v: unknown): v is User {
  if (!v || typeof v !== 'object') return false;
  const o = v as Record<string, unknown>;

  // ✅ userId는 number 또는 숫자 문자열을 허용(입력값/구버전 호환)
  const rawUserId = o.userId;
  const userIdNum =
    typeof rawUserId === 'number'
      ? rawUserId
      : typeof rawUserId === 'string' && rawUserId.trim().length > 0
        ? Number(rawUserId)
        : NaN;

  return Number.isFinite(userIdNum) && isAllowedRole(o.role);
}

const AuthContext = createContext<AuthContextType | null>(null);

function readStoredUser(): User | null {
  if (typeof window === 'undefined') return null;

  const stored = window.localStorage.getItem(AUTH_STORAGE_KEY);
  if (!stored) return null;

  try {
    const parsed: unknown = JSON.parse(stored);

    if (!isStoredUser(parsed)) return null;

    const o = parsed as Record<string, unknown>;
    const userId =
      typeof o.userId === 'number'
        ? o.userId
        : typeof o.userId === 'string'
          ? Number(o.userId)
          : NaN;

    if (!Number.isFinite(userId)) return null;

    return { userId, role: o.role as User['role'] };
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const restored = readStoredUser();
    if (restored) {
      setUser(restored);
    } else {
      // 저장값이 없거나 유효하지 않으면 정리
      localStorage.removeItem(AUTH_STORAGE_KEY);
      setUser(null);
      // stray token 정리(로그아웃 상태 보장)
      if (typeof window !== 'undefined') {
        window.sessionStorage.removeItem(ACCESS_TOKEN_KEY);
      }
    }

    // client hydration 완료 (SSR/CSR 첫 렌더 불일치 방지)
    setReady(true);
  }, []);

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

  const allowedRoles = options.roles;

  const forbidden = useMemo(() => {
    if (!ready) return false;
    if (!user) return false;
    if (!allowedRoles || allowedRoles.length === 0) return false;
    return !allowedRoles.includes(user.role);
  }, [ready, user, allowedRoles]);

  useEffect(() => {
    if (!ready) return;
    if (!user) router.push('/login');
  }, [ready, user, router]);

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
