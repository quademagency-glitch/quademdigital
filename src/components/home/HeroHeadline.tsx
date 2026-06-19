import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';

interface HeroHeadlineProps {
  headline: string;
  services?: string[];
}

const SCRAMBLE_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ#%&*+=/<>';
const CHAR_DELAY = 16; // ms before the next character begins locking
const SCRAMBLE_MS = 280; // how long a single character flickers before it locks

const randomChar = () => SCRAMBLE_CHARS[(Math.random() * SCRAMBLE_CHARS.length) | 0];

interface CharFrame {
  display: string;
  locked: boolean;
  weight: number;
}

const lockedFrame = (char: string): CharFrame => ({ display: char, locked: true, weight: 700 });
const scrambledFrame = (weight: number): CharFrame => ({ display: randomChar(), locked: false, weight });

// Staggered decode/scramble reveal: every character flickers through random glyphs
// and "locks" into place left-to-right, gaining font-weight as it settles.
function useDecodeReveal(text: string, active: boolean) {
  const letters = useRef(text.split(''));
  letters.current = text.split('');

  const [frames, setFrames] = useState<CharFrame[]>(() =>
    letters.current.map((c) => (c === ' ' ? lockedFrame(' ') : lockedFrame(c))),
  );
  const [done, setDone] = useState(true);

  useEffect(() => {
    if (!active) return;
    let raf = 0;
    const start = performance.now();
    setDone(false);

    const tick = () => {
      const elapsed = performance.now() - start;
      let allLocked = true;

      const next = letters.current.map((char, i) => {
        if (char === ' ') return lockedFrame(' ');
        const lockAt = i * CHAR_DELAY + SCRAMBLE_MS;
        if (elapsed >= lockAt) return lockedFrame(char);
        allLocked = false;
        const startAt = i * CHAR_DELAY;
        const progress = Math.min(1, Math.max(0, (elapsed - startAt) / SCRAMBLE_MS));
        return scrambledFrame(300 + progress * 400);
      });

      setFrames(next);
      if (allLocked) {
        setDone(true);
      } else {
        raf = requestAnimationFrame(tick);
      }
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [active, text]);

  return { frames, done };
}

export default function HeroHeadline({ headline, services = [] }: HeroHeadlineProps) {
  const prefersReducedMotion = useReducedMotion();
  const [serviceIndex, setServiceIndex] = useState(0);

  // The intro splash covers the page for ~1.8s on first visit. Don't start
  // decoding until it's actually gone, or it finishes invisibly behind it.
  const [ready, setReady] = useState(
    () => typeof document !== 'undefined' && document.body.classList.contains('loader-done'),
  );

  useEffect(() => {
    if (ready) return;
    const onDone = () => setReady(true);
    document.addEventListener('quadem:loaderdone', onDone);
    return () => document.removeEventListener('quadem:loaderdone', onDone);
  }, [ready]);

  useEffect(() => {
    if (services.length < 2 || prefersReducedMotion) return;
    const id = setInterval(() => setServiceIndex((i) => (i + 1) % services.length), 2600);
    return () => clearInterval(id);
  }, [services, prefersReducedMotion]);

  const { frames, done } = useDecodeReveal(headline, ready && !prefersReducedMotion);

  if (prefersReducedMotion) {
    return (
      <span className="hero-headline-text is-decoded">
        {headline}
        {services.length > 0 && <span className="text-gradient"> {services[serviceIndex]}</span>}
      </span>
    );
  }

  return (
    <motion.span
      className={`hero-headline-text${done && ready ? ' is-decoded' : ''}`}
      initial={{ opacity: 0 }}
      animate={{ opacity: ready ? 1 : 0 }}
      transition={{ duration: 0.2 }}
    >
      <span aria-hidden="true">
        {frames.map((f, i) => (
          <span
            key={i}
            style={{
              display: 'inline-block',
              fontVariationSettings: `"wght" ${f.weight}`,
              color: f.locked ? undefined : 'rgba(0, 174, 239, 0.9)',
            }}
          >
            {f.display}
          </span>
        ))}
      </span>
      <span className="hero-sr-only">
        {headline}
        {services.length > 0 ? ` ${services[serviceIndex]}` : ''}
      </span>

      {services.length > 0 && (
        <span aria-hidden="true" style={{ display: 'inline-block', overflow: 'hidden', verticalAlign: 'top', marginLeft: '0.3em' }}>
          <AnimatePresence mode="wait">
            <motion.span
              key={services[serviceIndex]}
              className="text-gradient"
              initial={{ y: '100%', opacity: 0 }}
              animate={{ y: '0%', opacity: 1 }}
              exit={{ y: '-100%', opacity: 0 }}
              transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
              style={{ display: 'inline-block' }}
            >
              {services[serviceIndex]}
            </motion.span>
          </AnimatePresence>
        </span>
      )}
    </motion.span>
  );
}
