import { describe, expect, it } from 'vitest';
import {
  buildEvidenceBrief,
  chunkText,
  extractRequirements,
  rankChunks,
  sparseVector,
  type StoredChunk,
} from '@/lib/rag';

function stored(overrides: Partial<StoredChunk> & Pick<StoredChunk, 'id' | 'content'>): StoredChunk {
  const { id, content, ...rest } = overrides;
  return {
    id,
    ownerId: 'owner-a',
    projectId: 'project-a',
    namespace: 'tenant:a:project:a:rag:v1',
    documentId: 'doc-a',
    documentTitle: 'Solicitation',
    chunkIndex: 0,
    section: 'Technical Requirements',
    pageNumber: 1,
    charStart: 0,
    charEnd: content.length,
    content,
    vector: sparseVector(content),
    amendmentNumber: 0,
    isSuperseded: false,
    ...rest,
  };
}

describe('project RAG', () => {
  it('creates page-aware chunks with stable locators', () => {
    const chunks = chunkText('SECTION 1 — SCOPE\n\nThe contractor shall deliver a plan.\fSECTION 2 — SECURITY\n\nThe system must encrypt data at rest.');
    expect(chunks.length).toBeGreaterThanOrEqual(2);
    expect(chunks[0].pageNumber).toBe(1);
    expect(chunks.at(-1)?.pageNumber).toBe(2);
    expect(chunks.every((chunk) => chunk.charEnd > chunk.charStart)).toBe(true);
  });

  it('filters owner, project, and namespace before ranking', () => {
    const scope = { ownerId: 'owner-a', projectId: 'project-a', namespace: 'tenant:a:project:a:rag:v1' };
    const chunks = [
      stored({ id: 'allowed', content: 'The platform must encrypt data and maintain availability.' }),
      stored({ id: 'wrong-project', projectId: 'project-b', content: 'The platform must encrypt data and maintain availability.' }),
      stored({ id: 'wrong-owner', ownerId: 'owner-b', content: 'The platform must encrypt data and maintain availability.' }),
      stored({ id: 'wrong-namespace', namespace: 'tenant:a:project:b:rag:v1', content: 'The platform must encrypt data and maintain availability.' }),
    ];
    expect(rankChunks('encryption availability', chunks, scope).map((chunk) => chunk.id)).toEqual(['allowed']);
  });

  it('excludes superseded evidence and favors current amendments', () => {
    const scope = { ownerId: 'owner-a', projectId: 'project-a', namespace: 'tenant:a:project:a:rag:v1' };
    const chunks = [
      stored({ id: 'superseded', isSuperseded: true, content: 'Proposals are due September 1.' }),
      stored({ id: 'base', content: 'Proposals are due September 10.' }),
      stored({ id: 'amendment', amendmentNumber: 2, documentTitle: 'Amendment 0002', content: 'Proposals are due September 10.' }),
    ];
    const ranked = rankChunks('proposal due date September 10', chunks, scope);
    expect(ranked.map((chunk) => chunk.id)).not.toContain('superseded');
    expect(ranked[0].id).toBe('amendment');
  });

  it('extracts mandatory requirements with source citations', () => {
    const chunks = chunkText('SECTION 4 — DELIVERY\n\nThe contractor shall deliver the migration plan within 30 days. The offeror must provide three past-performance references. Background information is optional.');
    const requirements = extractRequirements(chunks, 'Performance Work Statement');
    expect(requirements).toHaveLength(2);
    expect(requirements.every((item) => item.citationLabel.startsWith('Performance Work Statement'))).toBe(true);
  });

  it('returns a professional structured evidence brief rather than raw JSON text', () => {
    const scope = { ownerId: 'owner-a', projectId: 'project-a', namespace: 'tenant:a:project:a:rag:v1' };
    const ranked = rankChunks('security', [stored({ id: 'security', content: 'The contractor shall maintain a security plan.' })], scope);
    const brief = buildEvidenceBrief('security', ranked);
    expect(brief.headline).toBe('Project evidence brief');
    expect(brief.findings[0].citations).toEqual(['E1']);
    expect(brief.citations[0].chunkId).toBe('security');
  });
});
