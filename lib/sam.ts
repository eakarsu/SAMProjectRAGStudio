import { env } from 'cloudflare:workers';

const SEARCH_ENDPOINT = 'https://api.sam.gov/opportunities/v2/search';
const ALLOWED_SAM_HOSTS = new Set(['api.sam.gov', 'api-alpha.sam.gov', 'sam.gov', 'www.sam.gov']);
const MAX_RESPONSE_BYTES = 5 * 1024 * 1024;

export class SamConfigurationError extends Error {}
export class SamRequestError extends Error {
  constructor(message: string, public status = 502) {
    super(message);
  }
}

type SamOpportunity = Record<string, unknown> & {
  noticeId?: string;
  solicitationNumber?: string;
  title?: string;
  department?: string;
  fullParentPathName?: string;
  postedDate?: string;
  responseDeadLine?: string;
  uiLink?: string;
  description?: string;
  resourceLinks?: string[] | null;
  naicsCode?: string;
  typeOfSetAsideDescription?: string;
};

export type NormalizedSamOpportunity = {
  noticeId: string;
  solicitationNumber: string | null;
  title: string;
  agency: string;
  department: string | null;
  naics: string | null;
  setAside: string | null;
  placeOfPerformance: string | null;
  postedAt: string | null;
  responseDeadline: string | null;
  sourceUrl: string | null;
  descriptionText: string;
  resourceLinks: string[];
  raw: SamOpportunity;
};

function configuredSecret(name: string): string | null {
  const cloudflareValue = (env as unknown as Record<string, unknown>)[name];
  const value = typeof cloudflareValue === 'string' ? cloudflareValue : process.env[name];
  return value?.trim() || null;
}

export function samStatus() {
  return { configured: Boolean(configuredSecret('SAM_GOV_API_KEY')) };
}

function parseUsDate(value: string): Date {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value);
  if (!match) throw new Error('SAM.gov dates must use MM/DD/YYYY.');
  const date = new Date(Date.UTC(Number(match[3]), Number(match[1]) - 1, Number(match[2])));
  if (Number.isNaN(date.getTime())) throw new Error('A SAM.gov date is invalid.');
  return date;
}

function validateDateRange(postedFrom: string, postedTo: string) {
  const start = parseUsDate(postedFrom);
  const end = parseUsDate(postedTo);
  const days = (end.getTime() - start.getTime()) / 86_400_000;
  if (days < 0) throw new Error('The start date must be before the end date.');
  if (days > 366) throw new Error('SAM.gov limits each search window to one year.');
}

function trustedSamUrl(value: string): URL {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new SamRequestError('SAM.gov returned an invalid source link.');
  }
  if (url.protocol !== 'https:' || !ALLOWED_SAM_HOSTS.has(url.hostname.toLowerCase())) {
    throw new SamRequestError('SAM.gov returned a source link outside the trusted host allowlist.');
  }
  url.username = '';
  url.password = '';
  return url;
}

async function boundedFetch(url: URL, options: RequestInit = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);
  try {
    const response = await fetch(url, {
      ...options,
      redirect: 'manual',
      signal: controller.signal,
      headers: { accept: 'application/json, text/plain, text/html;q=0.9', ...options.headers },
    });
    if (response.status >= 300 && response.status < 400) {
      throw new SamRequestError('SAM.gov returned an unexpected redirect.');
    }
    const declaredLength = Number(response.headers.get('content-length') ?? '0');
    if (declaredLength > MAX_RESPONSE_BYTES) throw new SamRequestError('The SAM.gov response exceeds the safe import limit.');
    return response;
  } catch (error) {
    if (error instanceof SamRequestError) throw error;
    if (error instanceof Error && error.name === 'AbortError') throw new SamRequestError('SAM.gov did not respond before the import timeout.');
    throw new SamRequestError('SAM.gov could not be reached. Try the import again.');
  } finally {
    clearTimeout(timeout);
  }
}

