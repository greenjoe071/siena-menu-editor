'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

// The "make changes" controls on a menu landing page. Client-side because
// "Start over from current" must discard the existing draft before opening
// the editor.
export default function DraftActions({
  draftExists,
  editHref,
  apiBase,
  mostRecentWording = false,
}: {
  draftExists: boolean;
  editHref: string;   // e.g. '/weekend/edit'
  apiBase: string;    // e.g. '/api/weekend'
  // Tue–Wed (Sep 2026): spell out that both buttons copy the "Most Recent
  // Menu" and that starting over throws the draft away.
  mostRecentWording?: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function startOver() {
    const msg = mostRecentWording
      ? 'Throw out your draft and start fresh?\n\nYour draft will be deleted and replaced with a copy of the Most Recent Menu.'
      : 'Start over from the current menu?\n\nYour current draft will be discarded and a fresh draft will be created from the current menu.';
    if (!confirm(msg)) return;
    setBusy(true);
    try {
      await fetch(`${apiBase}/draft`, { method: 'DELETE' });
    } finally {
      router.push(editHref);
    }
  }

  if (!draftExists) {
    return (
      <div className="dl-actions">
        <a className="dl-btn dl-btn--primary" href={editHref}>
          {mostRecentWording ? 'Start a New Draft (copy of Most Recent Menu) →' : 'Start a New Draft →'}
        </a>
      </div>
    );
  }

  return (
    <>
      <div className="dl-actions">
        <a className="dl-btn dl-btn--primary" href={editHref}>Continue Your Draft →</a>
        <button className="dl-btn dl-btn--ghost" onClick={startOver} disabled={busy}>
          {busy ? 'Starting over…' : mostRecentWording ? 'Start Fresh from Most Recent Menu' : 'Start Over from Current'}
        </button>
      </div>
      {mostRecentWording && (
        <p className="dl-draft-hint">Throws out this draft and starts a new copy of the most recent menu.</p>
      )}
    </>
  );
}
