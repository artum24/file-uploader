import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { isAllowedKey, prefixForScope, SHARED_PREFIX, TRASH_DIR, type Scope } from "@/lib/access";
import { moveObject } from "@/lib/s3";

export async function POST(request: Request) {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { key?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { key } = body;
  if (!key || key.endsWith("/") || !isAllowedKey(key, email)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const scope: Scope = key.startsWith(SHARED_PREFIX) ? "shared" : "personal";
  const prefix = prefixForScope(scope, email);
  const relativePath = key.slice(prefix.length);
  if (!relativePath) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const trashKey = `${prefix}${TRASH_DIR}/${Date.now()}~${encodeURIComponent(relativePath)}`;

  try {
    await moveObject(key, trashKey);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Failed to move file to trash", { key, error });
    return NextResponse.json({ error: "Could not delete file" }, { status: 500 });
  }
}