function htmlToText(value: string) {
  const withoutUnsafeBlocks = value
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<br\s*\/?\s*>/gi, '\n')
    .replace(/<\/p\s*>/gi, '\n\n')
    .replace(/<\/li\s*>/gi, '\n')
    .replace(/<[^>]+>/g, ' ');
  return withoutUnsafeBlocks
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

async function responseTextWithLimit(response: Response) {
  const buffer = await response.arrayBuffer();
  if (buffer.byteLength > MAX_RESPONSE_BYTES) throw new SamRequestError('The SAM.gov response exceeds the safe import limit.');
  return new TextDecoder().decode(buffer);
}

async function fetchDescription(descriptionUrl: string | undefined, apiKey: string) {
  if (!descriptionUrl) return '';
  const url = trustedSamUrl(descriptionUrl);
  url.searchParams.set('api_key', apiKey);
  const response = await boundedFetch(url);
  if (response.status === 404) return '';
  if (!response.ok) throw new SamRequestError(`SAM.gov could not load the opportunity description (${response.status}).`);
  const raw = await responseTextWithLimit(response);
  const contentType = response.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    try {
      const parsed = JSON.parse(raw) as { description?: string };
      return htmlToText(parsed.description ?? '');
    } catch {
      return htmlToText(raw);
    }
  }
  return htmlToText(raw);
}

function placeOfPerformance(value: unknown): string | null {
  if (!value || typeof value !== 'object') return null;
  const record = value as Record<string, unknown>;
  const city = record.city && typeof record.city === 'object'
    ? (record.city as Record<string, unknown>).name
    : record.city;
  const state = record.state && typeof record.state === 'object'
    ? (record.state as Record<string, unknown>).code
    : record.state;
  const country = record.country && typeof record.country === 'object'
    ? (record.country as Record<string, unknown>).name
    : record.country;
  return [city, state, country].filter((item): item is string => typeof item === 'string' && item.length > 0).join(', ') || null;
}

function lastPathPart(value: string | undefined) {
  if (!value) return null;
  const parts = value.split('.').map((part) => part.trim()).filter(Boolean);
  return parts.at(-1) ?? value;
}

function normalizeOpportunity(opportunity: SamOpportunity): NormalizedSamOpportunity | null {
  if (!opportunity.noticeId) return null;
  const agency = lastPathPart(opportunity.fullParentPathName) ?? opportunity.department ?? 'Federal agency';
  return {
    noticeId: opportunity.noticeId,
    solicitationNumber: opportunity.solicitationNumber ?? null,
    title: opportunity.title?.trim() || 'Untitled SAM.gov opportunity',
    agency,
    department: opportunity.department ?? null,
    naics: opportunity.naicsCode ?? null,
    setAside: opportunity.typeOfSetAsideDescription ?? null,
    placeOfPerformance: placeOfPerformance(opportunity.placeOfPerformance),
    postedAt: opportunity.postedDate ?? null,
    responseDeadline: opportunity.responseDeadLine ?? null,
    sourceUrl: typeof opportunity.uiLink === 'string' ? opportunity.uiLink : null,
    descriptionText: '',
    resourceLinks: (opportunity.resourceLinks ?? []).filter((link): link is string => {
      if (typeof link !== 'string') return false;
      try { trustedSamUrl(link); return true; } catch { return false; }
    }),
    raw: opportunity,
  };
}

