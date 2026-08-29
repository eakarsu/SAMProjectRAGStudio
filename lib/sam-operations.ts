import { all, first, newId, nowIso, run, sha256 } from "@/lib/db-helpers";
import {
  getOwnedProject,
  ingestTextSource,
  recordAudit,
} from "@/lib/project-repository";
import { invalidateReleaseValidation } from "@/lib/release-guards";
import {
  assertTrustedSamAttachmentUrl,
  fetchSamOpportunity,
  searchSamOpportunities,
} from "@/lib/sam";
import { extractUpload, storeOriginalSource } from "@/lib/source-files";

function usDate(date: Date) {
  return `${String(date.getUTCMonth() + 1).padStart(2, "0")}/${String(date.getUTCDate()).padStart(2, "0")}/${date.getUTCFullYear()}`;
}

export async function discoverOpportunities(
  ownerId: string,
  input: Parameters<typeof searchSamOpportunities>[0],
) {
  const result = await searchSamOpportunities(input);
  const now = nowIso();
  for (const opportunity of result.opportunities) {
    await run(
      `INSERT INTO opportunity_leads
      (id, owner_id, notice_id, solicitation_number, title, agency, naics, set_aside, posted_at,
       response_deadline, source_url, match_score, disposition, raw_json, discovered_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 'new', ?, ?, ?)
      ON CONFLICT(owner_id, notice_id) DO UPDATE SET
        solicitation_number = excluded.solicitation_number, title = excluded.title, agency = excluded.agency,
        naics = excluded.naics, set_aside = excluded.set_aside, posted_at = excluded.posted_at,
        response_deadline = excluded.response_deadline, source_url = excluded.source_url,
        raw_json = excluded.raw_json, updated_at = excluded.updated_at`,
      [
        newId("lead"),
        ownerId,
        opportunity.noticeId,
        opportunity.solicitationNumber,
        opportunity.title,
        opportunity.agency,
        opportunity.naics,
        opportunity.setAside,
        opportunity.postedAt,
        opportunity.responseDeadline,
        opportunity.sourceUrl,
        JSON.stringify(opportunity.raw),
        now,
        now,
      ],
    );
  }
  return result;
}

export async function queueSamAttachments(
  ownerId: string,
  projectId: string,
  links: string[],
) {
  const now = nowIso();
  let queued = 0;
  for (const link of links) {
    const url = assertTrustedSamAttachmentUrl(link);
    const exists = await first<{ id: string }>(
      "SELECT id FROM attachment_jobs WHERE owner_id = ? AND project_id = ? AND source_url = ?",
      [ownerId, projectId, url.toString()],
    );
    if (exists) continue;
    const filename = decodeURIComponent(
      url.pathname.split("/").at(-1) || `SAM-attachment-${queued + 1}`,
    );
    await run(
      `INSERT INTO attachment_jobs
      (id, owner_id, project_id, source_url, filename, status, stage, attempts, table_count, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, 'queued', 'download', 0, 0, ?, ?)`,
      [
        newId("attachment"),
        ownerId,
        projectId,
        url.toString(),
        filename.slice(0, 180),
        now,
        now,
      ],
    );
    queued += 1;
  }
  if (queued > 0) {
    await invalidateReleaseValidation(
      ownerId,
      projectId,
      null,
      "The queued SAM.gov attachment set changed after package validation.",
    );
  }
  return queued;
}

export async function syncProjectFromSam(ownerId: string, projectId: string) {
  const project = await getOwnedProject(ownerId, projectId);
  const posted = project.posted_at ? new Date(project.posted_at) : new Date();
  const year = Number.isNaN(posted.getTime())
    ? new Date().getUTCFullYear()
    : posted.getUTCFullYear();
  const opportunity = await fetchSamOpportunity({
    noticeId: project.notice_id,
    postedFrom: usDate(new Date(Date.UTC(year, 0, 1))),
    postedTo: usDate(new Date(Date.UTC(year, 11, 31))),
  });
  const beforeHash = project.raw_sam_json
    ? await sha256(project.raw_sam_json)
    : null;
  const normalizedRaw = JSON.stringify(opportunity.raw);
  const afterHash = await sha256(normalizedRaw);
  const changed = beforeHash !== afterHash;
  const now = nowIso();
  await run(
    `UPDATE projects SET solicitation_number = ?, title = ?, agency = ?, department = ?, naics = ?,
    set_aside = ?, place_of_performance = ?, posted_at = ?, response_deadline = ?, source_url = ?, raw_sam_json = ?,
    latest_sam_sync_at = ?, updated_at = ? WHERE id = ? AND owner_id = ?`,
    [
      opportunity.solicitationNumber,
      opportunity.title,
      opportunity.agency,
      opportunity.department,
      opportunity.naics,
      opportunity.setAside,
      opportunity.placeOfPerformance,
      opportunity.postedAt,
      opportunity.responseDeadline,
      opportunity.sourceUrl,
      normalizedRaw,
      now,
      now,
      projectId,
      ownerId,
    ],
  );
  const existingAttachments = new Set(
    (
      await all<{ source_url: string }>(
        "SELECT source_url FROM attachment_jobs WHERE owner_id = ? AND project_id = ?",
        [ownerId, projectId],
      )
    ).map((item) => item.source_url),
  );
  let addedAttachments = 0;
  for (const sourceUrl of opportunity.resourceLinks) {
    if (existingAttachments.has(sourceUrl)) continue;
    const path = new URL(sourceUrl).pathname;
    const filename = decodeURIComponent(
      path.split("/").at(-1) || `SAM-attachment-${addedAttachments + 1}`,
    );
    await run(
      `INSERT INTO attachment_jobs
      (id, owner_id, project_id, document_id, source_url, filename, status, stage, attempts,
       table_count, created_at, updated_at)
      VALUES (?, ?, ?, NULL, ?, ?, 'queued', 'download', 0, 0, ?, ?)`,
      [
        newId("attachment"),
        ownerId,
        projectId,
        sourceUrl,
        filename.slice(0, 180),
        now,
        now,
      ],
    );
    addedAttachments += 1;
  }
  if (changed || addedAttachments > 0) {
    await invalidateReleaseValidation(
      ownerId,
      projectId,
      null,
      changed
        ? "SAM.gov opportunity metadata changed after package validation."
        : "The SAM.gov attachment set changed after package validation.",
    );
  }
  const eventId = newId("sync");
  await run(
    `INSERT INTO sam_sync_events
    (id, owner_id, project_id, status, change_type, amendment_number, summary, before_hash, after_hash, details_json, created_at)
    VALUES (?, ?, ?, 'completed', ?, ?, ?, ?, ?, ?, ?)`,
    [
      eventId,
      ownerId,
      projectId,
      changed ? "metadata-change" : "unchanged",
      project.current_amendment,
      changed
        ? "SAM.gov metadata changed; review the current notice and queued attachments."
        : "SAM.gov is unchanged since the previous synchronization.",
      beforeHash,
      afterHash,
      JSON.stringify({
        resourceLinks: opportunity.resourceLinks.length,
        addedAttachments,
      }),
      now,
    ],
  );
  await recordAudit(
    ownerId,
    projectId,
    "sam.synchronized",
    "sam_sync_event",
    eventId,
    { changed, addedAttachments, afterHash },
  );
  return { changed, addedAttachments, eventId, synchronizedAt: now };
}

