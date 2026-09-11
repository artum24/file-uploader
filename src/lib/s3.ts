import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  CopyObjectCommand,
  HeadObjectCommand,
  DeleteObjectCommand,
  DeleteObjectsCommand,
  ListObjectsV2Command,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

/**
 * Shared S3 client for the app. Only ever import this from server-side code
 * (API routes / server actions) — never from client components — so AWS
 * credentials never reach the browser.
 */
export const s3 = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID ?? "",
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? "",
  },
});

export const BUCKET_NAME = process.env.S3_BUCKET_NAME ?? "";

/** How long presigned URLs stay valid, in seconds. */
export const PRESIGNED_URL_TTL_SECONDS = 300;

export async function getUploadUrl(key: string, contentType: string) {
  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
    ContentType: contentType,
  });
  return getSignedUrl(s3, command, { expiresIn: PRESIGNED_URL_TTL_SECONDS });
}

/**
 * Builds a Content-Disposition header that works for non-ASCII file names
 * too (RFC 6266): an ASCII fallback for old clients plus a UTF-8 encoded
 * filename* for everyone else.
 */
function contentDisposition(
  disposition: "inline" | "attachment",
  fileName: string
): string {
  const asciiFallback = fileName.replace(/[^\x20-\x7E]/g, "_") || "file";
  const encoded = encodeURIComponent(fileName);
  return `${disposition}; filename="${asciiFallback}"; filename*=UTF-8''${encoded}`;
}

export async function getDownloadUrl(
  key: string,
  disposition: "inline" | "attachment" = "inline",
  ttlSeconds: number = PRESIGNED_URL_TTL_SECONDS
) {
  const fileName = key.split("/").pop() || "file";
  const command = new GetObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
    ResponseContentDisposition: contentDisposition(disposition, fileName),
  });
  return getSignedUrl(s3, command, { expiresIn: ttlSeconds });
}

/** Longest a share link is allowed to stay valid — SigV4 presigned URLs
 * signed with long-term (non-STS) credentials support up to 7 days. */
export const MAX_SHARE_TTL_SECONDS = 7 * 24 * 60 * 60;
/** Shortest useful share link duration. */
export const MIN_SHARE_TTL_SECONDS = 5 * 60;

export async function deleteObject(key: string) {
  await s3.send(new DeleteObjectCommand({ Bucket: BUCKET_NAME, Key: key }));
}

export async function objectExists(key: string): Promise<boolean> {
  try {
    await s3.send(new HeadObjectCommand({ Bucket: BUCKET_NAME, Key: key }));
    return true;
  } catch (error) {
    const status =
      (error as { $metadata?: { httpStatusCode?: number } })?.$metadata?.httpStatusCode;
    if (status === 404) return false;
    throw error;
  }
}

export async function prefixHasObjects(prefix: string): Promise<boolean> {
  const page = await s3.send(
    new ListObjectsV2Command({ Bucket: BUCKET_NAME, Prefix: prefix, MaxKeys: 1 })
  );
  return (page.Contents?.length ?? 0) > 0;
}

/** Copies one object to a new key, then removes the original — S3 has no
 * native "move", so this is copy-then-delete. Used for the recycle bin
 * (trash/restore) and any future move/rename features. */
export async function moveObject(sourceKey: string, destKey: string) {
  await s3.send(
    new CopyObjectCommand({
      Bucket: BUCKET_NAME,
      CopySource: `${BUCKET_NAME}/${encodeURIComponent(sourceKey)}`,
      Key: destKey,
    })
  );
  await s3.send(new DeleteObjectCommand({ Bucket: BUCKET_NAME, Key: sourceKey }));
}

/**
 * Moves everything under a folder prefix (the folder marker itself plus
 * every nested object, at any depth) to the same relative layout under a
 * new prefix — copy each object, then batch-delete all the originals.
 * Used to move a folder into (or out of) the recycle bin.
 */
export async function moveFolder(sourcePrefix: string, destPrefix: string) {
  let continuationToken: string | undefined;
  const movedSourceKeys: string[] = [];

  do {
    const page = await s3.send(
      new ListObjectsV2Command({
        Bucket: BUCKET_NAME,
        Prefix: sourcePrefix,
        ContinuationToken: continuationToken,
      })
    );

    const keys = (page.Contents ?? [])
      .map((object) => object.Key)
      .filter((key): key is string => Boolean(key));

    for (const sourceKey of keys) {
      const destKey = destPrefix + sourceKey.slice(sourcePrefix.length);
      await s3.send(
        new CopyObjectCommand({
          Bucket: BUCKET_NAME,
          CopySource: `${BUCKET_NAME}/${encodeURIComponent(sourceKey)}`,
          Key: destKey,
        })
      );
      movedSourceKeys.push(sourceKey);
    }

    continuationToken = page.IsTruncated ? page.NextContinuationToken : undefined;
  } while (continuationToken);

  for (let i = 0; i < movedSourceKeys.length; i += 1000) {
    const chunk = movedSourceKeys.slice(i, i + 1000);
    await s3.send(
      new DeleteObjectsCommand({
        Bucket: BUCKET_NAME,
        Delete: { Objects: chunk.map((Key) => ({ Key })) },
      })
    );
  }
}

/**
 * Recursively deletes everything under a folder prefix (the folder marker
 * itself plus every object nested inside it, at any depth) by listing
 * without a Delimiter and batch-deleting in chunks of up to 1000 keys —
 * the max S3's DeleteObjects API accepts per request.
 */
export async function deleteFolder(prefix: string) {
  let continuationToken: string | undefined;

  do {
    const page = await s3.send(
      new ListObjectsV2Command({
        Bucket: BUCKET_NAME,
        Prefix: prefix,
        ContinuationToken: continuationToken,
      })
    );

    const keys = (page.Contents ?? [])
      .map((object) => object.Key)
      .filter((key): key is string => Boolean(key));

    if (keys.length > 0) {
      for (let i = 0; i < keys.length; i += 1000) {
        const chunk = keys.slice(i, i + 1000);
        await s3.send(
          new DeleteObjectsCommand({
            Bucket: BUCKET_NAME,
            Delete: { Objects: chunk.map((Key) => ({ Key })) },
          })
        );
      }
    }

    continuationToken = page.IsTruncated ? page.NextContinuationToken : undefined;
  } while (continuationToken);
}

/**
 * Creates a zero-byte "folder marker" object. S3 has no real folders — a
 * key ending in "/" with no content is the conventional way to make an
 * otherwise-empty folder show up (via ListObjectsV2 + Delimiter) before
 * anything has been uploaded into it.
 */
export async function createFolder(key: string) {
  await s3.send(new PutObjectCommand({ Bucket: BUCKET_NAME, Key: key, Body: "" }));
}

export async function listObjects(prefix: string) {
  const command = new ListObjectsV2Command({
    Bucket: BUCKET_NAME,
    Prefix: prefix,
    Delimiter: "/",
  });
  return s3.send(command);
}
