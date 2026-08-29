import { env } from "cloudflare:workers";
import { all, batch, first, newId, nowIso, sha256 } from "@/lib/db-helpers";
import {
  documentChunkReferenceQueries,
  documentReferenceQueries,
  type DocumentChunkReferenceSummary,
  type DocumentReferenceQuery,
  type DocumentReferenceSummary,
} from "@/lib/document-reference-queries";
import {
  getOwnedProject,
  NotFoundError,
  recordAudit,
} from "@/lib/project-repository";
import { chunkText, extractRequirements } from "@/lib/rag";
import {
  assertReleaseMutable,
  invalidateReleaseValidation,
} from "@/lib/release-guards";
import { ConflictError } from "@/lib/errors";
import type { DocumentRow } from "@/lib/types";

async function ownedDocument(ownerId: string, documentId: string) {
  const document = await first<DocumentRow>(
    "SELECT * FROM documents WHERE id = ? AND owner_id = ?",
    [documentId, ownerId],
  );
  if (!document) throw new NotFoundError("Document not found.");
  await getOwnedProject(ownerId, document.project_id);
  return document;
}

function detectTables(content: string) {
  const tables: Array<{
    pageNumber: number;
    columns: string[];
    rows: string[][];
    source: string;
  }> = [];
  const pages = content.split("\f");
  pages.forEach((page, pageIndex) => {
    const lines = page
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
    const candidates = lines.filter(
      (line) => line.includes("|") || (line.match(/,/g)?.length ?? 0) >= 2,
    );
    if (candidates.length < 2) return;
    const separator = candidates[0].includes("|") ? "|" : ",";
    const parsed = candidates.slice(0, 30).map((line) =>
      line
        .split(separator)
        .map((cell) => cell.trim())
        .filter(Boolean),
    );
    const width = Math.max(...parsed.map((row) => row.length));
    if (width < 2) return;
    const [header, ...rows] = parsed;
    tables.push({
      pageNumber: pageIndex + 1,
      columns: Array.from(
        { length: width },
        (_, index) => header[index] || `Column ${index + 1}`,
      ),
      rows: rows.map((row) =>
        Array.from({ length: width }, (_, index) => row[index] || ""),
      ),
      source: "deterministic text-table detection",
    });
  });
  return tables;
}

export async function getDocumentLifecycle(
  ownerId: string,
  documentId: string,
) {
  const document = await ownedDocument(ownerId, documentId);
  const content = document.content_text ?? "";
  const pages = content.split("\f").map((text, index) => ({
    pageNumber: index + 1,
    text,
    characterCount: text.length,
    locator: `${document.title} · page ${index + 1}`,
  }));
  const chunks = await all<{
    id: string;
    chunk_index: number;
    section: string | null;
    page_number: number | null;
    char_start: number;
    char_end: number;
    content: string;
  }>(
    "SELECT id, chunk_index, section, page_number, char_start, char_end, content FROM rag_chunks WHERE owner_id = ? AND document_id = ? ORDER BY chunk_index",
    [ownerId, documentId],
  );
  return {
    document: {
      id: document.id,
      projectId: document.project_id,
      title: document.title,
      kind: document.kind,
      filename: document.filename,
      mimeType: document.mime_type,
      sourceUrl: document.source_url,
      storageKey: document.storage_key ? "stored" : null,
      contentHash: document.content_hash,
      amendmentNumber: document.amendment_number,
      isAuthoritative: Boolean(document.is_authoritative),
      extractionStatus: document.extraction_status,
      pageCount: document.page_count,
      byteSize: document.byte_size,
      ingestedAt: document.ingested_at,
    },
    pages,
    tables: detectTables(content),
    chunks: chunks.map((chunk) => ({
      id: chunk.id,
      index: chunk.chunk_index,
      section: chunk.section,
      pageNumber: chunk.page_number,
      charStart: chunk.char_start,
      charEnd: chunk.char_end,
      excerpt: chunk.content.slice(0, 360),
    })),
  };
}

