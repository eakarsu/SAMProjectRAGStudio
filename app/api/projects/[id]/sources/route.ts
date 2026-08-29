import { env } from 'cloudflare:workers';
import { z } from 'zod';
import { errorResponse, json } from '@/lib/http';
import { ingestTextSource } from '@/lib/project-repository';
import { requireRole, requireWorkspaceActor } from '@/lib/workspace-auth';
import { extractUpload, storeOriginalSource } from '@/lib/source-files';

const textSourceSchema = z.object({
  title: z.string().trim().min(2).max(240),
  kind: z.string().trim().min(2).max(80).default('solicitation'),
  content: z.string().trim().min(20).max(1_500_000),
  amendmentNumber: z.number().int().min(0).max(999).default(0),
  supersedesDocumentId: z.string().trim().min(3).nullable().optional(),
  sourceUrl: z.string().url().max(1_000).nullable().optional(),
});

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  let orphanedStorageKey: string | null = null;
  try {
    const actor = await requireWorkspaceActor(request);
    requireRole(actor, 'contributor');
    const { id } = await context.params;
    const contentType = request.headers.get('content-type') ?? '';
    if (contentType.includes('multipart/form-data')) {
      const form = await request.formData();
      const file = form.get('file');
      if (!(file instanceof File)) throw new Error('Choose a source file to upload.');
      const extracted = await extractUpload(file);
      const title = String(form.get('title') || extracted.filename).trim();
      const kind = String(form.get('kind') || 'solicitation').trim();
      const amendmentNumber = Number(form.get('amendmentNumber') || 0);
      const supersedesDocumentId = String(form.get('supersedesDocumentId') || '').trim() || null;
      orphanedStorageKey = await storeOriginalSource(actor.workspaceOwnerId, id, extracted);
      const document = await ingestTextSource(actor.workspaceOwnerId, id, {
        title,
        kind,
        content: extracted.content,
        filename: extracted.filename,
        mimeType: extracted.mimeType,
        storageKey: orphanedStorageKey,
        amendmentNumber: Number.isFinite(amendmentNumber) ? amendmentNumber : 0,
        supersedesDocumentId,
        pageCount: extracted.pageCount,
        byteSize: extracted.byteSize,
      });
      orphanedStorageKey = null;
      return json({ document }, { status: 201 });
    }

    const input = textSourceSchema.parse(await request.json());
    const document = await ingestTextSource(actor.workspaceOwnerId, id, input);
    return json({ document }, { status: 201 });
  } catch (error) {
    if (orphanedStorageKey && env.FILES) await env.FILES.delete(orphanedStorageKey).catch(() => undefined);
    return errorResponse(error);
  }
}
