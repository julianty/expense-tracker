"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

/**
 * Minimal toast. Server actions redirect with `?flash=<message>&ft=<nonce>`; this
 * reads it, shows a transient toast, then strips the params so a refresh won't
 * replay it. Dedupes on the `ft` nonce so repeated identical messages still show.
 */
export function Toaster() {
  const sp = useSearchParams();
  const flash = sp.get("flash");
  const ft = sp.get("ft");
  const pathname = usePathname();
  const router = useRouter();

  const [message, setMessage] = useState<string | null>(null);
  const [seen, setSeen] = useState<string | null>(null);

  // Adjust state during render when a new flash arrives (the React-recommended
  // pattern — avoids setState inside an effect).
  if (flash && ft && ft !== seen) {
    setSeen(ft);
    setMessage(flash);
  }

  useEffect(() => {
    if (!message) return;
    if (flash) router.replace(pathname); // strip ?flash&ft from the URL
    const hide = setTimeout(() => setMessage(null), 2600);
    return () => clearTimeout(hide);
  }, [message, flash, pathname, router]);

  if (!message) return null;

  return (
    <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-6 z-50 flex justify-center">
      <div className="toast-in pointer-events-auto flex items-center gap-2 rounded-[8px] border border-border bg-foreground px-4 py-2.5 text-sm font-medium text-background shadow-lg">
        <span className="text-owed" aria-hidden>
          ✓
        </span>
        {message}
      </div>
    </div>
  );
}
