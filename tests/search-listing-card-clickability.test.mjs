import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(
  new URL("../components/home/TravelMarketsHome.tsx", import.meta.url),
  "utf8"
);

test("search listing cards expose the visible card body as a listing link", () => {
  const listingLinks = [...source.matchAll(/href=\{`\/listings\/\$\{listing\.id\}`\}/g)];

  assert.ok(
    listingLinks.length >= 2,
    "mobile and desktop listing cards should each have a main listing link"
  );
  assert.match(source, /aria-label=\{`Open listing/);
  assert.match(source, /cursor-pointer/);
  assert.match(source, /focus-visible:ring-2 focus-visible:ring-pink-300/);
});

test("search listing heart controls do not trigger listing navigation", () => {
  assert.match(source, /event\.preventDefault\(\);/);
  assert.match(source, /event\.stopPropagation\(\);/);
  assert.match(source, /toggleSave\(listing\.id, listing\.is_saved\)/);
  assert.match(source, /aria-label=\{listing\.is_saved \? "Remove saved listing" : "Save listing"\}/);
});
