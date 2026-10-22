const maxLogoBytes = 1024 * 1024;

export const logoError = "Use an SVG, PNG, or WebP under 1 MB.";

export function companyLogoPath(companyId: string): string {
  return `logos/${companyId}.png`;
}

/** Path the game should load from the logos bucket. */
export function logoPathForPlay(path: string, companyId: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  const bare = path.replace(/^\/+/, "");
  if (bare === `logos/${companyId}.svg` || bare === `${companyId}.svg` || bare === `logos/${companyId}.png`) {
    return companyLogoPath(companyId);
  }
  if (bare.startsWith("logos/")) return bare;
  return companyLogoPath(companyId);
}

export function logoPublicUrl(baseUrl: string, path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  let file = path.replace(/^\/+/, "");
  if (file.startsWith("logos/")) file = file.slice("logos/".length);
  const safe = file
    .split("/")
    .filter(Boolean)
    .map((part) => encodeURIComponent(part))
    .join("/");
  return `${baseUrl.replace(/\/$/, "")}/storage/v1/object/public/logos/${safe}`;
}

/** Where an uploaded category image lives in the logos bucket. */
export function categoryImagePath(categoryId: string, ext: string, token: string): string {
  return `categories/${categoryId}-${token}.${ext}`;
}

/** The bucket path of a stored image, with or without the `logos/` prefix. */
export function logoBucketPath(path: string): string {
  return path.replace(/^\/+/, "").replace(/^logos\//, "");
}

export function readLogo(bytes: Uint8Array): { mime: string; ext: string } | null {
  if (bytes.byteLength === 0 || bytes.byteLength > maxLogoBytes) return null;
  if (isPng(bytes)) return { mime: "image/png", ext: "png" };
  if (isWebp(bytes)) return { mime: "image/webp", ext: "webp" };
  if (isSvg(bytes)) return { mime: "image/svg+xml", ext: "svg" };
  return null;
}

function isPng(bytes: Uint8Array) {
  return bytes.byteLength >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
}

function isWebp(bytes: Uint8Array) {
  return (
    bytes.byteLength >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  );
}

function isSvg(bytes: Uint8Array) {
  const text = new TextDecoder("utf-8", { fatal: false }).decode(bytes.slice(0, 400)).trimStart().toLowerCase();
  if (text.includes("<script")) return false;
  if (text.startsWith("<svg")) return true;
  return text.startsWith("<?xml") && text.includes("<svg");
}
