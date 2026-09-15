import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prefixForScope, sanitizePath, TRASH_DIR, type Scope } from "@/lib/access";
import { getDownloadUrl, listObjects } from "@/lib/s3";
import { IMAGE_EXTENSIONS } from "@/lib/upload-limits";

function isImage(name: string): boolean {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  return IMAGE_EXTENSIONS.includes(ext);
}

/** How many entries (files + folders combined) a single page returns. */
const PAGE_SIZE = 40;

export async function GET(request: Request) {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const scope: Scope = searchParams.get("scope") === "shared" ? "shared" : "personal";
  const rawPath = searchParams.get("path") ?? "";
  const cursor = searchParams.get("cursor") ?? undefined;

  let relativePath: string;
  try {
    relativePath = sanitizePath(rawPath);
  } catch (error) {
    console.error("Invalid path in /api/files/list", { rawPath, error });
    return NextResponse.json({ error: "Invalid path" }, { status: 400 });
  }

  const prefix = `${prefixForScope(scope, email)}${relativePath}`;

  try {
    const result = await listObjects(prefix, { continuationToken: cursor, maxKeys: PAGE_SIZE });

    const rawFiles = (result.Contents ?? [])
      .filter(
        (obj): obj is typeof obj & { Key: string } =>
          Boolean(obj.Key) && obj.Key !== prefix && !obj.Key!.endsWith("/")
      )
      .map((obj) => ({
        key: obj.Key,
        name: obj.Key.slice(prefix.length),
        size: obj.Size ?? 0,
        lastModified: obj.LastModified ? obj.LastModified.toISOString() : null,
      }))
      .sort((a, b) =>
        a.lastModified && b.lastModified
          ? b.lastModified.localeCompare(a.lastModified)
          : 0
      );

    // Thumbnails: sign an inline GET URL for image files only, so the list
    // view can render a real preview instead of a generic icon. Signing is
    // local (no extra AWS round-trip), so this stays cheap even for a
    // folder full of photos.
    const files = await Promise.all(
      rawFiles.map(async (file) => ({
        ...file,
        thumbnailUrl: isImage(file.name) ? await getDownloadUrl(file.key, "inline") : null,
      }))
    );

    const folders = (result.CommonPrefixes ?? [])
      .map((p) => p.Prefix)
      .filter((p): p is string => Boolean(p))
      .map((p) => p.slice(prefix.length).replace(/\/$/, ""))
      .filter(Boolean)
      .filter((name) => name !== TRASH_DIR)
      .sort((a, b) => a.localeCompare(b));

    const nextCursor = result.IsTruncated ? result.NextContinuationToken ?? null : null;

    return NextResponse.json({ scope, path: relativePath, files, folders, nextCursor });
  } catch (error) {
    console.error("Failed to list files", error);
    return NextResponse.json({ error: "Could not list files" }, { status: 500 });
  }
}
