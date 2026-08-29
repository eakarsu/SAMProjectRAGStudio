import { newId, nowIso, run } from '@/lib/db-helpers';
import { askAiWithEvidence } from '@/lib/openrouter';
import { getOwnedProject, recordAudit, retrieveProjectEvidence } from '@/lib/project-repository';
import { buildEvidenceBrief } from '@/lib/rag';

export async function queryProject(
  ownerId: string,
  projectId: string,
  question: string,
  mode: 'ai' | 'evidence',
) {
  const project = await getOwnedProject(ownerId, projectId);
  const trimmed = question.trim();
  if (trimmed.length < 4) throw new Error('Ask a more specific project question.');
  if (trimmed.length > 2_000) throw new Error('Project questions must be 2,000 characters or shorter.');
  const chunks = await retrieveProjectEvidence(ownerId, projectId, trimmed, mode === 'ai' ? 10 : 8);
  const result = mode === 'ai'
    ? await askAiWithEvidence(trimmed, chunks)
    : { answer: buildEvidenceBrief(trimmed, chunks), model: null, providerResponseId: null, usage: {} };
  const queryId = newId('query');
  await run(
    `INSERT INTO rag_queries (
      id, owner_id, project_id, namespace, query, retrieved_chunk_ids_json,
      answer_json, mode, model, provider_response_id, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      queryId,
      ownerId,
      projectId,
      project.namespace,
      trimmed,
      JSON.stringify(chunks.map((chunk) => chunk.id)),
      JSON.stringify(result.answer),
      mode,
      result.model,
      result.providerResponseId,
      nowIso(),
    ],
  );
  await recordAudit(ownerId, projectId, mode === 'ai' ? 'rag.ai.answered' : 'rag.evidence.retrieved', 'rag_query', queryId, {
    chunks: chunks.map((chunk) => chunk.id),
    model: result.model,
  });
  return {
    id: queryId,
    mode,
    answer: result.answer,
    model: result.model,
    usage: result.usage,
    createdAt: nowIso(),
  };
}
