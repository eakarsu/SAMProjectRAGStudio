import { z } from 'zod';
import { errorResponse, json } from '@/lib/http';
import { createProject, getProjectDetail } from '@/lib/project-repository';
import { requireRole, requireWorkspaceActor } from '@/lib/workspace-auth';
import { fetchSamOpportunity, SamConfigurationError, SamRequestError } from '@/lib/sam';
import { queueSamAttachments } from '@/lib/sam-operations';

const importSchema = z.discriminatedUnion('mode', [
  z.object({
    mode: z.literal('sam'),
    noticeId: z.string().trim().min(2).max(160),
    postedFrom: z.string().regex(/^\d{2}\/\d{2}\/\d{4}$/),
    postedTo: z.string().regex(/^\d{2}\/\d{2}\/\d{4}$/),
  }),
  z.object({
    mode: z.literal('manual'),
    noticeId: z.string().trim().min(2).max(160),
    solicitationNumber: z.string().trim().max(160).optional(),
    title: z.string().trim().min(3).max(300),
    agency: z.string().trim().min(2).max(240),
    department: z.string().trim().max(240).optional(),
    naics: z.string().trim().max(12).optional(),
    setAside: z.string().trim().max(180).optional(),
    responseDeadline: z.string().trim().max(80).optional(),
    description: z.string().trim().max(80_000).optional(),
  }),
]);

export async function POST(request: Request) {
  try {
    const actor = await requireWorkspaceActor(request);
    requireRole(actor, 'contributor');
    const input = importSchema.parse(await request.json());
    if (input.mode === 'sam') {
      const sam = await fetchSamOpportunity(input);
      const project = await createProject(actor.workspaceOwnerId, {
        noticeId: sam.noticeId,
        solicitationNumber: sam.solicitationNumber,
        title: sam.title,
        agency: sam.agency,
        department: sam.department,
        naics: sam.naics,
        setAside: sam.setAside,
        placeOfPerformance: sam.placeOfPerformance,
        postedAt: sam.postedAt,
        responseDeadline: sam.responseDeadline,
        sourceUrl: sam.sourceUrl,
        rawSam: { ...sam.raw, trustedResourceLinks: sam.resourceLinks },
        initialSourceText: sam.descriptionText,
      });
      await queueSamAttachments(actor.workspaceOwnerId, project.id, sam.resourceLinks);
      return json(await getProjectDetail(actor.workspaceOwnerId, project.id), { status: 201 });
    }

    const project = await createProject(actor.workspaceOwnerId, {
      noticeId: input.noticeId,
      solicitationNumber: input.solicitationNumber,
      title: input.title,
      agency: input.agency,
      department: input.department,
      naics: input.naics,
      setAside: input.setAside,
      responseDeadline: input.responseDeadline,
      initialSourceText: input.description,
    });
    return json(await getProjectDetail(actor.workspaceOwnerId, project.id), { status: 201 });
  } catch (error) {
    if (error instanceof SamConfigurationError) return json({ error: error.message }, { status: 503 });
    if (error instanceof SamRequestError) return json({ error: error.message }, { status: error.status });
    return errorResponse(error);
  }
}
