import { useEffect, useState, useCallback } from 'react';

interface HeroHeadlineProps {
  headline: string;
  services?: { prefix?: string; service: string; suffix?: string }[];
}

const SERVICE_WORDS = [
  { prefix: '', service: 'Websites', suffix: '' },
  { prefix: '', service: 'Brands', suffix: '' },
  { prefix: '', service: 'Campaigns', suffix: '' },
  { prefix: '', service: 'Reels', suffix: '' },
  { prefix: '', service: 'Growth', suffix: '' }
];
const CYCLE_MS = 2800;

export default function HeroHeadline({ headline, services = [] }: HeroHeadlineProps) {
  const words = services.length > 0 ? services : SERVICE_WORDS;
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<'in' | 'out'>('in');

  // Rotation starts once hydrated. There is deliberately no "isReady" gate on
  // visibility: this is the page's LCP element, and hiding server-rendered
  // markup behind a hydration flag meant the H1 shipped at opacity:0 and never
  // appeared at all if the React bundle was slow, blocked or broken.
  const [isRotating, setIsRotating] = useState(false);
  useEffect(() => {
    setIsRotating(true);
  }, []);

  const cycle = useCallback(() => {
    setPhase('out');
    setTimeout(() => {
      setIndex((i) => {
        const nextIndex = (i + 1) % words.length;
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('hero-slide-change', { detail: { index: nextIndex } }));
        }
        return nextIndex;
      });
      setPhase('in');
    }, 400);
  }, [words.length]);

  useEffect(() => {
    if (!isRotating || words.length < 2) return;
    const id = setInterval(cycle, CYCLE_MS);
    return () => clearInterval(id);
  }, [isRotating, cycle, words.length]);

  // Split the headline at the first period or use as-is
  // Expected format: "We build [WORD] that make you money."
  // If headline contains a pipe |, split there for two lines
  const parts = headline.includes('|')
    ? headline.split('|').map(s => s.trim())
    : [headline];

  const hasMultiLine = parts.length >= 2;

  // One static, screen-reader-only rendering of the headline. The rotating word
  // is aria-hidden below: it sat in an aria-live region and changed every 2.8s,
  // so assistive tech announced a new word indefinitely.
  const spokenHeadline = [parts[0], words[0].service, words[0].suffix || parts[1]]
    .filter(Boolean)
    .join(' ');

  return (
    <span className="hero-headline-wrapper">
      <span className="sr-only">{spokenHeadline}</span>
      {hasMultiLine ? (
        <>
          {/* Line 1 is the intro: a per-service "prefix" override, falling back to the static headline text */}
          {(words[index].prefix || parts[0]) && (
            <span className="hero-line hero-line-1" aria-hidden="true">{words[index].prefix || parts[0]}</span>
          )}

          {/* Line 2: rotating word */}
          <span className="hero-rotator-row">
            <span className="hero-rotator-container" aria-hidden="true">
              <span
                className={`hero-rotator-word ${phase}`}
                key={words[index].service}
              >
                {words[index].service}
              </span>
            </span>
          </span>

          {/* Line 3: closing phrase */}
          {words[index].suffix ? (
            <span className="hero-line hero-line-3" aria-hidden="true">{words[index].suffix}</span>
          ) : parts[1] ? (
            <span className="hero-line hero-line-3" aria-hidden="true">{parts[1]}</span>
          ) : null}
        </>
      ) : (
        <>
          {/* Single headline with rotating word appended */}
          {(words[index].prefix || parts[0]) && (
            <span className="hero-line hero-line-1" aria-hidden="true">{words[index].prefix || parts[0]}</span>
          )}
          {words.length > 0 && (
            <>
              <span className="hero-rotator-row">
                <span className="hero-rotator-container" aria-hidden="true">
                  <span
                    className={`hero-rotator-word ${phase}`}
                    key={words[index].service}
                  >
                    {words[index].service}
                  </span>
                </span>
              </span>
              {words[index].suffix && (
                <span className="hero-line hero-line-3" aria-hidden="true">{words[index].suffix}</span>
              )}
            </>
          )}
        </>
      )}
    </span>
  );
}
