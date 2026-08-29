export type RagScope = {
  ownerId: string;
  projectId: string;
  namespace: string;
};

export type ChunkDraft = {
  chunkIndex: number;
  section: string | null;
  pageNumber: number;
  charStart: number;
  charEnd: number;
  content: string;
  vector: number[];
};

export type StoredChunk = RagScope & {
  id: string;
  documentId: string;
  documentTitle: string;
  chunkIndex: number;
  section: string | null;
  pageNumber: number | null;
  charStart: number;
  charEnd: number;
  content: string;
  vector: number[];
  amendmentNumber: number;
  isSuperseded: boolean;
};

export type RankedChunk = StoredChunk & {
  score: number;
  citationLabel: string;
};

export type ExtractedRequirement = {
  text: string;
  category: string;
  chunkIndex: number;
  citationLabel: string;
  amendmentNumber: number;
};

const STOP_WORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'been', 'by', 'for', 'from', 'has',
  'have', 'in', 'into', 'is', 'it', 'its', 'of', 'on', 'or', 'that', 'the', 'their',
  'this', 'to', 'was', 'were', 'will', 'with', 'within', 'shall', 'must', 'should',
]);

export function tokenize(value: string): string[] {
  return (value.toLocaleLowerCase('en-US').match(/[a-z0-9][a-z0-9._/-]{1,}/g) ?? [])
    .map((token) => token.replace(/^[./_-]+|[./_-]+$/g, ''))
    .filter((token) => token.length > 1 && !STOP_WORDS.has(token));
}

function fnv1a(value: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

export function sparseVector(value: string, dimensions = 192): number[] {
  const vector = Array.from({ length: dimensions }, () => 0);
  const counts = new Map<string, number>();
  for (const token of tokenize(value)) counts.set(token, (counts.get(token) ?? 0) + 1);

  for (const [token, count] of counts) {
    const hash = fnv1a(token);
    const index = hash % dimensions;
    const sign = (hash & 0x80000000) === 0 ? 1 : -1;
    vector[index] += sign * (1 + Math.log(count));
  }

  const norm = Math.sqrt(vector.reduce((sum, item) => sum + item * item, 0));
  return norm === 0 ? vector : vector.map((item) => Number((item / norm).toFixed(6)));
}

export function cosineSimilarity(left: number[], right: number[]): number {
  const length = Math.min(left.length, right.length);
  let dot = 0;
  let leftNorm = 0;
  let rightNorm = 0;
  for (let index = 0; index < length; index += 1) {
    dot += left[index] * right[index];
    leftNorm += left[index] * left[index];
    rightNorm += right[index] * right[index];
  }
  if (leftNorm === 0 || rightNorm === 0) return 0;
  return dot / (Math.sqrt(leftNorm) * Math.sqrt(rightNorm));
}

function looksLikeHeading(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 110 || /[.!?]$/.test(trimmed)) return false;
  if (/^(section|part|appendix|attachment|exhibit)\s+[a-z0-9]/i.test(trimmed)) return true;
  if (/^\d+(?:\.\d+){0,4}\s+\S+/.test(trimmed)) return true;
  const letters = trimmed.replace(/[^a-z]/gi, '');
  return letters.length > 4 && trimmed === trimmed.toUpperCase();
}

