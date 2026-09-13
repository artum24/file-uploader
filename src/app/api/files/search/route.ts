import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prefixForScope, TRASH_DIR, type Scope } from "@/lib/access";
import { getDownloadUrl, listAllObjects } from "@/lib/s3";
import { IMAGE_EXTENSIONS } from "@/lib/upload-limits";

/** Cap on how many matches to sign thumbnails for and return. */
const MAX_RESULTS = 100;

function isImage(name: string): boolean {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  return IMAGE_EXTENSIONS.includes(ext);
}

export async function GET(request: Request) {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const scope: Scope = searchParams.get("scope") === "shared" ? "shared" : "personal";
  const query = (searchParams.get("q") ?? "").trim().toLowerCase();

  if (!query) {
    return NextResponse.json({ files: [] });
  }

  const prefix = prefixForScope(scope, email);

  try {
    const objects = await listAllObjects(prefix);

    const matches = objects.filter((obj) => {
      if (obj.key.endsWith("/")) return false;
      const relative = obj.key.slice(prefix.length);
      if (relative === `${TRASH_DIR}` || relative.startsWith(`${TRASH_DIR}/`)) return false;
      const name = relative.slice(relative.lastIndexOf("/") + 1);
      return name.toLowerCase().includes(query);
    });

    const limited = matches.slice(0, MAX_RESULTS);

    const files = await Promise.all(
      limited.map(async (obj) => {
        const relative = obj.key.slice(prefix.length);
        const lastSlash = relative.lastIndexOf("/");
        const name = lastSlash === -1 ? relative : relative.slice(lastSlash + 1);
        const path = lastSlash === -1 ? "" : relative.slice(0, lastSlash);
        return {
          key: obj.key,
          name,
          path,
          size: obj.size,
          lastModified: obj.lastModified ? obj.lastModified.toISOString() : null,
          thumbnailUrl: isImage(name) ? await getDownloadUrl(obj.key, "inline") : null,
        };
      })
    );

    files.sort((a, b) => a.name.localeCompare(b.name));

    return NextResponse.json({ files, truncated: matches.length > MAX_RESULTS });
  } catch (error) {
    console.error("Failed to search files", error);
    return NextResponse.json({ error: "Could not search files" }, { status: 500 });
  }
}
