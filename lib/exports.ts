import {
  AlignmentType,
  BorderStyle,
  Document as DocxDocument,
  Footer,
  HeadingLevel,
  Packer,
  PageNumber,
  Paragraph,
  TextRun,
} from 'docx';
import { all, parseJson } from '@/lib/db-helpers';
import { getOwnedProject } from '@/lib/project-repository';
import type { ProposalRow, ProposalSection, RequirementRow } from '@/lib/types';

function filenamePart(value: string) {
  return value.replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 72) || 'proposal';
}

export async function proposalDocx(proposal: ProposalRow) {
  const project = await getOwnedProject(proposal.owner_id, proposal.project_id);
  const sections = parseJson<ProposalSection[]>(proposal.sections_json, []);
  const doc = new DocxDocument({
    styles: {
      default: {
        document: { run: { font: 'Aptos', size: 22, color: '26362F' }, paragraph: { spacing: { after: 150 } } },
      },
      paragraphStyles: [
        {
          id: 'Title',
          name: 'Title',
          basedOn: 'Normal',
          next: 'Normal',
          run: { font: 'Aptos Display', size: 42, bold: true, color: '123D31' },
          paragraph: { spacing: { after: 280 } },
        },
        {
          id: 'Heading1',
          name: 'Heading 1',
          basedOn: 'Normal',
          next: 'Normal',
          quickFormat: true,
          run: { font: 'Aptos Display', size: 30, bold: true, color: '145C47' },
          paragraph: { spacing: { before: 300, after: 160 } },
        },
      ],
    },
    sections: [{
      properties: {
        page: { margin: { top: 900, right: 900, bottom: 900, left: 900 } },
      },
      footers: {
        default: new Footer({
          children: [new Paragraph({
            alignment: AlignmentType.RIGHT,
            children: [
              new TextRun({ text: 'ProcureScope evidence-grounded draft  •  ', color: '62746B', size: 18 }),
              new TextRun({ children: [PageNumber.CURRENT], color: '62746B', size: 18 }),
            ],
          })],
        }),
      },
      children: [
        new Paragraph({ text: proposal.title, heading: HeadingLevel.TITLE }),
        new Paragraph({ children: [new TextRun({ text: project.title, bold: true, size: 26, color: '244B3E' })] }),
        new Paragraph({ text: `${project.agency}  •  ${project.solicitation_number ?? project.notice_id}` }),
        new Paragraph({
          border: { bottom: { color: '8BCBB4', style: BorderStyle.SINGLE, size: 10 } },
          spacing: { after: 320 },
          children: [new TextRun({
            text: `Version ${proposal.version}  •  ${proposal.generation_mode === 'ai-rag' ? 'AI + project RAG' : 'Non-AI evidence outline'}  •  ${new Date(proposal.updated_at).toLocaleDateString('en-US')}`,
            color: '557067',
          })],
        }),
        ...sections.flatMap((section) => [
          new Paragraph({ text: section.title, heading: HeadingLevel.HEADING_1 }),
          ...section.body.split(/\n{2,}/).filter(Boolean).map((text) => new Paragraph({ text })),
          new Paragraph({
            spacing: { before: 100, after: 220 },
            children: [new TextRun({
              text: section.citations.length
                ? `Evidence: ${section.citations.map((citation) => citation.label).join('; ')}`
                : 'Evidence: additional source support required',
              italics: true,
              color: section.citations.length ? '367A62' : 'A15B36',
              size: 19,
            })],
          }),
        ]),
        new Paragraph({ text: 'Evidence register', heading: HeadingLevel.HEADING_1 }),
        ...Array.from(new Map(sections.flatMap((section) => section.citations).map((citation) => [citation.chunkId, citation])).values())
          .map((citation, index) => new Paragraph({
            children: [
              new TextRun({ text: `${index + 1}. ${citation.label}`, bold: true }),
              new TextRun({ text: citation.quote ? ` — ${citation.quote}` : '' }),
            ],
          })),
      ],
    }],
  });
  const buffer = await Packer.toBuffer(doc);
  return {
    body: buffer,
    filename: `${filenamePart(project.solicitation_number ?? project.notice_id)}-proposal-v${proposal.version}.docx`,
  };
}

function csvCell(value: unknown) {
  const text = value === null || value === undefined ? '' : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

export async function requirementsCsv(ownerId: string, projectId: string) {
  const project = await getOwnedProject(ownerId, projectId);
  const requirements = await all<RequirementRow>(
    'SELECT * FROM requirements WHERE owner_id = ? AND project_id = ? ORDER BY requirement_key',
    [ownerId, projectId],
  );
  const rows = [
    ['Requirement ID', 'Category', 'Requirement', 'Status', 'Verification', 'Proposal Section', 'Assignee', 'Evidence Citation', 'Amendment'],
    ...requirements.map((item) => [
      item.requirement_key,
      item.category,
      item.text,
      item.status,
      item.verification,
      item.proposal_section,
      item.assignee,
      item.citation_label,
      item.amendment_number,
    ]),
  ];
  return {
    body: rows.map((row) => row.map(csvCell).join(',')).join('\r\n'),
    filename: `${filenamePart(project.solicitation_number ?? project.notice_id)}-requirements.csv`,
  };
}
