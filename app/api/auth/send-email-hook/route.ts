import { NextResponse } from "next/server";
import { resend } from "@/lib/email/resend";
import { processSupabaseAuthEmailHook } from "@/lib/email/supabase-auth-hook-core.mjs";
import {
  authEmailHtml,
  authEmailSubject,
} from "@/lib/email/templates/auth-emails";

export async function POST(request: Request) {
  try {
    const rawBody = await request.text();
    const result = await processSupabaseAuthEmailHook({
      rawBody,
      headers: request.headers,
      requestUrl: request.url,
      env: process.env,
      sendEmail: (email: {
        from: string;
        to: string;
        subject: string;
        html: string;
      }) => resend.emails.send(email),
      subjectForKind: authEmailSubject,
      htmlForEmail: authEmailHtml,
    });

    if (result.log) {
      console.error("SUPABASE AUTH EMAIL HOOK MISSING DATA", result.log);
    }

    return NextResponse.json(result.body, { status: result.status });
  } catch (error) {
    console.error("RESEND AUTH EMAIL HOOK ERROR", error);

    return NextResponse.json(
      { error: "Failed to send authentication email." },
      { status: 500 }
    );
  }
}
