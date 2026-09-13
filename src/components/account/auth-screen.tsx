"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { ArrowRight, LoaderCircle } from "lucide-react";
import type { AuthError } from "@supabase/supabase-js";
import { BrandLogo } from "@/components/layout/brand-logo";
import { ScanError, ScanShell } from "@/components/workspace/scan-shell";
import { safeNextPath } from "@/lib/security/next-path";
import { createBrowserSupabase } from "@/lib/supabase/browser";

type Mode = "inscription" | "connexion";

const copy = {
  inscription: { kicker: "VOTRE COMPTE", title: "Créez votre compte.", lead: "Il garde votre dossier : vous le retrouvez dans votre espace, sur n’importe quel appareil.", submit: "Créer mon compte", switchText: "Déjà un compte ?", switchLabel: "Se connecter", switchPath: "/connexion" },
  connexion: { kicker: "CONNEXION", title: "Connectez-vous.", lead: "Reprenez votre questionnaire ou retrouvez vos dossiers.", submit: "Se connecter", switchText: "Pas encore de compte ?", switchLabel: "Créer un compte", switchPath: "/inscription" },
} as const;

const notConfigured = "La connexion n’est pas encore configurée sur ce site.";

function authMessage(error: AuthError) {
  switch (error.code) {
    case "invalid_credentials": return "Email ou mot de passe incorrect.";
    case "user_already_exists":
    case "email_exists": return "Un compte existe déjà avec cet email. Connectez-vous.";
    case "weak_password": return "Choisissez un mot de passe plus solide, de 8 caractères au moins.";
    case "email_address_invalid":
    case "validation_failed": return "Vérifiez l’adresse email.";
    case "over_request_rate_limit":
    case "over_email_send_rate_limit": return "Trop de tentatives. Réessayez dans quelques minutes.";
    case "signup_disabled":
    case "email_provider_disabled": return "La création de compte est fermée pour le moment.";
    case "email_not_confirmed": return "Ce compte n’est pas encore activé. Contactez-nous pour l’activer.";
    default: return "La connexion n’a pas abouti. Réessayez dans un instant.";
  }
}

function GoogleMark() {
  return <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" /><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" /><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" /><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" /></svg>;
}

export function AuthScreen({ mode }: { mode: Mode }) {
  const text = copy[mode];
  const supabase = useMemo(() => createBrowserSupabase(), []);
  const [suite, setSuite] = useState("/questionnaire");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState<"google" | "email" | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setSuite(safeNextPath(params.get("suite")));
    if (params.get("erreur") === "google") setError("La connexion avec Google n’a pas abouti. Réessayez ou utilisez votre email.");
  }, []);

  async function continueWithGoogle() {
    if (!supabase) { setError(notConfigured); return; }
    setBusy("google"); setError("");
    const { error: failure } = await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: `${window.location.origin}/auth/callback?suite=${encodeURIComponent(suite)}` } });
    if (failure) { setBusy(null); setError(authMessage(failure)); }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase) { setError(notConfigured); return; }
    setBusy("email"); setError("");
    const credentials = { email: email.trim(), password };
    const { data, error: failure } = mode === "inscription" ? await supabase.auth.signUp(credentials) : await supabase.auth.signInWithPassword(credentials);
    if (failure) { setBusy(null); setError(authMessage(failure)); return; }
    // Sans email de confirmation, Supabase ouvre la session aussitôt.
    if (!data.session) { setBusy(null); setError("Ce compte n’est pas encore activé. Contactez-nous pour l’activer."); return; }
    window.location.assign(suite);
  }

  return <ScanShell stage="account"><section className="scan-auth">
    <BrandLogo />
    <p className="scan-count">{text.kicker}</p>
    <h1>{text.title}</h1>
    <p className="scan-auth-lead">{text.lead}</p>
    <button type="button" className="scan-google" onClick={continueWithGoogle} disabled={!!busy}>{busy === "google" ? <LoaderCircle size={18} className="scan-spinner" /> : <GoogleMark />}Continuer avec Google</button>
    <p className="scan-divider">ou avec votre email</p>
    <form onSubmit={submit}>
      <label className="scan-field"><span>Email</span><input type="email" name="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} /></label>
      <label className="scan-field"><span>Mot de passe</span><input type="password" name="password" autoComplete={mode === "inscription" ? "new-password" : "current-password"} required minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} />{mode === "inscription" && <small>8 caractères minimum.</small>}</label>
      {error && <ScanError>{error}</ScanError>}
      <button type="submit" className="scan-button" disabled={!!busy}>{busy === "email" ? <><LoaderCircle size={16} className="scan-spinner" /> Un instant…</> : <>{text.submit} <ArrowRight size={16} /></>}</button>
    </form>
    <p className="scan-auth-switch">{text.switchText} <Link href={`${text.switchPath}?suite=${encodeURIComponent(suite)}`}>{text.switchLabel}</Link></p>
    {mode === "connexion"
      ? <p className="scan-auth-terms">Mot de passe oublié ? <Link href="/contact">Écrivez-nous</Link> avec l’adresse de votre compte.</p>
      : <p className="scan-auth-terms">En créant un compte, vous acceptez les <Link href="/cgv">CGV</Link> et la <Link href="/confidentialite">politique de confidentialité</Link>.</p>}
  </section></ScanShell>;
}
