import { createServer, type Server } from 'node:http';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('cloudflare:workers', () => ({ env: {} }));
import { callOpenRouter, AiConfigurationError, AiProviderError } from '@/lib/openrouter';

describe('native OpenRouter cancellation', () => {
  let server: Server;
  let endpoint: string;
  const realFetch = globalThis.fetch;
  let requests = 0;
  let answer: 'hold' | 'retry' | 'refusal' | 'truncated' | 'success' = 'hold';
  beforeEach(async () => {
    requests = 0;
    process.env.OPENROUTER_API_KEY = 'isolated-provider-fixture';
    server = createServer((request, response) => {
      requests += 1;
      request.resume();
      if (answer === 'hold') return;
      response.setHeader('content-type', 'application/json');
      if (answer === 'retry') { response.writeHead(503); response.end('{}'); return; }
      response.end(JSON.stringify({ id:'fixture-response', model:'fixture-model', choices:[{finish_reason:answer === 'truncated' ? 'length' : 'stop',message:{content:'{"headline":"Retained evidence review"}',refusal:answer === 'refusal' ? 'Declined' : null}}] }));
    });
    await new Promise<void>(resolve => server.listen(0,'127.0.0.1',resolve));
    endpoint = `http://127.0.0.1:${(server.address() as {port:number}).port}`;
    vi.stubGlobal('fetch', (_url: string, options: RequestInit) => realFetch(endpoint, options));
  });
  afterEach(async () => {
    vi.unstubAllGlobals();
    delete process.env.OPENROUTER_API_KEY;
    server.closeAllConnections();
    await new Promise<void>(resolve => server.close(()=>resolve()));
    answer = 'hold';
  });
  async function waitForRequest() { for (let count=0; count<100 && !requests; count++) await new Promise(resolve=>setTimeout(resolve,5)); expect(requests).toBe(1); }
  it('aborts the actual HTTP request and never retries a cancelled provider call', async () => {
    const controller = new AbortController();
    const result = callOpenRouter('Native evidence policy','Owned project evidence',{signal:controller.signal});
    const rejected = expect(result).rejects.toMatchObject({name:'AbortError'});
    await waitForRequest(); controller.abort(); await rejected;
    expect(requests).toBe(1);
  });
  it('cancels retry backoff before another HTTP request', async () => {
    answer='retry'; const controller=new AbortController();
    const result=callOpenRouter('policy','facts',{signal:controller.signal});
    const rejected=expect(result).rejects.toMatchObject({name:'AbortError'});
    await waitForRequest(); await new Promise(resolve=>setTimeout(resolve,20)); controller.abort(); await rejected;
    expect(requests).toBe(1);
  });
  it.each(['refusal','truncated'] as const)('rejects genuine %s responses instead of returning an AI answer', async kind => {
    answer=kind; await expect(callOpenRouter('policy','facts')).rejects.toBeInstanceOf(AiProviderError); expect(requests).toBe(1);
  });
  it('returns a genuine configuration error before contacting the provider', async () => {
    delete process.env.OPENROUTER_API_KEY;
    await expect(callOpenRouter('policy','facts')).rejects.toBeInstanceOf(AiConfigurationError); expect(requests).toBe(0);
  });
  it('retains a successful native provider response', async () => {
    answer='success'; await expect(callOpenRouter('policy','facts')).resolves.toMatchObject({id:'fixture-response',model:'fixture-model',content:'{"headline":"Retained evidence review"}'});
  });
});
