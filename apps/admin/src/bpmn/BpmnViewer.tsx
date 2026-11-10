import NavigatedViewer from 'bpmn-js/lib/NavigatedViewer';
import { useEffect, useRef } from 'react';

interface Props {
  xml?: string;
  markers: Record<string, 'active' | 'completed' | 'failed'>;
  onSelect?: (elementId: string) => void;
}

export function BpmnViewer({ xml, markers, onSelect }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const viewer = useRef<any>(null);
  const applied = useRef<Record<string, string>>({});
  const loaded = useRef<string | undefined>(undefined);

  useEffect(() => {
    viewer.current = new NavigatedViewer({ container: container.current! });
    viewer.current.on('element.click', (e: any) => onSelect?.(e.element.id));
    return () => {
      viewer.current.destroy();
      loaded.current = undefined;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!xml || xml === loaded.current) return;
    loaded.current = xml;
    applied.current = {};
    const instance = viewer.current;
    // StrictMode remounts destroy the viewer while an import is still in flight; ignore that instance.
    instance
      .importXML(xml)
      .then(() => {
        if (viewer.current !== instance) return;
        instance.get('canvas').zoom('fit-viewport');
        paint();
      })
      .catch((err: unknown) => {
        if (viewer.current === instance) throw err;
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [xml]);

  useEffect(paint, [markers]);

  function paint() {
    const v = viewer.current;
    if (!v || !loaded.current) return;
    const canvas = v.get('canvas');
    const registry = v.get('elementRegistry');
    for (const [id, cls] of Object.entries(applied.current)) {
      if (registry.get(id)) canvas.removeMarker(id, `jidoka-${cls}`);
    }
    applied.current = {};
    for (const [id, cls] of Object.entries(markers)) {
      if (!registry.get(id)) continue;
      canvas.addMarker(id, `jidoka-${cls}`);
      applied.current[id] = cls;
    }
  }

  return <div ref={container} className="relative h-80 bg-white sm:h-96" />;
}
