# Travel Markets Auth Email Setup

These files are the branded Travel Markets Supabase Auth templates. Supabase
does not automatically read them from the repository; they must be copied into
the Supabase Dashboard for each environment.

## Required Dashboard Steps

1. Authentication -> Email Templates
   - Confirm signup: use `verification.html`
   - Confirm signup subject: use `verification-subject.txt`
   - Password reset: use `password-reset.html`
   - Magic link: use `magic-link.html` if passwordless login is enabled
   - Email change: use `email-change.html`
   - Invite: use `invite.html` if invites are enabled

2. Authentication -> SMTP Settings
   - Sender name: `Travel Markets`
   - Sender email: `no-reply@travelmarkets.ca`
   - Provider: Resend or the configured production SMTP provider

3. Authentication -> URL Configuration
   - Production site URL: `https://travelmarkets.ca`
   - Add redirect URL: `https://travelmarkets.ca/auth/callback`
   - Add local redirect URL for development: `http://localhost:3000/auth/callback`

4. Phone Auth
   - Configure a Supabase-supported SMS provider before enabling phone
     verification in production.
   - The app will not mark phone numbers verified unless Supabase OTP
     verification succeeds.

## Required Environment Variables

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- Resend/SMTP credentials configured in Supabase Dashboard
