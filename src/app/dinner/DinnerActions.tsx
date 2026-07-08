'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

// The "make changes" controls on the Dinner landing page. Rendered client-side
// because "Start over from current" must discard the existing draft before
// opening the editor.
export default function DinnerActions({ draftExists }: { draftExists: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function startOver() {
    if (!confirm('Start over from the current menu?\n\nYour current draft will be discarded and a fresh draft will be created from the current menu.')) return;
    setBusy(true);
    try {
      await fetch('/api/dinner/draft', { method: 'DELETE' });
    } finally {
      router.push('/dinner/edit');
    }
  }

  if (!draftExists) {
    return (
      <div className="dl-actions">
        <a className="dl-btn dl-btn--primary" href="/dinner/edit">Start a New Draft →</a>
      </div>
    );
  }

  return (
    <div className="dl-actions">
      <a className="dl-btn dl-btn--primary" href="/dinner/edit">Continue Your Draft →</a>
      <button className="dl-btn dl-btn--ghost" onClick={startOver} disabled={busy}>
        {busy ? 'Starting over…' : 'Start Over from Current'}
      </button>
    </div>
  );
}
