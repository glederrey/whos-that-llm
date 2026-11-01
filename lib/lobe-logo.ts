/** A company logo that ships with the app (`@lobehub/icons-static-svg`) instead of living in the logos bucket. */
export const lobePrefix = "lobe:";

const lobeId = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function isLobePath(path: string): boolean {
  return path.startsWith(lobePrefix);
}

/** The icon id of a stored `lobe:` path, or null when it is not one or is malformed. */
export function lobeIdOf(path: string): string | null {
  if (!isLobePath(path)) return null;
  const id = path.slice(lobePrefix.length);
  return lobeId.test(id) ? id : null;
}

export function lobePath(id: string): string {
  return `${lobePrefix}${id}`;
}

/** The public URL the app serves the icon from (`app/lobe/[file]/route.ts`). */
export function lobeUrl(id: string): string {
  return `/lobe/${id}.svg`;
}

/** Mono icons draw in `currentColor`, so they need a colour when they are shown as a picture. */
export function isMonoLobe(id: string): boolean {
  return !id.endsWith("-color");
}
