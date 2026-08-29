import { all, first, newId, nowIso, parseJson, run } from '@/lib/db-helpers';
import { generateAiProposalSection, openRouterStatus } from '@/lib/openrouter';
import { nextJobProgress } from '@/lib/job-state';
import {
  formatJob,
  formatProposal,
  getOwnedProject,
  recordAudit,
  retrieveProjectEvidence,
  NotFoundError,
} from '@/lib/project-repository';
import type { JobRow, ProposalRow, ProposalSection } from '@/lib/types';

export type GenerationSection = {
  key: string;
  title: string;
  retrievalQuery: string;
  instructions: string;
};

const GENERATION_PLANS: Record<string, { title: string; sections: GenerationSection[] }> = {
  full: {
    title: 'Evidence-grounded proposal draft',
    sections: [
      {
        key: 'executive-summary',
        title: 'Executive overview',
        retrievalQuery: 'mission objectives scope outcomes evaluation priorities deadline',
        instructions: 'Explain the mission need, desired outcomes, and a disciplined response posture. Do not invent company qualifications.',
      },
      {
        key: 'understanding',
        title: 'Understanding of the requirement',
        retrievalQuery: 'scope objectives requirements shall must deliverables constraints',
        instructions: 'Synthesize the requirement, operational context, constraints, and success conditions.',
      },
      {
        key: 'technical-approach',
        title: 'Technical approach',
        retrievalQuery: 'technical requirements architecture security performance operations deliverables',
        instructions: 'Create a phased response structure tied to technical requirements. Mark company evidence gaps explicitly.',
      },
      {
        key: 'management-transition',
        title: 'Management and transition',
        retrievalQuery: 'management staffing key personnel transition schedule reporting quality risk',
        instructions: 'Address governance, staffing, transition, quality, reporting, and risk controls supported by the solicitation.',
      },
      {
        key: 'compliance-roadmap',
        title: 'Compliance and evidence roadmap',
        retrievalQuery: 'proposal instructions evaluation factors page limits submission compliance shall must',
        instructions: 'Summarize compliance obligations and list the proposal evidence still needed before review.',
      },
    ],
  },
  technical: {
    title: 'Technical response draft',
    sections: [
      {
        key: 'technical-objectives',
        title: 'Technical objectives',
        retrievalQuery: 'technical scope objectives outcomes requirements',
        instructions: 'Describe the technical outcomes and governing constraints.',
      },
      {
        key: 'solution-architecture',
        title: 'Solution architecture',
        retrievalQuery: 'architecture platform integration security data operations',
        instructions: 'Draft an architecture narrative using only solicitation facts; identify every company-specific proof gap.',
      },
      {
        key: 'delivery-plan',
        title: 'Delivery and verification plan',
        retrievalQuery: 'deliverables schedule milestones testing acceptance service levels reporting',
        instructions: 'Organize deliverables, verification, acceptance, schedule, and operating metrics.',
      },
    ],
  },
  compliance: {
    title: 'Compliance response draft',
    sections: [
      {
        key: 'mandatory-requirements',
        title: 'Mandatory requirements',
        retrievalQuery: 'shall must required contractor offeror submission',
        instructions: 'Organize mandatory obligations into a reviewable response narrative.',
      },
      {
        key: 'evaluation-alignment',
        title: 'Evaluation alignment',
        retrievalQuery: 'evaluation factors rating technical management past performance price',
        instructions: 'Explain what evaluators will assess and where proposal proof is needed.',
      },
      {
        key: 'submission-readiness',
        title: 'Submission readiness',
        retrievalQuery: 'deadline page limit format volume submission amendment instructions',
        instructions: 'Summarize submission controls, dependencies, and unresolved evidence gaps.',
      },
    ],
  },
};

export function generationPlan(intent: string) {
  return GENERATION_PLANS[intent] ?? GENERATION_PLANS.full;
}

export async function createGenerationJob(ownerId: string, projectId: string, intent: string) {
  const project = await getOwnedProject(ownerId, projectId);
  if (project.rag_status !== 'ready') throw new Error('This project needs at least one indexed source before generation.');
  const plan = generationPlan(intent);
  const jobId = newId('job');
  const now = nowIso();
  const ai = openRouterStatus();
  await run(
    `INSERT INTO jobs (
      id, owner_id, project_id, type, title, status, stage, progress, total_steps,
      current_step, request_json, result_json, error, model,
      provider_response_ids_json, created_at, updated_at, completed_at
    ) VALUES (?, ?, ?, 'proposal-generation', ?, 'queued', 'Ready to generate', 0, ?, 0, ?, '[]', NULL, ?, '[]', ?, ?, NULL)`,
    [jobId, ownerId, projectId, plan.title, plan.sections.length, JSON.stringify({ intent, sections: plan.sections }), ai.model, now, now],
  );
  await recordAudit(ownerId, projectId, 'ai.job.created', 'job', jobId, { intent, sections: plan.sections.length });
  return getJob(ownerId, jobId);
}

