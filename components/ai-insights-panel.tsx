"use client";
import { useState } from "react";
import JsonReport from "@/components/JsonReport";

const FEATURES = [
  { id: "opportunity-fit", label: "Opportunity fit" },
  { id: "requirement-gap", label: "Requirement gap" },
  { id: "deadline-risk", label: "Deadline risk" },
] as const;

export default function AiInsightsPanel() {
  const [result, setResult] = useState<unknown>(null);
  const [message, setMessage] = useState("");
  async function run(feature: string) {
    setMessage("Running domain analysis…");
    try {
      const res = await fetch("/api/projects/ai-insights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ feature }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "AI insights failed");
      setResult(data);
      setMessage(data?.aiGenerated ? "AI-generated result." : "Deterministic fallback — no AI provider configured (aiGenerated: false).");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "AI insights failed");
    }
  }
  return (
    <section className="mt-6 rounded-[22px] border border-[#dce4df] bg-white p-5 shadow-[0_8px_28px_rgba(28,47,40,0.05)]">
      <h2 className="font-bold tracking-tight">Project AI insights</h2>
      <p className="mt-1 text-xs text-[#7c8a84]">Domain-grounded analysis over your SAM.gov projects. Without a provider key it returns a clearly labelled deterministic fallback (aiGenerated: false).</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {FEATURES.map((f) => (
          <button key={f.id} type="button" onClick={() => run(f.id)} className="rounded-lg border border-[#dce4df] px-3 py-1.5 text-sm hover:bg-[#f4f8f6]">{f.label}</button>
        ))}
      </div>
      {message ? <p role="status" className="mt-2 text-xs text-[#597169]">{message}</p> : null}
      {result ? <div className="mt-4"><JsonReport data={result} title="AI insights" /></div> : null}
    </section>
  );
}
