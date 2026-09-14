"use client";

import { useEffect, useState } from "react";

const typeDelay = 55;
const deleteDelay = 32;
const holdTyped = 2600;
const holdEmpty = 380;

/** Efface la fin de phrase lettre par lettre puis tape la suivante, comme au clavier. La place de la plus longue est réservée : rien ne bouge autour. */
export function TypewriterText({ phrases }: { phrases: string[] }) {
  const [text, setText] = useState(phrases[0]);
  const key = phrases.join("\n");

  useEffect(() => {
    const list = key.split("\n");
    if (list.length < 2 || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let timer = 0;
    let index = 0;
    let length = list[0].length;
    let deleting = true;
    const step = () => {
      if (deleting) {
        length -= 1;
        setText(list[index].slice(0, length));
        if (length > 0) { timer = window.setTimeout(step, deleteDelay); return; }
        deleting = false;
        index = (index + 1) % list.length;
        timer = window.setTimeout(step, holdEmpty);
        return;
      }
      length += 1;
      setText(list[index].slice(0, length));
      if (length < list[index].length) { timer = window.setTimeout(step, typeDelay + Math.random() * 45); return; }
      deleting = true;
      timer = window.setTimeout(step, holdTyped);
    };
    timer = window.setTimeout(step, holdTyped);
    return () => window.clearTimeout(timer);
  }, [key]);

  const longest = phrases.reduce((widest, phrase) => phrase.length > widest.length ? phrase : widest);
  return <span className="typewriter">
    <span className="sr-only">{phrases[0]}</span>
    <span className="typewriter-sizer" aria-hidden="true">{longest}<span className="typewriter-caret" /></span>
    <span className="typewriter-text" aria-hidden="true">{text}<span className="typewriter-caret" /></span>
  </span>;
}
