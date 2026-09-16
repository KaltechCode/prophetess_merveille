import 'server-only';
import nodemailer from 'nodemailer';

export type RsvpNotice = {
  full_name: string;
  email: string;
  phone: string;
  response: 'accepted' | 'declined';
  party_size: number;
  guest_names: string;
  dietary_requirements: string;
  message: string;
};

const ADMIN_INBOX = process.env.NOTIFY_EMAIL?.trim() || 'notification@merveille.kaltechconsultancy.tech';
const PURPLE = '#321843';
const GOLD = '#a78349';
const CREAM = '#fffcf7';
const LAVENDER = '#eee8f0';
const HEADING = '#32213d';
const MUTED = '#77677e';

function mailConfigured(): boolean {
  return Boolean(process.env.MAIL_HOST && process.env.MAIL_USER && process.env.MAIL_PASS);
}

function escapeHtml(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

function origin(): string {
  return (process.env.APP_ORIGIN || '').replace(/\/$/, '');
}

function celebrationIcs(): string {
  const events = [
    {
      day: 18,
      start: '20260919T000000Z',
      end: null as string | null,
      time: 'September 18 at 7 PM Central Time.',
    },
    {
      day: 19,
      start: '20260919T163000Z',
      end: '20260919T213000Z',
      time: 'September 19 from 11:30 AM to 4:30 PM Central Time.',
    },
  ];
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Merveille Celebration//EN',
    ...events.flatMap((e) => [
      'BEGIN:VEVENT',
      `UID:merveille-202609${e.day}@celebration`,
      'DTSTAMP:20260916T000000Z',
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
}

function iconCircle(kind: 'check' | 'heart' | 'notice'): string {
  const mark = kind === 'heart' ? '♥' : kind === 'notice' ? '✦' : '✓';
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto 24px;">
    <tr>
      <td width="60" height="60" align="center" valign="middle" style="width:60px;height:60px;border:1px solid ${GOLD};border-radius:50%;color:${GOLD};font-size:22px;line-height:60px;font-family:Georgia,'Times New Roman',serif;">${mark}</td>
    </tr>
  </table>`;
}

function card(inner: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<body style="margin:0;padding:0;background:${LAVENDER};font-family:Arial,Helvetica,sans-serif;color:${HEADING};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${LAVENDER};padding:36px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:${CREAM};padding:48px 40px 52px;">
          <tr><td align="center" style="text-align:center;">${inner}</td></tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function button(href: string, label: string): string {
  if (!href) return '';
  return `<a href="${escapeHtml(href)}" style="display:inline-block;background:${PURPLE};color:#fff9ed;text-decoration:none;font-size:15px;padding:16px 28px;margin-top:8px;">${escapeHtml(label)}</a>`;
}

function guestHtml(rsvp: RsvpNotice): string {
  const yes = rsvp.response === 'accepted';
  const name = escapeHtml(rsvp.full_name);
  const details = yes
    ? `<p style="font-size:14px;line-height:1.8;color:${HEADING};margin:24px 0;">
        September 18, 2026 · 7:00 PM CT<br/>
        September 19, 2026 · 11:30 AM–4:30 PM CT<br/>
        Hampton Inn &amp; Suites
      </p>
      ${button(origin(), 'Add to Calendar')}`
    : '';
  return card(`
    ${iconCircle(yes ? 'check' : 'heart')}
    <p style="margin:0 0 8px;font-size:12px;letter-spacing:2.5px;font-weight:600;color:${GOLD};text-transform:uppercase;">Thank you, ${name}</p>
    <h1 style="margin:16px 0 18px;font-family:Georgia,'Times New Roman',serif;font-weight:400;font-size:36px;line-height:1.2;color:${HEADING};">
      ${yes ? 'You’re on the guest list.' : 'Your message is received.'}
    </h1>
    <p style="margin:0;font-size:16px;line-height:1.7;color:${MUTED};">
      ${
        yes
          ? 'Your RSVP is confirmed. We can’t wait to celebrate with you.'
          : 'Thank you for letting us know. We’ll miss celebrating with you.'
      }
    </p>
    ${details}
  `);
}

function guestText(rsvp: RsvpNotice): string {
  const yes = rsvp.response === 'accepted';
  return [
    `Thank you, ${rsvp.full_name}`,
    yes ? 'You’re on the guest list.' : 'Your message is received.',
    yes
      ? 'Your RSVP is confirmed. We can’t wait to celebrate with you.'
      : 'Thank you for letting us know. We’ll miss celebrating with you.',
    ...(yes
      ? [
          '',
          'September 18, 2026 · 7:00 PM CT',
          'September 19, 2026 · 11:30 AM–4:30 PM CT',
          'Hampton Inn & Suites',
        ]
      : []),
  ].join('\n');
}

function detailLine(label: string, value: string): string {
  const display = value.trim() || '—';
  return `<tr>
    <td style="padding:10px 0;border-bottom:1px solid #e4dbce;text-align:left;font-size:13px;color:${MUTED};width:42%;">${escapeHtml(label)}</td>
    <td style="padding:10px 0;border-bottom:1px solid #e4dbce;text-align:left;font-size:14px;color:${HEADING};">${escapeHtml(display)}</td>
  </tr>`;
}

function adminHtml(rsvp: RsvpNotice): string {
  const yes = rsvp.response === 'accepted';
  const name = escapeHtml(rsvp.full_name);
  const extra = yes
    ? `${detailLine('Party size', String(rsvp.party_size))}
       ${detailLine('Guest names', rsvp.guest_names)}
       ${detailLine('Dietary requirements', rsvp.dietary_requirements)}`
    : '';
  return card(`
    ${iconCircle('notice')}
    <p style="margin:0 0 8px;font-size:12px;letter-spacing:2.5px;font-weight:600;color:${GOLD};text-transform:uppercase;">New RSVP · Prophetess Merveille</p>
    <h1 style="margin:16px 0 18px;font-family:Georgia,'Times New Roman',serif;font-weight:400;font-size:32px;line-height:1.2;color:${HEADING};">
      ${name} has ${yes ? 'accepted.' : 'declined.'}
    </h1>
    <p style="margin:0 0 28px;font-size:16px;line-height:1.7;color:${MUTED};">
      ${
        yes
          ? 'A guest is on the list. Open the dashboard to review party size, plus-ones and any notes.'
          : 'This guest will not be attending. Their response is saved on the guest list.'
      }
    </p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="text-align:left;margin:0 auto 28px;">
      ${detailLine('Guest name', rsvp.full_name)}
      ${detailLine('Email', rsvp.email)}
      ${detailLine('Phone', rsvp.phone)}
      ${detailLine('RSVP', yes ? 'Accepted' : 'Declined')}
      ${extra}
      ${detailLine('Message', rsvp.message)}
    </table>
    ${button(`${origin()}/admin`, 'Open guest list')}
  `);
}

function adminText(rsvp: RsvpNotice): string {
  const yes = rsvp.response === 'accepted';
  return [
    `New RSVP: ${rsvp.full_name} has ${yes ? 'accepted' : 'declined'}.`,
    `Email: ${rsvp.email || '—'}`,
    `Phone: ${rsvp.phone || '—'}`,
    `Status: ${yes ? 'Accepted' : 'Declined'}`,
    ...(yes
      ? [
          `Party size: ${rsvp.party_size}`,
          `Guest names: ${rsvp.guest_names || '—'}`,
          `Dietary requirements: ${rsvp.dietary_requirements || '—'}`,
        ]
      : []),
    `Message: ${rsvp.message || '—'}`,
  ].join('\n');
}

async function sendMail(options: {
  to: { name?: string; address: string };
  subject: string;
  html: string;
  text: string;
  ics?: boolean;
}): Promise<void> {
  if (!mailConfigured()) return;
  const port = Number(process.env.MAIL_PORT || 465);
  const fromName = process.env.MAIL_FROM_NAME?.trim() || 'Prophetess Merveille';
  const fromAddress = process.env.MAIL_FROM?.trim() || process.env.MAIL_USER || '';
  const transporter = nodemailer.createTransport({
    host: process.env.MAIL_HOST,
    port,
    secure: port === 465,
    connectionTimeout: 10000,
    socketTimeout: 10000,
    auth: {
      user: process.env.MAIL_USER,
      pass: process.env.MAIL_PASS,
    },
    tls: {
      rejectUnauthorized: false,
    },
  });
  await transporter.sendMail({
    from: `${fromName} <${fromAddress}>`,
    to: options.to.name ? `${options.to.name} <${options.to.address}>` : options.to.address,
    subject: options.subject,
    html: options.html,
    text: options.text,
    attachments: options.ics
      ? [
          {
            filename: 'merveille-celebration.ics',
            content: celebrationIcs(),
            contentType: 'text/calendar; charset=utf-8',
          },
        ]
      : undefined,
  });
}

export async function sendRsvpNotifications(rsvp: RsvpNotice): Promise<void> {
  const tasks: Promise<void>[] = [
    sendMail({
      to: { name: 'Celebration organizer', address: ADMIN_INBOX },
      subject:
        rsvp.response === 'accepted'
          ? `${rsvp.full_name} accepted the invitation`
          : `${rsvp.full_name} declined the invitation`,
      html: adminHtml(rsvp),
      text: adminText(rsvp),
    }),
  ];
  if (rsvp.email) {
    tasks.push(
      sendMail({
        to: { name: rsvp.full_name, address: rsvp.email },
        subject:
          rsvp.response === 'accepted'
            ? 'You’re on the guest list — Prophetess Merveille'
            : 'Your RSVP was received — Prophetess Merveille',
        html: guestHtml(rsvp),
        text: guestText(rsvp),
        ics: rsvp.response === 'accepted',
      }),
    );
  }
  const results = await Promise.allSettled(tasks);
  for (const result of results) {
    if (result.status === 'rejected') console.error('RSVP email failed');
  }
}