export async function getJob(ownerId: string, jobId: string) {
  const job = await first<JobRow>('SELECT * FROM jobs WHERE id = ? AND owner_id = ?', [jobId, ownerId]);
  if (!job) throw new NotFoundError('Generation job not found.');
  return formatJob(job);
}

export async function advanceGenerationJob(ownerId: string, jobId: string) {
  const job = await first<JobRow>('SELECT * FROM jobs WHERE id = ? AND owner_id = ?', [jobId, ownerId]);
  if (!job) throw new NotFoundError('Generation job not found.');
  if (job.status === 'completed') return formatJob(job);
  const request = parseJson<{ intent: string; sections: GenerationSection[] }>(job.request_json, {
    intent: 'full',
    sections: generationPlan('full').sections,
  });
  const section = request.sections[job.current_step];
  if (!section) {
    await finalizeJob(ownerId, job);
    return getJob(ownerId, jobId);
  }

  const staleBefore = new Date(Date.now() - 2 * 60_000).toISOString();
  const claim = await run(
    `UPDATE jobs SET status = 'running', stage = ?, error = NULL, updated_at = ?
      WHERE id = ? AND owner_id = ? AND current_step = ?
      AND (status IN ('queued', 'blocked') OR (status = 'running' AND updated_at < ?))`,
    [`Generating ${section.title}`, nowIso(), jobId, ownerId, job.current_step, staleBefore],
  );
  if ((claim.meta.changes ?? 0) === 0) return getJob(ownerId, jobId);

  try {
    const project = await getOwnedProject(ownerId, job.project_id);
    const evidence = await retrieveProjectEvidence(ownerId, job.project_id, section.retrievalQuery, 10);
    const generated = await generateAiProposalSection({
      sectionKey: section.key,
      sectionTitle: section.title,
      instructions: section.instructions,
      projectTitle: project.title,
      chunks: evidence,
    });
    const previousResults = parseJson<ProposalSection[]>(job.result_json, []);
    const results = [...previousResults, generated.section];
    const responseIds = parseJson<string[]>(job.provider_response_ids_json, []);
    if (generated.providerResponseId) responseIds.push(generated.providerResponseId);
    const { nextStep, completed, progress } = nextJobProgress(job.current_step, request.sections.length);
    const now = nowIso();
    await run(
      `UPDATE jobs SET status = ?, stage = ?, progress = ?, current_step = ?, result_json = ?,
        model = ?, provider_response_ids_json = ?, updated_at = ?, completed_at = ?
        WHERE id = ? AND owner_id = ? AND current_step = ?`,
      [
        completed ? 'completed' : 'queued',
        completed ? 'Draft ready' : `Saved ${section.title}`,
        progress,
        nextStep,
        JSON.stringify(results),
        generated.model,
        JSON.stringify(responseIds),
        now,
        completed ? now : null,
        jobId,
        ownerId,
        job.current_step,
      ],
    );
    if (completed) await createProposalFromJob(ownerId, jobId);
    await recordAudit(ownerId, job.project_id, 'ai.job.step.completed', 'job', jobId, {
      section: section.key,
      step: nextStep,
      total: request.sections.length,
      evidenceChunks: evidence.map((item) => item.id),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'The generation step failed.';
    await run(
      `UPDATE jobs SET status = 'blocked', stage = 'Action required', error = ?, updated_at = ?
        WHERE id = ? AND owner_id = ? AND current_step = ?`,
      [message, nowIso(), jobId, ownerId, job.current_step],
    );
  }
  return getJob(ownerId, jobId);
}

export async function runGenerationJobToCompletion(ownerId: string, jobId: string) {
  for (let step = 0; step < 40; step += 1) {
    const job = await advanceGenerationJob(ownerId, jobId);
    if (job.status === 'completed' || job.status === 'blocked') return job;
  }
  return getJob(ownerId, jobId);
}

async function finalizeJob(ownerId: string, job: JobRow) {
  const now = nowIso();
  await run(
    `UPDATE jobs SET status = 'completed', stage = 'Draft ready', progress = 100, completed_at = ?, updated_at = ?
      WHERE id = ? AND owner_id = ?`,
    [now, now, job.id, ownerId],
  );
  await createProposalFromJob(ownerId, job.id);
}

async function createProposalFromJob(ownerId: string, jobId: string) {
  const job = await first<JobRow>('SELECT * FROM jobs WHERE id = ? AND owner_id = ?', [jobId, ownerId]);
  if (!job) throw new NotFoundError('Generation job not found.');
  const existing = await first<ProposalRow>('SELECT * FROM proposals WHERE job_id = ? AND owner_id = ?', [jobId, ownerId]);
  if (existing) return formatProposal(existing);
  const sections = parseJson<ProposalSection[]>(job.result_json, []);
  const citations = sections.flatMap((section) => section.citations);
  const versionRow = await first<{ version: number }>(
    'SELECT COALESCE(MAX(version), 0) + 1 AS version FROM proposals WHERE owner_id = ? AND project_id = ?',
    [ownerId, job.project_id],
  );
  const proposalId = newId('proposal');
  const now = nowIso();
  await run(
    `INSERT INTO proposals (
      id, owner_id, project_id, job_id, title, status, version, generation_mode,
      sections_json, citations_json, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, 'draft', ?, 'ai-rag', ?, ?, ?, ?)`,
    [proposalId, ownerId, job.project_id, job.id, job.title, versionRow?.version ?? 1, JSON.stringify(sections), JSON.stringify(citations), now, now],
  );
  await recordAudit(ownerId, job.project_id, 'proposal.created', 'proposal', proposalId, {
    jobId,
    sections: sections.length,
    citations: citations.length,
  });
  const proposal = await first<ProposalRow>('SELECT * FROM proposals WHERE id = ? AND owner_id = ?', [proposalId, ownerId]);
  if (!proposal) throw new Error('The proposal was saved but could not be reloaded.');
  return formatProposal(proposal);
}

export async function createEvidenceOutline(ownerId: string, projectId: string, intent: string) {
  const plan = generationPlan(intent);
  const sections: ProposalSection[] = [];
  for (const section of plan.sections) {
    const evidence = await retrieveProjectEvidence(ownerId, projectId, section.retrievalQuery, 5);
    const body = evidence.length
      ? [
          `Evidence objective: ${section.instructions}`,
          '',
          ...evidence.map((item, index) => `${index + 1}. ${item.content.length > 520 ? `${item.content.slice(0, 517).trim()}…` : item.content}`),
          '',
          'Author action: convert this evidence into persuasive proposal prose and add verified company proof before approval.',
        ].join('\n')
      : `No supporting project evidence was found for this section. Add or index the relevant solicitation source before drafting.`;
    sections.push({
      key: section.key,
      title: section.title,
      body,
      citations: evidence.map((item) => ({
        chunkId: item.id,
        label: item.citationLabel,
        quote: item.content.length > 280 ? `${item.content.slice(0, 277).trim()}…` : item.content,
      })),
      evidenceStatus: evidence.length ? 'cited' : 'needs-evidence',
    });
  }
  const versionRow = await first<{ version: number }>(
    'SELECT COALESCE(MAX(version), 0) + 1 AS version FROM proposals WHERE owner_id = ? AND project_id = ?',
    [ownerId, projectId],
  );
  const proposalId = newId('proposal');
  const now = nowIso();
  const citations = sections.flatMap((section) => section.citations);
  await run(
    `INSERT INTO proposals (
      id, owner_id, project_id, job_id, title, status, version, generation_mode,
      sections_json, citations_json, created_at, updated_at
    ) VALUES (?, ?, ?, NULL, ?, 'outline', ?, 'deterministic-evidence', ?, ?, ?, ?)`,
    [
      proposalId,
      ownerId,
      projectId,
      `${plan.title} — evidence outline`,
      versionRow?.version ?? 1,
      JSON.stringify(sections),
      JSON.stringify(citations),
      now,
      now,
    ],
  );
  await recordAudit(ownerId, projectId, 'proposal.evidence-outline.created', 'proposal', proposalId, {
    intent,
    sections: sections.length,
    citations: citations.length,
  });
  const proposal = await first<ProposalRow>('SELECT * FROM proposals WHERE id = ? AND owner_id = ?', [proposalId, ownerId]);
  if (!proposal) throw new Error('The evidence outline could not be reloaded.');
  return formatProposal(proposal);
}

export async function getOwnedProposal(ownerId: string, proposalId: string) {
  const proposal = await first<ProposalRow>('SELECT * FROM proposals WHERE id = ? AND owner_id = ?', [proposalId, ownerId]);
  if (!proposal) throw new NotFoundError('Proposal not found.');
  return proposal;
}

export async function listRecentJobs(ownerId: string) {
  const jobs = await all<JobRow>('SELECT * FROM jobs WHERE owner_id = ? ORDER BY updated_at DESC LIMIT 30', [ownerId]);
  return jobs.map(formatJob);
}
