'use client';

import { Suspense, useMemo, useState } from 'react';
import AppHeader from '@/app/_components/AppHeader';
import SitesTab from './_components/SitesTab';
import EmployeesTab from './_components/EmployeesTab';
import ReportTab from './_components/ReportTab';

import { useAdminTab } from './_hooks/useAdminTab';
import type { UseAdminTabParams } from './_hooks/useAdminTab';
import { useAdminPageBootstrap } from './_hooks/useAdminPageBootstrap';
import { useEmployeesOps } from './_hooks/useEmployeesOps';
import { useSitesOps } from './_hooks/useSitesOps';

import { useFlashMessage, useRequireAuth } from '@/app/context/AuthContext';

type TabKey = 'sites' | 'employees' | 'report';

function tabLabel(tab: TabKey): string {
  if (tab === 'sites') return 'Sites';
  if (tab === 'employees') return 'Employees';
  return 'Report';
}

function AdminSitesPageInner() {
  const { user, ready, forbidden } = useRequireAuth({
    roles: ['ADMIN', 'MANAGER'],
  });

  const userLite = useMemo(
    () => (user ? { userId: user.userId, role: user.role } : null),
    [user?.userId, user?.role]
  );

  const { tab, setTabAndSync } = useAdminTab<TabKey>({
    basePath: '/admin/sites',
    defaultTab: 'sites',
    allowedTabs: ['sites', 'employees', 'report'] as const,
  } satisfies UseAdminTabParams<TabKey>);

  const { message, setFlashMessage } = useFlashMessage({ ttlMs: 4000 });
  const [loading, setLoading] = useState(false);

  const sitesOps = useSitesOps({
    user: userLite,
    setLoading,
    setFlashMessage,
  });

  const employeesOps = useEmployeesOps({
    user: userLite,
    sites: sitesOps.sites,
    setLoading,
    setFlashMessage,
  });

  useAdminPageBootstrap({
    ready,
    user: userLite,
    forbidden,
    tab,

    sitesCount: sitesOps.sites.length,
    refreshSites: sitesOps.refreshSites,

    refreshEmployees: employeesOps.refreshEmployees,
    setIsCreateEmployeeOpen: employeesOps.setIsCreateEmployeeOpen,

    showAssignmentsUi: employeesOps.showAssignmentsUi,
    editingUserId: employeesOps.editingUserId,
    refreshManagerAssignments: employeesOps.refreshManagerAssignments,
  });

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 dark:bg-gray-900 dark:text-gray-100">
      <AppHeader />

      <main className="mx-auto w-full max-w-3xl px-4 py-6">
        <div className="mb-4">
          <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
            관리자
          </h1>
          <div className="mt-2 flex gap-2">
            {(['sites', 'employees', 'report'] as const).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setTabAndSync(k)}
                className={`rounded border px-3 py-1 text-xs hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800 ${
                  tab === k
                    ? 'bg-white dark:bg-gray-800'
                    : 'bg-gray-50 dark:bg-gray-900'
                }`}
              >
                {tabLabel(k)}
              </button>
            ))}
          </div>
        </div>

        {ready && forbidden && (
          <div className="mb-4 rounded border bg-white p-4 text-sm text-gray-800 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100">
            권한이 없습니다. (ADMIN/MANAGER 전용)
          </div>
        )}

        {message && (
          <div className="mb-4 rounded border bg-white px-3 py-2 text-sm text-gray-800 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100">
            {message}
          </div>
        )}

        {tab === 'sites' && (
          <SitesTab
            userRole={user?.role}
            loading={loading}
            sites={sitesOps.sites}
            create={{
              name: sitesOps.createName,
              setName: sitesOps.setCreateName,
              submitCreateSite: sitesOps.submitCreateSite,
            }}
            edit={{
              editingSiteId: sitesOps.editingSiteId,
              startEditSite: sitesOps.startEditSite,
              cancelEditSite: sitesOps.cancelEditSite,
              name: sitesOps.editSiteName,
              setName: sitesOps.setEditSiteName,
              active: sitesOps.editSiteActive,
              setActive: sitesOps.setEditSiteActive,
              submitUpdateSite: sitesOps.submitUpdateSite,
            }}
            actions={{
              refreshSites: sitesOps.refreshSites,
            }}
          />
        )}

        {tab === 'employees' && (
          <EmployeesTab
            user={userLite}
            loading={loading}
            sites={sitesOps.sites}
            filteredEmployees={employeesOps.filteredEmployees}
            create={{
              canCreateEmployee: employeesOps.canCreateEmployee,
              isCreateEmployeeOpen: employeesOps.isCreateEmployeeOpen,
              setIsCreateEmployeeOpen: employeesOps.setIsCreateEmployeeOpen,
              createEmpUserId: employeesOps.createEmpUserId,
              setCreateEmpUserId: employeesOps.setCreateEmpUserId,
              createEmpUsername: employeesOps.createEmpUsername,
              setCreateEmpUsername: employeesOps.setCreateEmpUsername,
              createEmpPassword: employeesOps.createEmpPassword,
              setCreateEmpPassword: employeesOps.setCreateEmpPassword,
              createEmpSiteId: employeesOps.createEmpSiteId,
              setCreateEmpSiteId: employeesOps.setCreateEmpSiteId,
              createEmpRole: employeesOps.createEmpRole,
              setCreateEmpRole: employeesOps.setCreateEmpRole,
              createEmpUserIdRef: employeesOps.createEmpUserIdRef,
              submitCreateEmployee: employeesOps.submitCreateEmployee,
            }}
            list={{
              empFilterSiteId: employeesOps.empFilterSiteId,
              setEmpFilterSiteId: employeesOps.setEmpFilterSiteId,
              refreshEmployees: employeesOps.refreshEmployees,
            }}
            bulkMove={{
              bulkTargetSiteId: employeesOps.bulkTargetSiteId,
              setBulkTargetSiteId: employeesOps.setBulkTargetSiteId,
              bulkSelectedUserIds: employeesOps.bulkSelectedUserIds,
              setBulkSelectedUserIds: employeesOps.setBulkSelectedUserIds,
              bulkSelectableInView: employeesOps.bulkSelectableInView,
              bulkSelectedEmployees: employeesOps.bulkSelectedEmployees,
              bulkMoving: employeesOps.bulkMoving,
              submitBulkMoveEmployees: employeesOps.submitBulkMoveEmployees,
            }}
            rowEdit={{
              editingUserId: employeesOps.editingUserId,
              startEditEmployee: employeesOps.startEditEmployee,
              cancelEditEmployee: employeesOps.cancelEditEmployee,
              submitUpdateEmployee: employeesOps.submitUpdateEmployee,
              editEmpActive: employeesOps.editEmpActive,
              setEditEmpActive: employeesOps.setEditEmpActive,
              editingEmpRole: employeesOps.editingEmpRole,
              editEmpUsername: employeesOps.editEmpUsername,
              setEditEmpUsername: employeesOps.setEditEmpUsername,
              editEmpSiteId: employeesOps.editEmpSiteId,
              setEditEmpSiteId: employeesOps.setEditEmpSiteId,
              canEditEmployeeSiteId: employeesOps.canEditEmployeeSiteId,
            }}
            quickToggle={{
              pendingActiveUserId: employeesOps.pendingActiveUserId,
              submitToggleActiveQuick: employeesOps.submitToggleActiveQuick,
            }}
            assignments={{
              showAssignmentsUi: employeesOps.showAssignmentsUi,
              isAssignmentsOpen: employeesOps.isAssignmentsOpen,
              setIsAssignmentsOpen: employeesOps.setIsAssignmentsOpen,
              mgrAssignedSiteIds: employeesOps.mgrAssignedSiteIds,
              mgrSelectedSiteIds: employeesOps.mgrSelectedSiteIds,
              setMgrSelectedSiteIds: employeesOps.setMgrSelectedSiteIds,
              mgrSiteQuery: employeesOps.mgrSiteQuery,
              setMgrSiteQuery: employeesOps.setMgrSiteQuery,
              mgrDelta: employeesOps.mgrDelta,
              refreshManagerAssignments: employeesOps.refreshManagerAssignments,
              applyManagerAssignments: employeesOps.applyManagerAssignments,
            }}
          />
        )}

        {tab === 'report' && (
          <ReportTab
            user={user}
            ready={ready}
            forbidden={forbidden}
            sites={sitesOps.sites}
            setFlashMessage={setFlashMessage}
          />
        )}
      </main>
    </div>
  );
}

export default function AdminSitesPage() {
  return (
    <Suspense
      fallback={<div className="min-h-screen bg-gray-50 dark:bg-gray-900" />}
    >
      <AdminSitesPageInner />
    </Suspense>
  );
}
