import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { isAllowedKey } from "@/lib/access";
import { getDownloadUrl } from "@/lib/s3";

export async function GET(request: Request) {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const key = searchParams.get("key");
  const disposition =
    searchParams.get("disposition") === "attachment" ? "attachment" : "inline";

  if (!key || !isAllowedKey(key, email)) {
    // 404 rather than 403: don't reveal whether a key outside this user's
    // scope exists at all.
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const url = await getDownloadUrl(key, disposition);
    return NextResponse.json({ url });
  } catch (error) {
    console.error("Failed to create download URL", error);
    return NextResponse.json(
      { error: "Could not create download URL" },
      { status: 500 }
    );
  }
}
