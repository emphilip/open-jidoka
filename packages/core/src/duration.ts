const ISO_DURATION = /^P(?:(\d+(?:\.\d+)?)W)?(?:(\d+(?:\.\d+)?)D)?(?:T(?:(\d+(?:\.\d+)?)H)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+(?:\.\d+)?)S)?)?$/;

/** Parses an ISO 8601 duration (weeks, days, hours, minutes, seconds) into milliseconds. */
export function parseIsoDuration(value: string): number | undefined {
  const m = ISO_DURATION.exec(value.trim());
  if (!m || value.trim() === 'P' || value.trim().endsWith('T')) return undefined;
  const [, w, d, h, min, s] = m.map((x) => (x === undefined ? 0 : Number(x)));
  return ((((w! * 7 + d!) * 24 + h!) * 60 + min!) * 60 + s!) * 1000;
}
