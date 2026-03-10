'use client';

import type { AdminSiteResponse, EmployeeRole } from '@/lib/api/types';
import { useState } from 'react';

export default function SitesTab(props: {
  userRole: EmployeeRole | null | undefined;
  loading: boolean;
  sites: AdminSiteResponse[];

  create: {
    name: string;
    setName: (v: string) => void;
    submitCreateSite: () => void | Promise<void>;
  };

  edit: {
    editingSiteId: number | null;
    startEditSite: (s: AdminSiteResponse) => void;
    cancelEditSite: () => void;
    name: string;
    setName: (v: string) => void;
    active: boolean;
    setActive: (v: boolean) => void;
    submitUpdateSite: (siteId: number) => void | Promise<void>;
  };

  actions: {
    refreshSites: () => void | Promise<void>;
  };
}) {
  const { userRole, loading, sites } = props;

  const {
    name: createName,
    setName: setCreateName,
    submitCreateSite,
  } = props.create;

  const { refreshSites } = props.actions;

  const {
    editingSiteId,
    startEditSite,
    cancelEditSite,
    name: editSiteName,
    setName: setEditSiteName,
    active: editSiteActive,
    setActive: setEditSiteActive,
    submitUpdateSite,
  } = props.edit;

  // Modal open state is controlled by editingSiteId; no extra state needed.

  // Modal implementation
  function SiteEditModal({ siteId }: { siteId: number }) {
    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
        onMouseDown={(e) => {
          // backdrop click closes if not loading
          if (e.target === e.currentTarget && !loading) {
            cancelEditSite();
          }
        }}
      >
        <div className="w-full max-w-2xl rounded-lg bg-white p-4 shadow dark:bg-gray-900 dark:text-gray-100 flex flex-col max-h-[85vh] overflow-auto">
          <div className="mb-4 flex items-center justify-between">
            <div className="text-lg font-semibold">근무지 수정 (#{siteId})</div>
            <button
              type="button"
              onClick={cancelEditSite}
              disabled={loading}
              className="rounded border border-gray-400 px-3 py-1 text-xs hover:bg-gray-100 disabled:opacity-50 dark:border-gray-600 dark:hover:bg-gray-800"
            >
              닫기
            </button>
          </div>
          <div className="grid gap-3">
            <label className="text-xs text-gray-700 dark:text-gray-200">
              <span className="block mb-1">근무지 이름</span>
              <input
                value={editSiteName}
                onChange={(e) => setEditSiteName(e.target.value)}
                className="w-full rounded border border-gray-400 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-500 dark:bg-gray-950 dark:text-gray-100 md:w-1/2"
              />
            </label>
            <label className="flex items-center gap-2 text-xs text-gray-700 dark:text-gray-200">
              <input
                type="checkbox"
                checked={editSiteActive}
                onChange={(e) => setEditSiteActive(e.target.checked)}
              />
              활성
            </label>
            <div className="text-xs text-gray-500 dark:text-gray-300">
              * MANAGER는 담당 근무지만 수정 가능(권한은 서버에서 검증)
            </div>
          </div>
          <div className="mt-6 flex gap-2 justify-end">
            <button
              type="button"
              onClick={() => submitUpdateSite(siteId)}
              disabled={loading}
              className="rounded border border-gray-400 px-3 py-1 text-xs hover:bg-gray-100 disabled:opacity-50 dark:border-gray-600 dark:hover:bg-gray-800"
            >
              저장
            </button>
            <button
              type="button"
              onClick={cancelEditSite}
              disabled={loading}
              className="rounded border border-gray-400 px-3 py-1 text-xs hover:bg-gray-100 disabled:opacity-50 dark:border-gray-600 dark:hover:bg-gray-800"
            >
              취소
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Create (ADMIN only) */}
      {userRole === 'ADMIN' && (
        <section className="mb-6 rounded border border-gray-300 bg-white p-4 dark:border-gray-600 dark:bg-gray-900">
          <h2 className="mb-3 text-sm font-semibold">근무지 생성</h2>
          <div className="flex flex-col gap-2 md:flex-row md:items-end">
            <input
              value={createName}
              onChange={(e) => setCreateName(e.target.value)}
              placeholder="근무지 이름"
              className="w-full rounded border border-gray-400 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-500 dark:bg-gray-950 dark:text-gray-100 md:w-1/2"
            />
            <button
              type="button"
              onClick={submitCreateSite}
              disabled={loading}
              className="rounded border border-gray-400 px-3 py-2 text-sm hover:bg-gray-100 disabled:opacity-50 dark:border-gray-600 dark:hover:bg-gray-800"
            >
              생성
            </button>
          </div>
        </section>
      )}

      <section className="rounded border border-gray-300 bg-white p-4 dark:border-gray-600 dark:bg-gray-900">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold">근무지 목록</h2>
          <button
            type="button"
            onClick={refreshSites}
            disabled={loading}
            className="rounded border border-gray-400 px-3 py-1 text-xs hover:bg-gray-100 disabled:opacity-50 dark:border-gray-600 dark:hover:bg-gray-800"
          >
            새로고침
          </button>
        </div>

        {sites.length === 0 ? (
          <div className="text-sm text-gray-600 dark:text-gray-300">
            표시할 근무지가 없습니다.
          </div>
        ) : (
          <ul className="space-y-2">
            {sites.map((s) => {
              const isEditing = editingSiteId === s.siteId;
              return (
                <li
                  key={s.siteId}
                  className="rounded border border-gray-300 p-3 dark:border-gray-600 dark:bg-gray-900"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm">
                      <div className="font-medium">
                        #{s.siteId} · {s.name}
                      </div>
                      <div className="text-xs text-gray-600 dark:text-gray-300">
                        활성: {s.active ? '활성' : '비활성'}
                      </div>
                    </div>

                    {!isEditing ? (
                      <button
                        type="button"
                        onClick={() => startEditSite(s)}
                        className="rounded border border-gray-400 px-3 py-1 text-xs hover:bg-gray-100 dark:border-gray-600 dark:hover:bg-gray-800"
                      >
                        수정
                      </button>
                    ) : null}
                  </div>
                  {/* Modal for editing shown below */}
                </li>
              );
            })}
          </ul>
        )}
      </section>
      {/* Modal for editing */}
      {editingSiteId !== null ? <SiteEditModal siteId={editingSiteId} /> : null}
    </>
  );
}
