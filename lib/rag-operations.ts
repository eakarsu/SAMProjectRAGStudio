import { all, batch, nowIso } from '@/lib/db-helpers';
import { embedTexts, embeddingStatus } from '@/lib/embeddings';
import { getOwnedProject, recordAudit } from '@/lib/project-repository';

export async function semanticReindexProject(ownerId: string, projectId: string) {
  const project = await getOwnedProject(ownerId, projectId);
  const chunks = await all<{ id: string; content: string }>(`SELECT id, content FROM rag_chunks
    WHERE owner_id = ? AND project_id = ? AND namespace = ? AND is_superseded = 0 ORDER BY document_id, chunk_index`, [ownerId, projectId, project.namespace]);
  if (chunks.length === 0) throw new Error('No current project chunks are available to embed.');
  let embedded = 0;
  let model = embeddingStatus().model;
  for (let start = 0; start < chunks.length; start += 16) {
    const group = chunks.slice(start, start + 16);
    const result = await embedTexts(group.map((chunk) => chunk.content));
    model = result.model;
    await batch(group.map((chunk, index) => ({
      sql: 'UPDATE rag_chunks SET semantic_vector_json = ?, embedding_model = ? WHERE id = ? AND owner_id = ? AND project_id = ?',
      values: [JSON.stringify(result.vectors[index]), model, chunk.id, ownerId, projectId],
    })));
    embedded += group.length;
  }
  await recordAudit(ownerId, projectId, 'rag.semantic.reindexed', 'project', projectId, { model, embedded });
  return { projectId, namespace: project.namespace, model, embedded, completedAt: nowIso() };
}

export async function ragHealth(ownerId: string, projectId: string) {
  const project = await getOwnedProject(ownerId, projectId);
  const counts = await all<{ total: number; embedded: number; current_docs: number; superseded: number }>(`SELECT
    COUNT(*) AS total,
    SUM(CASE WHEN semantic_vector_json IS NOT NULL THEN 1 ELSE 0 END) AS embedded,
    (SELECT COUNT(*) FROM documents WHERE owner_id = ? AND project_id = ? AND is_authoritative = 1) AS current_docs,
    SUM(CASE WHEN is_superseded = 1 THEN 1 ELSE 0 END) AS superseded
    FROM rag_chunks WHERE owner_id = ? AND project_id = ? AND namespace = ?`, [ownerId, projectId, ownerId, projectId, project.namespace]);
  const row = counts[0] ?? { total: 0, embedded: 0, current_docs: 0, superseded: 0 };
  return {
    namespace: project.namespace,
    status: project.rag_status,
    chunks: Number(row.total ?? 0),
    semanticChunks: Number(row.embedded ?? 0),
    semanticCoverage: Number(row.total ?? 0) ? Math.round((Number(row.embedded ?? 0) / Number(row.total)) * 100) : 0,
    authoritativeDocuments: Number(row.current_docs ?? 0),
    supersededChunks: Number(row.superseded ?? 0),
    minimumRelevance: 0.045,
    embedding: embeddingStatus(),
  };
}
