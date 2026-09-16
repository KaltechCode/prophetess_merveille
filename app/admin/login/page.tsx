'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
export default function Login() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const r = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(Object.fromEntries(new FormData(e.currentTarget))),
      });
      const b = await r.json();
      if (!r.ok) throw Error(b.error);
      location.assign('/admin');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Please try again.');
      setBusy(false);
    }
  }
  return (
    <main className="admin-login">
      <a href="/">← Back to invitation</a>
      <span className="eyebrow">PROPHETESS MERVEILLE’S CELEBRATION</span>
      <h1>Organizer sign-in</h1>
      <p>Sign in to manage RSVPs and prepare your guest list.</p>
      <form onSubmit={submit}>
        <label>
          Email
          <Input name="email" type="email" autoComplete="username" required />
        </label>
        <label>
          Password
          <Input name="password" type="password" autoComplete="current-password" required />
        </label>
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        <Button className="primary-button submit" disabled={busy}>
          {busy ? 'Signing in…' : 'Sign in'}
        </Button>
      </form>
    </main>
  );
}
