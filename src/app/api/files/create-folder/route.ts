import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prefixForScope, sanitizeName, sanitizePath, type Scope } from "@/lib/access";
import { createFolder } from "@/lib/s3";

interface CreateFolderBody {
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

  let body: CreateFolderBody;
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
    console.error("Invalid folder name in /api/files/create-folder", {
      path,
      name,
      error,
    });
    return NextResponse.json({ error: "Invalid folder name" }, { status: 400 });
  }

  const key = `${prefixForScope(scope, email)}${safeParent}${safeName}/`;

  try {
    await createFolder(key);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Failed to create folder", error);
    return NextResponse.json(
      { error: "Could not create folder" },
      { status: 500 }
    );
  }
}
