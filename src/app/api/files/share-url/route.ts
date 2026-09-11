import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { isAllowedKey } from "@/lib/access";
import { getDownloadUrl, MAX_SHARE_TTL_SECONDS, MIN_SHARE_TTL_SECONDS } from "@/lib/s3";

export async function GET(request: Request) {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const key = searchParams.get("key");
  if (!key || !isAllowedKey(key, email)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const requested = Number(searchParams.get("expiresIn"));
  const expiresIn = Number.isFinite(requested)
    ? Math.min(Math.max(Math.floor(requested), MIN_SHARE_TTL_SECONDS), MAX_SHARE_TTL_SECONDS)
    : 3600;

  try {
    const url = await getDownloadUrl(key, "inline", expiresIn);
    return NextResponse.json({
      url,
      expiresAt: new Date(Date.now() + expiresIn * 1000).toISOString(),
    });
  } catch (error) {
    console.error("Failed to create share link", { key, error });
    return NextResponse.json({ error: "Could not create share link" }, { status: 500 });
  }
}
