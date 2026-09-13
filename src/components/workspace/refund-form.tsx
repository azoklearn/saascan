"use client";
import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { ArrowRight, Check, LoaderCircle } from "lucide-react";
import type { DossierSummary } from "@/types/domain";

export function RefundForm() {
  const [session, setSession] = useState<"loading" | "anonymous" | "connected">("loading");
  const [dossiers, setDossiers] = useState<DossierSummary[]>([]);
  const [selected, setSelected] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const sessionResponse = await fetch("/api/session", { cache: "no-store" });
        const data = await sessionResponse.json();
        if (!active) return;
        if (!data.user) { setSession("anonymous"); return; }
        setSession("connected");
        const response = await fetch("/api/dossiers", { cache: "no-store" });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Impossible de charger les dossiers.");
        if (!active) return;
        const paid = (result.dossiers as DossierSummary[]).filter(d => d.paid_at && !d.refunded_at && Date.now() - Date.parse(d.paid_at) <= 14 * 86400000);
        setDossiers(paid);
        const wanted = new URLSearchParams(window.location.search).get("dossier");
        setSelected(paid.find(d => d.id === wanted)?.id || paid[0]?.id || "");
      } catch (cause) { if (active) { setError(cause instanceof Error ? cause.message : "Impossible de charger tes dossiers."); setSession("anonymous"); } }
    })();
    return () => { active = false; };
  }, []);
  async function submit(event: FormEvent) {
    event.preventDefault(); if (!selected || !accepted || busy) return;
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/remboursement", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ dossier_id: selected }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Le remboursement n’a pas pu être lancé.");
      setSuccess(true);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Le remboursement n’a pas pu être lancé."); }
    finally { setBusy(false); }
  }
  if (session === "loading") return <p role="status"><LoaderCircle size={15} /> Vérification de ton compte…</p>;
  if (success) return <div className="legal-notice" role="status"><p><Check size={16} /> Ta demande a été transmise à Stripe. Le remboursement revient sur ton moyen de paiement initial ; le délai d’apparition dépend de ta banque. L’accès au dossier sera fermé dès confirmation du remboursement.</p></div>;
  return <div className="refund-form">{error && <p role="alert" className="form-error">{error}</p>}{session === "anonymous" ? <Link className="button button-primary" href="/connexion?next=%2Fremboursement">Me connecter pour retrouver mon achat <ArrowRight size={15} /></Link> : dossiers.length === 0 ? <p>Aucun achat remboursable sous 14 jours n’est actuellement associé à ton compte. Pour une autre demande, utilise la page <Link href="/contact">contact</Link>.</p> : <form onSubmit={submit}><label htmlFor="refund-dossier">Ton dossier</label><select id="refund-dossier" value={selected} onChange={event => { setSelected(event.target.value); setAccepted(false); }}>{dossiers.map(d => <option key={d.id} value={d.id}>Scan du {new Intl.DateTimeFormat("fr-FR").format(new Date(d.created_at))} · 39 €</option>)}</select><label className="refund-confirmation"><input type="checkbox" checked={accepted} onChange={event => setAccepted(event.target.checked)} /><span>Je confirme le remboursement de cet achat. L’accès au dossier sera fermé après confirmation par Stripe.</span></label><button className="button button-primary" disabled={!accepted || busy} type="submit">{busy ? <LoaderCircle size={15} /> : null}Confirmer le remboursement <ArrowRight size={15} /></button></form>}</div>;
}
