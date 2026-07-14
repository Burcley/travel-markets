import { NextRequest } from "next/server";
import { POST as createBoostCheckout } from "@/app/api/listings/boost/checkout/route";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const forwarded = new NextRequest(request.url, {
    method: "POST",
    headers: request.headers,
    body: JSON.stringify({
      listingId: body?.listingId,
      option: "boost_7_day",
    }),
  });

  return createBoostCheckout(forwarded);
}
