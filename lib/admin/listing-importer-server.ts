import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  dedupeImportRows,
  rowsFromSheetJson,
  summarizePreview,
  type NormalizedImportRow,
} from "@/lib/admin/listing-importer-core.mjs";

type SupabaseAdmin = ReturnType<typeof createAdminClient>;

export type ImportAdminContext =
  | {
      userId: string;
      admin: SupabaseAdmin;
      response?: never;
    }
  | {
      userId?: never;
      admin?: never;
      response: NextResponse;
    };

export async function requireImportAdmin(): Promise<ImportAdminContext> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  const admin = createAdminClient();
  const { data: profile, error } = await admin
    .from("profiles")
    .select("id, role, is_admin, account_status")
    .eq("id", user.id)
    .maybeSingle();

  const isAdmin = profile?.is_admin || profile?.role === "admin";
  const accountStatus = String(profile?.account_status || "active").toLowerCase();

  if (error || !profile || !isAdmin || ["banned", "suspended", "disabled"].includes(accountStatus)) {
    return {
      response: NextResponse.json({ error: "Admin access required." }, { status: 403 }),
    };
  }

  return { userId: user.id, admin };
}

export async function parseSpreadsheetFile({
  file,
  useTemplateOrder,
}: {
  file: File;
  useTemplateOrder: boolean;
}) {
  const extension = file.name.split(".").pop()?.toLowerCase() || "";

  if (!["xlsx", "xls", "csv"].includes(extension)) {
    throw new Error("Upload an XLSX, XLS, or CSV spreadsheet.");
  }

  if (file.size <= 0) {
    throw new Error("The spreadsheet is empty.");
  }

  if (file.size > 5 * 1024 * 1024) {
    throw new Error("Spreadsheet is too large. Keep imports under 5 MB.");
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const XLSX = await import("xlsx");
  const workbook = XLSX.read(buffer, {
    type: "buffer",
    cellDates: false,
    dense: false,
  });

  const firstSheetName = workbook.SheetNames[0];
  const sheet = firstSheetName ? workbook.Sheets[firstSheetName] : null;

  if (!sheet) {
    throw new Error("The spreadsheet does not contain a readable sheet.");
  }

  const sheetRows = XLSX.utils.sheet_to_json(sheet, {
    header: useTemplateOrder ? 1 : undefined,
    defval: "",
    blankrows: false,
  }) as unknown[];

  const sourceRows = rowsFromSheetJson(sheetRows, { useTemplateOrder });
  const { unique, skipped } = dedupeImportRows(sourceRows);

  return {
    sourceRows,
    uniqueRows: unique as NormalizedImportRow[],
    skippedRows: skipped,
    summary: summarizePreview({
      sourceRows,
      uniqueRows: unique,
      skippedRows: skipped,
    }),
  };
}

export function isLandlordProfile(profile: { role?: string | null; is_admin?: boolean | null } | null) {
  const role = String(profile?.role || "").toLowerCase();
  return Boolean(
    profile &&
      !profile.is_admin &&
      ["owner", "landlord", "host", "property_owner", "property_manager"].includes(role)
  );
}
