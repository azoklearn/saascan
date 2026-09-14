"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { BatteryFull, SignalHigh, Wifi } from "lucide-react";

// Paiements fictifs : l’illustration montre ce que vise un SaaS lancé, pas des ventes réelles.
const payments = [
  { amount: "39,00 €", sender: "s•••••@gmail.com" },
  { amount: "149,00 €", sender: "j••••@icloud.com" },
  { amount: "12,00 €", sender: "m•••••@outlook.fr" },
  { amount: "79,98 €", sender: "l••••@hotmail.fr" },
  { amount: "24,00 €", sender: "c•••••@gmail.com" },
  { amount: "19,90 €", sender: "a•••@orange.fr" },
];
const visibleSlots = 4;
const arrivalMs = 3200;
const minutesBetweenArrivals = 2;

type Notification = { id: number; minutes: number };
const initialFeed: Notification[] = [0, 1, 2, 3].map((id) => ({ id, minutes: id * 3 }));

export function PaymentsPhone() {
  const phone = useRef<HTMLDivElement>(null);
  const [feed, setFeed] = useState(initialFeed);
  const [date, setDate] = useState("");

  useEffect(() => {
    setDate(new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long" }).format(new Date()));
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let onScreen = true;
    const observer = new IntersectionObserver(([entry]) => { onScreen = entry.isIntersecting; });
    if (phone.current) observer.observe(phone.current);
    let nextId = initialFeed.length;
    const timer = window.setInterval(() => {
      // Hors de l’écran, les cartes s’accumuleraient sans être vues.
      if (!onScreen || document.hidden) return;
      const id = nextId++;
      // Un emplacement de plus que l’écran : la carte poussée en bas disparaît avant d’être retirée.
      setFeed((current) => [{ id, minutes: 0 }, ...current.map((item) => ({ ...item, minutes: item.minutes + minutesBetweenArrivals }))].slice(0, visibleSlots + 1));
    }, arrivalMs);
    return () => { window.clearInterval(timer); observer.disconnect(); };
  }, []);

  return <figure className="payments-scene">
    <div ref={phone} className="payments-phone" role="img" aria-label="Illustration : notifications de paiement Stripe sur un téléphone">
      <div className="phone-body"><div className="phone-screen">
        <div className="phone-status"><span>9:41</span><span className="phone-island" /><span className="phone-indicators"><SignalHigh size={13} /><Wifi size={13} /><BatteryFull size={17} /></span></div>
        <p className="phone-date">{date}</p>
        <p className="phone-clock">9:41</p>
        <ul className="payment-feed">{feed.map((item, slot) => {
          const payment = payments[item.id % payments.length];
          return <li key={item.id} className="feed-slot" data-slot={slot} data-enter={item.id >= initialFeed.length} style={{ "--slot": slot } as CSSProperties}>
            <div className="payment-card">
              <span className="payment-app">S</span>
              <div>
                <p className="payment-head"><strong>Stripe</strong><span>{item.minutes === 0 ? "maintenant" : `il y a ${item.minutes} min`}</span></p>
                <p className="payment-text">Vous avez reçu <strong>{payment.amount}</strong></p>
                <p className="payment-sender">émis par {payment.sender}</p>
              </div>
            </div>
          </li>;
        })}</ul>
      </div></div>
      <span className="phone-shadow" />
    </div>
  </figure>;
}
