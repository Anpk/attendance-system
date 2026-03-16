'use client';

type FlashMessageProps = {
  message: string;
  className?: string;
};

export default function FlashMessage({ message, className }: FlashMessageProps) {
  if (!message) return null;

  return (
    <div
      className={`mb-4 rounded border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100 ${className ?? ''}`.trim()}
    >
      {message}
    </div>
  );
}
