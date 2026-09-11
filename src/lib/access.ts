/**
 * S3 key layout and access control.
 *
 * users/<slug>/...   — personal files for one allowed user
 * shared/...         — files visible to everyone on the whitelist
 *
 * <slug> is derived from the local part of the user's email (the part
 * before "@"), lowercased and sanitized. With a two-person whitelist this
 * stays stable and readable in the S3 console.
 */

export const SHARED_PREFIX = "shared/";

/**
 * Reserved folder name for the recycle bin, kept inside each scope's own
 * prefix (users/<slug>/.trash/, shared/.trash/) so the existing access
 * checks (isAllowedKey) cover it for free. Filtered out of the normal
 * file/folder listing so it never shows up as a regular folder.
 */
export const TRASH_DIR = ".trash";

export function slugFromEmail(email: string): string {
  const local = email.split("@")[0] ?? email;
  return local.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "user";
}

export function userPrefix(email: string): string {
  return `users/${slugFromEmail(email)}/`;
}

export type Scope = "personal" | "shared";

export function prefixForScope(scope: Scope, email: string): string {
  return scope === "shared" ? SHARED_PREFIX : userPrefix(email);
}

/** True if this email is allowed to read/write the given S3 key. */
export function isAllowedKey(key: string, email: string): boolean {
  if (!email) return false;
  return key.startsWith(userPrefix(email)) || key.startsWith(SHARED_PREFIX);
}

/**
 * Sanitizes a "/"-separated relative folder path (e.g. "Documents/2026")
 * into a safe, normalized S3 key prefix ("Documents/2026/"). Each segment
 * goes through `sanitizeName`, so ".." and empty segments can't escape the
 * current scope. An empty/blank input returns "" (the scope root).
 */
export function sanitizePath(path: string): string {
  const segments = path
    .split("/")
    .map((segment) => segment.trim())
    .filter(Boolean)
    .map(sanitizeName);
  return segments.length > 0 ? `${segments.join("/")}/` : "";
}

/**
 * Sanitizes a user-supplied file or folder name so it can't escape its
 * prefix (no "/", no "..", no leading dots/whitespace, no control chars).
 */
export function sanitizeName(name: string): string {
  const trimmed = name.normalize("NFC").trim();
  const stripped = trimmed
    .replace(/[\/\\]/g, "-")
    .replace(/\.\.+/g, ".")
    // eslint-disable-next-line no-control-regex
    .replace(/[\x00-\x1f\x7f]/g, "");
  const cleaned = stripped.replace(/^\.+/, "").trim();
  if (!cleaned) {
    throw new Error("Invalid name");
  }
  return cleaned;
}
