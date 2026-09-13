import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { isAllowedKey, sanitizeName } from "@/lib/access";
import { moveObject, objectExists } from "@/lib/s3";

export async function POST(request: Request) {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { key?: string; newName?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { key, newName } = body;
  if (!key || key.endsWith("/") || !isAllowedKey(key, email)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (!newName || typeof newName !== "string") {
    return NextResponse.json({ error: "newName is required" }, { status: 400 });
  }

  let safeName: string;
  try {
    safeName = sanitizeName(newName);
  } catch {
    return NextResponse.json({ error: "Invalid file name" }, { status: 400 });
  }

  const parent = key.slice(0, key.lastIndexOf("/") + 1);
  const destKey = `${parent}${safeName}`;

  if (destKey === key) {
    return NextResponse.json({ ok: true, key });
  }

  try {
    if (await objectExists(destKey)) {
      return NextResponse.json(
        { error: "A file with this name already exists here" },
        { status: 409 }
      );
    }
    await moveObject(key, destKey);
    return NextResponse.json({ ok: true, key: destKey });
  } catch (error) {
    console.error("Failed to rename file", { key, destKey, error });
    return NextResponse.json({ error: "Could not rename file" }, { status: 500 });
  }
}
