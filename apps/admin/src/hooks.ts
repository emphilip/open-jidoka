import { useEffect, useRef, useState } from 'react';

/** Loads data on mount and re-polls while `poll` returns true for the latest value. */
export function useResource<T>(load: () => Promise<T>, deps: unknown[], poll?: (v: T) => boolean) {
  const [data, setData] = useState<T>();
  const [error, setError] = useState('');
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    let alive = true;
    const tick = async () => {
      try {
        const v = await load();
        if (!alive) return;
        setData(v);
        setError('');
        if (poll?.(v)) timer.current = setTimeout(tick, 2500);
      } catch (err) {
        if (alive) setError((err as Error).message);
      }
    };
    tick();
    return () => {
      alive = false;
      clearTimeout(timer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  const reload = async () => {
    try {
      setData(await load());
    } catch (err) {
      setError((err as Error).message);
    }
  };
  return { data, error, reload };
}
