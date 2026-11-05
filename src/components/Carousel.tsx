import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react';

/**
 * A single row of cards that scrolls sideways: drag, swipe, use the arrow buttons, or focus the
 * row and use the arrow keys. Cards snap into place, and the buttons dim at either end.
 */
export function Carousel({ label, children, count, tools }: { label: string; children: ReactNode; count: number; tools?: ReactNode }) {
  const track = useRef<HTMLDivElement>(null);
  const [edge, setEdge] = useState({ start: true, end: false, first: 1, shown: 1 });
  const measure = useCallback(() => {
    const t = track.current;
    if (!t) return;
    const card = t.firstElementChild as HTMLElement | null;
    const step = card ? card.getBoundingClientRect().width + 12 : t.clientWidth;
    const first = Math.min(count, Math.round(t.scrollLeft / step) + 1);
    const shown = Math.max(1, Math.floor((t.clientWidth + 12) / step));
    setEdge({ start: t.scrollLeft <= 4, end: t.scrollLeft + t.clientWidth >= t.scrollWidth - 4, first, shown });
  }, [count]);
  useEffect(() => {
    measure();
    const t = track.current;
    if (!t) return;
    const ro = new ResizeObserver(measure);
    ro.observe(t);
    return () => ro.disconnect();
  }, [measure, count]);
  const go = (dir: 1 | -1) => {
    const t = track.current;
    if (t) t.scrollBy({ left: dir * Math.max(240, t.clientWidth * 0.85), behavior: 'smooth' });
  };
  const last = Math.min(count, edge.first + edge.shown - 1);
  return (
    <div className="carousel">
      <div className="carousel-bar">
        {tools}
        <div className="carousel-nav">
          <span className="small muted num" aria-live="polite">{count ? `${edge.first}–${last} of ${count}` : 'None'}</span>
          <button type="button" className="icon-btn carousel-btn" aria-label={`Scroll ${label} left`} disabled={edge.start} onClick={() => go(-1)}>‹</button>
          <button type="button" className="icon-btn carousel-btn" aria-label={`Scroll ${label} right`} disabled={edge.end} onClick={() => go(1)}>›</button>
        </div>
      </div>
      <div className="carousel-wrap" data-start={edge.start} data-end={edge.end}>
        <div className="carousel-track" ref={track} role="region" aria-label={label} tabIndex={0} onScroll={measure}>
          {children}
        </div>
      </div>
    </div>
  );
}
