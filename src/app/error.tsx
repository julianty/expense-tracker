"use client";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  // Permission failures from server actions surface here with a friendly message.
  const isPermission = /not allowed/i.test(error.message);

  return (
    <div className="flex min-h-full items-center justify-center px-4 py-16">
      <div className="w-full max-w-[400px] rounded-[12px] border border-border bg-background p-6 text-center">
        <div className="text-lg font-medium">
          {isPermission ? "You can’t do that" : "Something went wrong"}
        </div>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          {isPermission
            ? error.message.replace(/^Error:\s*/, "")
            : "An unexpected error occurred. You can try again."}
        </p>
        <button
          onClick={reset}
          className="mt-5 cursor-pointer rounded-[6px] bg-accent px-4 py-2 text-sm font-medium text-accent-foreground transition-colors hover:bg-[#b06f1f]"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
