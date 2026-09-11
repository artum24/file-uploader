/**
 * Shared upload constraints — imported both by the client (immediate
 * feedback, no round-trip needed) and by the server (defense in depth).
 * Kept free of any server-only imports (like the AWS SDK) so it's safe to
 * bundle into client components.
 */

/** Reject files larger than this. See README for why this isn't a hard
 * guarantee yet (presigned PUT doesn't enforce size on S3's side). */
export const MAX_UPLOAD_SIZE_BYTES = 200 * 1024 * 1024; // 200 MB

/**
 * Allowlist rather than a denylist — for a private family store it's safer
 * to occasionally ask "can you zip that?" than to silently accept something
 * like an executable.
 */
export const ALLOWED_EXTENSIONS = [
  // documents
  "pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx", "txt", "csv", "rtf",
  "odt", "ods", "odp",
  // images
  "jpg", "jpeg", "png", "gif", "webp", "heic", "svg", "bmp", "tiff",
  // video / audio
  "mp4", "mov", "avi", "mkv", "webm", "mp3", "wav", "m4a", "flac",
  // archives
  "zip", "rar", "7z",
];

/** Extensions that get a real inline thumbnail in the file list instead of
 * a generic icon (see IMAGE_EXTENSIONS usage in the list API route). */
export const IMAGE_EXTENSIONS = [
  "jpg", "jpeg", "png", "gif", "webp", "heic", "svg", "bmp", "tiff",
];

export function getExtension(fileName: string): string {
  const idx = fileName.lastIndexOf(".");
  if (idx <= 0 || idx === fileName.length - 1) return "";
  return fileName.slice(idx + 1).toLowerCase();
}

export function isAllowedExtension(fileName: string): boolean {
  const ext = getExtension(fileName);
  return ext !== "" && ALLOWED_EXTENSIONS.includes(ext);
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / Math.pow(1024, i);
  return `${value.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}
