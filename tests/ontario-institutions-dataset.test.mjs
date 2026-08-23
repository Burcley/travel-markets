import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(
  new URL("../lib/data/canadian-institutions.ts", import.meta.url),
  "utf8"
);

const institutionIds = [...source.matchAll(/id: "([^"]+)",\n\s+name: "[^"]+",\n\s+type: "([^"]+)",\n\s+province: "Ontario"/g)]
  .map((match) => ({ id: match[1], type: match[2] }));
const campusRows = [...source.matchAll(/\{ id: "([^"]+)", institutionId: "([^"]+)", name: "([^"]+)", city: "([^"]+)", province: "Ontario"/g)]
  .map((match) => ({
    id: match[1],
    institutionId: match[2],
    name: match[3],
    city: match[4],
  }));
const routeDetailIds = new Set(
  [...source.matchAll(/"([^"]+)": \{\n\s+address:/g)].map((match) => match[1])
);

test("centralized Ontario university dataset includes recognized public and associated universities", () => {
  const universityIds = new Set(
    institutionIds
      .filter((institution) => institution.type === "university")
      .map((institution) => institution.id)
  );

  [
    "algoma-university",
    "brock-university",
    "carleton-university",
    "university-of-guelph",
    "lakehead-university",
    "laurentian-university",
    "mcmaster-university",
    "nipissing-university",
    "ocad-university",
    "ontario-tech-university",
    "university-of-ottawa",
    "queens-university",
    "university-of-toronto",
    "toronto-metropolitan-university",
    "trent-university",
    "university-of-waterloo",
    "western-university",
    "wilfrid-laurier-university",
    "university-of-windsor",
    "york-university",
    "royal-military-college-of-canada",
    "nosm-university",
    "universite-de-hearst",
    "universite-de-lontario-francais",
  ].forEach((id) => assert.equal(universityIds.has(id), true, id));
});

test("centralized Ontario college dataset includes major public colleges used for landlord campus search", () => {
  const collegeIds = new Set(
    institutionIds
      .filter((institution) =>
        ["college", "polytechnic"].includes(institution.type)
      )
      .map((institution) => institution.id)
  );

  [
    "durham-college",
    "george-brown-college",
    "humber-college",
    "seneca-polytechnic",
    "sheridan-college",
    "conestoga-college",
    "centennial-college",
    "fanshawe-college",
    "niagara-college",
    "mohawk-college",
    "georgian-college",
    "algonquin-college",
    "st-lawrence-college",
    "fleming-college",
    "loyalist-college",
    "canadore-college",
    "cambrian-college",
    "confederation-college",
    "sault-college",
    "lambton-college",
    "st-clair-college",
    "northern-college",
    "college-boreal",
    "la-cite",
  ].forEach((id) => assert.equal(collegeIds.has(id), true, id));
});

test("institution and campus ids are unique and every campus belongs to an institution", () => {
  const allInstitutionIds = institutionIds.map((institution) => institution.id);
  assert.equal(new Set(allInstitutionIds).size, allInstitutionIds.length);

  const allCampusIds = campusRows.map((campus) => campus.id);
  assert.equal(new Set(allCampusIds).size, allCampusIds.length);

  const institutionIdSet = new Set(allInstitutionIds);
  campusRows.forEach((campus) => {
    assert.equal(
      institutionIdSet.has(campus.institutionId),
      true,
      `${campus.id} references ${campus.institutionId}`
    );
  });
});

test("every centralized Ontario campus record has route-ready location details", () => {
  const routeReadyCampusIds = campusRows
    .filter((campus) => routeDetailIds.has(campus.id))
    .map((campus) => campus.id);

  assert.equal(routeReadyCampusIds.includes("ontario-tech-north-oshawa"), true);
  assert.equal(routeReadyCampusIds.includes("durham-oshawa"), true);
  assert.equal(routeReadyCampusIds.includes("utoronto-st-george"), true);
  assert.equal(routeReadyCampusIds.includes("york-keele"), true);
  assert.equal(routeReadyCampusIds.includes("laurier-waterloo"), true);
  assert.equal(routeReadyCampusIds.length, campusRows.length);
});
