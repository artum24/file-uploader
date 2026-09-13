import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { isAllowedKey, prefixForScope, sanitizeName, sanitizePath, type Scope } from "@/lib/access";
import { moveFolder, moveObject, objectExists, prefixHasObjects } from "@/lib/s3";

interface MoveFileBody {
  scope?: Scope;
  destPath?: string;
  item?: { type: "file"; key?: string };
}

interface MoveFolderBody {
  scope?: Scope;
  destPath?: string;
  item?: { type: "folder"; path?: string; name?: string };
}

type MoveBody = MoveFileBody | MoveFolderBody;

export async function POST(request: Request) {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: MoveBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const scope: Scope = body.scope === "shared" ? "shared" : "personal";
  const prefix = prefixForScope(scope, email);

  let safeDest: string;
  try {
    safeDest = body.destPath ? sanitizePath(body.destPath) : "";
  } catch {
    return NextResponse.json({ error: "Invalid destination" }, { status: 400 });
  }

  if (!body.item || (body.item.type !== "file" && body.item.type !== "folder")) {
    return NextResponse.json({ error: "Invalid item" }, { status: 400 });
  }

  if (body.item.type === "file") {
    const { key } = body.item;
    if (!key || key.endsWith("/") || !isAllowedKey(key, email)) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const fileName = key.slice(key.lastIndexOf("/") + 1);
    const destKey = `${prefix}${safeDest}${fileName}`;

    if (destKey === key) {
      return NextResponse.json({ ok: true, key });
    }

    try {
      if (await objectExists(destKey)) {
        return NextResponse.json(
          { error: "A file with this name already exists there" },
          { status: 409 }
        );
      }
      await moveObject(key, destKey);
      return NextResponse.json({ ok: true, key: destKey });
    } catch (error) {
      console.error("Failed to move file", { key, destKey, error });
      return NextResponse.json({ error: "Could not move file" }, { status: 500 });
    }
  }

  // Folder move
  const { path, name } = body.item;
  if (!name || typeof name !== "string") {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  let safeParent = "";
  let safeName: string;
  try {
    safeParent = path ? sanitizePath(path) : "";
    safeName = sanitizeName(name);
  } catch {
    return NextResponse.json({ error: "Invalid folder name" }, { status: 400 });
  }

  const sourcePrefix = `${prefix}${safeParent}${safeName}/`;
  const destPrefix = `${prefix}${safeDest}${safeName}/`;

  if (destPrefix === sourcePrefix) {
    return NextResponse.json({ ok: true });
  }

  if (destPrefix.startsWith(sourcePrefix)) {
    return NextResponse.json(
      { error: "Can't move a folder into itself" },
      { status: 400 }
    );
  }

  try {
    if (await prefixHasObjects(destPrefix)) {
      return NextResponse.json(
        { error: "A folder with this name already exists there" },
        { status: 409 }
      );
    }
    await moveFolder(sourcePrefix, destPrefix);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Failed to move folder", { sourcePrefix, destPrefix, error });
    return NextResponse.json({ error: "Could not move folder" }, { status: 500 });
  }
}
