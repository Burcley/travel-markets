# Supabase Auth Send Email Hook -> Resend

This project includes a Resend-backed Supabase Auth Send Email Hook endpoint:

```text
https://travelmarkets.ca/api/auth/send-email-hook
```

It keeps Supabase Auth as the authentication provider, but replaces Supabase's
default Auth email delivery with Resend.

## Sender

```text
Travel Markets <no-reply@travelmarkets.ca>
```

## Required Environment Variables

Set these in the production hosting environment:

```text
RESEND_API_KEY=...
AUTH_EMAIL_FROM=Travel Markets <no-reply@travelmarkets.ca>
SUPABASE_AUTH_SEND_EMAIL_HOOK_SECRET=generate-a-long-random-secret
NEXT_PUBLIC_SITE_URL=https://travelmarkets.ca
```

`AUTH_EMAIL_FROM` is optional in code because the default is already
`Travel Markets <no-reply@travelmarkets.ca>`, but setting it explicitly keeps
deployment configuration clear.

## Supabase Dashboard Steps

1. Go to Supabase Dashboard -> Authentication -> Hooks.
2. Enable the supported Send Email Hook / Custom Send Email Hook for the project.
3. Set the hook URL:

```text
https://travelmarkets.ca/api/auth/send-email-hook
```

4. Configure the hook authorization header:

```text
Authorization: Bearer <SUPABASE_AUTH_SEND_EMAIL_HOOK_SECRET>
```

5. Ensure Auth URL Configuration includes:

```text
Site URL: https://travelmarkets.ca
Redirect URL: https://travelmarkets.ca/auth/callback
```

6. Confirm the Resend domain `travelmarkets.ca` is verified with SPF, DKIM, and
DMARC records.

7. Test every auth email type from Supabase:
   - Signup / email verification
   - Password recovery
   - Email change
   - Invite, if enabled

## Email Types Sent By The Hook

- Email verification
- Password reset
- Email change confirmation
- User invitation

The production email HTML lives in:

```text
lib/email/templates/auth-emails.ts
lib/email/templates/branded-layout.ts
```

The static Supabase Dashboard reference template remains in:

```text
supabase/templates/confirm-signup.html
supabase/templates/confirm-signup-subject.txt
```

## Important

This repository code does not enable the hosted Supabase hook by itself. Auth
emails are delivered through Resend only after the Supabase Dashboard hook is
enabled and the production environment variables are deployed.
