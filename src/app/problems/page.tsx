import type { Metadata } from "next";
import { Catalog } from "@/components/Catalog";
import { Footer } from "@/components/ui";
import { isSupported, problems, summaries } from "@/lib/problems";

export const metadata: Metadata = { title: "Problems — AlgoLab" };

export default function ProblemsPage() {
  const runnable = problems.filter(isSupported).length;
  return (
    <>
      <main className="mx-auto max-w-3xl px-4 pt-10 sm:pt-14">
        <h1 className="text-[2rem] leading-tight font-semibold">Problems</h1>
        <p className="mt-2 max-w-[65ch] text-label-2">
          {runnable === problems.length
            ? `${problems.length} problems, from counting loops to graph search and dynamic programming. Pick one and build its flowchart.`
            : `${runnable} of ${problems.length} problems can be solved today. The rest unlock as the flowchart engine gains the features they need.`}
        </p>
        <Catalog items={summaries()} />
      </main>
      <Footer />
    </>
  );
}
