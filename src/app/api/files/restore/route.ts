import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prefixForScope, TRASH_DIR, type Scope } from "@/lib/access";
import { moveFolder, moveObject, objectExists, prefixHasObjects } from "@/lib/s3";

interface RestoreBody {
  scope?: Scope;
  id?: string;
  type?: "file" | "folder";
}

function parseTrashId(id: string): string | null {
  const match = /^(\d+)~(.*)$/.exec(id);
  if (!match) return null;
  try {
    return decodeURIComponent(match[2]);
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: RestoreBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { id, type } = body;
  const scope: Scope = body.scope === "shared" ? "shared" : "personal";

  if (!id || (type !== "file" && type !== "folder")) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const originalPath = parseTrashId(id);
  if (!originalPath) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const prefix = prefixForScope(scope, email);

  try {
    if (type === "file") {
      const trashKey = `${prefix}${TRASH_DIR}/${id}`;
      const destKey = `${prefix}${originalPath}`;
      if (await objectExists(destKey)) {
        return NextResponse.json(
          { error: "У цьому місці вже є файл з такою назвою" },
          { status: 409 }
        );
      }
      await moveObject(trashKey, destKey);
    } else {
      const trashPrefix = `${prefix}${TRASH_DIR}/${id}/`;
      const destPrefix = `${prefix}${originalPath}/`;
      if (await prefixHasObjects(destPrefix)) {
        return NextResponse.json(
          { error: "У цьому місці вже є папка з такою назвою" },
          { status: 409 }
        );
      }
      await moveFolder(trashPrefix, destPrefix);
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Failed to restore from trash", { id, type, error });
    return NextResponse.json({ error: "Could not restore" }, { status: 500 });
  }
}
