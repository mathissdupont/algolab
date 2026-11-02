import type { Metadata } from "next";
import { Catalog } from "@/components/Catalog";
import { summaries } from "@/lib/problems";

export const metadata: Metadata = { title: "Problems — AlgoLab" };

export default function ProblemsPage() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">Problems</h1>
      <p className="mt-1 text-sm text-muted">
        Problems unlock as the flowchart engine gains the features they need. Locked problems show which capabilities are missing.
      </p>
      <Catalog items={summaries()} />
    </main>
  );
}
