import { NextResponse } from "next/server";
import { ENRICHED_IMPORT_HEADERS } from "@/lib/admin/listing-importer-core.mjs";
import { requireImportAdmin } from "@/lib/admin/listing-importer-server";

export async function GET() {
  const context = await requireImportAdmin();
  if ("response" in context) return context.response;

  const csv = `${ENRICHED_IMPORT_HEADERS.join(",")}\n`;

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": "attachment; filename=travel-markets-landlord-import-template.csv",
    },
  });
}
