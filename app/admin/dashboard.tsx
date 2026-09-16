'use client';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
type Row = {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  response: string;
  party_size: number;
  guest_names: string;
  dietary_requirements: string;
  message: string;
  invitation_code: string | null;
  submitted_at: string;
  code?: string;
};
type Invite = { id: string; full_name: string; email: string; code: string; created_at: string };
export default function AdminDashboard() {
  const [data, setData] = useState<{ rsvps: Row[]; invitations: Invite[] } | null>(null);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [link, setLink] = useState('');
  async function load() {
    try {
      const r = await fetch('/api/admin');
      if (r.status === 401) {
        location.assign('/admin/login');
        return;
      }
      const body = (await r.json()) as { error?: string; rsvps: Row[]; invitations: Invite[] };
      if (!r.ok) throw Error(body.error);
      setData(body);
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to load guest list.');
    }
  }
  useEffect(() => {
    load();
  }, []);
  const responses = data?.rsvps || [];
  const pending = (data?.invitations || []).filter(
    (i) => !responses.some((r) => r.invitation_code === i.code),
  );
  const rows: Row[] = [
    ...responses,
    ...pending.map((i) => ({
      id: i.id,
      full_name: i.full_name,
      email: i.email,
      phone: '',
      response: 'pending',
      party_size: 0,
      guest_names: '',
      dietary_requirements: '',
      message: '',
      invitation_code: i.code,
      submitted_at: '',
      code: i.code,
    })),
  ];
  const accepted = responses.filter((r) => r.response === 'accepted');
  const guests = accepted.reduce((s, r) => s + r.party_size, 0);
  const dietary = accepted.filter((r) => r.dietary_requirements.trim());
  const visible = rows.filter(
    (r) =>
      (filter === 'all' ||
        filter === r.response ||
        (filter === 'dietary' && !!r.dietary_requirements) ||
        (filter === 'plus' && r.party_size > 1)) &&
      [r.full_name, r.email, r.phone, r.guest_names]
        .join(' ')
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  function csv() {
    const keys = [
      'full_name',
      'email',
      'phone',
      'response',
      'party_size',
      'guest_names',
      'dietary_requirements',
      'submitted_at',
    ] as const;
    const safe = (v: unknown) => {
      let s = String(v ?? '');
      if (/^[\s]*[=+@-]/.test(s)) s = "'" + s;
      return '"' + s.replaceAll('"', '""') + '"';
    };
    const text = [
      keys.join(','),
      ...visible.map((r) => keys.map((k) => safe(r[k])).join(',')),
    ].join('\r\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob(['\uFEFF' + text], { type: 'text/csv;charset=utf-8' }));
    a.download = 'merveille-guest-list.csv';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  async function add(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    const form = e.currentTarget;
    try {
      const r = await fetch('/api/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(Object.fromEntries(new FormData(form))),
      });
      const b = (await r.json()) as { error?: string; code: string };
      if (!r.ok) throw Error(b.error);
      setLink(location.origin + '/?code=' + b.code);
      form.reset();
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to add guest');
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="admin">
      <a href="/">← Back to the invitation</a>
      <div className="admin-top">
        <div>
          <span className="eyebrow">PROPHETESS MERVEILLE · SEPTEMBER 18–19</span>
          <h1>The guest list</h1>
        </div>
        <Button onClick={csv} disabled={!data}>
          Export CSV
        </Button>
      </div>
      {error && (
        <div className="error" role="alert">
          {error} <Button onClick={load}>Retry</Button>
        </div>
      )}
      {!data && !error && <p>Loading your guest list…</p>}
      {data && (
        <>
          <div className="metrics">
            {[
              ['Total invitations', data.invitations.length],
              ['Total responses', responses.length],
              ['Accepted invitations', accepted.length],
              ['Declined invitations', responses.length - accepted.length],
              ['Pending invitations', pending.length],
              ['Expected attendees', guests],
              ['Total plus-ones', accepted.reduce((s, r) => s + Math.max(0, r.party_size - 1), 0)],
              ['Dietary restriction responses', dietary.length],
            ].map(([label, value]) => (
              <div className="metric" key={label}>
                <span>{label}</span>
                <strong>{value}</strong>
              </div>
            ))}
          </div>
          <p>
            Invitation counts come from your registered guest list. Responses to the general
            invitation link are also included in attendance totals.
          </p>
          <form className="admin-add" onSubmit={add}>
            <h2 style={{ fontSize: 25 }}>Add an invited guest</h2>
            <div className="form-row">
              <label>
                Guest name
                <Input name="full_name" required maxLength={120} />
              </label>
              <label>
                Email (optional)
                <Input name="email" type="email" maxLength={254} />
              </label>
              <Button disabled={busy}>{busy ? 'Adding…' : 'Create invitation link'}</Button>
            </div>
            {link && (
              <p role="status">
                Share this invitation with your guest: <a href={link}>{link}</a>
              </p>
            )}
          </form>
          <div className="admin-controls">
            <Input
              aria-label="Search guests"
              placeholder="Search by name, email or phone"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <select
              aria-label="Filter guests"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            >
              <option value="all">All guests</option>
              <option value="accepted">Accepted</option>
              <option value="declined">Declined</option>
              <option value="pending">Pending</option>
              <option value="dietary">Dietary restrictions</option>
              <option value="plus">Plus-ones</option>
            </select>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  {[
                    'Guest name',
                    'Email',
                    'Phone',
                    'RSVP status',
                    'Party size',
                    'Guest names',
                    'Dietary requirements',
                    'Submission date',
                    'Message',
                    'Invitation',
                  ].map((t) => (
                    <th key={t}>{t}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visible.map((r) => (
                  <tr key={r.id}>
                    <td>{r.full_name}</td>
                    <td>{r.email || '—'}</td>
                    <td>{r.phone || '—'}</td>
                    <td>{r.response}</td>
                    <td>{r.party_size || '—'}</td>
                    <td>{r.guest_names || '—'}</td>
                    <td>{r.dietary_requirements || '—'}</td>
                    <td>{r.submitted_at ? new Date(r.submitted_at).toLocaleDateString() : '—'}</td>
                    <td>{r.message || '—'}</td>
                    <td>
                      {r.invitation_code ? (
                        <a href={'/?code=' + r.invitation_code}>Open link</a>
                      ) : (
                        'General link'
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!visible.length && (
              <p className="empty">
                {rows.length
                  ? 'No guests match this search.'
                  : 'No responses yet. Add your invited guests to begin planning.'}
              </p>
            )}
          </div>
          <section className="planning">
            <h2>Planning summary</h2>
            <p>
              <strong>{guests} expected guests</strong> across {accepted.length} accepted
              invitations.
            </p>
            <h3>Dietary requirements</h3>
            {dietary.length ? (
              dietary.map((r) => (
                <p key={r.id}>
                  <strong>{r.full_name}</strong> (party of {r.party_size}): {r.dietary_requirements}
                </p>
              ))
            ) : (
              <p>No dietary requirements reported.</p>
            )}
          </section>
        </>
      )}
    </main>
  );
}
