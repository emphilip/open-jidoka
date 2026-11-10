import { CheckCircleIcon, ExclamationTriangleIcon, InformationCircleIcon, XCircleIcon } from '@heroicons/react/20/solid';
import type { ReactNode } from 'react';
import { cx } from './cx';

type Tone = 'error' | 'warning' | 'success' | 'info';

const TONES: Record<Tone, { box: string; icon: string; title: string; body: string; Icon: typeof XCircleIcon }> = {
  error: { box: 'bg-red-50', icon: 'text-red-400', title: 'text-red-800', body: 'text-red-700', Icon: XCircleIcon },
  warning: { box: 'bg-yellow-50', icon: 'text-yellow-400', title: 'text-yellow-800', body: 'text-yellow-700', Icon: ExclamationTriangleIcon },
  success: { box: 'bg-green-50', icon: 'text-green-400', title: 'text-green-800', body: 'text-green-700', Icon: CheckCircleIcon },
  info: { box: 'bg-blue-50', icon: 'text-blue-400', title: 'text-blue-800', body: 'text-blue-700', Icon: InformationCircleIcon },
};

export function Alert({ tone, title, children, className }: { tone: Tone; title: ReactNode; children?: ReactNode; className?: string }) {
  const t = TONES[tone];
  return (
    <div role={tone === 'error' ? 'alert' : 'status'} className={cx('rounded-md p-4', t.box, className)}>
      <div className="flex">
        <div className="shrink-0">
          <t.Icon aria-hidden="true" className={cx('size-5', t.icon)} />
        </div>
        <div className="ml-3 min-w-0 flex-1">
          <h3 className={cx('text-sm font-medium', t.title)}>{title}</h3>
          {children && <div className={cx('mt-2 text-sm break-words', t.body)}>{children}</div>}
        </div>
      </div>
    </div>
  );
}
