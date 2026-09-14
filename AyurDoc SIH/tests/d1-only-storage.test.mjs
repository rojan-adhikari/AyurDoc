import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("production configuration contains D1 and no R2 binding", async () => {
  const config = JSON.parse(await readFile("wrangler.jsonc", "utf8"));
  assert.equal(config.d1_databases?.[0]?.binding, "DB");
  assert.equal(config.d1_databases?.[0]?.database_name, "ayurdoc-db");
  assert.equal(config.r2_buckets, undefined);
});

test("application source contains no R2 bucket calls", async () => {
  const paths = [
    "app/api/direct-voice/route.ts",
    "app/api/documents/route.ts",
    "app/api/identity/route.ts",
    "app/api/intakes/route.ts",
    "app/api/auth/register/route.ts",
    "app/api/auth/doctor-register/route.ts",
    "app/api/admin/identity/route.ts",
    "app/api/admin/doctor-applications/route.ts",
    "app/api/admin/users/route.ts",
  ];
  const sources = await Promise.all(paths.map((path) => readFile(path, "utf8")));
  assert.equal(sources.some((source) => source.includes("env.BUCKET")), false);
});

test("stored file migration uses a BLOB payload", async () => {
  const migration = await readFile("drizzle/0013_dusty_kylun.sql", "utf8");
  assert.match(migration, /CREATE TABLE `stored_files`/);
  assert.match(migration, /`file_data` blob NOT NULL/);
});
