import { DIFF_COLOR, DESK, STOPS } from './levels';
import { PEOPLES_PREVIEW, PREVIEW_KINDS, previewText } from './previews';
import { UncleSam } from './UncleSam';

// One link-preview card, drawn at exactly 1200×630 for scripts/make-previews.mjs to photograph
// (#og-card?k=10-3-balanced-gentle). Not linked from anywhere in the game.

export default function OgCard({ param }: { param: string | null }) {
  const id = new URLSearchParams(param ?? '').get('k') ?? '';
  if (id === PEOPLES_PREVIEW.id) {
    return (
      <div className="ogcard" style={{ ['--og' as string]: '#1d5a43' }} data-kind={id}>
        <div className="ogcard-band" />
        <div className="ogcard-main">
          <div className="ogcard-eyebrow">Everyone’s budget · one move a day</div>
          <div className="ogcard-title">The People’s<br />Budget</div>
          <div className="ogcard-goal">Fix Uncle Sam’s books together</div>
          <div className="ogcard-person">
            <div className="ogcard-k">How it works</div>
            <div className="ogcard-line">Each day, every player pushes one policy card in or out. A card is in when more people push it in than out. Watch the country close the gap.</div>
          </div>
          <div className="ogcard-foot"><strong>balancethebudget.us</strong> · Help Uncle Sam Balance the Budget · official U.S. data</div>
        </div>
        <div className="ogcard-sam"><UncleSam mood="happy" size={330} /></div>
      </div>
    );
  }
  const k = PREVIEW_KINDS.find((x) => x.id === id) ?? PREVIEW_KINDS.at(-1)!;
  const t = previewText(k);
  const d = DESK.find((x) => x.n === k.level)!;
  const color = DIFF_COLOR[d.difficulty];
  return (
    <div className="ogcard" style={{ ['--og' as string]: color }} data-kind={k.id}>
      <div className="ogcard-band" />
      <div className="ogcard-main">
        <div className="ogcard-eyebrow">Level {t.level} of {STOPS.length} · {t.difficulty}</div>
        <div className="ogcard-title">Can you beat<br />this plan?</div>
        <div className="ogcard-goal">Goal: {t.goal[0].toLowerCase() + t.goal.slice(1)}</div>
        <div className="ogcard-stars" aria-label={`${k.stars} of 3 stars`}>
          {[1, 2, 3].map((s) => <span key={s} data-on={s <= k.stars}>★</span>)}
        </div>
        <div className="ogcard-person">
          <div className="ogcard-k">Budget personality</div>
          <div className="ogcard-name">{t.personality}</div>
          <div className="ogcard-line">{t.line}</div>
        </div>
        <div className="ogcard-foot"><strong>balancethebudget.us</strong> · Help Uncle Sam Balance the Budget · official U.S. data</div>
      </div>
      <div className="ogcard-sam"><UncleSam mood="cheering" size={330} /></div>
    </div>
  );
}