const MAX_ATTACHMENT_BYTES = 20 * 1024 * 1024;

export async function importSamAttachment(
  ownerId: string,
  projectId: string,
  attachmentId: string,
) {
  await getOwnedProject(ownerId, projectId);
  const attachment = await first<{
    id: string;
    source_url: string;
    filename: string | null;
    attempts: number;
  }>(
    "SELECT id, source_url, filename, attempts FROM attachment_jobs WHERE id = ? AND owner_id = ? AND project_id = ?",
    [attachmentId, ownerId, projectId],
  );
  if (!attachment) throw new Error("SAM.gov attachment not found.");
  const url = assertTrustedSamAttachmentUrl(attachment.source_url);
  const now = nowIso();
  await run(
    "UPDATE attachment_jobs SET status = ?, stage = ?, attempts = ?, error = NULL, updated_at = ? WHERE id = ?",
    ["running", "download", attachment.attempts + 1, now, attachmentId],
  );
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 35_000);
    let response: Response;
    try {
      response = await fetch(url, {
        redirect: "manual",
        signal: controller.signal,
        headers: {
          accept:
            "application/pdf, application/vnd.openxmlformats-officedocument.wordprocessingml.document, text/plain, text/html",
        },
      });
    } finally {
      clearTimeout(timeout);
    }
    if (response.status >= 300 && response.status < 400)
      throw new Error("The attachment returned an unexpected redirect.");
    if (!response.ok)
      throw new Error(
        `SAM.gov attachment download returned ${response.status}.`,
      );
    const declared = Number(response.headers.get("content-length") ?? "0");
    if (declared > MAX_ATTACHMENT_BYTES)
      throw new Error(
        "The attachment exceeds the 20 MB safe-processing limit.",
      );
    const buffer = await response.arrayBuffer();
    if (buffer.byteLength > MAX_ATTACHMENT_BYTES)
      throw new Error(
        "The attachment exceeds the 20 MB safe-processing limit.",
      );
    const filename = attachment.filename || "SAM-attachment";
    const file = new File([buffer], filename, {
      type:
        response.headers.get("content-type")?.split(";")[0] ||
        "application/octet-stream",
    });
    await run(
      "UPDATE attachment_jobs SET stage = ?, updated_at = ? WHERE id = ?",
      ["extract", nowIso(), attachmentId],
    );
    const extracted = await extractUpload(file);
    let storageKey: string | null = null;
    try {
      storageKey = await storeOriginalSource(ownerId, projectId, extracted);
    } catch {
      storageKey = null;
    }
    const document = await ingestTextSource(ownerId, projectId, {
      title: filename,
      kind: "sam-attachment",
      content: extracted.content,
      filename: extracted.filename,
      mimeType: extracted.mimeType,
      sourceUrl: attachment.source_url,
      storageKey,
      pageCount: extracted.pageCount,
      byteSize: extracted.byteSize,
    });
    await run(
      `UPDATE attachment_jobs SET document_id = ?, status = 'completed', stage = 'indexed',
      completed_at = ?, updated_at = ? WHERE id = ?`,
      [document.id, nowIso(), nowIso(), attachmentId],
    );
    await recordAudit(
      ownerId,
      projectId,
      "sam.attachment.indexed",
      "attachment_job",
      attachmentId,
      { documentId: document.id, filename },
    );
    return { attachmentId, documentId: document.id, status: "completed" };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Attachment processing failed.";
    await run(
      `UPDATE attachment_jobs SET status = 'failed', stage = 'failed', error = ?, updated_at = ? WHERE id = ?`,
      [message.slice(0, 500), nowIso(), attachmentId],
    );
    throw error;
  }
}
