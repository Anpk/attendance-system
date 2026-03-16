'use client';

import type { ReactNode } from 'react';
import AsyncButton from './AsyncButton';

type ConfirmModalProps = {
  open: boolean;
  title: string;
  description?: ReactNode;
  confirmText?: string;
  cancelText?: string;
  loading?: boolean;
  danger?: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
};

export default function ConfirmModal({
  open,
  title,
  description,
  confirmText = '확인',
  cancelText = '취소',
  loading = false,
  danger = false,
  onClose,
  onConfirm,
}: ConfirmModalProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4"
      onMouseDown={(e) => {
        if (loading) return;
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className="w-full max-w-md rounded-lg border border-gray-300 bg-white p-4 shadow-lg dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100">
        <div className="text-base font-semibold">{title}</div>
        {description ? (
          <div className="mt-2 whitespace-pre-wrap text-sm text-gray-700 dark:text-gray-300">
            {description}
          </div>
        ) : null}

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="rounded border border-gray-400 px-3 py-2 text-sm hover:bg-gray-100 disabled:opacity-50 dark:border-gray-600 dark:hover:bg-gray-800"
          >
            {cancelText}
          </button>

          <AsyncButton
            type="button"
            onClick={onConfirm}
            loading={loading}
            loadingText="처리 중..."
            showSpinner
            className={`rounded px-3 py-2 text-sm text-white disabled:opacity-60 ${
              danger ? 'bg-red-600 dark:bg-red-500' : 'bg-black dark:bg-gray-100 dark:text-gray-900'
            }`}
          >
            {confirmText}
          </AsyncButton>
        </div>
      </div>
    </div>
  );
}
