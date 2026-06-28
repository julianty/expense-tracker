"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { signInAction, signUpAction } from "@/app/auth-actions";
import { SubmitButton } from "@/components/client";

function LoginCard() {
  const router = useRouter();
  const error = useSearchParams().get("error");
  const [tab, setTab] = useState<"account" | "link">("account");
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [linkValue, setLinkValue] = useState("");

  function openLink(e: React.FormEvent) {
    e.preventDefault();
    const match = linkValue.trim().match(/([A-Za-z0-9]{6,})\/?$/);
    if (match) router.push(`/g/${match[1]}`);
  }

  const inputCls =
    "h-9 w-full rounded-[6px] border border-border px-3 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20";

  return (
    <div className="w-[340px] rounded-[12px] border border-border bg-background p-6">
      <div className="text-center text-lg font-medium">Splitwise-lite</div>
      <div className="mt-1 text-center text-[13px] text-muted-foreground">Sign in to your groups</div>

      {/* tabs */}
      <div className="mt-5 flex border-b border-border">
        {(["account", "link"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`-mb-px flex-1 cursor-pointer pb-2.5 text-center text-sm font-medium ${
              tab === t ? "border-b-2 border-accent text-accent" : "text-muted-foreground"
            }`}
          >
            {t === "account" ? "Account" : "Have a link?"}
          </button>
        ))}
      </div>

      {error && tab === "account" && (
        <div className="mt-4 rounded-[6px] bg-owe-bg px-3 py-2 text-[13px] text-owe">{error}</div>
      )}

      {tab === "account" ? (
        <form className="mt-5" action={mode === "signup" ? signUpAction : signInAction}>
          <label className="mb-1.5 block text-[13px] font-medium">Email</label>
          <input name="email" type="email" required placeholder="you@example.com" className={inputCls} />
          <label className="mb-1.5 mt-3.5 block text-[13px] font-medium">Password</label>
          <input
            name="password"
            type="password"
            required
            placeholder={mode === "signup" ? "At least 6 characters" : "••••••••••"}
            className={inputCls}
          />
          <SubmitButton
            pendingLabel={mode === "signup" ? "Creating account…" : "Signing in…"}
            className="mt-5 h-[38px] w-full cursor-pointer rounded-[6px] bg-accent text-sm font-medium text-accent-foreground transition-colors hover:bg-[#b06f1f] disabled:cursor-default disabled:opacity-70"
          >
            {mode === "signup" ? "Create account" : "Sign in"}
          </SubmitButton>
          <div className="mt-4 text-center text-[13px] text-muted-foreground">
            {mode === "signup" ? "Already have an account? " : "Don't have an account? "}
            <button
              type="button"
              onClick={() => setMode(mode === "signup" ? "signin" : "signup")}
              className="cursor-pointer font-medium text-accent"
            >
              {mode === "signup" ? "Sign in" : "Sign up"}
            </button>
          </div>
        </form>
      ) : (
        <form className="mt-5" onSubmit={openLink}>
          <label className="mb-1.5 block text-[13px] font-medium">Share link or token</label>
          <input
            value={linkValue}
            onChange={(e) => setLinkValue(e.target.value)}
            placeholder="app.split/g/x7Qa9k…"
            className={inputCls}
          />
          <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
            Anyone with a group&apos;s link can join and act as a member — no account needed. Try the
            demo:{" "}
            <Link href="/g/x7Qa9k2mDt" className="font-medium text-accent underline">
              x7Qa9k2mDt
            </Link>
            .
          </p>
          <button
            type="submit"
            className="mt-5 h-[38px] w-full cursor-pointer rounded-[6px] bg-accent text-sm font-medium text-accent-foreground transition-colors hover:bg-[#b06f1f]"
          >
            Open group
          </button>
        </form>
      )}
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="flex min-h-full items-center justify-center bg-[#FAFAFA] px-4 py-12">
      <Suspense>
        <LoginCard />
      </Suspense>
    </div>
  );
}
