import { Dialog, DialogBackdrop, DialogPanel, TransitionChild } from '@headlessui/react';
import {
  ArrowRightStartOnRectangleIcon,
  Bars3Icon,
  ClipboardDocumentListIcon,
  InboxIcon,
  LinkIcon,
  PlayCircleIcon,
  RectangleGroupIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import { useState, type ReactNode } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { cx } from './ui';

const NAVIGATION = [
  { name: 'Workflows', to: '/workflows', icon: RectangleGroupIcon },
  { name: 'Runs', to: '/runs', icon: PlayCircleIcon },
  { name: 'Task inbox', to: '/tasks', icon: InboxIcon },
  { name: 'Connections', to: '/connections', icon: LinkIcon },
  { name: 'Audit log', to: '/audit', icon: ClipboardDocumentListIcon },
];

export function BrandMark({ className }: { className?: string }) {
  return (
    <span className={cx('flex size-8 items-center justify-center rounded-lg bg-brand-500 text-xs font-bold text-white', className)}>
      OJ
    </span>
  );
}

function Sidebar({ actor, onSignOut, onNavigate }: { actor: string; onSignOut: () => void; onNavigate?: () => void }) {
  return (
    <div className="flex grow flex-col gap-y-5 overflow-y-auto bg-gray-900 px-6">
      <div className="flex h-16 shrink-0 items-center gap-x-3">
        <BrandMark />
        <span className="text-base font-semibold text-white">OpenJidoka</span>
      </div>
      <nav className="flex flex-1 flex-col">
        <ul role="list" className="flex flex-1 flex-col gap-y-7">
          <li>
            <ul role="list" className="-mx-2 space-y-1">
              {NAVIGATION.map((item) => (
                <li key={item.name}>
                  <NavLink
                    to={item.to}
                    onClick={onNavigate}
                    className={({ isActive }) =>
                      cx(
                        isActive ? 'bg-white/5 text-white' : 'text-gray-400 hover:bg-white/5 hover:text-white',
                        'group flex gap-x-3 rounded-md p-2 text-sm/6 font-semibold',
                      )
                    }
                  >
                    <item.icon aria-hidden="true" className="size-6 shrink-0" />
                    {item.name}
                  </NavLink>
                </li>
              ))}
            </ul>
          </li>
          <li className="-mx-6 mt-auto border-t border-white/10">
            <div className="flex items-center gap-x-4 px-6 py-3 text-sm/6 font-semibold text-white">
              <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-gray-500 outline -outline-offset-1 outline-black/5">
                <span className="text-sm font-medium text-white uppercase">{actor.slice(0, 2) || '?'}</span>
              </span>
              <span className="min-w-0 flex-1 truncate" title={actor}>
                {actor}
              </span>
              <button
                type="button"
                onClick={onSignOut}
                className="-m-1.5 rounded-md p-1.5 text-gray-400 hover:bg-white/5 hover:text-white"
              >
                <span className="sr-only">Sign out</span>
                <ArrowRightStartOnRectangleIcon aria-hidden="true" className="size-5" />
              </button>
            </div>
          </li>
        </ul>
      </nav>
    </div>
  );
}

export function AppShell({ actor, onSignOut, children }: { actor: string; onSignOut: () => void; children: ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { pathname } = useLocation();
  const section = NAVIGATION.find((n) => pathname.startsWith(n.to))?.name ?? 'OpenJidoka';

  return (
    <div className="min-h-dvh">
      <Dialog open={sidebarOpen} onClose={setSidebarOpen} className="relative z-50 lg:hidden">
        <DialogBackdrop transition className="fixed inset-0 bg-gray-900/80 transition-opacity duration-300 ease-linear data-closed:opacity-0" />
        <div className="fixed inset-0 flex">
          <DialogPanel
            transition
            className="relative mr-16 flex w-full max-w-xs flex-1 transform transition duration-300 ease-in-out data-closed:-translate-x-full"
          >
            <TransitionChild>
              <div className="absolute top-0 left-full flex w-16 justify-center pt-5 duration-300 ease-in-out data-closed:opacity-0">
                <button type="button" onClick={() => setSidebarOpen(false)} className="-m-2.5 p-2.5">
                  <span className="sr-only">Close navigation</span>
                  <XMarkIcon aria-hidden="true" className="size-6 text-white" />
                </button>
              </div>
            </TransitionChild>
            <Sidebar actor={actor} onSignOut={onSignOut} onNavigate={() => setSidebarOpen(false)} />
          </DialogPanel>
        </div>
      </Dialog>

      <div className="hidden lg:fixed lg:inset-y-0 lg:z-40 lg:flex lg:w-64 lg:flex-col">
        <Sidebar actor={actor} onSignOut={onSignOut} />
      </div>

      <div className="sticky top-0 z-40 flex h-14 items-center gap-x-4 bg-gray-900 px-4 shadow-sm sm:px-6 lg:hidden">
        <button type="button" onClick={() => setSidebarOpen(true)} className="-m-2.5 p-2.5 text-gray-400 hover:text-white">
          <span className="sr-only">Open navigation</span>
          <Bars3Icon aria-hidden="true" className="size-6" />
        </button>
        <div className="flex-1 text-sm/6 font-semibold text-white">{section}</div>
        <BrandMark className="size-7" />
      </div>

      <main className="lg:pl-64">{children}</main>
    </div>
  );
}

/** Standard page padding and width; screens that need the full viewport (the modeler) skip it. */
export function Page({ children }: { children: ReactNode }) {
  return <div className="mx-auto max-w-7xl space-y-8 px-4 py-8 sm:px-6 lg:px-8 lg:py-10">{children}</div>;
}
