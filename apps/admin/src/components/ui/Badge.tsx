import type { RunStatus, StepStatus } from '@openjidoka/core/types';
import type { ReactNode } from 'react';
import { cx } from './cx';

export type BadgeColor = 'gray' | 'red' | 'yellow' | 'green' | 'blue' | 'indigo' | 'purple';

// Tailwind Plus "Badges / With border" (and "Small with border" for size="sm").
const COLORS: Record<BadgeColor, string> = {
  gray: 'bg-gray-50 text-gray-600 inset-ring inset-ring-gray-500/10',
  red: 'bg-red-50 text-red-700 inset-ring inset-ring-red-600/10',
  yellow: 'bg-yellow-50 text-yellow-800 inset-ring inset-ring-yellow-600/20',
  green: 'bg-green-50 text-green-700 inset-ring inset-ring-green-600/20',
  blue: 'bg-blue-50 text-blue-700 inset-ring inset-ring-blue-700/10',
  indigo: 'bg-indigo-50 text-indigo-700 inset-ring inset-ring-indigo-700/10',
  purple: 'bg-purple-50 text-purple-700 inset-ring inset-ring-purple-700/10',
};

export function Badge({
  color = 'gray',
  size = 'md',
  children,
  className,
}: {
  color?: BadgeColor;
  size?: 'sm' | 'md';
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cx(
        'inline-flex items-center rounded-md text-xs font-medium whitespace-nowrap',
        size === 'sm' ? 'px-1.5 py-0.5' : 'px-2 py-1',
        COLORS[color],
        className,
      )}
    >
      {children}
    </span>
  );
}

type TaskStatus = 'open' | 'completed' | 'cancelled';

/** Every run, step and task status the API returns. The label is always shown; color only reinforces it. */
export const STATUS_COLORS = {
  pending: 'gray',
  running: 'blue',
  completed: 'green',
  failed: 'red',
  cancelled: 'gray',
  terminated: 'red',
  validation_failed: 'yellow',
  waiting: 'indigo',
  open: 'indigo',
} as const satisfies Record<RunStatus | StepStatus | TaskStatus, BadgeColor>;

export type KnownStatus = keyof typeof STATUS_COLORS;

export function StatusBadge({ status }: { status: string }) {
  const color: BadgeColor = STATUS_COLORS[status as KnownStatus] ?? 'gray';
  return <Badge color={color}>{status.replace('_', ' ')}</Badge>;
}
