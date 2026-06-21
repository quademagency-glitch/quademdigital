import { useEffect, useState, useCallback } from 'react';

interface HeroHeadlineProps {
  headline: string;
  services?: { prefix?: string; service: string; suffix?: string }[];
}

const SERVICE_WORDS = [
  { prefix: '', service: 'Websites', suffix: '' },
  { prefix: '', service: 'Brands', suffix: '' },
  { prefix: '', service: 'Campaigns', suffix: '' },
  { prefix: '', service: 'Videos', suffix: '' },
  { prefix: '', service: 'Growth', suffix: '' }
];
const CYCLE_MS = 2800;

export default function HeroHeadline({ headline, services = [] }: HeroHeadlineProps) {
  const words = services.length > 0 ? services : SERVICE_WORDS;
  const [index, setIndex] = useState(0);
  const [isReady, setIsReady] = useState(false);
  const [phase, setPhase] = useState<'in' | 'out'>('in');

  // Wait for loader to dismiss before starting animations
  useEffect(() => {
    const check = () => {
      if (typeof document !== 'undefined' && document.body.classList.contains('loader-done')) {
        setIsReady(true);
        return true;
      }
      return false;
    };
    if (check()) return;
    const onDone = () => setIsReady(true);
    document.addEventListener('quadem:loaderdone', onDone);
    // Fallback: start after 2.5s regardless
    const fallback = setTimeout(() => setIsReady(true), 2500);
    return () => {
      document.removeEventListener('quadem:loaderdone', onDone);
      clearTimeout(fallback);
    };
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
    if (!isReady || words.length < 2) return;
    const id = setInterval(cycle, CYCLE_MS);
    return () => clearInterval(id);
  }, [isReady, cycle, words.length]);

  // Split the headline at the first period or use as-is
  // Expected format: "We build [WORD] that make you money."
  // If headline contains a pipe |, split there for two lines
  const parts = headline.includes('|')
    ? headline.split('|').map(s => s.trim())
    : [headline];

  const hasMultiLine = parts.length >= 2;

  return (
    <span
      className="hero-headline-wrapper"
      style={{
        opacity: isReady ? 1 : 0,
        transform: isReady ? 'translateY(0)' : 'translateY(24px)',
        transition: 'opacity 0.7s cubic-bezier(0.16, 1, 0.3, 1), transform 0.7s cubic-bezier(0.16, 1, 0.3, 1)',
      }}
    >
      {hasMultiLine ? (
        <>
          {/* Line 1: intro — per-service "prefix" override, falling back to the static headline text */}
          {(words[index].prefix || parts[0]) && (
            <span className="hero-line hero-line-1">{words[index].prefix || parts[0]}</span>
          )}

          {/* Line 2: rotating word */}
          <span className="hero-rotator-row">
            <span className="hero-rotator-container" aria-live="polite">
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
            <span className="hero-line hero-line-3">{words[index].suffix}</span>
          ) : parts[1] ? (
            <span className="hero-line hero-line-3">{parts[1]}</span>
          ) : null}
        </>
      ) : (
        <>
          {/* Single headline with rotating word appended */}
          {(words[index].prefix || parts[0]) && (
            <span className="hero-line hero-line-1">{words[index].prefix || parts[0]}</span>
          )}
          {words.length > 0 && (
            <>
              <span className="hero-rotator-row">
                <span className="hero-rotator-container" aria-live="polite">
                  <span
                    className={`hero-rotator-word ${phase}`}
                    key={words[index].service}
                  >
                    {words[index].service}
                  </span>
                </span>
              </span>
              {words[index].suffix && (
                <span className="hero-line hero-line-3">{words[index].suffix}</span>
              )}
            </>
          )}
        </>
      )}
    </span>
  );
}
