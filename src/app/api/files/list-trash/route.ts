import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prefixForScope, TRASH_DIR, type Scope } from "@/lib/access";
import { listObjects } from "@/lib/s3";

/** A trash entry's key looks like "<epochMillis>~<encoded original path>",
 * e.g. "1734000000000~Documents%2Freport.pdf". The epoch prefix keeps
 * repeated deletes of the same name from colliding and doubles as the
 * "deleted at" timestamp; everything after the first "~" is the original,
 * percent-encoded relative path (so it can contain "/" for nested files
 * without introducing extra path segments under .trash/). */
function parseTrashId(id: string): { deletedAt: string; originalPath: string } | null {
  const match = /^(\d+)~(.*)$/.exec(id);
  if (!match) return null;
  const epoch = Number(match[1]);
  if (!Number.isFinite(epoch)) return null;
  try {
    return {
      deletedAt: new Date(epoch).toISOString(),
      originalPath: decodeURIComponent(match[2]),
    };
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const scope: Scope = searchParams.get("scope") === "shared" ? "shared" : "personal";
  const trashPrefix = `${prefixForScope(scope, email)}${TRASH_DIR}/`;

  try {
    const result = await listObjects(trashPrefix);

    const files = (result.Contents ?? [])
      .filter(
        (obj): obj is typeof obj & { Key: string } =>
          Boolean(obj.Key) && obj.Key !== trashPrefix && !obj.Key!.endsWith("/")
      )
      .map((obj) => {
        const id = obj.Key.slice(trashPrefix.length);
        const parsed = parseTrashId(id);
        if (!parsed) return null;
        return {
          id,
          type: "file" as const,
          originalPath: parsed.originalPath,
          originalName: parsed.originalPath.split("/").pop() || parsed.originalPath,
          size: obj.Size ?? 0,
          deletedAt: parsed.deletedAt,
        };
      })
      .filter((entry): entry is NonNullable<typeof entry> => entry !== null);

    const folders = (result.CommonPrefixes ?? [])
      .map((p) => p.Prefix)
      .filter((p): p is string => Boolean(p))
      .map((p) => p.slice(trashPrefix.length).replace(/\/$/, ""))
      .filter(Boolean)
      .map((id) => {
        const parsed = parseTrashId(id);
        if (!parsed) return null;
        return {
          id,
          type: "folder" as const,
          originalPath: parsed.originalPath,
          originalName: parsed.originalPath.split("/").pop() || parsed.originalPath,
          deletedAt: parsed.deletedAt,
        };
      })
      .filter((entry): entry is NonNullable<typeof entry> => entry !== null);

    files.sort((a, b) => b.deletedAt.localeCompare(a.deletedAt));
    folders.sort((a, b) => b.deletedAt.localeCompare(a.deletedAt));

    return NextResponse.json({ scope, files, folders });
  } catch (error) {
    console.error("Failed to list trash", error);
    return NextResponse.json({ error: "Could not list trash" }, { status: 500 });
  }
}
