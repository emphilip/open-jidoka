import { Menu, MenuButton, MenuItem, MenuItems } from '@headlessui/react';
import { EllipsisVerticalIcon } from '@heroicons/react/20/solid';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { cx } from './cx';

/** Row link from "Lists / Tables": "View<span class=sr-only>, name</span>". */
export function RowLink({ to, onClick, label, name, tone = 'brand' }: { to?: string; onClick?: () => void; label: string; name: string; tone?: 'brand' | 'red' }) {
  const className = cx(tone === 'red' ? 'text-red-600 hover:text-red-900' : 'text-brand-600 hover:text-brand-900');
  const body = (
    <>
      {label}
      <span className="sr-only">, {name}</span>
    </>
  );
  return to ? (
    <Link to={to} className={className}>
      {body}
    </Link>
  ) : (
    <button type="button" onClick={onClick} className={className}>
      {body}
    </button>
  );
}

export interface RowMenuItem {
  label: string;
  onClick?: () => void;
  to?: string;
  danger?: boolean;
}

/** Secondary row actions, from "Elements / Dropdowns / With minimal menu icon". Anchored so table overflow does not clip it. */
export function RowMenu({ name, items }: { name: string; items: RowMenuItem[] }) {
  return (
    <Menu as="div" className="relative flex-none">
      <MenuButton className="relative block text-gray-500 hover:text-gray-900">
        <span className="absolute -inset-2.5" />
        <span className="sr-only">Open options for {name}</span>
        <EllipsisVerticalIcon aria-hidden="true" className="size-5" />
      </MenuButton>
      <MenuItems
        transition
        anchor="bottom end"
        className="z-50 w-36 origin-top-right rounded-md bg-white py-2 shadow-lg outline-1 outline-gray-900/5 transition [--anchor-gap:0.5rem] data-closed:scale-95 data-closed:transform data-closed:opacity-0 data-enter:duration-100 data-enter:ease-out data-leave:duration-75 data-leave:ease-in"
      >
        {items.map((item) => (
          <MenuItem key={item.label}>
            {item.to ? (
              <Link to={item.to} className="block px-3 py-1 text-sm/6 text-gray-900 data-focus:bg-gray-50 data-focus:outline-hidden">
                {item.label}
                <span className="sr-only">, {name}</span>
              </Link>
            ) : (
              <button
                type="button"
                onClick={item.onClick}
                className={cx(
                  'block w-full px-3 py-1 text-left text-sm/6 data-focus:bg-gray-50 data-focus:outline-hidden',
                  item.danger ? 'text-red-600' : 'text-gray-900',
                )}
              >
                {item.label}
                <span className="sr-only">, {name}</span>
              </button>
            )}
          </MenuItem>
        ))}
      </MenuItems>
    </Menu>
  );
}

export function RowActions({ children }: { children: ReactNode }) {
  return <div className="flex items-center justify-end gap-x-4">{children}</div>;
}
