function clean(value) {
  if (value == null) return "";
  return String(value).replace(/\s+/g, " ").trim();
}

function compactKey(value) {
  return clean(value).toLowerCase().replace(/\.[a-z0-9]+$/i, "").replace(/[^a-z0-9]+/g, "");
}

export function imageUploadKey(file) {
  return [file?.name || "", file?.size ?? "", file?.lastModified ?? ""].join("|");
}

export function makeUniqueImageName(fileName, usedNames = new Set()) {
  const originalName = clean(fileName) || "image";
  if (!usedNames.has(originalName)) return originalName;

  const extensionMatch = originalName.match(/(\.[a-z0-9]+)$/i);
  const extension = extensionMatch?.[1] || "";
  const baseName = extension ? originalName.slice(0, -extension.length) : originalName;

  let index = 2;
  let candidate = `${baseName} (${index})${extension}`;
  while (usedNames.has(candidate)) {
    index += 1;
    candidate = `${baseName} (${index})${extension}`;
  }

  return candidate;
}

export function appendImageUploads(currentImages = [], files = []) {
  const existingKeys = new Set(currentImages.map((image) => image.key));
  const usedNames = new Set(currentImages.map((image) => image.name));
  const addedImages = [];
  let duplicateCount = 0;

  files.forEach((file) => {
    if (!file || file.size <= 0 || (file.type && !file.type.startsWith("image/"))) {
      return;
    }

    const key = imageUploadKey(file);
    if (existingKeys.has(key)) {
      duplicateCount += 1;
      return;
    }

    const name = makeUniqueImageName(file.name, usedNames);
    const image = { key, name, file };
    existingKeys.add(key);
    usedNames.add(name);
    addedImages.push(image);
  });

  return {
    images: [...currentImages, ...addedImages],
    addedImages,
    duplicateCount,
  };
}

export function suggestImageAssignmentsForRows(rows = [], imageNames = [], currentAssignments = {}) {
  const assigned = new Set(Object.values(currentAssignments).flat());
  const nextAssignments = Object.fromEntries(
    Object.entries(currentAssignments).map(([fingerprint, names]) => [
      fingerprint,
      [...names],
    ])
  );

  rows.forEach((row) => {
    const rowKeys = [row.property, row.streetAddress]
      .map((value) => compactKey(value))
      .filter(Boolean);
    if (!rowKeys.length) return;

    const matches = imageNames.filter((imageName) => {
      if (assigned.has(imageName)) return false;
      const imageKey = compactKey(imageName);
      return rowKeys.some((rowKey) => imageKey.includes(rowKey));
    });

    if (!matches.length) return;

    const existing = nextAssignments[row.fingerprint] || [];
    const additions = matches.filter((imageName) => !existing.includes(imageName));
    nextAssignments[row.fingerprint] = [...existing, ...additions];
    additions.forEach((imageName) => assigned.add(imageName));
  });

  return nextAssignments;
}
