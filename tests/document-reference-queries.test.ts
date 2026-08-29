import { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";
import {
  documentChunkReferenceQueries,
  documentReferenceQueries,
} from "@/lib/document-reference-queries";

function createDatabase() {
  const database = new DatabaseSync(":memory:");
  database.exec(`
    CREATE TABLE rag_chunks (id TEXT, owner_id TEXT, document_id TEXT);
    CREATE TABLE documents (id TEXT, owner_id TEXT, supersedes_document_id TEXT);
    CREATE TABLE proposals (id TEXT, owner_id TEXT, sections_json TEXT, citations_json TEXT);
    CREATE TABLE proposal_revisions (id TEXT, owner_id TEXT, sections_json TEXT);
    CREATE TABLE ai_analyses (id TEXT, owner_id TEXT, solicitation_chunk_ids_json TEXT);
    CREATE TABLE rag_queries (id TEXT, owner_id TEXT, retrieved_chunk_ids_json TEXT);
    CREATE TABLE jobs (id TEXT, owner_id TEXT, result_json TEXT);
    CREATE TABLE audit_events (id TEXT, owner_id TEXT, details_json TEXT);
    CREATE TABLE attachment_jobs (id TEXT, owner_id TEXT, document_id TEXT);
    CREATE TABLE submission_packages (id TEXT, owner_id TEXT, status TEXT, manifest_json TEXT);
  `);
  return database;
}

function insert(
  database: DatabaseSync,
  sql: string,
  ...values: Array<string | null>
) {
  database.prepare(sql).run(...values);
}

function referenceCounts(
  database: DatabaseSync,
  ownerId: string,
  documentId: string,
  chunkOnly = false,
) {
  const counts: Record<string, number> = {};
  for (const [name, query] of Object.entries(
    chunkOnly
      ? documentChunkReferenceQueries(ownerId, documentId)
      : documentReferenceQueries(ownerId, documentId),
  )) {
    const row = database
      .prepare(query.sql)
      .get(...(query.values as string[])) as { count: number };
    counts[name] = Number(row.count);
  }
  return counts;
}

describe("document provenance reference queries", () => {
  it("finds every retained document and chunk reference exactly once", () => {
    const database = createDatabase();
    try {
      const owner = "owner-a";
      const otherOwner = "owner-b";
      const documentId = "doc-target";
      const chunkId = "chunk-target";
      insert(
        database,
        "INSERT INTO rag_chunks VALUES (?, ?, ?)",
        chunkId,
        owner,
        documentId,
      );

      insert(
        database,
        "INSERT INTO proposals VALUES (?, ?, ?, ?)",
        "proposal-citation",
        owner,
        "[]",
        JSON.stringify([{ chunkId }]),
      );
      insert(
        database,
        "INSERT INTO proposals VALUES (?, ?, ?, ?)",
        "proposal-both",
        owner,
        JSON.stringify([{ citations: [{ chunkId }] }]),
        JSON.stringify([{ chunkId }]),
      );
      insert(
        database,
        "INSERT INTO proposals VALUES (?, ?, ?, ?)",
        "proposal-near-match",
        owner,
        JSON.stringify([{ chunkId: `${chunkId}-extra` }]),
        "not-json",
      );
      insert(
        database,
        "INSERT INTO proposals VALUES (?, ?, ?, ?)",
        "proposal-wrong-field",
        owner,
        JSON.stringify([{ body: chunkId, citations: [{ label: chunkId }] }]),
        JSON.stringify([{ label: chunkId, quote: chunkId }]),
      );
      insert(
        database,
        "INSERT INTO proposals VALUES (?, ?, ?, ?)",
        "proposal-other-owner",
        otherOwner,
        "[]",
        JSON.stringify([{ chunkId }]),
      );

      insert(
        database,
        "INSERT INTO proposal_revisions VALUES (?, ?, ?)",
        "revision-target",
        owner,
        JSON.stringify([{ citations: [{ chunkId }] }]),
      );
      insert(
        database,
        "INSERT INTO proposal_revisions VALUES (?, ?, ?)",
        "revision-invalid",
        owner,
        "{",
      );
      insert(
        database,
        "INSERT INTO proposal_revisions VALUES (?, ?, ?)",
        "revision-wrong-field",
        owner,
        JSON.stringify([{ body: chunkId }]),
      );

      insert(
        database,
        "INSERT INTO ai_analyses VALUES (?, ?, ?)",
        "analysis-target",
        owner,
        JSON.stringify([chunkId]),
      );
      insert(
        database,
        "INSERT INTO ai_analyses VALUES (?, ?, ?)",
        "analysis-near-match",
        owner,
        JSON.stringify([`${chunkId}-extra`]),
      );
      insert(
        database,
        "INSERT INTO ai_analyses VALUES (?, ?, ?)",
        "analysis-wrong-root",
        owner,
        JSON.stringify({ message: chunkId }),
      );

      insert(
        database,
        "INSERT INTO rag_queries VALUES (?, ?, ?)",
        "query-target",
        owner,
        JSON.stringify([chunkId]),
      );
      insert(
        database,
        "INSERT INTO rag_queries VALUES (?, ?, ?)",
        "query-invalid",
        owner,
        "[",
      );
      insert(
        database,
        "INSERT INTO rag_queries VALUES (?, ?, ?)",
        "query-wrong-root",
        owner,
        JSON.stringify({ chunkId }),
      );

      insert(
        database,
        "INSERT INTO jobs VALUES (?, ?, ?)",
        "job-target",
        owner,
        JSON.stringify([{ citations: [{ chunkId }] }]),
      );
      insert(
        database,
        "INSERT INTO jobs VALUES (?, ?, ?)",
        "job-other-owner",
        otherOwner,
        JSON.stringify([{ citations: [{ chunkId }] }]),
      );
      insert(
        database,
        "INSERT INTO jobs VALUES (?, ?, ?)",
        "job-wrong-field",
        owner,
        JSON.stringify([{ body: chunkId, citations: [{ quote: chunkId }] }]),
      );

      insert(
        database,
        "INSERT INTO audit_events VALUES (?, ?, ?)",
        "audit-target",
        owner,
        JSON.stringify({ evidenceChunks: [chunkId], documentId }),
      );
      insert(
        database,
        "INSERT INTO audit_events VALUES (?, ?, ?)",
        "audit-near-match",
        owner,
        JSON.stringify({ evidenceChunks: [`prefix-${chunkId}`] }),
      );
      insert(
        database,
        "INSERT INTO audit_events VALUES (?, ?, ?)",
        "audit-wrong-field",
        owner,
        JSON.stringify({ message: chunkId, documentId: chunkId }),
      );
      insert(
        database,
        "INSERT INTO audit_events VALUES (?, ?, ?)",
        "audit-document-only",
        owner,
        JSON.stringify({ documentId }),
      );

      insert(
        database,
        "INSERT INTO documents VALUES (?, ?, ?)",
        "document-newer",
        owner,
        documentId,
      );
      insert(
        database,
        "INSERT INTO documents VALUES (?, ?, ?)",
        "document-near-match",
        owner,
        `${documentId}-extra`,
      );
      insert(
        database,
        "INSERT INTO documents VALUES (?, ?, ?)",
        "document-other-owner",
        otherOwner,
        documentId,
      );

      insert(
        database,
        "INSERT INTO attachment_jobs VALUES (?, ?, ?)",
        "attachment-target",
        owner,
        documentId,
      );
      insert(
        database,
        "INSERT INTO attachment_jobs VALUES (?, ?, ?)",
        "attachment-near-match",
        owner,
        `${documentId}-extra`,
      );

      insert(
        database,
        "INSERT INTO submission_packages VALUES (?, ?, ?, ?)",
        "package-document",
        owner,
        "submitted",
        JSON.stringify({ sources: [{ id: documentId }] }),
      );
      insert(
        database,
        "INSERT INTO submission_packages VALUES (?, ?, ?, ?)",
        "package-chunk",
        owner,
        "submitted",
        JSON.stringify({ proposal: { citations: [{ chunkId }] } }),
      );
      insert(
        database,
        "INSERT INTO submission_packages VALUES (?, ?, ?, ?)",
        "package-both",
        owner,
        "submitted",
        JSON.stringify({
          sources: [{ id: documentId }],
          proposal: { sections: [{ citations: [{ chunkId }] }] },
        }),
      );
      insert(
        database,
        "INSERT INTO submission_packages VALUES (?, ?, ?, ?)",
        "package-near-match",
        owner,
        "submitted",
        JSON.stringify({
          sources: [{ id: `${documentId}-extra` }],
          chunkId: `${chunkId}-extra`,
        }),
      );
      insert(
        database,
        "INSERT INTO submission_packages VALUES (?, ?, ?, ?)",
        "package-invalid",
        owner,
        "submitted",
        "{",
      );
      insert(
        database,
        "INSERT INTO submission_packages VALUES (?, ?, ?, ?)",
        "package-wrong-field",
        owner,
        "submitted",
        JSON.stringify({
          project: { id: documentId },
          proposal: { citations: [{ label: chunkId, quote: chunkId }] },
        }),
      );
      insert(
        database,
        "INSERT INTO submission_packages VALUES (?, ?, ?, ?)",
        "package-rebuildable",
        owner,
        "validated",
        JSON.stringify({ sources: [{ id: documentId }], chunkId }),
      );
      insert(
        database,
        "INSERT INTO submission_packages VALUES (?, ?, ?, ?)",
        "package-other-owner",
        otherOwner,
        "submitted",
        JSON.stringify({ sources: [{ id: documentId }], chunkId }),
      );

      expect(referenceCounts(database, owner, documentId)).toEqual({
        proposals: 2,
        revisions: 1,
        analyses: 1,
        ragQueries: 1,
        jobs: 1,
        auditEvents: 2,
        attachmentJobs: 1,
        supersedingDocuments: 1,
        releasePackages: 3,
      });
      expect(referenceCounts(database, owner, documentId, true)).toEqual({
        proposals: 2,
        revisions: 1,
        analyses: 1,
        ragQueries: 1,
        jobs: 1,
        auditEvents: 1,
        releasePackages: 2,
      });
    } finally {
      database.close();
    }
  });

  it("does not treat substrings or another owner's values as provenance", () => {
    const database = createDatabase();
    try {
      insert(
        database,
        "INSERT INTO rag_chunks VALUES (?, ?, ?)",
        "chunk-doc-near-extra",
        "owner-a",
        "doc-near-extra",
      );
      insert(
        database,
        "INSERT INTO proposals VALUES (?, ?, ?, ?)",
        "proposal-near",
        "owner-a",
        JSON.stringify([{ chunkId: "chunk-doc-near-extra" }]),
        "[]",
      );
      insert(
        database,
        "INSERT INTO submission_packages VALUES (?, ?, ?, ?)",
        "package-other-owner",
        "owner-b",
        "submitted",
        JSON.stringify({ sources: [{ id: "doc-near" }] }),
      );

      expect(referenceCounts(database, "owner-a", "doc-near")).toEqual({
        proposals: 0,
        revisions: 0,
        analyses: 0,
        ragQueries: 0,
        jobs: 0,
        auditEvents: 0,
        attachmentJobs: 0,
        supersedingDocuments: 0,
        releasePackages: 0,
      });
    } finally {
      database.close();
    }
  });
});
