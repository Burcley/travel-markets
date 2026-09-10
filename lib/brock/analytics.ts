export const BROCK_ANALYTICS_EVENTS = [
  "brock_page_view",
  "brock_listing_impression",
  "brock_listing_click",
  "brock_search_started",
  "brock_search_completed",
  "brock_signup_started",
  "brock_signup_completed",
  "brock_listing_saved",
  "brock_message_started",
  "brock_inquiry_sent",
  "brock_viewing_requested",
  "brock_saved_search_created",
  "campus_search_opened",
  "campus_selected",
  "campus_card_clicked",
] as const;

export type BrockAnalyticsEvent = (typeof BROCK_ANALYTICS_EVENTS)[number];

export function isBrockAnalyticsEvent(value: unknown): value is BrockAnalyticsEvent {
  return (
    typeof value === "string" &&
    BROCK_ANALYTICS_EVENTS.includes(value as BrockAnalyticsEvent)
  );
}

export function normalizeAcquisitionSource(value?: string | null) {
  const source = value?.trim().toLowerCase();

  if (!source) return "Direct";
  if (source.includes("instagram")) return "Instagram";
  if (source.includes("tiktok")) return "TikTok";
  if (source.includes("reddit")) return "Reddit";
  if (source.includes("youtube")) return "YouTube";
  if (source === "x" || source.includes("twitter")) return "X";
  if (source.includes("qr")) return "QR";
  if (source.includes("partner")) return "Partner";
  if (source === "direct") return "Direct";

  return "Other";
}
