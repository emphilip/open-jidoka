import { DocumentArrowUpIcon } from '@heroicons/react/24/solid';
import { useId, useState } from 'react';
import { cx } from './cx';

/** File upload area from "Forms / Form Layouts / Stacked" (cover photo), with drag and drop. */
export function FileDrop({ label, hint, accept, file, onFile }: { label: string; hint: string; accept: string; file?: File; onFile: (f?: File) => void }) {
  const id = useId();
  const [over, setOver] = useState(false);
  return (
    <div>
      <span className="block text-sm/6 font-medium text-gray-900">{label}</span>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          onFile(e.dataTransfer.files[0]);
        }}
        className={cx('mt-2 flex justify-center rounded-lg border border-dashed px-6 py-10', over ? 'border-brand-600 bg-brand-50' : 'border-gray-900/25')}
      >
        <div className="text-center">
          <DocumentArrowUpIcon aria-hidden="true" className="mx-auto size-12 text-gray-300" />
          <div className="mt-4 flex justify-center text-sm/6 text-gray-600">
            <label
              htmlFor={id}
              className="relative cursor-pointer rounded-md bg-transparent font-semibold text-brand-600 focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-brand-600 hover:text-brand-500"
            >
              <span>Upload a file</span>
              <input id={id} type="file" accept={accept} className="sr-only" onChange={(e) => onFile(e.target.files?.[0])} />
            </label>
            <p className="pl-1">or drag and drop</p>
          </div>
          <p className="text-xs/5 text-gray-600">{file ? file.name : hint}</p>
        </div>
      </div>
    </div>
  );
}
