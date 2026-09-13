"use client";

export default function ErrorPage({ reset }: { reset: () => void }) { return <main className="empty-page container"><p className="eyebrow">UN PETIT CONTRETEMPS</p><h1>La page n’a pas pu se charger.</h1><p>Tu peux réessayer. Les réponses déjà enregistrées restent dans ton dossier.</p><button className="button button-primary" onClick={reset}>Réessayer</button></main>; }
