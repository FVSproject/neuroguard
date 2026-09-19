"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { LogIn, UserPlus, Mail, Lock } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LogoMark } from "@/components/layout/logo";
import { LanguageToggle } from "@/components/layout/language-toggle";
import { createClient } from "@/lib/supabase/client";

type Mode = "sign-in" | "sign-up";

export function AuthCard({ mode }: { mode: Mode }) {
  const t = useTranslations();
  const router = useRouter();
  const params = useSearchParams();
  const nextPath = params.get("next") ?? "/live";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const supabase = createClient();

  async function onEmailPassword(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "sign-up") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: `${location.origin}/auth/callback?next=${nextPath}` },
        });
        if (error) throw error;
        toast.success(t("auth.checkEmail"));
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success(t("auth.welcomeBack"));
        router.replace(nextPath);
        router.refresh();
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function onMagicLink() {
    if (!email) {
      toast.error(t("auth.enterEmailFirst"));
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: `${location.origin}/auth/callback?next=${nextPath}` },
      });
      if (error) throw error;
      toast.success(t("auth.magicLinkSent"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  const label = mode === "sign-up" ? t("auth.signUp") : t("auth.signIn");
  const Icon = mode === "sign-up" ? UserPlus : LogIn;

  return (
    <div className="flex min-h-screen flex-col bg-bg">
      <header className="flex items-center justify-between px-4 py-3 sm:px-6">
        <Link href="/" className="flex items-center gap-2">
          <LogoMark className="h-8 w-8" />
          <span className="text-base font-semibold tracking-tight">NeuroGuard</span>
        </Link>
        <LanguageToggle />
      </header>

      <main className="flex flex-1 items-center justify-center px-4 pb-16">
        <Card className="w-full max-w-md">
          <CardHeader className="items-center text-center">
            <div className="mb-2 grid size-12 place-items-center rounded-full bg-brand-soft text-brand">
              <Icon className="size-6" aria-hidden />
            </div>
            <CardTitle className="text-2xl">{label}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <form onSubmit={onEmailPassword} className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="email">{t("auth.email")}</Label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden />
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="ps-9"
                    disabled={busy}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="password">{t("auth.password")}</Label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden />
                  <Input
                    id="password"
                    type="password"
                    autoComplete={mode === "sign-up" ? "new-password" : "current-password"}
                    required
                    minLength={8}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="ps-9"
                    disabled={busy}
                  />
                </div>
              </div>

              <Button type="submit" className="w-full gap-2" disabled={busy}>
                <Icon className="size-4" aria-hidden />
                {label}
              </Button>
            </form>

            <Button
              type="button"
              variant="ghost"
              className="w-full text-xs text-muted"
              onClick={onMagicLink}
              disabled={busy}
            >
              {t("auth.magicLink")}
            </Button>

            <p className="text-center text-xs text-muted">
              {mode === "sign-up" ? (
                <>
                  {t("auth.haveAccount")} {" "}
                  <Link href="/sign-in" className="font-semibold text-brand hover:underline">
                    {t("auth.signIn")}
                  </Link>
                </>
              ) : (
                <>
                  {t("auth.noAccount")} {" "}
                  <Link href="/sign-up" className="font-semibold text-brand hover:underline">
                    {t("auth.signUp")}
                  </Link>
                </>
              )}
            </p>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
