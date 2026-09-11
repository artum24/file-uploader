import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prefixForScope, sanitizeName, sanitizePath, type Scope } from "@/lib/access";
import { getUploadUrl } from "@/lib/s3";
import {
  MAX_UPLOAD_SIZE_BYTES,
  isAllowedExtension,
} from "@/lib/upload-limits";

interface UploadRequestBody {
  fileName?: string;
  contentType?: string;
  size?: number;
  scope?: Scope;
  folder?: string;
}

export async function POST(request: Request) {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: UploadRequestBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { fileName, contentType, size, folder } = body;
  const scope: Scope = body.scope === "shared" ? "shared" : "personal";

  if (!fileName || typeof fileName !== "string") {
    return NextResponse.json({ error: "fileName is required" }, { status: 400 });
  }

  if (!isAllowedExtension(fileName)) {
    return NextResponse.json(
      { error: "This file type isn't allowed" },
      { status: 400 }
    );
  }

  if (typeof size === "number" && size > MAX_UPLOAD_SIZE_BYTES) {
    return NextResponse.json(
      { error: "File is larger than the 200 MB limit" },
      { status: 400 }
    );
  }

  let safeName: string;
  let safeFolder = "";
  try {
    safeName = sanitizeName(fileName);
    if (folder) {
      safeFolder = sanitizePath(folder);
    }
  } catch (error) {
    console.error("Invalid fileName or folder in /api/files/upload-url", {
      fileName,
      folder,
      error,
    });
    return NextResponse.json({ error: "Invalid fileName or folder" }, { status: 400 });
  }

  const key = `${prefixForScope(scope, email)}${safeFolder}${safeName}`;

  try {
    const url = await getUploadUrl(key, contentType || "application/octet-stream");
    return NextResponse.json({ url, key });
  } catch (error) {
    console.error("Failed to create upload URL", error);
    return NextResponse.json(
      { error: "Could not create upload URL" },
      { status: 500 }
    );
  }
}
