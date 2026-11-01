import sharp from "sharp";

/** The longest side a stored raster logo keeps. Smaller images are not enlarged. */
export const maxLogoSide = 512;

/**
 * A PNG or WebP logo on a transparent square: scaled to fit, never cropped, never enlarged past `maxLogoSide`.
 * Returns null when the file cannot be decoded. SVG is not passed here: it scales on its own.
 */
export async function squareLogo(bytes: Uint8Array, mime: "image/png" | "image/webp"): Promise<Uint8Array | null> {
  try {
    const meta = await sharp(bytes).metadata();
    if (!meta.width || !meta.height) return null;
    const side = Math.min(Math.max(meta.width, meta.height), maxLogoSide);
    const image = sharp(bytes)
      .resize(side, side, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 }, withoutEnlargement: true })
      .ensureAlpha();
    const out = mime === "image/webp" ? await image.webp({ quality: 90 }).toBuffer() : await image.png().toBuffer();
    return new Uint8Array(out);
  } catch {
    return null;
  }
}
