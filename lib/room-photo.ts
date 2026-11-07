// Only small raster JPEG covers are stored; URLs, SVG and arbitrary data are rejected.
export function validateRoomPhoto(value: unknown): string {
  if (value === "") return "/images/space-cover.svg";
  if (typeof value !== "string" || value.length > 131095 || !/^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/.test(value))
    throw new Error("Choose a JPEG photo up to 96 KB after compression.");
  let bytes: Uint8Array;
  try { bytes = Uint8Array.from(atob(value.slice(23)), c => c.charCodeAt(0)); }
  catch { throw new Error("Invalid photo encoding."); }
  if (bytes.length > 98304 || bytes[0] !== 255 || bytes[1] !== 216 || bytes.at(-2) !== 255 || bytes.at(-1) !== 217)
    throw new Error("Invalid JPEG photo.");
  let pos = 2;
  while (pos + 8 < bytes.length) {
    if (bytes[pos++] !== 255) break;
    const marker = bytes[pos++];
    const length = bytes[pos] * 256 + bytes[pos + 1];
    if (length < 2 || pos + length > bytes.length) break;
    if ([192, 193, 194].includes(marker)) {
      const height = bytes[pos + 3] * 256 + bytes[pos + 4];
      const width = bytes[pos + 5] * 256 + bytes[pos + 6];
      if (width > 0 && height > 0 && width <= 1024 && height <= 1024) return value;
      break;
    }
    pos += length;
  }
  throw new Error("Photo dimensions must be at most 1024 × 1024.");
}