export async function searchSamOpportunities(input: {
  postedFrom: string;
  postedTo: string;
  keywords?: string;
  naics?: string;
  setAside?: string;
  state?: string;
  noticeType?: string;
  organization?: string;
  limit?: number;
  offset?: number;
}) {
  const apiKey = configuredSecret('SAM_GOV_API_KEY');
  if (!apiKey) throw new SamConfigurationError('SAM.gov discovery needs the SAM_GOV_API_KEY deployment secret.');
  validateDateRange(input.postedFrom, input.postedTo);
  const limit = Math.min(100, Math.max(1, Math.trunc(input.limit ?? 25)));
  const offset = Math.max(0, Math.trunc(input.offset ?? 0));
  const url = new URL(SEARCH_ENDPOINT);
  const params: Array<[string, string | undefined]> = [
    ['api_key', apiKey], ['postedFrom', input.postedFrom], ['postedTo', input.postedTo],
    ['title', input.keywords?.trim()], ['ncode', input.naics?.trim()], ['typeOfSetAside', input.setAside?.trim()],
    ['state', input.state?.trim()], ['ptype', input.noticeType?.trim()], ['organizationName', input.organization?.trim()],
    ['limit', String(limit)], ['offset', String(offset)],
  ];
  params.forEach(([key, value]) => { if (value) url.searchParams.set(key, value); });
  const response = await boundedFetch(url);
  if (response.status === 400 || response.status === 401 || response.status === 403) {
    throw new SamRequestError('SAM.gov rejected the discovery search. Verify the filters and API key.', response.status);
  }
  if (!response.ok) throw new SamRequestError(`SAM.gov discovery returned ${response.status}.`);
  const rawText = await responseTextWithLimit(response);
  let payload: { opportunitiesData?: SamOpportunity[]; totalRecords?: number; limit?: number; offset?: number };
  try { payload = JSON.parse(rawText) as typeof payload; } catch { throw new SamRequestError('SAM.gov returned an unreadable discovery response.'); }
  return {
    opportunities: (payload.opportunitiesData ?? []).map(normalizeOpportunity).filter((item): item is NormalizedSamOpportunity => Boolean(item)),
    totalRecords: Number(payload.totalRecords ?? 0),
    limit,
    offset,
  };
}

export async function fetchSamOpportunity(input: {
  noticeId: string;
  postedFrom: string;
  postedTo: string;
}): Promise<NormalizedSamOpportunity> {
  const apiKey = configuredSecret('SAM_GOV_API_KEY');
  if (!apiKey) {
    throw new SamConfigurationError('SAM.gov import needs the SAM_GOV_API_KEY deployment secret. You can still create a manual project and upload its documents.');
  }
  const noticeId = input.noticeId.trim();
  if (!noticeId) throw new Error('A SAM.gov notice ID is required.');
  validateDateRange(input.postedFrom, input.postedTo);

  const url = new URL(SEARCH_ENDPOINT);
  url.searchParams.set('api_key', apiKey);
  url.searchParams.set('noticeid', noticeId);
  url.searchParams.set('postedFrom', input.postedFrom);
  url.searchParams.set('postedTo', input.postedTo);
  url.searchParams.set('limit', '10');
  url.searchParams.set('offset', '0');
  const response = await boundedFetch(url);
  if (response.status === 404) throw new SamRequestError('No SAM.gov opportunity matched that notice ID and date window.', 404);
  if (response.status === 400 || response.status === 401 || response.status === 403) {
    throw new SamRequestError('SAM.gov rejected the search. Verify the notice ID, date window, and API key.', response.status);
  }
  if (!response.ok) throw new SamRequestError(`SAM.gov returned ${response.status}. Try again later.`);
  const rawText = await responseTextWithLimit(response);
  let payload: { opportunitiesData?: SamOpportunity[] };
  try {
    payload = JSON.parse(rawText) as { opportunitiesData?: SamOpportunity[] };
  } catch {
    throw new SamRequestError('SAM.gov returned an unreadable search response.');
  }
  const opportunity = (payload.opportunitiesData ?? []).find(
    (item) => item.noticeId?.toLocaleLowerCase('en-US') === noticeId.toLocaleLowerCase('en-US'),
  );
  if (!opportunity) throw new SamRequestError('No exact SAM.gov opportunity matched that notice ID and date window.', 404);

  let descriptionText = '';
  try {
    descriptionText = await fetchDescription(opportunity.description, apiKey);
  } catch (error) {
    if (!(error instanceof SamRequestError)) throw error;
  }
  const normalized = normalizeOpportunity({ ...opportunity, noticeId: opportunity.noticeId ?? noticeId });
  if (!normalized) throw new SamRequestError('SAM.gov returned an opportunity without a notice ID.');
  return { ...normalized, descriptionText };
}

export function assertTrustedSamAttachmentUrl(value: string) {
  return trustedSamUrl(value);
}
