'use client';

import type { ButtonHTMLAttributes, ReactNode } from 'react';

type AsyncButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> & {
  loading?: boolean;
  loadingText?: ReactNode;
  children: ReactNode;
  showSpinner?: boolean;
};

export default function AsyncButton({
  loading = false,
  loadingText,
  children,
  disabled,
  className,
  showSpinner = false,
  ...rest
}: AsyncButtonProps) {
  const isDisabled = Boolean(disabled || loading);

  return (
    <button
      {...rest}
      disabled={isDisabled}
      aria-busy={loading}
      className={className}
    >
      {loading ? (
        <span className="inline-flex items-center gap-2">
          {showSpinner ? (
            <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-current border-r-transparent" />
          ) : null}
          {loadingText ?? children}
        </span>
      ) : (
        children
      )}
    </button>
  );
}
