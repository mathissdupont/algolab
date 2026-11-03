// Page patterns: Split pane (workspace) for runnable problems, Detail for the rest.
import { Lock } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ProblemPanel } from "@/components/ProblemPanel";
import { Workspace } from "@/components/flow/Workspace";
import { button } from "@/components/styles";
import { Footer, Group } from "@/components/ui";
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
    <>
      <main className="mx-auto grid max-w-5xl gap-6 px-4 py-10 md:grid-cols-[1fr_320px] md:items-start">
        <Group>
          <ProblemPanel problem={problem} />
        </Group>
        <Group className="p-5">
          <Lock size={20} aria-hidden className="text-label-2" />
          <h2 className="mt-3 text-lg font-semibold">Not runnable yet</h2>
          <p className="mt-1 text-sm leading-normal text-label-2">
            This problem is written, but the flowchart engine can’t express it yet. It unlocks when these capabilities ship:
          </p>
          <ul className="mt-3 space-y-1 font-mono text-sm">
            {missing.map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ul>
          <Link href="/problems/" className={`${button.tinted} mt-5 w-full`}>
            Find a problem to solve
          </Link>
        </Group>
      </main>
      <Footer />
    </>
  );
}
