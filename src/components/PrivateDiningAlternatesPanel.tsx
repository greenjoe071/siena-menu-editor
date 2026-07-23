'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

interface Alternate {
  id: string;
  name: string;
  extraItems: Array<{ courseIndex: number; name: string; desc?: string }>;
}

export default function PrivateDiningAlternatesPanel({
  menuId,
  initialAlternates,
}: {
  menuId: string;
  initialAlternates: Alternate[];
}) {
  const router = useRouter();
  const [alternates, setAlternates] = useState(initialAlternates);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleCreate() {
    if (!newName.trim()) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/privatedining/${menuId}/alternates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName.trim(), extraItems: [] }),
      });
      if (!res.ok) { alert('Could not create alternate'); return; }
      const alt = await res.json();
      router.push(`/privatedining/${menuId}/edit?alt=${alt.id}`);
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(altId: string, name: string) {
    if (!confirm(`Delete the alternate "${name}"? This can't be undone.`)) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/privatedining/${menuId}/alternates/${altId}`, { method: 'DELETE' });
      if (!res.ok) { alert('Could not delete alternate'); return; }
      setAlternates((list) => list.filter((a) => a.id !== altId));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="pd-alternates">
      {alternates.length === 0 && (
        <p className="pd-empty-hint">No saved alternates yet for this menu.</p>
      )}
      {alternates.map((alt) => (
        <div key={alt.id} className="pd-alt-row">
          <div className="pd-alt-row-main">
            <span className="pd-alt-name">{alt.name}</span>
            <span className="pd-alt-count">
              {alt.extraItems.length === 0 ? 'no extra items' : `${alt.extraItems.length} extra item${alt.extraItems.length > 1 ? 's' : ''}`}
            </span>
          </div>
          <div className="pd-alt-row-actions">
            <Link href={`/privatedining/${menuId}/edit?alt=${alt.id}`} className="btn-add-inline">Edit / Print</Link>
            <button className="btn-link-remove" disabled={busy} onClick={() => handleDelete(alt.id, alt.name)}>delete</button>
          </div>
        </div>
      ))}

      {creating ? (
        <div className="pd-alt-new-row">
          <input
            autoFocus
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="e.g. Vegetarian Alt"
            onKeyDown={(e) => { if (e.key === 'Enter') handleCreate(); }}
          />
          <button className="btn-publish" disabled={busy || !newName.trim()} onClick={handleCreate}>Create</button>
          <button className="btn-link-remove" onClick={() => { setCreating(false); setNewName(''); }}>cancel</button>
        </div>
      ) : (
        <button className="btn-add-dish" onClick={() => setCreating(true)}>+ New Alternate</button>
      )}
    </div>
  );
}
