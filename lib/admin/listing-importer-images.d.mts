export type ImportImageUpload<TFile = File> = {
  key: string;
  name: string;
  file: TFile;
};

export function imageUploadKey(file: {
  name?: string;
  size?: number;
  lastModified?: number;
}): string;

export function makeUniqueImageName(
  fileName: string,
  usedNames?: Set<string>
): string;

export function appendImageUploads<TFile extends { name?: string; size?: number; lastModified?: number; type?: string }>(
  currentImages?: Array<ImportImageUpload<TFile>>,
  files?: TFile[]
): {
  images: Array<ImportImageUpload<TFile>>;
  addedImages: Array<ImportImageUpload<TFile>>;
  duplicateCount: number;
};

export function suggestImageAssignmentsForRows(
  rows?: Array<{
    fingerprint: string;
    property?: string | null;
    streetAddress?: string | null;
  }>,
  imageNames?: string[],
  currentAssignments?: Record<string, string[]>
): Record<string, string[]>;
