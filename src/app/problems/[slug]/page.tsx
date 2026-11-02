import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ProblemPanel } from "@/components/ProblemPanel";
import { Workspace } from "@/components/flow/Workspace";
import { getProblem, missingFeatures, problems } from "@/lib/problems";

export const dynamicParams = false;

export function generateStaticParams() {
  return problems.map((p) => ({ slug: p.slug }));
}

type Params = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const p = getProblem((await params).slug);
  return { title: p ? `${p.title} — AlgoLab` : "AlgoLab" };
}

export default async function ProblemPage({ params }: Params) {
  const problem = getProblem((await params).slug);
  if (!problem) notFound();
  const missing = missingFeatures(problem);

  if (missing.length === 0) return <Workspace problem={problem} />;

  return (
    <main className="mx-auto grid max-w-5xl gap-6 px-4 py-10 md:grid-cols-[1fr_320px]">
      <div className="rounded-xl border border-line bg-panel">
        <ProblemPanel problem={problem} />
      </div>
      <aside className="h-fit rounded-xl border border-line bg-panel p-5 text-sm">
        <span className="rounded border border-line px-1.5 py-0.5 text-xs text-muted">Coming soon</span>
        <h2 className="mt-3 font-semibold">Not runnable yet</h2>
        <p className="mt-2 text-muted">
          The problem is ready, but the flowchart engine can’t express it yet. It unlocks once these capabilities ship:
        </p>
        <ul className="mt-3 flex flex-wrap gap-1.5">
          {missing.map((f) => (
            <li key={f} className="rounded bg-panel-2 px-2 py-0.5 font-mono text-xs">
              {f}
            </li>
          ))}
        </ul>
        <Link href="/problems/" className="mt-5 inline-block text-accent underline">
          Find a runnable problem
        </Link>
      </aside>
    </main>
  );
}
