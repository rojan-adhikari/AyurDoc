import { env } from "cloudflare:workers";

// D1 limits a BLOB/row to 2,000,000 bytes. Keeping application files below
// 1.5 MiB leaves room for row metadata and makes failures predictable.
export const MAX_D1_FILE_BYTES = 1_500_000;

export type StoredFile = {
  objectKey: string;
  ownerUsername: string;
  category: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  bytes: ArrayBuffer;
};

function exactArrayBuffer(value: ArrayBuffer | Uint8Array): ArrayBuffer {
  if (value instanceof ArrayBuffer) return value;
  return value.buffer.slice(
    value.byteOffset,
    value.byteOffset + value.byteLength,
  ) as ArrayBuffer;
}

function resultBytes(value: unknown): ArrayBuffer | null {
  if (value instanceof ArrayBuffer) return value;
  if (ArrayBuffer.isView(value)) {
    const view = value as ArrayBufferView;
    return view.buffer.slice(
      view.byteOffset,
      view.byteOffset + view.byteLength,
    ) as ArrayBuffer;
  }
  if (Array.isArray(value) && value.every((item) => Number.isInteger(item)))
    return Uint8Array.from(value as number[]).buffer;
  return null;
}

export async function putD1File(input: {
  objectKey: string;
  ownerUsername: string;
  category: string;
  fileName: string;
  contentType: string;
  bytes: ArrayBuffer | Uint8Array;
}) {
  const bytes = exactArrayBuffer(input.bytes);
  if (bytes.byteLength < 1 || bytes.byteLength > MAX_D1_FILE_BYTES)
    throw new Error(`File must be between 1 byte and ${MAX_D1_FILE_BYTES} bytes.`);

  await env.DB.prepare(
    `INSERT INTO stored_files (
       object_key, owner_username, category, file_name, content_type,
       size_bytes, file_data, created_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
     ON CONFLICT(object_key) DO UPDATE SET
       owner_username = excluded.owner_username,
       category = excluded.category,
       file_name = excluded.file_name,
       content_type = excluded.content_type,
       size_bytes = excluded.size_bytes,
       file_data = excluded.file_data,
       created_at = CURRENT_TIMESTAMP`,
  )
    .bind(
      input.objectKey,
      input.ownerUsername,
      input.category,
      input.fileName.slice(0, 240),
      input.contentType.slice(0, 120),
      bytes.byteLength,
      bytes,
    )
    .run();
}

export async function getD1File(objectKey: string): Promise<StoredFile | null> {
  const row = await env.DB.prepare(
    `SELECT object_key, owner_username, category, file_name, content_type,
            size_bytes, file_data
     FROM stored_files WHERE object_key = ?`,
  )
    .bind(objectKey)
    .first<{
      object_key: string;
      owner_username: string;
      category: string;
      file_name: string;
      content_type: string;
      size_bytes: number;
      file_data: unknown;
    }>();
  if (!row) return null;
  const bytes = resultBytes(row.file_data);
  if (!bytes) return null;
  return {
    objectKey: row.object_key,
    ownerUsername: row.owner_username,
    category: row.category,
    fileName: row.file_name,
    contentType: row.content_type,
    sizeBytes: row.size_bytes,
    bytes,
  };
}

export async function deleteD1File(objectKey: string) {
  if (!objectKey) return;
  await env.DB.prepare("DELETE FROM stored_files WHERE object_key = ?")
    .bind(objectKey)
    .run();
}
