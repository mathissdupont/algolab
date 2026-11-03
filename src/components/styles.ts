// Class names shared by server and client components. Kept out of the
// "use client" module so server components receive the real strings.

const base = "inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-lg px-4 font-medium disabled:opacity-40 disabled:pointer-events-none";

export const button = {
  primary: `${base} bg-accent-fill text-on-accent hover:opacity-90`,
  tinted: `${base} bg-accent-tint text-accent hover:bg-fill-strong`,
  plain: `${base} text-accent hover:bg-fill`,
  gray: `${base} bg-fill text-label hover:bg-fill-strong`,
  destructive: `${base} bg-red-fill text-white hover:opacity-90`,
  destructivePlain: `${base} text-red hover:bg-red-tint`,
};

export const field =
  "h-11 w-full rounded-lg border border-separator bg-surface px-3 text-base text-label placeholder:text-label-3";
