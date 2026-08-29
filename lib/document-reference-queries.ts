import type { SqlValue } from "@/lib/db-helpers";

export type DocumentReferenceSummary = {
  proposals: number;
  revisions: number;
  analyses: number;
  ragQueries: number;
  jobs: number;
  auditEvents: number;
  attachmentJobs: number;
  supersedingDocuments: number;
  releasePackages: number;
};

export type DocumentChunkReferenceSummary = Omit<
  DocumentReferenceSummary,
  "attachmentJobs" | "supersedingDocuments"
>;

export type DocumentReferenceQuery = {
  sql: string;
  values: SqlValue[];
};

function chunkReferenceQueries(
  ownerId: string,
  documentId: string,
): Record<keyof DocumentChunkReferenceSummary, DocumentReferenceQuery> {
  const chunkMatch = `reference.type = 'text' AND CAST(reference.atom AS TEXT) IN (
    SELECT id FROM rag_chunks WHERE owner_id = ? AND document_id = ?
  )`;
  return {
    proposals: {
      sql: `SELECT COUNT(*) AS count
      FROM proposals proposal
      WHERE proposal.owner_id = ? AND (
        EXISTS (
          SELECT 1
          FROM json_tree(CASE WHEN json_valid(proposal.sections_json) THEN proposal.sections_json ELSE '[]' END) reference
          WHERE reference.key = 'chunkId' AND ${chunkMatch}
        ) OR EXISTS (
          SELECT 1
          FROM json_tree(CASE WHEN json_valid(proposal.citations_json) THEN proposal.citations_json ELSE '[]' END) reference
          WHERE reference.key = 'chunkId' AND ${chunkMatch}
        )
      )`,
      values: [ownerId, ownerId, documentId, ownerId, documentId],
    },
    revisions: {
      sql: `SELECT COUNT(DISTINCT revision.id) AS count
      FROM proposal_revisions revision,
        json_tree(CASE WHEN json_valid(revision.sections_json) THEN revision.sections_json ELSE '[]' END) reference
      WHERE revision.owner_id = ? AND reference.key = 'chunkId' AND ${chunkMatch}`,
      values: [ownerId, ownerId, documentId],
    },
    analyses: {
      sql: `SELECT COUNT(DISTINCT analysis.id) AS count
      FROM ai_analyses analysis,
        json_tree(CASE WHEN json_valid(analysis.solicitation_chunk_ids_json) THEN analysis.solicitation_chunk_ids_json ELSE '[]' END) reference
      WHERE analysis.owner_id = ? AND reference.path = '$'
        AND typeof(reference.key) = 'integer' AND ${chunkMatch}`,
      values: [ownerId, ownerId, documentId],
    },
    ragQueries: {
      sql: `SELECT COUNT(DISTINCT query.id) AS count
      FROM rag_queries query,
        json_tree(CASE WHEN json_valid(query.retrieved_chunk_ids_json) THEN query.retrieved_chunk_ids_json ELSE '[]' END) reference
      WHERE query.owner_id = ? AND reference.path = '$'
        AND typeof(reference.key) = 'integer' AND ${chunkMatch}`,
      values: [ownerId, ownerId, documentId],
    },
    jobs: {
      sql: `SELECT COUNT(DISTINCT job.id) AS count
      FROM jobs job,
        json_tree(CASE WHEN json_valid(job.result_json) THEN job.result_json ELSE '[]' END) reference
      WHERE job.owner_id = ? AND reference.key = 'chunkId' AND ${chunkMatch}`,
      values: [ownerId, ownerId, documentId],
    },
    auditEvents: {
      sql: `SELECT COUNT(DISTINCT event.id) AS count
      FROM audit_events event,
        json_tree(CASE WHEN json_valid(event.details_json) THEN event.details_json ELSE '{}' END) reference
      WHERE event.owner_id = ? AND reference.path IN ('$.chunks', '$.evidenceChunks')
        AND typeof(reference.key) = 'integer' AND ${chunkMatch}`,
      values: [ownerId, ownerId, documentId],
    },
    releasePackages: {
      sql: `SELECT COUNT(*) AS count
      FROM submission_packages package
      WHERE package.owner_id = ? AND package.status = 'submitted' AND EXISTS (
        SELECT 1
        FROM json_tree(CASE WHEN json_valid(package.manifest_json) THEN package.manifest_json ELSE '{}' END) reference
        WHERE reference.key = 'chunkId'
          AND (
            reference.path LIKE '$.proposal.citations[%]'
            OR reference.path LIKE '$.proposal.sections[%].citations[%]'
          )
          AND ${chunkMatch}
      )`,
      values: [ownerId, ownerId, documentId],
    },
  };
}

export function documentChunkReferenceQueries(
  ownerId: string,
  documentId: string,
): Record<keyof DocumentChunkReferenceSummary, DocumentReferenceQuery> {
  return chunkReferenceQueries(ownerId, documentId);
}

export function documentReferenceQueries(
  ownerId: string,
  documentId: string,
): Record<keyof DocumentReferenceSummary, DocumentReferenceQuery> {
  const queries = chunkReferenceQueries(ownerId, documentId);
  const chunkMatch = `reference.type = 'text' AND CAST(reference.atom AS TEXT) IN (
    SELECT id FROM rag_chunks WHERE owner_id = ? AND document_id = ?
  )`;
  return {
    ...queries,
    auditEvents: {
      sql: `SELECT COUNT(*) AS count
      FROM audit_events event
      WHERE event.owner_id = ? AND (
        EXISTS (
          SELECT 1
          FROM json_tree(CASE WHEN json_valid(event.details_json) THEN event.details_json ELSE '{}' END) reference
          WHERE reference.path IN ('$.chunks', '$.evidenceChunks')
            AND typeof(reference.key) = 'integer' AND ${chunkMatch}
        ) OR EXISTS (
          SELECT 1
          FROM json_tree(CASE WHEN json_valid(event.details_json) THEN event.details_json ELSE '{}' END) reference
          WHERE reference.type = 'text'
            AND reference.path = '$'
            AND reference.key = 'documentId'
            AND CAST(reference.atom AS TEXT) = ?
        )
      )`,
      values: [ownerId, ownerId, documentId, documentId],
    },
    attachmentJobs: {
      sql: `SELECT COUNT(*) AS count
      FROM attachment_jobs attachment
      WHERE attachment.owner_id = ? AND attachment.document_id = ?`,
      values: [ownerId, documentId],
    },
    supersedingDocuments: {
      sql: `SELECT COUNT(*) AS count
      FROM documents document
      WHERE document.owner_id = ? AND document.supersedes_document_id = ?`,
      values: [ownerId, documentId],
    },
    releasePackages: {
      sql: `SELECT COUNT(*) AS count
      FROM submission_packages package
      WHERE package.owner_id = ? AND package.status = 'submitted' AND EXISTS (
        SELECT 1
        FROM json_tree(CASE WHEN json_valid(package.manifest_json) THEN package.manifest_json ELSE '{}' END) reference
        WHERE (
          reference.type = 'text'
          AND reference.key = 'id'
          AND reference.path LIKE '$.sources[%]'
          AND CAST(reference.atom AS TEXT) = ?
        ) OR (
          reference.key = 'chunkId'
          AND (
            reference.path LIKE '$.proposal.citations[%]'
            OR reference.path LIKE '$.proposal.sections[%].citations[%]'
          )
          AND ${chunkMatch}
        )
      )`,
      values: [ownerId, documentId, ownerId, documentId],
    },
  };
}
