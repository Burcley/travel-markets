import { NextResponse } from "next/server";
import { parseSpreadsheetFile, requireImportAdmin } from "@/lib/admin/listing-importer-server";
import { suggestImageMatches } from "@/lib/admin/listing-importer-core.mjs";

export async function POST(request: Request) {
  const context = await requireImportAdmin();
  if ("response" in context) return context.response;

  const formData = await request.formData();
  const file = formData.get("spreadsheet");
  const useTemplateOrder = formData.get("useTemplateOrder") === "true";
  const imageNames = formData
    .getAll("imageNames")
    .filter((value): value is string => typeof value === "string");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Upload a spreadsheet first." }, { status: 400 });
  }

  try {
    const preview = await parseSpreadsheetFile({ file, useTemplateOrder });

    return NextResponse.json({
      ...preview,
      sourceFilename: file.name,
      imageSuggestions: suggestImageMatches(preview.uniqueRows, imageNames),
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "We could not parse this spreadsheet.",
      },
      { status: 400 }
    );
  }
}
