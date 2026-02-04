'use client';

import { createContext, useContext, useEffect, useState } from 'react';

type User = {
  userId: number;
  role: 'EMPLOYEE' | 'MANAGER' | 'ADMIN';
};

type AuthContextType = {
  user: User | null;
  login: (user: User) => void;
  logout: () => void;
};

// ✅ localStorage 복원 시 런타임 검증(최소 보강)
// - 잘못된 값/구버전 포맷/수동 편집 등으로 role 기반 UI가 깨지는 것을 방지
const AUTH_STORAGE_KEY = 'user';

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

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!stored) return;

    try {
      const parsed: unknown = JSON.parse(stored);

      // ✅ role/userId 최소 검증 후에만 복원
      if (isStoredUser(parsed)) {
        const o = parsed as unknown as Record<string, unknown>;
        const userId =
          typeof o.userId === 'number'
            ? o.userId
            : typeof o.userId === 'string'
              ? Number(o.userId)
              : NaN;

        // ✅ 저장된 포맷이 문자열이어도 내부 상태는 number로 정규화
        setUser({ userId, role: o.role as User['role'] });
      } else {
        // 구버전/오염 데이터는 제거(다음 로그인에서 정상 생성)
        localStorage.removeItem(AUTH_STORAGE_KEY);
        setUser(null);
      }
    } catch {
      localStorage.removeItem(AUTH_STORAGE_KEY);
      setUser(null);
    }
  }, []);

  function login(user: User) {
    setUser(user);
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));
  }

  function logout() {
    setUser(null);
    localStorage.removeItem(AUTH_STORAGE_KEY);
  }

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('AuthContext not found');
  return ctx;
}
