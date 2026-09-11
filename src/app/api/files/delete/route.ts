import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { isAllowedKey } from "@/lib/access";
import { deleteObject } from "@/lib/s3";

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
  if (!key || !isAllowedKey(key, email)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    await deleteObject(key);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Failed to delete object", error);
    return NextResponse.json({ error: "Could not delete file" }, { status: 500 });
  }
}
