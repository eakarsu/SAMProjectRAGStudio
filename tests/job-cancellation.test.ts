import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { JobRow } from '@/lib/types';
const state = vi.hoisted(() => ({ job:null as JobRow|null, audits:[] as string[], providerSignal:null as AbortSignal|null, resultWrites:0, proposalWrites:0, resolve:null as null|((value:unknown)=>void) }));
vi.mock('@/lib/db-helpers', () => ({
  all:vi.fn(), newId:()=> 'fixture-generated-id', nowIso:()=>new Date().toISOString(), parseJson:(value:string,fallback:unknown)=> {try{return JSON.parse(value);}catch{return fallback;}},
  first:vi.fn(async (sql:string, values:unknown[]) => { const job=state.job; if(sql.includes('FROM jobs')) return job && job.id===values[0] && job.owner_id===values[1] ? {...job} : null; return null; }),
  run:vi.fn(async (sql:string, values:unknown[]) => {
    const job=state.job!;
    if(sql.includes("status = 'cancelled'")) {if(values[2]!==job.id || values[3]!==job.owner_id || !['queued','running','blocked'].includes(job.status))return {meta:{changes:0}}; job.status='cancelled'; job.updated_at=String(values[0]); return {meta:{changes:1}};}
    if(sql.includes("SET status = 'running'")) {job.status='running';job.updated_at=String(values[1]);return {meta:{changes:1}};}
    if(sql.includes('result_json = ?')) {state.resultWrites++;if(job.status!=='running' || job.updated_at!==values.at(-1))return {meta:{changes:0}};job.status=String(values[0]);job.current_step=Number(values[3]);return {meta:{changes:1}};}
    if(sql.includes("status = 'blocked'")) {if(job.status!=='running' || job.updated_at!==values.at(-1))return {meta:{changes:0}};job.status='blocked';return {meta:{changes:1}};}
    if(sql.includes('INSERT INTO proposals'))state.proposalWrites++;
    return {meta:{changes:0}};
  }),
}));
vi.mock('@/lib/project-repository', () => ({
  NotFoundError:class extends Error {}, formatJob:(job:JobRow)=>({...job,currentStep:job.current_step}),formatProposal:(value:unknown)=>value,
  getOwnedProject:vi.fn(async()=>({title:'Actual retained project',rag_status:'ready'})), retrieveProjectEvidence:vi.fn(async()=>[{id:'owned-chunk'}]),
  recordAudit:vi.fn(async(_owner:string,_project:string,action:string)=>state.audits.push(action)),
}));
vi.mock('@/lib/openrouter', () => ({openRouterStatus:()=>({model:'fixture-model'}),generateAiProposalSection:vi.fn(async(_input:unknown,signal:AbortSignal)=>{
  state.providerSignal=signal;
  return new Promise((resolve,reject)=>{state.resolve=resolve;signal.addEventListener('abort',()=>reject(signal.reason),{once:true});});
})}));
import { advanceGenerationJob, cancelGenerationJob, getJob } from '@/lib/job-service';

describe('owned persistent generation cancellation', () => {
  beforeEach(()=>{state.job={id:'saved-job',owner_id:'owner-a',project_id:'saved-project',status:'queued',current_step:0,request_json:JSON.stringify({intent:'compliance',sections:[{key:'requirement',title:'Requirement',retrievalQuery:'actual evidence',instructions:'Cite facts'}]}),result_json:'[]',provider_response_ids_json:'[]',updated_at:'2026-01-01',title:'Saved job'} as JobRow;state.audits=[];state.providerSignal=null;state.resultWrites=0;state.proposalWrites=0;state.resolve=null;});
  it('allows only the owning workspace to read or cancel a job', async()=>{
    await expect(getJob('other-owner','saved-job')).rejects.toThrow('not found');
    await expect(cancelGenerationJob('other-owner','saved-job')).rejects.toThrow('not found');expect(state.job!.status).toBe('queued');expect(state.audits).toEqual([]);
  });
  it('persists queued cancellation and does not resume a cancelled job', async()=>{
    await cancelGenerationJob('owner-a','saved-job');await advanceGenerationJob('owner-a','saved-job');expect(state.job!.status).toBe('cancelled');expect(state.providerSignal).toBeNull();expect(state.audits).toEqual(['ai.job.cancelled']);
  });
  it('aborts an in-flight section after owned cancellation without replacing its cancelled state', async()=>{
    const running=advanceGenerationJob('owner-a','saved-job');
    for(let count=0; count<50&&!state.providerSignal;count++)await new Promise(resolve=>setTimeout(resolve,5));
    expect(state.providerSignal).not.toBeNull(); await cancelGenerationJob('owner-a','saved-job');await running;
    expect(state.providerSignal!.aborted).toBe(true);expect(state.job!.status).toBe('cancelled');expect(state.resultWrites).toBe(0);expect(state.proposalWrites).toBe(0);expect(state.audits).toEqual(['ai.job.cancelled']);
  });
  it('rejects cancellation of a completed retained result', async()=>{state.job!.status='completed';await expect(cancelGenerationJob('owner-a','saved-job')).rejects.toThrow('already completed');expect(state.job!.status).toBe('completed');});
});