export async function downloadDocument(ownerId: string, documentId: string) {
  const document = await ownedDocument(ownerId, documentId);
  if (document.storage_key && env.FILES) {
    const object = await env.FILES.get(document.storage_key);
    if (object)
      return new Response(object.body, {
        headers: {
          "content-type": document.mime_type ?? "application/octet-stream",
          "content-disposition": `attachment; filename="${(document.filename ?? document.title).replace(/["\r\n]/g, "_")}"`,
        },
      });
  }
  return new Response(document.content_text ?? "", {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "content-disposition": `attachment; filename="${(document.filename ?? `${document.title}.txt`).replace(/["\r\n]/g, "_")}"`,
    },
  });
}

async function countDocumentReferences<T extends string>(
  queries: Record<T, DocumentReferenceQuery>,
): Promise<Record<T, number>> {
  const entries = await Promise.all(
    Object.entries(queries).map(async ([name, query]) => {
      const { sql, values } = query as DocumentReferenceQuery;
      const result = await first<{ count: number }>(sql, values);
      return [name, Number(result?.count ?? 0)] as const;
    }),
  );
  return Object.fromEntries(entries) as Record<T, number>;
}

export async function documentReferences(
  ownerId: string,
  documentId: string,
): Promise<DocumentReferenceSummary> {
  return countDocumentReferences(documentReferenceQueries(ownerId, documentId));
}

async function documentChunkReferences(
  ownerId: string,
  documentId: string,
): Promise<DocumentChunkReferenceSummary> {
  return countDocumentReferences(
    documentChunkReferenceQueries(ownerId, documentId),
  );
}

function referenceSummaryText(
  references: DocumentReferenceSummary | DocumentChunkReferenceSummary,
) {
  return Object.entries(references)
    .filter(([, count]) => count > 0)
    .map(
      ([name, count]) =>
        `${count} ${name.replace(/([A-Z])/g, " $1").toLowerCase()}`,
    )
    .join(", ");
}

export async function deleteDocument(
  ownerId: string,
  documentId: string,
  force = false,
) {
  const document = await ownedDocument(ownerId, documentId);
  await assertReleaseMutable(
    ownerId,
    document.project_id,
    null,
    "source document",
  );
  const references = await documentReferences(ownerId, documentId);
  const referenceCount = Object.values(references).reduce(
    (total, count) => total + count,
    0,
  );
  if (referenceCount > 0) {
    throw new ConflictError(
      `This source is retained by ${referenceSummaryText(references)}. Upload a replacement source so the existing provenance remains verifiable.`,
    );
  }
  await batch([
    {
      sql: "DELETE FROM requirements WHERE owner_id = ? AND document_id = ?",
      values: [ownerId, documentId],
    },
    {
      sql: "DELETE FROM rag_chunks WHERE owner_id = ? AND document_id = ?",
      values: [ownerId, documentId],
    },
    {
      sql: "DELETE FROM documents WHERE owner_id = ? AND id = ?",
      values: [ownerId, documentId],
    },
    {
      sql: `UPDATE projects SET rag_status = CASE WHEN EXISTS(SELECT 1 FROM rag_chunks WHERE project_id = ? AND owner_id = ?) THEN 'ready' ELSE 'needs-sources' END, updated_at = ? WHERE id = ? AND owner_id = ?`,
      values: [
        document.project_id,
        ownerId,
        nowIso(),
        document.project_id,
        ownerId,
      ],
    },
  ]);
  await invalidateReleaseValidation(
    ownerId,
    document.project_id,
    null,
    "A source document was deleted after package validation.",
  );
  if (document.storage_key && env.FILES)
    await env.FILES.delete(document.storage_key).catch(() => undefined);
  await recordAudit(
    ownerId,
    document.project_id,
    "source.deleted",
    "document",
    documentId,
    { title: document.title, forced: force, references },
  );
  return {
    deleted: true,
    documentId,
    storageDeleted: Boolean(document.storage_key),
  };
}

