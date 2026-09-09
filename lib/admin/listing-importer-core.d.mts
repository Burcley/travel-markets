export const LANDLORD_IMPORT_HEADERS: string[];
export const ENRICHED_IMPORT_HEADERS: string[];
export const LISTING_DRAFT_INSERT_COLUMNS: string[];

export type RawImportRow = {
  rowNumber?: number | null;
  row?: Record<string, unknown>;
  [key: string]: unknown;
};

export type NormalizedImportRow = {
  rowNumber: number | null;
  importFormat: string;
  property: string | null;
  streetAddress: string | null;
  city: string | null;
  province: string | null;
  postalCode: string | null;
  roomsAvailable: number | null;
  unit: string | null;
  rent: number | null;
  arrangement: string | null;
  genderPreference: string | null;
  utilitiesIncluded: boolean | null;
  internetIncluded: boolean | null;
  availability: string | null;
  totalRooms: number | null;
  bathrooms: number | null;
  listingTitle: string | null;
  description: string | null;
  sourceVerificationNotes: string | null;
  sourceUrl: string | null;
  completenessScore: number;
  fingerprint: string;
  warnings: string[];
};

export function parseCurrency(value: unknown): number | null;
export function parseCount(value: unknown): number | null;
export function parseBoolean(value: unknown): boolean | null;
export function normalizeNullableText(value: unknown): string | null;
export function rowsFromSheetJson(
  sheetRows: unknown[],
  options?: {
    useTemplateOrder?: boolean;
    importFormat?: "legacy-template" | "legacy-header" | "enriched" | "unknown-header";
  }
): Array<{
  row: Record<string, unknown>;
  rowNumber: number;
  importFormat: "legacy-template" | "legacy-header" | "enriched";
}>;
export function detectImportFormat(
  sheetRows: unknown[],
  options?: { useTemplateOrder?: boolean }
): "legacy-template" | "legacy-header" | "enriched" | "unknown-header";
export function validateEnrichedHeaders(sheetRows: unknown[]): {
  valid: boolean;
  missingHeaders: string[];
};
export function importRowBlockingError(row: Partial<NormalizedImportRow>): string | null;
export function importButtonState(args?: {
  selectedLandlord?: unknown;
  preview?: unknown;
  rows?: Array<Partial<NormalizedImportRow> & { fingerprint: string }>;
  selectedFingerprints?: Set<string> | string[];
  importing?: boolean;
}): {
  disabled: boolean;
  reason: string;
  selectedValidRows: Array<Partial<NormalizedImportRow> & { fingerprint: string }>;
  blockingErrorCount: number;
};
export function collectAssignedImportImages(args?: {
  rows?: Array<Partial<NormalizedImportRow> & { fingerprint?: string }>;
  imageAssignments?: Record<string, string[]>;
  imageFiles?: Array<
    | string
    | {
        name?: string | null;
        type?: string | null;
        size?: number | null;
      }
  >;
}): Array<{
  rowFingerprint: string;
  imageName: string;
  sortOrder: number;
  isCover: boolean;
  contentType: string | null;
  size: number | null;
}>;
export function schemaCompatibleListingInsertPayload(payload: Record<string, unknown>): Record<string, unknown>;
export function parseSpreadsheetBuffer(args: {
  buffer: Buffer;
  fileName?: string;
  useTemplateOrder?: boolean;
}): Promise<{
  sourceRows: RawImportRow[];
  uniqueRows: NormalizedImportRow[];
  skippedRows: Array<{ row: NormalizedImportRow; reason: string }>;
  importFormat: "legacy-template" | "legacy-header" | "enriched";
  summary: {
    rowsDetected: number;
    uniqueRows: number;
    skippedRows: number;
    duplicateRows: number;
    incompleteDuplicateRows: number;
    warningRows: number;
  };
}>;
export function normalizeImportRow(row: RawImportRow): NormalizedImportRow;
export function normalizeImportRows(rows: RawImportRow[]): NormalizedImportRow[];
export function dedupeImportRows(rows: RawImportRow[]): {
  unique: NormalizedImportRow[];
  skipped: Array<{ row: NormalizedImportRow; reason: string }>;
};
export function fingerprintImportRow(row: Partial<NormalizedImportRow>): string;
export function generateListingTitle(row: NormalizedImportRow): string;
export function generateListingDescription(row: NormalizedImportRow): string;
export function suggestImageMatches(
  rows: NormalizedImportRow[],
  imageNames?: string[]
): Record<string, string[]>;
export function buildDraftListingPayload(args: {
  ownerId: string;
  row: NormalizedImportRow;
  city?: string;
  province?: string;
}): Record<string, unknown>;
export function summarizePreview(args: {
  sourceRows: RawImportRow[];
  uniqueRows: NormalizedImportRow[];
  skippedRows: Array<{ row: NormalizedImportRow; reason: string }>;
}): {
  rowsDetected: number;
  uniqueRows: number;
  skippedRows: number;
  duplicateRows: number;
  incompleteDuplicateRows: number;
  warningRows: number;
};
