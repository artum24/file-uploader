import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prefixForScope, sanitizeName, sanitizePath, TRASH_DIR, type Scope } from "@/lib/access";
import { moveFolder } from "@/lib/s3";

interface TrashFolderBody {
  scope?: Scope;
  path?: string;
  name?: string;
}

export async function POST(request: Request) {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: TrashFolderBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { name, path } = body;
  const scope: Scope = body.scope === "shared" ? "shared" : "personal";

  if (!name || typeof name !== "string") {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  let safeParent = "";
  let safeName: string;
  try {
    safeParent = path ? sanitizePath(path) : "";
    safeName = sanitizeName(name);
  } catch (error) {
    console.error("Invalid folder name in /api/files/trash-folder", { path, name, error });
    return NextResponse.json({ error: "Invalid folder name" }, { status: 400 });
  }

  const prefix = prefixForScope(scope, email);
  const relativeFolderPath = `${safeParent}${safeName}`;
  const sourcePrefix = `${prefix}${relativeFolderPath}/`;
  const trashPrefix = `${prefix}${TRASH_DIR}/${Date.now()}~${encodeURIComponent(relativeFolderPath)}/`;

  try {
    await moveFolder(sourcePrefix, trashPrefix);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Failed to move folder to trash", { sourcePrefix, error });
    return NextResponse.json({ error: "Could not delete folder" }, { status: 500 });
  }
}
