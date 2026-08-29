import { env } from 'cloudflare:workers';
import { sha256 } from '@/lib/db-helpers';

const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;
const MAX_EXTRACTED_CHARACTERS = 1_500_000;
const MAX_PDF_PAGES = 500;

function cleanFilename(value: string) {
  const name = value.split(/[\\/]/).at(-1) ?? 'source';
  return name.replace(/[^a-zA-Z0-9._ -]/g, '_').slice(0, 140) || 'source';
}

function plainTextFromHtml(value: string) {
  return value
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<br\s*\/?\s*>/gi, '\n')
    .replace(/<\/p\s*>/gi, '\n\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export type ExtractedUpload = {
  content: string;
  filename: string;
  mimeType: string;
  pageCount: number | null;
  byteSize: number;
  contentHash: string;
  buffer: ArrayBuffer;
};

export async function extractUpload(file: File): Promise<ExtractedUpload> {
  if (file.size <= 0) throw new Error('The selected file is empty.');
  if (file.size > MAX_UPLOAD_BYTES) throw new Error('Source files must be 20 MB or smaller.');
  const filename = cleanFilename(file.name);
  const extension = filename.split('.').at(-1)?.toLocaleLowerCase('en-US') ?? '';
  const mimeType = file.type || 'application/octet-stream';
  const buffer = await file.arrayBuffer();
  let content = '';
  let pageCount: number | null = null;

  if (mimeType === 'application/pdf' || extension === 'pdf') {
    const { extractText, getDocumentProxy } = await import('unpdf');
    const pdf = await getDocumentProxy(new Uint8Array(buffer));
    if (pdf.numPages > MAX_PDF_PAGES) {
      throw new Error(`PDF sources must contain ${MAX_PDF_PAGES} pages or fewer. Split this document into project sources before uploading.`);
    }
    const extracted = await extractText(pdf, { mergePages: false });
    pageCount = extracted.totalPages;
    content = extracted.text.join('\f');
  } else if (
    mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    || extension === 'docx'
  ) {
    const mammothModule = await import('mammoth');
    const mammoth = mammothModule.default;
    const extracted = await mammoth.extractRawText({ arrayBuffer: buffer });
    content = extracted.value;
  } else if (mimeType.includes('html') || extension === 'html' || extension === 'htm') {
    content = plainTextFromHtml(new TextDecoder().decode(buffer));
  } else if (
    mimeType.startsWith('text/')
    || mimeType.includes('json')
    || ['txt', 'md', 'csv', 'json', 'xml', 'rtf'].includes(extension)
  ) {
    content = new TextDecoder().decode(buffer);
  } else {
    throw new Error('Supported source formats are PDF, DOCX, TXT, Markdown, CSV, JSON, XML, and HTML.');
  }

  content = content.replace(/\u0000/g, '').replace(/\r\n?/g, '\n').trim();
  if (content.length < 20) throw new Error('The file did not contain enough extractable text for RAG indexing.');
  if (content.length > MAX_EXTRACTED_CHARACTERS) {
    throw new Error('The extracted source is too large to index safely. Split it into smaller project sources before uploading.');
  }
  return {
    content,
    filename,
    mimeType,
    pageCount,
    byteSize: buffer.byteLength,
    contentHash: await sha256(buffer),
    buffer,
  };
}

export async function storeOriginalSource(
  ownerId: string,
  projectId: string,
  extracted: ExtractedUpload,
): Promise<string> {
  if (!env.FILES) throw new Error('The source-file storage binding is unavailable.');
  const ownerPrefix = (await sha256(ownerId)).slice(0, 16);
  const storageKey = `tenants/${ownerPrefix}/projects/${projectId}/sources/${extracted.contentHash}/${extracted.filename}`;
  await env.FILES.put(storageKey, extracted.buffer, {
    httpMetadata: { contentType: extracted.mimeType },
    customMetadata: {
      projectId,
      sha256: extracted.contentHash,
      originalFilename: extracted.filename,
    },
  });
  return storageKey;
}
