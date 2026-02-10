'use client';

import { useFlashMessage, useRequireAuth } from '@/app/context/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import AppHeader from '@/app/_components/AppHeader';
import { toUserMessage } from '@/lib/api/error-messages';
import {
  adminAssignManagerSite,
  adminListManagerSites,
  adminRemoveManagerSite,
} from '@/lib/api/admin';

export default function AdminAssignmentsPage() {
  const { user, ready, forbidden } = useRequireAuth({ roles: ['ADMIN'] });
  const router = useRouter();

  const [loading, setLoading] = useState(false);
  const { message, setFlashMessage } = useFlashMessage({ ttlMs: 4000 });

  const [managerUserId, setManagerUserId] = useState<string>('101');
  const [siteId, setSiteId] = useState<string>('1');
  const [managerSites, setManagerSites] = useState<number[]>([]);

  async function refreshManagerSites() {
    if (!user) return;
    const mId = Number(managerUserId);
    if (!Number.isFinite(mId)) {
      setFlashMessage('managerUserId를 확인해 주세요.');
      return;
    }
    setLoading(true);
    try {
      const ids = await adminListManagerSites(user.userId, mId);
      setManagerSites(ids);
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
    refreshManagerSites();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, ready, forbidden]);

  async function assign() {
    if (!user) return;
    const mId = Number(managerUserId);
    const sId = Number(siteId);
    if (!Number.isFinite(mId) || !Number.isFinite(sId)) {
      setFlashMessage('managerUserId/siteId를 확인해 주세요.');
      return;
    }
    setLoading(true);
    try {
      await adminAssignManagerSite(user.userId, {
        managerUserId: mId,
        siteId: sId,
      });
      setFlashMessage('할당 완료');
      await refreshManagerSites();
    } catch (e) {
      setFlashMessage(toUserMessage(e));
    } finally {
      setLoading(false);
    }
  }

  async function remove() {
    if (!user) return;
    const mId = Number(managerUserId);
    const sId = Number(siteId);
    if (!Number.isFinite(mId) || !Number.isFinite(sId)) {
      setFlashMessage('managerUserId/siteId를 확인해 주세요.');
      return;
    }
    setLoading(true);
    try {
      await adminRemoveManagerSite(user.userId, mId, sId);
      setFlashMessage('해제 완료');
      await refreshManagerSites();
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
          <h1 className="text-xl font-semibold">관리자 · 담당 Site 할당</h1>
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
            <div className="grid gap-3">
              <label className="text-xs text-gray-700">
                managerUserId
                <input
                  value={managerUserId}
                  onChange={(e) => setManagerUserId(e.target.value)}
                  className="mt-1 w-full rounded border px-3 py-2 text-sm"
                  inputMode="numeric"
                />
              </label>
              <label className="text-xs text-gray-700">
                siteId
                <input
                  value={siteId}
                  onChange={(e) => setSiteId(e.target.value)}
                  className="mt-1 w-full rounded border px-3 py-2 text-sm"
                  inputMode="numeric"
                />
              </label>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={assign}
                  disabled={loading}
                  className="rounded border px-3 py-2 text-sm hover:bg-gray-50 disabled:opacity-50"
                >
                  할당(POST)
                </button>
                <button
                  type="button"
                  onClick={remove}
                  disabled={loading}
                  className="rounded border px-3 py-2 text-sm hover:bg-gray-50 disabled:opacity-50"
                >
                  해제(DELETE)
                </button>
                <button
                  type="button"
                  onClick={refreshManagerSites}
                  disabled={loading}
                  className="rounded border px-3 py-2 text-sm hover:bg-gray-50 disabled:opacity-50"
                >
                  조회(GET)
                </button>
              </div>
            </div>

            <div className="mt-4">
              <div className="mb-2 text-sm font-semibold">담당 siteId 목록</div>
              {managerSites.length === 0 ? (
                <div className="text-sm text-gray-600">없음</div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {managerSites.map((id) => (
                    <span
                      key={id}
                      className="rounded bg-gray-100 px-2 py-1 text-xs"
                    >
                      {id}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
