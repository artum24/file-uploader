import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prefixForScope, TRASH_DIR, type Scope } from "@/lib/access";
import { deleteFolder, deleteObject } from "@/lib/s3";

interface PurgeBody {
  scope?: Scope;
  id?: string;
  type?: "file" | "folder";
}

export async function POST(request: Request) {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: PurgeBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { id, type } = body;
  const scope: Scope = body.scope === "shared" ? "shared" : "personal";

  if (!id || (type !== "file" && type !== "folder") || !/^\d+~.*$/.test(id)) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const prefix = prefixForScope(scope, email);

  try {
    if (type === "file") {
      await deleteObject(`${prefix}${TRASH_DIR}/${id}`);
    } else {
      await deleteFolder(`${prefix}${TRASH_DIR}/${id}/`);
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Failed to purge trash entry", { id, type, error });
    return NextResponse.json({ error: "Could not delete permanently" }, { status: 500 });
  }
}
