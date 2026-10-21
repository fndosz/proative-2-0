import "server-only";
import { put, get, del } from "@vercel/blob";
import { promises as fs } from "fs";
import path from "path";

// Arquivos sempre privados. Em produção: Vercel Blob (access: "private").
// Sem BLOB_READ_WRITE_TOKEN (desenvolvimento local): pasta .storage/ no disco.
const useBlob = Boolean(process.env.BLOB_READ_WRITE_TOKEN);
const LOCAL_ROOT = path.join(process.cwd(), ".storage");

function safeName(name: string) {
  return name.normalize("NFD").replace(/[^\w.\-]+/g, "_").slice(-120);
}

export async function saveFile(folder: string, file: File): Promise<string> {
  const pathname = `${folder}/${Date.now()}-${safeName(file.name)}`;
  if (useBlob) {
    const res = await put(pathname, file, {
      access: "private",
      contentType: file.type || "application/octet-stream",
      addRandomSuffix: true,
    });
    return res.pathname;
  }
  const full = path.join(LOCAL_ROOT, pathname);
  await fs.mkdir(path.dirname(full), { recursive: true });
  await fs.writeFile(full, Buffer.from(await file.arrayBuffer()));
  return pathname;
}

export async function readFile(pathname: string): Promise<ReadableStream | null> {
  if (useBlob) {
    const res = await get(pathname, { access: "private" });
    return res?.stream ?? null;
  }
  const full = path.join(LOCAL_ROOT, pathname);
  if (!full.startsWith(LOCAL_ROOT)) return null;
  try {
    const buf = await fs.readFile(full);
    return new Blob([buf]).stream();
  } catch {
    return null;
  }
}

export async function deleteFile(pathname: string) {
  if (useBlob) return del(pathname);
  await fs.rm(path.join(LOCAL_ROOT, pathname), { force: true });
}
