"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { ArrowLeft, FolderOpen, LoaderCircle, ScanLine } from "lucide-react";
import "./workspace.css";

export class ApiError extends Error {
  constructor(message: string, public status: number, public code?: string) { super(message); }
}

export async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...options, cache: "no-store", credentials: "same-origin", headers: { ...(options?.body ? { "Content-Type": "application/json" } : {}), ...options?.headers } });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new ApiError(data.error || "La demande n’a pas abouti. Réessayez dans un instant.", response.status, data.code);
  return data as T;
}

export function friendlyError(error: unknown) { return error instanceof Error ? error.message : "Une erreur est survenue. Réessayez dans un instant."; }
export function demoHref(path: string, demo: boolean) { return `${path}${demo ? "?demo=1" : ""}`; }

export function useDemoMode() {
  const [mode, setMode] = useState({ demo: false, ready: false });
  useEffect(() => { setMode({ demo: new URLSearchParams(window.location.search).get("demo") === "1", ready: true }); }, []);
  return mode;
}

export function downloadMarkdown(contents: string, name: string) {
  const blob = new Blob([contents], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a"); link.href = url; link.download = name; document.body.appendChild(link); link.click(); link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function Shell({ children, demo = false }: { children: ReactNode; demo?: boolean }) {
  return <main className="ws-shell">{demo && <div className="ws-demo-banner"><ScanLine size={16} /><span><b>Mode démo.</b> Données enregistrées dans ce navigateur. Aucun paiement ni appel à l’IA.</span><Link href="/questionnaire">Créer mon vrai dossier <span aria-hidden>↗</span></Link></div>}{children}</main>;
}

export function Spinner({ label }: { label: string }) { return <div className="ws-loading" role="status"><LoaderCircle size={26} className="ws-spinner" /><span>{label}</span></div>; }
export function ErrorNotice({ children }: { children: ReactNode }) { return <div className="ws-error" role="alert">{children}</div>; }

export function ProblemScreen({ message, demo, retry }: { message: string; demo?: boolean; retry?: () => void }) {
  return <Shell demo={demo}><div className="ws-empty ws-panel"><div className="ws-dossier-icon"><FolderOpen size={21} /></div><h1 className="ws-title">Un instant.</h1><ErrorNotice>{message}</ErrorNotice>{retry && <button className="ws-button-secondary" onClick={retry}>Réessayer</button>}<p style={{ marginTop: 20 }}><Link className="ws-back" href="/"><ArrowLeft size={13} /> Retour à l’accueil</Link></p></div></Shell>;
}
