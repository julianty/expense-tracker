import { Card } from "@/components/ui";

export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-[480px] px-4 py-8 sm:px-6">
      <Card className="overflow-hidden">
        <div className="px-6 pb-5 pt-6">
          <div className="h-7 w-40 animate-pulse rounded bg-muted" />
          <div className="mt-5 flex flex-col gap-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="rounded-[12px] border border-border p-4">
                <div className="h-5 w-32 animate-pulse rounded bg-muted" />
                <div className="mt-3 h-6 w-24 animate-pulse rounded-full bg-muted" />
              </div>
            ))}
          </div>
        </div>
      </Card>
    </div>
  );
}
