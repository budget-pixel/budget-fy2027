#!/usr/bin/env node
/* Fetches Census Bureau data for Walton County, FL (and Florida + Okaloosa
   County, FL as comparison geographies), calculates the derived statistics
   used by the Census Narratives Google Sheet's {{placeholder}} templates,
   and writes the result to assets/census-data.json.

   This script is run by .github/workflows/update-census-data.yml (on a
   schedule and on manual workflow_dispatch). It is NOT run in the browser —
   the website only ever reads the static assets/census-data.json this
   script produces, so the Census API key never reaches front-end code.

   Requires Node 18+ (for the built-in `fetch`). Reads CENSUS_API_KEY from
   the environment; the Census API will reject data requests without a key. */

"use strict";

const fs = require("fs");
const path = require("path");

const CENSUS_API_KEY = process.env.CENSUS_API_KEY || "";
const ACS_YEAR = 2022;

const ACS_SUBJECT = "https://api.census.gov/data/" + ACS_YEAR + "/acs/acs5/subject";
const ACS_DETAIL = "https://api.census.gov/data/" + ACS_YEAR + "/acs/acs5";
const ACS_PROFILE = "https://api.census.gov/data/" + ACS_YEAR + "/acs/acs5/profile";
const DEC_2020_PL = "https://api.census.gov/data/2020/dec/pl";
const DEC_2010_SF1 = "https://api.census.gov/data/2010/dec/sf1";

const GEO = {
  // Walton County, FL: state FIPS 12, county FIPS 131.
  walton: { state: "12", county: "131", label: "Walton County, FL" },
  // Florida statewide.
  florida: { state: "12", county: null, label: "Florida" },
  // Okaloosa County, FL: comparison county, state FIPS 12, county FIPS 091.
  okaloosa: { state: "12", county: "091", label: "Okaloosa County, FL" }
};

// Each entry is one 5-year (or terminal) age cohort from ACS Subject table
// S0101 (Age and Sex), used to determine the largest/smallest age group.
const AGE_BRACKETS = [
  { code: "S0101_C01_002E", label: "Under 5 years" },
  { code: "S0101_C01_003E", label: "5 to 9 years" },
  { code: "S0101_C01_004E", label: "10 to 14 years" },
  { code: "S0101_C01_005E", label: "15 to 19 years" },
  { code: "S0101_C01_006E", label: "20 to 24 years" },
  { code: "S0101_C01_007E", label: "25 to 29 years" },
  { code: "S0101_C01_008E", label: "30 to 34 years" },
  { code: "S0101_C01_009E", label: "35 to 39 years" },
  { code: "S0101_C01_010E", label: "40 to 44 years" },
  { code: "S0101_C01_011E", label: "45 to 49 years" },
  { code: "S0101_C01_012E", label: "50 to 54 years" },
  { code: "S0101_C01_013E", label: "55 to 59 years" },
  { code: "S0101_C01_014E", label: "60 to 64 years" },
  { code: "S0101_C01_015E", label: "65 to 69 years" },
  { code: "S0101_C01_016E", label: "70 to 74 years" },
  { code: "S0101_C01_017E", label: "75 to 79 years" },
  { code: "S0101_C01_018E", label: "80 to 84 years" },
  { code: "S0101_C01_019E", label: "85 years and over" }
];

// Class-of-worker (ACS Detail table B24080) is only broken out by sex, so
// male + female components are summed to get a county-wide total for each
// category. Indexes line up with the male/female blocks in that table.
const CLASS_OF_WORKER_VARS = [
  "B24080_001E",
  "B24080_003E", "B24080_013E", // private for-profit wage and salary
  "B24080_005E", "B24080_015E", // self-employed, incorporated
  "B24080_006E", "B24080_016E", // private not-for-profit (nonprofit)
  "B24080_007E", "B24080_008E", "B24080_009E", // government (male: local/state/federal)
  "B24080_017E", "B24080_018E", "B24080_019E", // government (female: local/state/federal)
  "B24080_010E", "B24080_020E", // self-employed, not incorporated
  "B24080_011E", "B24080_021E"  // unpaid family workers
];

