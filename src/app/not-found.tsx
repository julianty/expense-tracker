import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-full items-center justify-center px-4 py-16">
      <div className="w-full max-w-[400px] rounded-[12px] border border-border bg-background p-6 text-center">
        <div className="text-lg font-medium">Not found</div>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          That group or page doesn’t exist, or the link has changed.
        </p>
        <Link
          href="/groups"
          className="mt-5 inline-block rounded-[6px] bg-accent px-4 py-2 text-sm font-medium text-accent-foreground transition-colors hover:bg-[#b06f1f]"
        >
          Back to your groups
        </Link>
      </div>
    </div>
  );
}
