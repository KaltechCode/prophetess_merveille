const required = [
  'APP_ORIGIN',
  'SUPABASE_URL',
  'SUPABASE_PUBLISHABLE_KEY',
  'SUPABASE_SECRET_KEY',
  'ADMIN_USER_ID',
  'RATE_LIMIT_SECRET',
];
const problems = [];
for (const key of required)
  if (!process.env[key] || /REPLACE|YOUR_PROJECT|example\.com/.test(process.env[key]))
    problems.push(key + ' is missing or still a placeholder');
for (const key of ['APP_ORIGIN', 'SUPABASE_URL']) {
  try {
    const u = new URL(process.env[key]);
    if (u.protocol !== 'https:') problems.push(key + ' must use HTTPS in production');
    if (key === 'APP_ORIGIN' && u.origin !== process.env[key])
      problems.push('APP_ORIGIN must be an origin without a path or trailing slash');
  } catch {
    problems.push(key + ' is not a valid URL');
  }
}
if (!/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(process.env.ADMIN_USER_ID || ''))
  problems.push('ADMIN_USER_ID must be a Supabase Auth user UUID');
if ((process.env.RATE_LIMIT_SECRET || '').length < 32)
  problems.push('RATE_LIMIT_SECRET must contain at least 32 characters');
if (problems.length) {
  console.error(problems.join('\n'));
  process.exit(1);
}
console.log('Required runtime configuration is present. Values were not printed.');
