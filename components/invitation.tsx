'use client';
import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { CalendarDays, MapPin, Clock, ArrowUpRight, Heart, Check, Mail } from 'lucide-react';

export function CelebrantPortrait() {
  return (
    <img
      src="/merveille-portrait.webp"
      alt="Prophetess Merveille wearing a purple and gold dress at her celebration"
      width="1149"
      height="1369"
      fetchPriority="high"
    />
  );
}
export function EnvelopeAnimation({ done }: { done: () => void }) {
  const [phase, setPhase] = useState('closed');
  useEffect(() => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
      done();
      return;
    }
    const timers = [
      setTimeout(() => setPhase('opening'), 2000),
      setTimeout(() => setPhase('message'), 5600),
      setTimeout(() => setPhase('leaving'), 7600),
      setTimeout(done, 9600),
    ];
    return () => timers.forEach(clearTimeout);
  }, [done]);
  return (
    <div className={'intro ' + phase} role="dialog" aria-label="Your invitation">
      <div className="intro-label">A SPECIAL INVITATION FOR YOU</div>
      <div className="envelope">
        <div className="envelope-back" />
        <div className="portrait-card">
          <CelebrantPortrait />
        </div>
        <div className="envelope-front" />
        <div className="flap" />
        <span className="seal">M</span>
      </div>
      <div className="intro-message">
        <h1>
          Prophetess Merveille <br /> invites You <br /> To,
        </h1>
        <p>My Amazing Birthday Celebrations By God's Grace Along with my 10 YEARS in MINISTRY.</p>
      </div>
      <button className="skip" onClick={done}>
        Skip to invitation <ArrowUpRight size={14} />
      </button>
    </div>
  );
}
export function InvitationDetails() {
  return (
    <section className="details" id="details">
      <div className="section-intro">
        <span className="eyebrow">THE CELEBRATION</span>
        <h2>
          Two beautiful days.
          <br />
          <em>A heart full of gratitude.</em>
        </h2>
        <p>
          Join us in thanksgiving as we celebrate Prophetess Merveille’s birthday and 10 years in
          ministry, by God’s grace.
        </p>
      </div>
      <div className="detail-grid">
        <article>
          <CalendarDays />
          <span>THE DATE</span>
          <h3>September 18–19</h3>
          <p>Friday & Saturday, 2026</p>
        </article>
        <article>
          <Clock />
          <span>THE TIME</span>
          <h3 className="event-times">
            Sept. 18 · 7:00 PM
            <br />
            Sept. 19 · 11:30 AM–4:30 PM
          </h3>
          <p>All times Central Time</p>
        </article>
        <article>
          <MapPin />
          <span>THE PLACE</span>
          <h3>Hampton Inn & Suites</h3>
          <p>Full address to be announced</p>
        </article>
      </div>
      <div className="dress">
        <span>DRESS CODE</span>
        <p>
          White & blue <i>or</i> purple
        </p>
        <div className="swatches">
          <b />
          <b />
          <b />
        </div>
        <small>A touch of elegance, a spirit of celebration.</small>
      </div>
    </section>
  );
}
function calendar() {
  const events = [
    { day: 18, start: '20260919T000000Z', end: null, time: 'September 18 at 7 PM Central Time.' },
    {
      day: 19,
      start: '20260919T163000Z',
      end: '20260919T213000Z',
      time: 'September 19 from 11:30 AM to 4:30 PM Central Time.',
    },
  ];
  const content = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Merveille Celebration//EN',
    ...events.flatMap((e) => [
      'BEGIN:VEVENT',
      `UID:merveille-202609${e.day}@celebration`,
      `DTSTAMP:20260916T000000Z`,
      'SEQUENCE:1',
      `DTSTART:${e.start}`,
      ...(e.end ? [`DTEND:${e.end}`] : []),
      'SUMMARY:Prophetess Merveille’s Thanksgiving & Birthday Celebration',
      'LOCATION:Hampton Inn & Suites - full address to be announced',
      `DESCRIPTION:Birthday and 10 years in ministry. ${e.time}`,
      'END:VEVENT',
    ]),
    'END:VCALENDAR',
  ].join('\r\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([content], { type: 'text/calendar' }));
  a.download = 'merveille-celebration.ics';
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
export function Confirmation({ name, yes }: { name: string; yes: boolean }) {
  return (
    <div className="confirmation" role="status">
      <div className="confirmation-icon">{yes ? <Check /> : <Heart />}</div>
      <span className="eyebrow">THANK YOU, {name}</span>
      <h2>{yes ? 'You’re on the guest list.' : 'Your message is received.'}</h2>
      <p>
        {yes
          ? "Your RSVP is confirmed. We can't wait to celebrate with you."
          : "Thank you for letting us know. We'll miss celebrating with you."}
      </p>
      {yes && (
        <>
          <div className="confirmation-details">
            September 18, 2026 · 7:00 PM CT
            <br />
            September 19, 2026 · 11:30 AM–4:30 PM CT
            <br />
            Hampton Inn & Suites
          </div>
          <Button className="primary-button" onClick={calendar}>
            <CalendarDays /> Add to Calendar
          </Button>
        </>
      )}
    </div>
  );
}
export function RSVPForm() {
  const [response, setResponse] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [confirmed, setConfirmed] = useState<{ name: string; yes: boolean } | null>(null);
  const requestId = useRef('');
  const lock = useRef(false);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (lock.current) return;
    if (!response) {
      setError('Please let us know whether you can attend.');
      return;
    }
    lock.current = true;
    setBusy(true);
    setError('');
    const data = Object.fromEntries(new FormData(e.currentTarget));
    requestId.current ||= crypto.randomUUID();
    try {
      const res = await fetch('/api/rsvp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...data,
          response,
          id: requestId.current,
          invitation_code: new URLSearchParams(location.search).get('code') || null,
        }),
      });
      const result = (await res.json()) as { error?: string };
      if (!res.ok) throw Error(result.error || 'Unable to save your RSVP. Please try again.');
      setConfirmed({ name: String(data.full_name), yes: response === 'accepted' });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setBusy(false);
      lock.current = false;
    }
  }
  return (
    <section className="rsvp-section" id="rsvp">
      <div className="rsvp-heading">
        <span className="eyebrow">A SEAT SAVED FOR YOU</span>
        <h2>Will you join us?</h2>
        <p>Your presence would make this celebration even more special.</p>
        <div className="deadline">
          <Mail size={17} /> Kindly respond by September 17, 2026
        </div>
      </div>
      <div className="rsvp-card">
        {confirmed ? (
          <Confirmation {...confirmed} />
        ) : (
          <form onSubmit={submit}>
            <div className="form-head">
              <h3>Your RSVP</h3>
              <span>Fields marked * are required</span>
            </div>
            <label>
              Full name *
              <Input
                name="full_name"
                placeholder="Your full name"
                required
                maxLength={120}
                autoComplete="name"
              />
            </label>
            <div className="form-row">
              <label>
                Email address
                <Input
                  name="email"
                  type="email"
                  placeholder="you@example.com"
                  maxLength={254}
                  autoComplete="email"
                />
              </label>
              <label>
                Phone number
                <Input
                  name="phone"
                  type="tel"
                  placeholder="Your phone number"
                  maxLength={40}
                  autoComplete="tel"
                />
              </label>
            </div>
            <fieldset>
              <legend>Can you celebrate with us? *</legend>
              <div className="response-options">
                {[
                  ['accepted', 'Yes, I’ll be there'],
                  ['declined', 'Unfortunately, I can’t attend'],
                ].map(([value, text]) => (
                  <label key={value} className={response === value ? 'selected' : ''}>
                    <input
                      type="radio"
                      name="attendance"
                      value={value}
                      required
                      checked={response === value}
                      onChange={() => setResponse(value)}
                    />
                    {text}
                  </label>
                ))}
              </div>
            </fieldset>
            {response === 'accepted' && (
              <div className="conditional">
                <div className="form-row">
                  <label>
                    Number attending (including you)
                    <Input
                      name="party_size"
                      type="number"
                      min={1}
                      max={20}
                      defaultValue={1}
                      required
                    />
                  </label>
                  <label>
                    Guest names
                    <Input
                      name="guest_names"
                      placeholder="Names of accompanying guests"
                      maxLength={1000}
                    />
                  </label>
                </div>
                <label>
                  Dietary requirements
                  <Textarea
                    name="dietary_requirements"
                    placeholder="Please share any allergies or dietary needs"
                    maxLength={1000}
                  />
                </label>
              </div>
            )}
            {response && (
              <label>
                Leave a message for Prophetess Merveille <span>(optional)</span>
                <Textarea
                  name="message"
                  placeholder="A birthday wish, a prayer, a little love…"
                  maxLength={2000}
                />
              </label>
            )}
            {error && (
              <p className="error" role="alert">
                {error}
              </p>
            )}
            <Button className="primary-button submit" disabled={busy}>
              {busy ? 'Confirming your RSVP…' : 'Confirm RSVP'}
              {!busy && <ArrowUpRight size={18} />}
            </Button>
            <p className="privacy">
              Your details are shared only with the celebration’s organizer.
            </p>
          </form>
        )}
      </div>
    </section>
  );
}
export default function Home() {
  const [intro, setIntro] = useState(true);
  const finish = useRef(() => setIntro(false)).current;
  return (
    <>
      <link rel="preload" as="image" href="/merveille-portrait.webp" />
      {intro && <EnvelopeAnimation done={finish} />}
      <div className={'site ' + (intro ? 'waiting' : 'revealed')} inert={intro ? true : undefined}>
        <header>
          <a className="monogram" href="#">
            M<span>THE CELEBRATION</span>
          </a>
          <nav>
            <a href="#details">The occasion</a>
            <a href="#rsvp" className="nav-rsvp">
              Kindly RSVP <ArrowUpRight size={15} />
            </a>
          </nav>
        </header>
        <main>
          <section className="hero">
            <div className="hero-copy">
              <span className="eyebrow">THANKSGIVING & BIRTHDAY CELEBRATION</span>
              <p className="celebrating">Celebrating</p>
              <h1>
                <span>Prophetess</span>
                <em>Merveille</em>
              </h1>
              <div className="gold-rule" />
              <p className="hero-description">
                A celebration of life.
                <br />A decade of grace.
                <br />
                So many reasons to give thanks.
              </p>
              <div className="hero-date">
                SEPTEMBER 18–19, 2026
                <br />
                <span className="hero-times">
                  FRIDAY · 7 PM CT
                  <br />
                  SATURDAY · 11:30 AM–4:30 PM CT
                </span>
              </div>
              <a className="hero-cta" href="#rsvp">
                With joy, I’ll respond <ArrowUpRight size={18} />
              </a>
              <button className="replay" onClick={() => setIntro(true)}>
                Open the invitation again
              </button>
            </div>
            <div className="hero-art">
              <div className="arch-photo">
                <CelebrantPortrait />
              </div>
              <div className="anniversary">
                <span>10</span>
                <div>
                  YEARS
                  <br />
                  IN MINISTRY
                </div>
              </div>
              <div className="photo-caption">By God’s grace, with a grateful heart.</div>
            </div>
          </section>
          <div className="ribbon">
            <span>FAITH</span>
            <b>✦</b>
            <span>GRATITUDE</span>
            <b>✦</b>
            <span>LOVE</span>
            <b>✦</b>
            <span>CELEBRATION</span>
          </div>
          <InvitationDetails />
          <RSVPForm />
          <section className="closing">
            <span className="monogram-letter">M</span>
            <h2>With love & a grateful heart.</h2>
            <p>Prophetess Merveille</p>
            <span>WE LOOK FORWARD TO CELEBRATING WITH YOU</span>
          </section>
        </main>
        <footer>
          <span>September 18–19, 2026</span>
          <a href="/admin">Organizer access</a>
        </footer>
      </div>
    </>
  );
}