export async function reprocessDocument(ownerId: string, documentId: string) {
  const document = await ownedDocument(ownerId, documentId);
  await assertReleaseMutable(
    ownerId,
    document.project_id,
    null,
    "source document",
  );
  const references = await documentChunkReferences(ownerId, documentId);
  if (Object.values(references).some((count) => count > 0)) {
    throw new ConflictError(
      `This source cannot be reprocessed because retained records depend on its current chunk IDs (${referenceSummaryText(references)}). Upload the revised source as a new version instead.`,
    );
  }
  const content = document.content_text?.trim();
  if (!content)
    throw new Error(
      "This source has no retained text to reprocess. Download or OCR the original again.",
    );
  const chunks = chunkText(content);
  const extracted = extractRequirements(
    chunks,
    document.title,
    document.amendment_number,
  );
  const now = nowIso();
  const hash = await sha256(content);
  const chunkIds = chunks.map(() => newId("chunk"));
  const statements: Array<{
    sql: string;
    values: Array<string | number | null>;
  }> = [
    {
      sql: "DELETE FROM requirements WHERE owner_id = ? AND document_id = ?",
      values: [ownerId, documentId],
    },
    {
      sql: "DELETE FROM rag_chunks WHERE owner_id = ? AND document_id = ?",
      values: [ownerId, documentId],
    },
    {
      sql: `UPDATE documents SET extraction_status = 'ready', content_hash = ?, page_count = ?, ingested_at = ? WHERE id = ? AND owner_id = ?`,
      values: [
        hash,
        Math.max(1, ...chunks.map((chunk) => chunk.pageNumber)),
        now,
        documentId,
        ownerId,
      ],
    },
  ];
  chunks.forEach((chunk, index) =>
    statements.push({
      sql: `INSERT INTO rag_chunks
      (id, owner_id, project_id, namespace, document_id, chunk_index, section, page_number, char_start, char_end,
       content, content_hash, vector_json, semantic_vector_json, embedding_model, amendment_number, is_superseded, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, ?, 0, ?)`,
      values: [
        chunkIds[index],
        ownerId,
        document.project_id,
        document.namespace,
        documentId,
        chunk.chunkIndex,
        chunk.section,
        chunk.pageNumber,
        chunk.charStart,
        chunk.charEnd,
        chunk.content,
        hash,
        JSON.stringify(chunk.vector),
        document.amendment_number,
        now,
      ],
    }),
  );
  extracted.forEach((requirement, index) => {
    const chunkId = chunkIds[requirement.chunkIndex];
    if (!chunkId) return;
    statements.push({
      sql: `INSERT INTO requirements
        (id, owner_id, project_id, document_id, chunk_id, requirement_key, text, category, status, verification,
         citation_label, assignee, proposal_section, priority, amendment_number, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'unreviewed', 'machine-extracted', ?, NULL, NULL, 'medium', ?, ?, ?)`,
      values: [
        newId("req"),
        ownerId,
        document.project_id,
        documentId,
        chunkId,
        `REQ-R${String(index + 1).padStart(3, "0")}-${documentId.slice(-4)}`,
        requirement.text,
        requirement.category,
        requirement.citationLabel,
        document.amendment_number,
        now,
        now,
      ],
    });
  });
  await batch(statements);
  await invalidateReleaseValidation(
    ownerId,
    document.project_id,
    null,
    "A source document was reprocessed after package validation.",
  );
  await recordAudit(
    ownerId,
    document.project_id,
    "source.reprocessed",
    "document",
    documentId,
    {
      chunks: chunks.length,
      requirements: extracted.length,
      contentHash: hash,
    },
  );
  return getDocumentLifecycle(ownerId, documentId);
}
