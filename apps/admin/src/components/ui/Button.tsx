import type { ButtonHTMLAttributes, ComponentType, SVGProps } from 'react';
import { Link, type LinkProps } from 'react-router-dom';
import { cx } from './cx';

type Variant = 'primary' | 'secondary' | 'danger' | 'link';
type Size = 'sm' | 'md';
type Icon = ComponentType<SVGProps<SVGSVGElement>>;

const VARIANTS: Record<Variant, string> = {
  primary:
    'bg-brand-600 text-white shadow-xs hover:bg-brand-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600',
  secondary: 'bg-white text-gray-900 shadow-xs inset-ring inset-ring-gray-300 hover:bg-gray-50',
  danger:
    'bg-red-600 text-white shadow-xs hover:bg-red-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600',
  link: 'text-brand-600 hover:text-brand-500',
};

const SIZES: Record<Size, string> = { sm: 'px-2.5 py-1.5 text-sm', md: 'px-3 py-2 text-sm' };

function classes(variant: Variant, size: Size, className?: string) {
  return cx(
    'inline-flex items-center justify-center gap-x-1.5 rounded-md font-semibold disabled:cursor-not-allowed disabled:opacity-50',
    variant !== 'link' && SIZES[size],
    VARIANTS[variant],
    className,
  );
}

interface Common {
  variant?: Variant;
  size?: Size;
  icon?: Icon;
}

export function Button({ variant = 'secondary', size = 'md', icon: IconCmp, className, children, type = 'button', ...rest }: Common & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type={type} className={classes(variant, size, className)} {...rest}>
      {IconCmp && <IconCmp aria-hidden="true" className={cx('-ml-0.5 size-5', variant === 'secondary' && 'text-gray-400')} />}
      {children}
    </button>
  );
}

export function ButtonLink({ variant = 'secondary', size = 'md', icon: IconCmp, className, children, ...rest }: Common & LinkProps) {
  return (
    <Link className={classes(variant, size, className)} {...rest}>
      {IconCmp && <IconCmp aria-hidden="true" className={cx('-ml-0.5 size-5', variant === 'secondary' && 'text-gray-400')} />}
      {children}
    </Link>
  );
}
