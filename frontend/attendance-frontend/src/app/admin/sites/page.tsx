'use client';

import { useFlashMessage, useRequireAuth } from '@/app/context/AuthContext';
import { useEffect, useState } from 'react';

import AppHeader from '@/app/_components/AppHeader';
import { toUserMessage } from '@/lib/api/error-messages';
import type { AdminSiteResponse } from '@/lib/api/types';
import {
  adminCreateSite,
  adminListSites,
  adminUpdateSite,
} from '@/lib/api/admin';

export default function AdminSitesPage() {
  const { user, ready, forbidden } = useRequireAuth({
    roles: ['ADMIN', 'MANAGER'],
  });

  const [items, setItems] = useState<AdminSiteResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const { message, setFlashMessage } = useFlashMessage({ ttlMs: 4000 });

  const [createName, setCreateName] = useState('');

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [editActive, setEditActive] = useState<boolean>(true);

  async function refresh() {
    if (!user) return;
    setLoading(true);
    try {
      const data = await adminListSites(user.userId);
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
    if (forbidden) return;
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, ready, forbidden]);

  function startEdit(s: AdminSiteResponse) {
    setEditingId(s.siteId);
    setEditName(s.name);
    setEditActive(s.active);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditName('');
    setEditActive(true);
  }

  async function submitCreate() {
    if (!user) return;
    if (user.role !== 'ADMIN') {
      setFlashMessage('권한이 없습니다.');
      return;
    }
    const name = createName.trim();
    if (!name) {
      setFlashMessage('site name은 필수입니다.');
      return;
    }
    setLoading(true);
    try {
      await adminCreateSite(user.userId, { name });
      setCreateName('');
      await refresh();
      setFlashMessage('Site가 생성되었습니다.');
    } catch (e) {
      setFlashMessage(toUserMessage(e));
    } finally {
      setLoading(false);
    }
  }

  async function submitUpdate(siteId: number) {
    if (!user) return;
    setLoading(true);
    try {
      const body = {
        name: editName.trim(),
        active: editActive,
      };
      const updated = await adminUpdateSite(user.userId, siteId, body);
      setItems((prev) => prev.map((x) => (x.siteId === siteId ? updated : x)));
      setFlashMessage('Site가 수정되었습니다.');
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
        <h1 className="mb-4 text-xl font-semibold">관리자 · Site</h1>

        {ready && forbidden && (
          <div className="mb-4 rounded border bg-white p-4 text-sm">
            권한이 없습니다. (ADMIN/MANAGER 전용)
          </div>
        )}

        {message && (
          <div className="mb-4 rounded border bg-white px-3 py-2 text-sm">
            {message}
          </div>
        )}

        {/* Create (ADMIN only) */}
        {user?.role === 'ADMIN' && (
          <section className="mb-6 rounded border bg-white p-4">
            <h2 className="mb-3 text-sm font-semibold">Site 생성</h2>
            <div className="flex gap-2">
              <input
                value={createName}
                onChange={(e) => setCreateName(e.target.value)}
                placeholder="Site name"
                className="flex-1 rounded border px-3 py-2 text-sm"
              />
              <button
                type="button"
                onClick={submitCreate}
                disabled={loading}
                className="rounded border px-3 py-2 text-sm hover:bg-gray-50 disabled:opacity-50"
              >
                생성
              </button>
            </div>
          </section>
        )}

        <section className="rounded border bg-white p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold">Site 목록</h2>
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
            <div className="text-sm text-gray-600">표시할 site가 없습니다.</div>
          ) : (
            <ul className="space-y-2">
              {items.map((s) => {
                const isEditing = editingId === s.siteId;
                return (
                  <li key={s.siteId} className="rounded border p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-sm">
                        <div className="font-medium">
                          #{s.siteId} · {s.name}
                        </div>
                        <div className="text-xs text-gray-600">
                          active: {String(s.active)}
                        </div>
                      </div>

                      {!isEditing ? (
                        <button
                          type="button"
                          onClick={() => startEdit(s)}
                          className="rounded border px-3 py-1 text-xs hover:bg-gray-50"
                        >
                          수정
                        </button>
                      ) : (
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => submitUpdate(s.siteId)}
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
                        <label className="text-xs text-gray-700">
                          name
                          <input
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            className="mt-1 w-full rounded border px-3 py-2 text-sm"
                          />
                        </label>
                        <label className="flex items-center gap-2 text-xs text-gray-700">
                          <input
                            type="checkbox"
                            checked={editActive}
                            onChange={(e) => setEditActive(e.target.checked)}
                          />
                          active
                        </label>
                        <div className="text-xs text-gray-500">
                          * MANAGER는 담당 site만 수정 가능(권한은 서버에서
                          검증)
                        </div>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}
