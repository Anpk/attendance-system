'use client';

import { useFlashMessage, useRequireAuth } from '@/app/context/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import AppHeader from '@/app/_components/AppHeader';
import { toUserMessage } from '@/lib/api/error-messages';
import type { AdminEmployeeResponse, EmployeeRole } from '@/lib/api/types';
import { adminListEmployees, adminUpdateEmployee } from '@/lib/api/admin';

export default function AdminEmployeesPage() {
  const { user, ready, forbidden } = useRequireAuth({ roles: ['ADMIN'] });
  const router = useRouter();

  const [items, setItems] = useState<AdminEmployeeResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const { message, setFlashMessage } = useFlashMessage({ ttlMs: 4000 });

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editActive, setEditActive] = useState<boolean>(true);
  const [editRole, setEditRole] = useState<EmployeeRole>('EMPLOYEE');
  const [editSiteId, setEditSiteId] = useState<string>('1');

  async function refresh() {
    if (!user) return;
    setLoading(true);
    try {
      const data = await adminListEmployees(user.userId);
      setItems(data);
    } catch (e) {
      setFlashMessage(toUserMessage(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!ready) return;
    if (!user) return;
    if (forbidden) {
      setFlashMessage('권한이 없습니다.');
      return;
    }
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, ready, forbidden]);

  function startEdit(x: AdminEmployeeResponse) {
    setEditingId(x.userId);
    setEditActive(x.active);
    setEditRole(x.role);
    setEditSiteId(String(x.siteId));
  }

  function cancelEdit() {
    setEditingId(null);
  }

  async function submitUpdate(targetUserId: number) {
    if (!user) return;
    setLoading(true);
    try {
      const siteIdNum = Number(editSiteId);
      const body = {
        active: editActive,
        role: editRole,
        siteId: Number.isFinite(siteIdNum) ? siteIdNum : null,
      };
      const updated = await adminUpdateEmployee(
        user.userId,
        targetUserId,
        body
      );
      setItems((prev) =>
        prev.map((it) => (it.userId === targetUserId ? updated : it))
      );
      setFlashMessage('직원 정보가 수정되었습니다.');
      cancelEdit();
    } catch (e) {
      setFlashMessage(toUserMessage(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <AppHeader />

      <main className="mx-auto w-full max-w-3xl px-4 py-6">
        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-xl font-semibold">관리자 · 직원</h1>
          <button
            type="button"
            onClick={() => router.push('/admin/sites')}
            className="rounded border px-3 py-1 text-xs hover:bg-gray-50"
          >
            Site로 이동
          </button>
        </div>

        {message && (
          <div className="mb-4 rounded border bg-white px-3 py-2 text-sm">
            {message}
          </div>
        )}

        {ready && forbidden ? (
          <div className="rounded border bg-white p-4 text-sm">
            권한이 없습니다. (ADMIN 전용)
          </div>
        ) : (
          <section className="rounded border bg-white p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold">직원 목록</h2>
              <button
                type="button"
                onClick={refresh}
                disabled={loading}
                className="rounded border px-3 py-1 text-xs hover:bg-gray-50 disabled:opacity-50"
              >
                새로고침
              </button>
            </div>

            {items.length === 0 ? (
              <div className="text-sm text-gray-600">
                표시할 직원이 없습니다.
              </div>
            ) : (
              <ul className="space-y-2">
                {items.map((x) => {
                  const isEditing = editingId === x.userId;
                  return (
                    <li key={x.userId} className="rounded border p-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-sm">
                          <div className="font-medium">
                            #{x.userId} · {x.role}
                          </div>
                          <div className="text-xs text-gray-600">
                            active: {String(x.active)} · siteId: {x.siteId}
                          </div>
                        </div>

                        {!isEditing ? (
                          <button
                            type="button"
                            onClick={() => startEdit(x)}
                            className="rounded border px-3 py-1 text-xs hover:bg-gray-50"
                          >
                            수정
                          </button>
                        ) : (
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => submitUpdate(x.userId)}
                              disabled={loading}
                              className="rounded border px-3 py-1 text-xs hover:bg-gray-50 disabled:opacity-50"
                            >
                              저장
                            </button>
                            <button
                              type="button"
                              onClick={cancelEdit}
                              disabled={loading}
                              className="rounded border px-3 py-1 text-xs hover:bg-gray-50 disabled:opacity-50"
                            >
                              취소
                            </button>
                          </div>
                        )}
                      </div>

                      {isEditing && (
                        <div className="mt-3 grid gap-2">
                          <label className="flex items-center gap-2 text-xs text-gray-700">
                            <input
                              type="checkbox"
                              checked={editActive}
                              onChange={(e) => setEditActive(e.target.checked)}
                            />
                            active
                          </label>

                          <label className="text-xs text-gray-700">
                            role
                            <select
                              value={editRole}
                              onChange={(e) =>
                                setEditRole(e.target.value as EmployeeRole)
                              }
                              className="mt-1 w-full rounded border px-3 py-2 text-sm"
                            >
                              <option value="EMPLOYEE">EMPLOYEE</option>
                              <option value="MANAGER">MANAGER</option>
                              <option value="ADMIN">ADMIN</option>
                            </select>
                          </label>

                          <label className="text-xs text-gray-700">
                            siteId
                            <input
                              value={editSiteId}
                              onChange={(e) => setEditSiteId(e.target.value)}
                              className="mt-1 w-full rounded border px-3 py-2 text-sm"
                              inputMode="numeric"
                            />
                          </label>

                          <div className="text-xs text-gray-500">
                            * siteId는 존재하는 siteId여야 합니다. (서버 검증)
                          </div>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        )}
      </main>
    </div>
  );
}
