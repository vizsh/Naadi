'use client';
// The owner's only outward action. Approving prepares drafts; nothing is sent from here.
import { pct } from '@/lib/model/core';
import type { Costs } from '@/lib/model/decide';
import { useNaadi } from '@/lib/store';
import { useT } from '@/lib/i18n';
import { Icon } from '@/components/shell/Icons';
import { activeBearing, activeFault, activeShed, heroName } from '@/lib/model/setup';

export function DecisionActions({ cost, showFine = true }: { cost: Costs; showFine?: boolean }) {
  const decision = useNaadi((s) => s.decision);
  const decide = useNaadi((s) => s.decide);
  const { t } = useT();
  const sun = cost.windows.find((w) => w.id === 'sun')!;
  if (decision === 'open') {
    return (
      <>
        <div className="actions">
          <button type="button" className="btn primary" onClick={() => decide('approved')}>{t('btn.approve')}</button>
          <button type="button" className="btn" onClick={() => decide('snoozed')}>{t('btn.snooze')}</button>
        </div>
        {showFine && <p className="fine">{t('dec.fine')}</p>}
      </>
    );
  }
  if (decision === 'snoozed') {
    return (
      <div className="outcome step-in">
        <p>Snoozed. NAADI checks again at the next card, 18:00 today. Waiting until Sunday raises the chance it fails first to {pct(sun.F)}.</p>
        <button type="button" className="btn-quiet" onClick={() => decide('open')}>Undo</button>
      </div>
    );
  }
  return (
    <div className="outcome step-in">
      <p className="done"><Icon name="check" /> Repair approved at 12:04. Two drafts wait on your phone.</p>
      <div className="draft">
        <div className="draft-head"><Icon name="message" /> WhatsApp to Laxmi Bearing House <span>Draft</span></div>
        <p>“Namaskar. Need {activeFault().bearing ? `2 × ${activeBearing().name} bearings` : activeFault().part} by {cost.best.id === 'sun' ? 'Saturday evening' : 'Thursday 12:00'} for {activeShed().place}. Please confirm stock and rate.”</p>
      </div>
      <div className="draft">
        <div className="draft-head"><Icon name="person" /> Ramesh Patil, technician <span>Held</span></div>
        <p>{cost.best.when} held for {heroName()}. Confirm on your phone to book.</p>
      </div>
      <button type="button" className="btn-quiet" onClick={() => decide('open')}>Undo approval</button>
    </div>
  );
}