function buildUrl(base, vars, geo) {
  const params = new URLSearchParams();
  params.set("get", vars.join(","));
  if (geo.county) {
    params.set("for", "county:" + geo.county);
    params.set("in", "state:" + geo.state);
  } else {
    params.set("for", "state:" + geo.state);
  }
  if (CENSUS_API_KEY) params.set("key", CENSUS_API_KEY);
  return base + "?" + params.toString();
}

async function fetchRow(base, vars, geo) {
  const url = buildUrl(base, vars, geo);
  const res = await fetch(url);
  const text = await res.text();
  if (!res.ok) {
    throw new Error("Census API request failed (" + res.status + ") for " + geo.label + ": " + text.slice(0, 300));
  }
  let rows;
  try {
    rows = JSON.parse(text);
  } catch (err) {
    throw new Error("Census API did not return JSON for " + geo.label + " (" + base + "): " + text.slice(0, 300));
  }
  const header = rows[0];
  const dataRow = rows[1];
  const obj = {};
  header.forEach((h, i) => { obj[h] = dataRow[i]; });
  return obj;
}

function num(value) {
  if (value === undefined || value === null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function sum(values) {
  return values.reduce((total, v) => total + (v || 0), 0);
}

function pct(numerator, denominator) {
  if (numerator == null || denominator == null || denominator === 0) return null;
  return (numerator / denominator) * 100;
}

function round1(value) {
  return value == null ? null : Math.round(value * 10) / 10;
}

function formatCurrency(value) {
  if (value == null) return null;
  return "$" + Math.round(value).toLocaleString("en-US");
}

function formatWholeNumber(value) {
  if (value == null) return null;
  return Math.round(value).toLocaleString("en-US");
}

function largestSmallestAgeGroup(row) {
  let largest = null;
  let smallest = null;
  AGE_BRACKETS.forEach((bracket) => {
    const value = num(row[bracket.code]);
    if (value == null) return;
    if (!largest || value > largest.value) largest = { label: bracket.label, value };
    if (!smallest || value < smallest.value) smallest = { label: bracket.label, value };
  });
  return { largest: largest ? largest.label : null, smallest: smallest ? smallest.label : null };
}

// Class of worker percentages for one geography's B24080 row. Florida's
// "self-employed" comparison figure folds in unpaid family workers too,
// matching how the narrative template phrases it.
function classOfWorkerStats(row) {
  const total = num(row.B24080_001E);
  const privateForProfit = sum([num(row.B24080_003E), num(row.B24080_013E)]);
  const incorporated = sum([num(row.B24080_005E), num(row.B24080_015E)]);
  const nonprofit = sum([num(row.B24080_006E), num(row.B24080_016E)]);
  const government = sum([
    num(row.B24080_007E), num(row.B24080_008E), num(row.B24080_009E),
    num(row.B24080_017E), num(row.B24080_018E), num(row.B24080_019E)
  ]);
  const unincorporatedAndUnpaid = sum([
    num(row.B24080_010E), num(row.B24080_020E),
    num(row.B24080_011E), num(row.B24080_021E)
  ]);
  return {
    privateWorkerPct: pct(privateForProfit, total),
    incorporatedSelfEmpPct: pct(incorporated, total),
    nonprofitWorkerPct: pct(nonprofit, total),
    governmentWorkerPct: pct(government, total),
    unincorporatedSelfEmpPct: pct(unincorporatedAndUnpaid, total),
    selfEmpPct: pct(incorporated + unincorporatedAndUnpaid, total)
  };
}

async function main() {
  if (!CENSUS_API_KEY) {
    console.warn("WARNING: CENSUS_API_KEY is not set. The Census API rejects data " +
      "requests without a key, so this run will likely fail. Set it locally " +
      "(export CENSUS_API_KEY=...) or as the CENSUS_API_KEY GitHub Actions secret.");
  }

  console.log("Fetching Census data for Walton County, FL...");

  const ageVars = AGE_BRACKETS.map((b) => b.code).concat(["S0101_C01_032E"]);
  const incomeVars = ["S1901_C01_012E", "S1901_C02_012E", "S1901_C03_012E", "S1901_C04_012E"];
  const eduVarsWalton = ["S1501_C02_009E", "S1501_C02_010E", "S1501_C02_011E", "S1501_C02_012E", "S1501_C02_013E", "S1501_C02_015E"];
  const enrollVars = ["S1401_C02_003E", "S1401_C02_008E", "S1401_C02_009E"];
  const housingVarsWalton = [
    "DP04_0001E", "DP04_0002E", "DP04_0003E", "DP04_0046PE",
    "DP04_0081PE", "DP04_0082PE", "DP04_0083PE", "DP04_0084PE",
    "DP04_0085PE", "DP04_0086PE", "DP04_0087PE", "DP04_0088PE",
    "DP04_0089E", "DP04_0134E"
  ];
  const industryVarsWalton = [
    "DP03_0033PE", "DP03_0034PE", "DP03_0035PE", "DP03_0036PE", "DP03_0037PE",
    "DP03_0038PE", "DP03_0039PE", "DP03_0040PE", "DP03_0041PE", "DP03_0042PE",
    "DP03_0043PE", "DP03_0044PE", "DP03_0045PE"
  ];

  const [
    waltonPop2010, waltonPop2020,
    waltonAge, floridaAge, okaloosaAge,
    waltonVet, floridaVet, okaloosaVet,
    waltonIncome, floridaIncome, okaloosaIncome,
    waltonEdu, floridaEdu, okaloosaEdu,
    waltonEnroll,
    waltonWorker, floridaWorker, okaloosaWorker,
    waltonHousing, floridaHousing, okaloosaHousing,
    waltonIndustry, okaloosaIndustry
  ] = await Promise.all([
    fetchRow(DEC_2010_SF1, ["P001001"], GEO.walton),
    fetchRow(DEC_2020_PL, ["P1_001N"], GEO.walton),
    fetchRow(ACS_SUBJECT, ageVars, GEO.walton),
    fetchRow(ACS_SUBJECT, ["S0101_C01_032E"], GEO.florida),
    fetchRow(ACS_SUBJECT, ["S0101_C01_032E"], GEO.okaloosa),
    fetchRow(ACS_SUBJECT, ["S2101_C04_001E"], GEO.walton),
    fetchRow(ACS_SUBJECT, ["S2101_C04_001E"], GEO.florida),
    fetchRow(ACS_SUBJECT, ["S2101_C04_001E"], GEO.okaloosa),
    fetchRow(ACS_SUBJECT, incomeVars, GEO.walton),
    fetchRow(ACS_SUBJECT, ["S1901_C01_012E"], GEO.florida),
    fetchRow(ACS_SUBJECT, incomeVars, GEO.okaloosa),
    fetchRow(ACS_SUBJECT, eduVarsWalton, GEO.walton),
    fetchRow(ACS_SUBJECT, ["S1501_C02_015E"], GEO.florida),
    fetchRow(ACS_SUBJECT, ["S1501_C02_014E", "S1501_C02_015E"], GEO.okaloosa),
    fetchRow(ACS_SUBJECT, enrollVars, GEO.walton),
    fetchRow(ACS_DETAIL, CLASS_OF_WORKER_VARS, GEO.walton),
    fetchRow(ACS_DETAIL, CLASS_OF_WORKER_VARS, GEO.florida),
    fetchRow(ACS_DETAIL, CLASS_OF_WORKER_VARS, GEO.okaloosa),
    fetchRow(ACS_PROFILE, housingVarsWalton, GEO.walton),
    fetchRow(ACS_PROFILE, ["DP04_0046PE"], GEO.florida),
    fetchRow(ACS_PROFILE, ["DP04_0046PE", "DP04_0089E"], GEO.okaloosa),
    fetchRow(ACS_PROFILE, industryVarsWalton, GEO.walton),
    fetchRow(ACS_PROFILE, ["DP03_0036PE", "DP03_0037PE", "DP03_0038PE"], GEO.okaloosa)
  ]);

  const pop2010 = num(waltonPop2010.P001001);
  const pop2020 = num(waltonPop2020.P1_001N);
  const growthPct = (pop2010 != null && pop2020 != null) ? pct(pop2020 - pop2010, pop2010) : null;
  const ageGroups = largestSmallestAgeGroup(waltonAge);

  const waltonWorkerStats = classOfWorkerStats(waltonWorker);
  const floridaWorkerStats = classOfWorkerStats(floridaWorker);
  const okaloosaWorkerStats = classOfWorkerStats(okaloosaWorker);
  const okaloosaTradeTransportPct = sum([
    num(okaloosaIndustry.DP03_0036PE), num(okaloosaIndustry.DP03_0037PE), num(okaloosaIndustry.DP03_0038PE)
  ]);

  // Raw numeric values before display formatting. Keys match the
  // {{placeholder}} names used in the Census Narratives Google Sheet.
  const raw = {
    population2010: pop2010,
    population2020: pop2020,
    populationGrowthPct: growthPct,
    largestAgeGroup: ageGroups.largest,
    smallestAgeGroup: ageGroups.smallest,
    waltonMedianAge: num(waltonAge.S0101_C01_032E),
    floridaMedianAge: num(floridaAge.S0101_C01_032E),
    okaloosaMedianAge: num(okaloosaAge.S0101_C01_032E),
    waltonVeteranPct: num(waltonVet.S2101_C04_001E),
    floridaVeteranPct: num(floridaVet.S2101_C04_001E),
    okaloosaVeteranPct: num(okaloosaVet.S2101_C04_001E),

    waltonMedianHouseholdIncome: num(waltonIncome.S1901_C01_012E),
    waltonFamilyIncome: num(waltonIncome.S1901_C02_012E),
    waltonMarriedCoupleIncome: num(waltonIncome.S1901_C03_012E),
    waltonNonfamilyIncome: num(waltonIncome.S1901_C04_012E),
    floridaMedianHouseholdIncome: num(floridaIncome.S1901_C01_012E),
    okaloosaMedianHouseholdIncome: num(okaloosaIncome.S1901_C01_012E),
    okaloosaFamilyIncome: num(okaloosaIncome.S1901_C02_012E),
    okaloosaMarriedCoupleIncome: num(okaloosaIncome.S1901_C03_012E),
    okaloosaNonfamilyIncome: num(okaloosaIncome.S1901_C04_012E),

    waltonHsPct: num(waltonEdu.S1501_C02_009E),
    waltonSomeCollegePct: num(waltonEdu.S1501_C02_010E),
    waltonAssociatePct: num(waltonEdu.S1501_C02_011E),
    waltonBachelorPct: num(waltonEdu.S1501_C02_012E),
    waltonGraduatePct: num(waltonEdu.S1501_C02_013E),
    waltonBachelorOrHigherPct: num(waltonEdu.S1501_C02_015E),
    floridaBachelorOrHigherPct: num(floridaEdu.S1501_C02_015E),
    okaloosaBachelorOrHigherPct: num(okaloosaEdu.S1501_C02_015E),
    okaloosaHsOrHigherPct: num(okaloosaEdu.S1501_C02_014E),

    waltonK12Pct: num(waltonEnroll.S1401_C02_003E),
    waltonUndergradPct: num(waltonEnroll.S1401_C02_008E),
    waltonGraduateEnrollPct: num(waltonEnroll.S1401_C02_009E),

    privateWorkerPct: waltonWorkerStats.privateWorkerPct,
    incorporatedSelfEmpPct: waltonWorkerStats.incorporatedSelfEmpPct,
    nonprofitWorkerPct: waltonWorkerStats.nonprofitWorkerPct,
    governmentWorkerPct: waltonWorkerStats.governmentWorkerPct,
    unincorporatedSelfEmpPct: waltonWorkerStats.unincorporatedSelfEmpPct,
    floridaPrivateWorkerPct: floridaWorkerStats.privateWorkerPct,
    floridaGovernmentWorkerPct: floridaWorkerStats.governmentWorkerPct,
    floridaSelfEmpPct: floridaWorkerStats.selfEmpPct,
    okaloosaGovernmentPct: okaloosaWorkerStats.governmentWorkerPct,

    housingUnder50kPct: num(waltonHousing.DP04_0081PE),
    housing50to100kPct: num(waltonHousing.DP04_0082PE),
    housing100to150kPct: num(waltonHousing.DP04_0083PE),
    housing150to200kPct: num(waltonHousing.DP04_0084PE),
    housing200to300kPct: num(waltonHousing.DP04_0085PE),
    housing300to500kPct: num(waltonHousing.DP04_0086PE),
    housing500to1mPct: num(waltonHousing.DP04_0087PE),
    housingOver1mPct: num(waltonHousing.DP04_0088PE),
    housingUnits: num(waltonHousing.DP04_0001E),
    occupiedUnits: num(waltonHousing.DP04_0002E),
    vacantUnits: num(waltonHousing.DP04_0003E),
    homeownershipRate: num(waltonHousing.DP04_0046PE),
    waltonMedianRent: num(waltonHousing.DP04_0134E),
    floridaHomeownershipRate: num(floridaHousing.DP04_0046PE),
    okaloosaHomeownershipRate: num(okaloosaHousing.DP04_0046PE),
    okaloosaMedianHomeValue: num(okaloosaHousing.DP04_0089E),

    professionalServicesPct: num(waltonIndustry.DP03_0041PE),
    healthEducationPct: num(waltonIndustry.DP03_0042PE),
    retailPct: num(waltonIndustry.DP03_0037PE),
    hospitalityPct: num(waltonIndustry.DP03_0043PE),
    financeRealEstatePct: num(waltonIndustry.DP03_0040PE),
    constructionPct: num(waltonIndustry.DP03_0034PE),
    publicAdministrationPct: num(waltonIndustry.DP03_0045PE),
    transportationPct: num(waltonIndustry.DP03_0038PE),
    otherServicesPct: num(waltonIndustry.DP03_0044PE),
    manufacturingPct: num(waltonIndustry.DP03_0035PE),
    okaloosaTradeTransportPct: okaloosaTradeTransportPct
  };

  // Keys formatted as dollar amounts (with thousands separators and a $).
  const CURRENCY_KEYS = new Set([
    "waltonMedianHouseholdIncome", "waltonFamilyIncome", "waltonMarriedCoupleIncome", "waltonNonfamilyIncome",
    "floridaMedianHouseholdIncome",
    "okaloosaMedianHouseholdIncome", "okaloosaFamilyIncome", "okaloosaMarriedCoupleIncome", "okaloosaNonfamilyIncome",
    "waltonMedianRent", "okaloosaMedianHomeValue"
  ]);
  // Keys formatted as plain comma-separated whole numbers (counts, not money).
  const WHOLE_NUMBER_KEYS = new Set(["population2010", "population2020", "housingUnits", "occupiedUnits", "vacantUnits"]);

  const values = {};
  Object.keys(raw).forEach((key) => {
    const value = raw[key];
    if (value == null) { values[key] = null; return; }
    if (typeof value === "string") { values[key] = value; return; }
    if (CURRENCY_KEYS.has(key)) values[key] = formatCurrency(value);
    else if (WHOLE_NUMBER_KEYS.has(key)) values[key] = formatWholeNumber(value);
    else values[key] = round1(value); // percentages and median-age figures
  });

  const output = {
    metadata: {
      source: "U.S. Census Bureau",
      dataset: "ACS 5-Year Estimates (" + ACS_YEAR + ") and 2010/2020 Decennial Census",
      vintage: String(ACS_YEAR),
      lastUpdated: new Date().toISOString().slice(0, 10),
      notes: "Walton County, FL (FIPS 12131) compared against Florida statewide and Okaloosa County, FL (FIPS 12091). Generated by scripts/fetch-census-data.js; do not edit by hand."
    },
    values: values
  };

  const outPath = path.join(__dirname, "..", "assets", "census-data.json");
  fs.writeFileSync(outPath, JSON.stringify(output, null, 2) + "\n");
  console.log("Wrote " + outPath);
}

main().catch((err) => {
  console.error("Census data fetch failed:", err);
  process.exit(1);
});
