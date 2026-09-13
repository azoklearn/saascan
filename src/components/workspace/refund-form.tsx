"use client";

import { useEffect, useState, type FormEvent } from "react";
import { ArrowRight, Check, LoaderCircle } from "lucide-react";

export function RefundForm() {
  const [token, setToken] = useState<string | null | undefined>(undefined);
  const [accepted, setAccepted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => { setToken(new URLSearchParams(window.location.search).get("dossier")); }, []);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!token || !accepted || busy) return;
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/remboursement", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token }) });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Le remboursement n’a pas pu être lancé.");
      setSuccess(true);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Le remboursement n’a pas pu être lancé."); }
    finally { setBusy(false); }
  }
  if (token === undefined) return null;
  if (success) return <div className="legal-notice" role="status"><p><Check size={16} /> Votre demande a été transmise à Whop et votre abonnement ne sera pas renouvelé. Le remboursement revient sur votre moyen de paiement initial ; le délai d’apparition dépend de votre banque. L’accès au dossier sera fermé dès la confirmation du remboursement.</p></div>;
  if (!token) return <p>Ouvrez votre dossier avec votre lien personnel (sur l’appareil du paiement, il est aussi dans le menu « Mon dossier »), puis choisissez « Demander le remboursement » en bas de la page.</p>;
  return <form className="refund-form" onSubmit={submit}>{error && <p role="alert" className="form-error">{error}</p>}<label className="refund-confirmation"><input type="checkbox" checked={accepted} onChange={(event) => setAccepted(event.target.checked)} /><span>Je confirme la demande de remboursement de mon premier paiement et la résiliation de mon abonnement. L’accès au dossier sera fermé après la confirmation du remboursement.</span></label><button className="button button-primary" disabled={!accepted || busy} type="submit">{busy ? <LoaderCircle size={15} /> : null}Confirmer le remboursement <ArrowRight size={15} /></button></form>;
}
