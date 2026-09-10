import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { isBrockAnalyticsEvent, normalizeAcquisitionSource } from "@/lib/brock/analytics";

function safeText(value: unknown, maxLength = 500) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : null;
}

function safeMetadata(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    const eventName = body?.event;

    if (!isBrockAnalyticsEvent(eventName)) {
      return NextResponse.json({ error: "Invalid Brock event." }, { status: 400 });
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const admin = createAdminClient();
    const source = normalizeAcquisitionSource(
      safeText(body?.source || body?.utm_source, 80)
    );

    const { error } = await admin.from("brock_acquisition_events").insert({
      event_name: eventName,
      listing_id: safeText(body?.listingId, 80),
      user_id: user?.id || null,
      session_id: safeText(body?.sessionId, 120),
      source,
      medium: safeText(body?.medium || body?.utm_medium, 120),
      campaign: safeText(body?.campaign || body?.utm_campaign, 160),
      content: safeText(body?.content || body?.utm_content, 160),
      referrer: safeText(body?.referrer, 500),
      landing_page: safeText(body?.landingPage, 500),
      metadata: safeMetadata(body?.metadata),
    });

    if (error) {
      console.error("BROCK ANALYTICS INSERT ERROR:", {
        code: error.code,
        message: error.message,
      });

      return NextResponse.json({ error: "Event could not be recorded." }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("BROCK ANALYTICS ERROR:", error);
    return NextResponse.json({ error: "Event could not be recorded." }, { status: 500 });
  }
}
