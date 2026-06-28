import { Card } from "@/components/ui";

export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-[500px] px-4 py-8 sm:px-6">
      <Card className="overflow-hidden">
        <div className="px-6 pb-6 pt-6">
          <div className="flex items-center justify-between">
            <div className="h-7 w-36 animate-pulse rounded bg-muted" />
            <div className="h-7 w-24 animate-pulse rounded bg-muted" />
          </div>
          <div className="mt-[18px] rounded-[12px] border border-border p-4">
            <div className="h-4 w-20 animate-pulse rounded bg-muted" />
            <div className="mt-4 flex flex-col gap-3.5">
              {[0, 1, 2].map((i) => (
                <div key={i} className="flex items-center gap-2.5">
                  <div className="h-8 w-8 animate-pulse rounded-full bg-muted" />
                  <div className="h-4 flex-1 animate-pulse rounded bg-muted" />
                  <div className="h-6 w-20 animate-pulse rounded-full bg-muted" />
                </div>
              ))}
            </div>
          </div>
          <div className="mt-6 flex flex-col gap-4">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-10 w-full animate-pulse rounded bg-muted" />
            ))}
          </div>
        </div>
      </Card>
    </div>
  );
}
