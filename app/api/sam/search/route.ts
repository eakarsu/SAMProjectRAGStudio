import { z } from 'zod';
import { errorResponse, json } from '@/lib/http';
import { discoverOpportunities } from '@/lib/sam-operations';
import { requireWorkspaceActor } from '@/lib/workspace-auth';

const schema = z.object({
  postedFrom: z.string().regex(/^\d{2}\/\d{2}\/\d{4}$/),
  postedTo: z.string().regex(/^\d{2}\/\d{2}\/\d{4}$/),
  keywords: z.string().trim().max(200).optional(),
  naics: z.string().trim().max(12).optional(),
  setAside: z.string().trim().max(40).optional(),
  state: z.string().trim().max(4).optional(),
  noticeType: z.string().trim().max(20).optional(),
  organization: z.string().trim().max(160).optional(),
  limit: z.number().int().min(1).max(100).default(25),
  offset: z.number().int().min(0).default(0),
});

export async function POST(request: Request) {
  try {
    const actor = await requireWorkspaceActor(request);
    const input = schema.parse(await request.json());
    return json(await discoverOpportunities(actor.workspaceOwnerId, input));
  } catch (error) {
    return errorResponse(error);
  }
}