function normalizeText(value: string): string {
  return value
    .replace(/\r\n?/g, '\n')
    .replace(/[\t ]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function chunkText(
  sourceText: string,
  options: { maxChars?: number; overlapChars?: number } = {},
): ChunkDraft[] {
  const maxChars = Math.max(450, options.maxChars ?? 1050);
  const overlapChars = Math.min(Math.max(80, options.overlapChars ?? 180), Math.floor(maxChars / 3));
  const normalized = normalizeText(sourceText);
  if (!normalized) return [];

  const pages = normalized.split(/\f|\n\s*---\s*PAGE\s+\d+\s*---\s*\n/gi);
  const drafts: ChunkDraft[] = [];
  let globalOffset = 0;
  let currentSection: string | null = null;

  pages.forEach((page, pageIndex) => {
    const paragraphs = page.split(/\n{2,}/).map((item) => item.trim()).filter(Boolean);
    let buffer = '';
    let bufferStart = globalOffset;

    const flush = () => {
      const content = buffer.trim();
      if (!content) return;
      const leadingSpace = buffer.indexOf(content);
      const charStart = bufferStart + Math.max(0, leadingSpace);
      drafts.push({
        chunkIndex: drafts.length,
        section: currentSection,
        pageNumber: pageIndex + 1,
        charStart,
        charEnd: charStart + content.length,
        content,
        vector: sparseVector(content),
      });
      const overlap = content.slice(Math.max(0, content.length - overlapChars));
      const boundary = overlap.search(/[.!?]\s|\n/);
      buffer = boundary >= 0 ? overlap.slice(boundary + 1).trim() : overlap.trim();
      bufferStart = charStart + content.length - buffer.length;
    };

    for (const paragraph of paragraphs) {
      if (looksLikeHeading(paragraph)) currentSection = paragraph;
      const paragraphOffset = normalized.indexOf(paragraph, globalOffset);
      if (!buffer) bufferStart = paragraphOffset >= 0 ? paragraphOffset : globalOffset;

      if (paragraph.length > maxChars) {
        if (buffer) flush();
        const sentences = paragraph.match(/[^.!?]+[.!?]+|[^.!?]+$/g) ?? [paragraph];
        for (const sentence of sentences) {
          const candidate = buffer ? `${buffer} ${sentence.trim()}` : sentence.trim();
          if (candidate.length > maxChars && buffer) flush();
          buffer = buffer ? `${buffer} ${sentence.trim()}` : sentence.trim();
          if (buffer.length >= maxChars) flush();
        }
        continue;
      }

      const candidate = buffer ? `${buffer}\n\n${paragraph}` : paragraph;
      if (candidate.length > maxChars && buffer) flush();
      buffer = buffer ? `${buffer}\n\n${paragraph}` : paragraph;
    }
    if (buffer) flush();
    globalOffset += page.length + 1;
  });

  return drafts;
}

function lexicalScore(query: string, content: string): number {
  const queryTerms = new Set(tokenize(query));
  if (queryTerms.size === 0) return 0;
  const contentTerms = new Set(tokenize(content));
  let hits = 0;
  for (const term of queryTerms) if (contentTerms.has(term)) hits += 1;
  return hits / queryTerms.size;
}

export function citationLabel(chunk: Pick<StoredChunk, 'documentTitle' | 'pageNumber' | 'section' | 'chunkIndex'>): string {
  const locator = chunk.pageNumber
    ? `p. ${chunk.pageNumber}`
    : chunk.section
      ? chunk.section
      : `chunk ${chunk.chunkIndex + 1}`;
  return `${chunk.documentTitle} · ${locator}`;
}

export function rankChunks(
  query: string,
  chunks: StoredChunk[],
  scope: RagScope,
  limit = 8,
): RankedChunk[] {
  const queryVector = sparseVector(query);
  return chunks
    .filter((chunk) =>
      chunk.ownerId === scope.ownerId
      && chunk.projectId === scope.projectId
      && chunk.namespace === scope.namespace
      && !chunk.isSuperseded,
    )
    .map((chunk) => {
      const vector = cosineSimilarity(queryVector, chunk.vector);
      const lexical = lexicalScore(query, chunk.content);
      const amendmentBoost = Math.min(0.08, Math.max(0, chunk.amendmentNumber) * 0.012);
      const score = Math.max(0, (vector * 0.62) + (lexical * 0.35) + amendmentBoost);
      return { ...chunk, score, citationLabel: citationLabel(chunk) };
    })
    .filter((chunk) => chunk.score >= 0.045)
    .sort((left, right) => right.score - left.score || right.amendmentNumber - left.amendmentNumber)
    .slice(0, Math.max(1, Math.min(limit, 20)));
}

function requirementCategory(text: string): string {
  if (/security|nist|cmmc|fedramp|zero trust|authorization/i.test(text)) return 'Security';
  if (/deliver|report|plan|schedule|submission/i.test(text)) return 'Deliverable';
  if (/personnel|staff|key person|clearance|labor/i.test(text)) return 'Staffing';
  if (/performance|availability|response time|service level|uptime/i.test(text)) return 'Performance';
  if (/price|cost|invoice|payment|ceiling/i.test(text)) return 'Pricing';
  if (/past performance|experience|reference/i.test(text)) return 'Experience';
  return 'General';
}

export function extractRequirements(
  chunks: Array<Pick<ChunkDraft, 'chunkIndex' | 'content' | 'pageNumber' | 'section'>>,
  documentTitle: string,
  amendmentNumber = 0,
): ExtractedRequirement[] {
  const results: ExtractedRequirement[] = [];
  const seen = new Set<string>();
  const requirementPattern = /\b(shall|must|required to|is required|contractor will|offeror will)\b/i;

  for (const chunk of chunks) {
    const sentences = chunk.content
      .replace(/\n+/g, ' ')
      .match(/[^.!?;]+(?:[.!?;]+|$)/g) ?? [];
    for (const rawSentence of sentences) {
      const sentence = rawSentence.replace(/\s+/g, ' ').trim();
      if (sentence.length < 24 || sentence.length > 700 || !requirementPattern.test(sentence)) continue;
      const normalized = sentence.toLocaleLowerCase('en-US').replace(/[^a-z0-9]+/g, ' ').trim();
      if (seen.has(normalized)) continue;
      seen.add(normalized);
      const locator = chunk.pageNumber ? `p. ${chunk.pageNumber}` : chunk.section ?? `chunk ${chunk.chunkIndex + 1}`;
      results.push({
        text: sentence,
        category: requirementCategory(sentence),
        chunkIndex: chunk.chunkIndex,
        citationLabel: `${documentTitle} · ${locator}`,
        amendmentNumber,
      });
    }
  }
  return results;
}

export function buildEvidenceBrief(query: string, chunks: RankedChunk[]) {
  const evidence = chunks.map((chunk, index) => ({
    id: `E${index + 1}`,
    title: chunk.section ?? chunk.documentTitle,
    excerpt: chunk.content.length > 420 ? `${chunk.content.slice(0, 417).trim()}…` : chunk.content,
    citation: chunk.citationLabel,
    score: Math.round(chunk.score * 100),
    chunkId: chunk.id,
    amendmentNumber: chunk.amendmentNumber,
  }));
  return {
    headline: 'Project evidence brief',
    summary: evidence.length
      ? `Found ${evidence.length} source passages inside this project’s isolated RAG for “${query}”.`
      : 'No matching project evidence was found. Add or re-index a source before relying on this topic.',
    findings: evidence.map((item) => ({
      title: item.title,
      detail: item.excerpt,
      severity: 'evidence' as const,
      citations: [item.id],
    })),
    nextActions: evidence.length
      ? ['Review the cited source passages.', 'Promote confirmed statements into the compliance matrix.']
      : ['Add the missing solicitation or amendment.', 'Re-run retrieval after indexing completes.'],
    citations: evidence,
  };
}

export function parseVector(value: string | null | undefined): number[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) && parsed.every((item) => typeof item === 'number') ? parsed : [];
  } catch {
    return [];
  }
}
