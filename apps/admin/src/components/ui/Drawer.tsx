import { Dialog, DialogBackdrop, DialogPanel, DialogTitle, TransitionChild } from '@headlessui/react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import type { ReactNode } from 'react';

/** "Overlays / Drawers / With close button on outside" (wide). */
export function Drawer({
  open,
  onClose,
  title,
  description,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Dialog open={open} onClose={onClose} className="relative z-50">
      <DialogBackdrop transition className="fixed inset-0 bg-gray-500/75 transition-opacity duration-500 ease-in-out data-closed:opacity-0" />
      <div className="fixed inset-0 overflow-hidden">
        <div className="absolute inset-0 overflow-hidden">
          <div className="pointer-events-none fixed inset-y-0 right-0 flex max-w-full pl-10 sm:pl-16">
            <DialogPanel
              transition
              className="pointer-events-auto relative w-screen max-w-2xl transform transition duration-500 ease-in-out data-closed:translate-x-full sm:duration-700"
            >
              <TransitionChild>
                <div className="absolute top-0 left-0 -ml-8 flex pt-4 pr-2 duration-500 ease-in-out data-closed:opacity-0 sm:-ml-10 sm:pr-4">
                  <button
                    type="button"
                    onClick={onClose}
                    className="relative rounded-md text-gray-300 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
                  >
                    <span className="absolute -inset-2.5" />
                    <span className="sr-only">Close panel</span>
                    <XMarkIcon aria-hidden="true" className="size-6" />
                  </button>
                </div>
              </TransitionChild>
              <div className="relative flex h-full flex-col overflow-y-auto bg-white py-6 shadow-xl">
                <div className="px-4 sm:px-6">
                  <DialogTitle className="text-base font-semibold text-gray-900">{title}</DialogTitle>
                  {description && <p className="mt-1 text-sm text-gray-500">{description}</p>}
                </div>
                <div className="relative mt-6 flex-1 space-y-6 px-4 pb-10 sm:px-6">{children}</div>
              </div>
            </DialogPanel>
          </div>
        </div>
      </div>
    </Dialog>
  );
}

/** Information list from the "File details example" drawer. Long values wrap below their label. */
export function DrawerSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <h3 className="font-medium text-gray-900">{title}</h3>
      <div className="mt-2">{children}</div>
    </div>
  );
}

export function DrawerFacts({ items }: { items: Array<{ term: string; detail: ReactNode }> }) {
  return (
    <dl className="divide-y divide-gray-200 border-t border-b border-gray-200">
      {items.map((item) => (
        <div key={item.term} className="flex justify-between gap-x-4 py-3 text-sm font-medium">
          <dt className="text-gray-500">{item.term}</dt>
          <dd className="min-w-0 text-right break-words text-gray-900">{item.detail}</dd>
        </div>
      ))}
    </dl>
  );
}
