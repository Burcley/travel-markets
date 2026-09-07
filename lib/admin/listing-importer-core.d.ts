export const LANDLORD_IMPORT_HEADERS: string[];

export type RawImportRow = {
  rowNumber?: number | null;
  row?: Record<string, unknown>;
  [key: string]: unknown;
};

export type NormalizedImportRow = {
  rowNumber: number | null;
  property: string | null;
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
  options?: { useTemplateOrder?: boolean }
): Array<{ row: Record<string, unknown>; rowNumber: number }>;
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
