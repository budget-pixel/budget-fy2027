# data/property-records.json

Placeholder for the property address search on the homepage Property Tax
Calculator (`index.html`, `#propertyAddressSearch`). Currently an empty
array — the search box stays disabled with a "not available yet" message
until this file has records in it.

Replace the file's contents with an array of objects shaped like:

```json
[
  {
    "address": "123 MAIN ST, DEFUNIAK SPRINGS, FL 32433",
    "parcelId": "12-34-56-0000-0010-0000",
    "taxableValue": 245000,
    "inMosquitoControlDistrict": false
  }
]
```

Field notes:
- `address` — required. Matched as a case-insensitive substring against
  what the user types, so include enough of the address (street, city,
  zip) to disambiguate.
- `parcelId` — optional, shown in the search result for confirmation.
- `taxableValue` — required, numeric, no `$` or commas. Auto-fills the
  calculator's Taxable Value field when a result is selected.
- `inMosquitoControlDistrict` — optional boolean. Auto-checks/unchecks the
  North Walton Mosquito Control checkbox when a result is selected.

No other code changes are needed once this file is populated — the search
box on the homepage starts working as soon as it finds records here.
