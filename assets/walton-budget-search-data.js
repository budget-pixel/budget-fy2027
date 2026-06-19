

// walton-budget-search-data.js

window.wcProjectSearchBaseUrl = window.location.pathname.indexOf("/pages/") !== -1
  ? "search.html?q="
  : "pages/search.html?q=";

window.wcBudgetPages = window.wcBudgetPages || [
  { title:"Home", section:"Introduction and Overview", href:"home.html" },
  { title:"GFOA Distinguished Budget Presentation Award", section:"Introduction and Overview", href:"https://stories.opengov.com/countyofwaltonfl/cf6eaa7a-a98d-479a-9869-b20398ee38e5/published/re0lJHwus?currentPageId=6989dbbd25815ed4e2fe49b4" },
  { title:"Transmittal Letter", section:"Introduction and Overview", href:"https://stories.opengov.com/countyofwaltonfl/cf6eaa7a-a98d-479a-9869-b20398ee38e5/published/re0lJHwus?currentPageId=6989dbbdc3a5aa570050fba9" },
  { title:"Budget-in-Brief", section:"Introduction and Overview", href:"https://stories.opengov.com/countyofwaltonfl/cf6eaa7a-a98d-479a-9869-b20398ee38e5/published/re0lJHwus?currentPageId=69e8ae83a93da8d66dc5e248" },
  { title:"Overview of Walton County", section:"Introduction and Overview", href:"https://stories.opengov.com/countyofwaltonfl/cf6eaa7a-a98d-479a-9869-b20398ee38e5/published/re0lJHwus?currentPageId=6989dbbd2e29b2249e0a5b99" },
  { title:"Organizational Structure", section:"Introduction and Overview", href:"https://stories.opengov.com/countyofwaltonfl/cf6eaa7a-a98d-479a-9869-b20398ee38e5/published/re0lJHwus?currentPageId=6989dbbd1af21806371d68e7" },
  { title:"Strategic Initiatives", section:"Introduction and Overview", href:"https://stories.opengov.com/countyofwaltonfl/cf6eaa7a-a98d-479a-9869-b20398ee38e5/published/re0lJHwus?currentPageId=6989dbbda2feb1e35a5b122d" },
  { title:"Budget Overview", section:"Budget Overview", href:"budget-overview.html" },
  { title:"Departments", section:"Departments", href:"departments.html" },
  { title:"Budget Process & Calendar", section:"Financial Structure, Policies, and Process", href:"https://stories.opengov.com/countyofwaltonfl/cf6eaa7a-a98d-479a-9869-b20398ee38e5/published/re0lJHwus?currentPageId=6989dbbdeb3f9f1b409e86d5" },
  { title:"Fund Descriptions and Structure", section:"Financial Structure, Policies, and Process", href:"https://stories.opengov.com/countyofwaltonfl/cf6eaa7a-a98d-479a-9869-b20398ee38e5/published/re0lJHwus?currentPageId=6989dbbd623edf6822e6e54d" },
  { title:"Department to Fund Relationship", section:"Financial Structure, Policies, and Process", href:"https://stories.opengov.com/countyofwaltonfl/cf6eaa7a-a98d-479a-9869-b20398ee38e5/published/re0lJHwus?currentPageId=6989dbbdcf5e99561d6ee920" },
  { title:"Financial Policies", section:"Financial Structure, Policies, and Process", href:"https://stories.opengov.com/countyofwaltonfl/cf6eaa7a-a98d-479a-9869-b20398ee38e5/published/re0lJHwus?currentPageId=6989dbbd42737a8f8389d90a" },
  { title:"Consolidated Financial Schedules", section:"Financial Summaries", href:"https://stories.opengov.com/countyofwaltonfl/cf6eaa7a-a98d-479a-9869-b20398ee38e5/published/re0lJHwus?currentPageId=69ec1d92dac55b6e61a0d5a1" },
  { title:"Fund Financial Schedules", section:"Financial Summaries", href:"https://stories.opengov.com/countyofwaltonfl/cf6eaa7a-a98d-479a-9869-b20398ee38e5/published/re0lJHwus?currentPageId=69efabd38621d8866c0990bc" },
  { title:"Summary of Revenues", section:"Financial Summaries", href:"https://stories.opengov.com/countyofwaltonfl/cf6eaa7a-a98d-479a-9869-b20398ee38e5/published/re0lJHwus?currentPageId=6989dbbd901dc122f957d450" },
  { title:"Summary of Expenses", section:"Financial Summaries", href:"https://stories.opengov.com/countyofwaltonfl/cf6eaa7a-a98d-479a-9869-b20398ee38e5/published/re0lJHwus?currentPageId=6989dbbdf2d67fd0fb063ce6" },
  { title:"Summary of Interfund Transfers", section:"Financial Summaries", href:"https://stories.opengov.com/countyofwaltonfl/cf6eaa7a-a98d-479a-9869-b20398ee38e5/published/re0lJHwus?currentPageId=6989dbbd0c507ca05e715043" },
  { title:"Summary of Personnel", section:"Financial Summaries", href:"https://stories.opengov.com/countyofwaltonfl/cf6eaa7a-a98d-479a-9869-b20398ee38e5/published/re0lJHwus?currentPageId=6989dbbdacbe9432cc1ec134" },
  { title:"Summary of Machinery, Vehicles & Equipment", section:"Financial Summaries", href:"https://stories.opengov.com/countyofwaltonfl/cf6eaa7a-a98d-479a-9869-b20398ee38e5/published/re0lJHwus?currentPageId=6989dbbdfdb1a2c2915743e4" },
  { title:"Financials", section:"Financials", href:"financials.html" },
  { title:"Board of County Commissioners", section:"Constitutional Officers", href:"https://stories.opengov.com/countyofwaltonfl/cf6eaa7a-a98d-479a-9869-b20398ee38e5/published/re0lJHwus?currentPageId=6989dbbc6947be859271a418" },
  { title:"Clerk of Courts & County Comptroller", section:"Constitutional Officers", href:"https://stories.opengov.com/countyofwaltonfl/cf6eaa7a-a98d-479a-9869-b20398ee38e5/published/re0lJHwus?currentPageId=6989dbbcc965cb8dc61a1909" },
  { title:"Property Appraiser", section:"Constitutional Officers", href:"https://stories.opengov.com/countyofwaltonfl/cf6eaa7a-a98d-479a-9869-b20398ee38e5/published/re0lJHwus?currentPageId=6989dbbc872420fe4b9ad729" },
  { title:"Sheriff's Office", section:"Constitutional Officers", href:"https://stories.opengov.com/countyofwaltonfl/cf6eaa7a-a98d-479a-9869-b20398ee38e5/published/re0lJHwus?currentPageId=6989dbbccae62897761aea36" },
  { title:"Supervisor of Elections", section:"Constitutional Officers", href:"https://stories.opengov.com/countyofwaltonfl/cf6eaa7a-a98d-479a-9869-b20398ee38e5/published/re0lJHwus?currentPageId=6989dbbc238b94b182a17be3" },
  { title:"Tax Collector", section:"Constitutional Officers", href:"https://stories.opengov.com/countyofwaltonfl/cf6eaa7a-a98d-479a-9869-b20398ee38e5/published/re0lJHwus?currentPageId=6989dbbc5a7603d48c5d254c" },
  { title:"Circuit Court", section:"Autonomous Entities", href:"https://stories.opengov.com/countyofwaltonfl/cf6eaa7a-a98d-479a-9869-b20398ee38e5/published/re0lJHwus?currentPageId=6989dbbd8610a5581eec0eb5" },
  { title:"County Court", section:"Autonomous Entities", href:"https://stories.opengov.com/countyofwaltonfl/cf6eaa7a-a98d-479a-9869-b20398ee38e5/published/re0lJHwus?currentPageId=6989dbbd80c5b0f0529f9f19" },
  { title:"Court Technology & Innovations", section:"Autonomous Entities", href:"https://stories.opengov.com/countyofwaltonfl/cf6eaa7a-a98d-479a-9869-b20398ee38e5/published/re0lJHwus?currentPageId=6989dbbda7032c6c388f5159" },
  { title:"Guardian Ad Litem", section:"Autonomous Entities", href:"https://stories.opengov.com/countyofwaltonfl/cf6eaa7a-a98d-479a-9869-b20398ee38e5/published/re0lJHwus?currentPageId=6989dbbda641a1ab299d7803" },
  { title:"Medical Examiner", section:"Autonomous Entities", href:"https://stories.opengov.com/countyofwaltonfl/cf6eaa7a-a98d-479a-9869-b20398ee38e5/published/re0lJHwus?currentPageId=6989dbbd185c827885253858" },
  { title:"Non-Profit Funding Program", section:"Autonomous Entities", href:"https://stories.opengov.com/countyofwaltonfl/cf6eaa7a-a98d-479a-9869-b20398ee38e5/published/re0lJHwus?currentPageId=6989dbbdcb2c399f2c8536fd" },
  { title:"Public Defender", section:"Autonomous Entities", href:"https://stories.opengov.com/countyofwaltonfl/cf6eaa7a-a98d-479a-9869-b20398ee38e5/published/re0lJHwus?currentPageId=6989dbbd71fca7e3dc1ad0fa" },
  { title:"South Walton Fire & State Control", section:"Autonomous Entities", href:"https://stories.opengov.com/countyofwaltonfl/cf6eaa7a-a98d-479a-9869-b20398ee38e5/published/re0lJHwus?currentPageId=6989dbbd799cff81b62a9d04" },
  { title:"State Attorney", section:"Autonomous Entities", href:"https://stories.opengov.com/countyofwaltonfl/cf6eaa7a-a98d-479a-9869-b20398ee38e5/published/re0lJHwus?currentPageId=6989dbbdfba867c19eddf0d3" },
  { title:"Statutory & Other Agency Funding", section:"Autonomous Entities", href:"https://stories.opengov.com/countyofwaltonfl/cf6eaa7a-a98d-479a-9869-b20398ee38e5/published/re0lJHwus?currentPageId=6989dbbdd8b75e8172b9646a" },
  { title:"Walton County Health Department", section:"Autonomous Entities", href:"https://stories.opengov.com/countyofwaltonfl/cf6eaa7a-a98d-479a-9869-b20398ee38e5/published/re0lJHwus?currentPageId=6989dbbd55c6cf9367a9f70d" },
  { title:"Building Construction and Maintenance", section:"Departments", href:"https://stories.opengov.com/countyofwaltonfl/cf6eaa7a-a98d-479a-9869-b20398ee38e5/published/re0lJHwus?currentPageId=6989dbbe4a1b46dae2cd66cc" },
  { title:"Building Department", section:"Departments", href:"https://stories.opengov.com/countyofwaltonfl/cf6eaa7a-a98d-479a-9869-b20398ee38e5/published/re0lJHwus?currentPageId=6989dbbd8e620c6522929798" },
  { title:"Code Compliance", section:"Departments", href:"https://stories.opengov.com/countyofwaltonfl/cf6eaa7a-a98d-479a-9869-b20398ee38e5/published/re0lJHwus?currentPageId=6989dbbd5e724bfe505af7d1" },
  { title:"County Administration", section:"Departments", href:"https://stories.opengov.com/countyofwaltonfl/cf6eaa7a-a98d-479a-9869-b20398ee38e5/published/re0lJHwus?currentPageId=6989dbbd15a00b5b02701878" },
  { title:"Eagle Springs Golf and Recreation Center", section:"Departments", href:"https://stories.opengov.com/countyofwaltonfl/cf6eaa7a-a98d-479a-9869-b20398ee38e5/published/re0lJHwus?currentPageId=6989dbbd67c50a9caf8aa87f" },
  { title:"Eagle Springs Grill", section:"Departments", href:"https://stories.opengov.com/countyofwaltonfl/cf6eaa7a-a98d-479a-9869-b20398ee38e5/published/re0lJHwus?currentPageId=6989dbbdfe52b05dd76fe3e9" },
  { title:"Emergency Management", section:"Departments", href:"https://stories.opengov.com/countyofwaltonfl/cf6eaa7a-a98d-479a-9869-b20398ee38e5/published/re0lJHwus?currentPageId=6989dbbdfa0047aa8047423d" },
  { title:"Engineering Department", section:"Departments", href:"https://stories.opengov.com/countyofwaltonfl/cf6eaa7a-a98d-479a-9869-b20398ee38e5/published/re0lJHwus?currentPageId=6989dbbd0fd7d79954f0d697" },
  { title:"Environmental Resources", section:"Departments", href:"https://stories.opengov.com/countyofwaltonfl/cf6eaa7a-a98d-479a-9869-b20398ee38e5/published/re0lJHwus?currentPageId=6989dbbdd658e0914c4e22af" },
  { title:"Extension Office", section:"Departments", href:"https://stories.opengov.com/countyofwaltonfl/cf6eaa7a-a98d-479a-9869-b20398ee38e5/published/re0lJHwus?currentPageId=6989dbbde2e896043bd2da11" },
  { title:"Geographic Info Systems", section:"Departments", href:"https://stories.opengov.com/countyofwaltonfl/cf6eaa7a-a98d-479a-9869-b20398ee38e5/published/re0lJHwus?currentPageId=6989dbbee3bceee932fc0d87" },
  { title:"Housing & Urban Development", section:"Departments", href:"https://stories.opengov.com/countyofwaltonfl/cf6eaa7a-a98d-479a-9869-b20398ee38e5/published/re0lJHwus?currentPageId=6989dbbe639ac21532bb2142" },
  { title:"Human Resources", section:"Departments", href:"https://stories.opengov.com/countyofwaltonfl/cf6eaa7a-a98d-479a-9869-b20398ee38e5/published/re0lJHwus?currentPageId=6989dbbe479fad77bfe0b08c" },
  { title:"Libraries", section:"Departments", href:"https://stories.opengov.com/countyofwaltonfl/cf6eaa7a-a98d-479a-9869-b20398ee38e5/published/re0lJHwus?currentPageId=6989dbbea6376f80ba7f7b69" },
  { title:"Mosquito Control", section:"Departments", href:"https://stories.opengov.com/countyofwaltonfl/cf6eaa7a-a98d-479a-9869-b20398ee38e5/published/re0lJHwus?currentPageId=6989dbbeba6bb0c34fe13bcc" },
  { title:"Mossy Head Wastewater Treatment Facility", section:"Departments", href:"https://stories.opengov.com/countyofwaltonfl/cf6eaa7a-a98d-479a-9869-b20398ee38e5/published/re0lJHwus?currentPageId=6989dbbe3d7c82948e99141a" },
  { title:"Office of Management and Budget", section:"Departments", href:"https://stories.opengov.com/countyofwaltonfl/cf6eaa7a-a98d-479a-9869-b20398ee38e5/published/re0lJHwus?currentPageId=6989dbbe31d617f90d821387" },
  { title:"Office of the County Attorney", section:"Departments", href:"https://stories.opengov.com/countyofwaltonfl/cf6eaa7a-a98d-479a-9869-b20398ee38e5/published/re0lJHwus?currentPageId=6989dbbed0f2f4405191cf7e" },
  { title:"Planning", section:"Departments", href:"https://stories.opengov.com/countyofwaltonfl/cf6eaa7a-a98d-479a-9869-b20398ee38e5/published/re0lJHwus?currentPageId=6989dbbeee8cc7637f457744" },
  { title:"Probation", section:"Departments", href:"https://stories.opengov.com/countyofwaltonfl/cf6eaa7a-a98d-479a-9869-b20398ee38e5/published/re0lJHwus?currentPageId=6989dbbeaab1d7fbd1d2ba62" },
  { title:"Public Works", section:"Departments", href:"https://stories.opengov.com/countyofwaltonfl/cf6eaa7a-a98d-479a-9869-b20398ee38e5/published/re0lJHwus?currentPageId=6989dbbe512b64f66f25b84d" },
  { title:"Purchasing", section:"Departments", href:"https://stories.opengov.com/countyofwaltonfl/cf6eaa7a-a98d-479a-9869-b20398ee38e5/published/re0lJHwus?currentPageId=6989dbbe30c197fb7c61e522" },
  { title:"Recreation", section:"Departments", href:"https://stories.opengov.com/countyofwaltonfl/cf6eaa7a-a98d-479a-9869-b20398ee38e5/published/re0lJHwus?currentPageId=6989dbbeb2d7e817998fc5b3" },
  { title:"Soil Conservation", section:"Departments", href:"https://stories.opengov.com/countyofwaltonfl/cf6eaa7a-a98d-479a-9869-b20398ee38e5/published/re0lJHwus?currentPageId=6989dbbec41205b833c4df0e" },
  { title:"Solid Waste", section:"Departments", href:"https://stories.opengov.com/countyofwaltonfl/cf6eaa7a-a98d-479a-9869-b20398ee38e5/published/re0lJHwus?currentPageId=6989dbbe3d0fefca6b1a531e" },
  { title:"Tourism Administration", section:"Departments", href:"https://stories.opengov.com/countyofwaltonfl/cf6eaa7a-a98d-479a-9869-b20398ee38e5/published/re0lJHwus?currentPageId=6989dbbe794aa4891a3dc024" },
  { title:"Tourism Beach Operations", section:"Departments", href:"https://stories.opengov.com/countyofwaltonfl/cf6eaa7a-a98d-479a-9869-b20398ee38e5/published/re0lJHwus?currentPageId=6989dbbed36e2967b08392bf" },
  { title:"Tourism Lifeguard Services and Beach Safety", section:"Departments", href:"https://stories.opengov.com/countyofwaltonfl/cf6eaa7a-a98d-479a-9869-b20398ee38e5/published/re0lJHwus?currentPageId=6989dbbecf8c02d147a19f9f" },
  { title:"Veteran Services", section:"Departments", href:"https://stories.opengov.com/countyofwaltonfl/cf6eaa7a-a98d-479a-9869-b20398ee38e5/published/re0lJHwus?currentPageId=6989dbbf22a7f73b8c6a62b4" },
  { title:"Capital Improvement Plan", section:"Capital Improvement Plan", href:"https://stories.opengov.com/countyofwaltonfl/cf6eaa7a-a98d-479a-9869-b20398ee38e5/published/re0lJHwus?currentPageId=6989dbbd4a9d93e5ac05a153" },
  { title:"Debt Overview", section:"Debt and Financial Forecast", href:"https://stories.opengov.com/countyofwaltonfl/cf6eaa7a-a98d-479a-9869-b20398ee38e5/published/re0lJHwus?currentPageId=6989dbbd7fa91d193bd3f319" },
  { title:"Financial Forecast", section:"Debt and Financial Forecast", href:"https://stories.opengov.com/countyofwaltonfl/cf6eaa7a-a98d-479a-9869-b20398ee38e5/published/re0lJHwus?currentPageId=6989dbbd986e584c322f6216" },
  { title:"Glossary, Acronyms, and Frequently Asked Questions", section:"Glossary, Statistical, and Supplemental Information", href:"https://stories.opengov.com/countyofwaltonfl/cf6eaa7a-a98d-479a-9869-b20398ee38e5/published/re0lJHwus?currentPageId=6989dbbd48feef483c784fe0" },
  { title:"Statistical & Supplemental Information", section:"Glossary, Statistical, and Supplemental Information", href:"https://stories.opengov.com/countyofwaltonfl/cf6eaa7a-a98d-479a-9869-b20398ee38e5/published/re0lJHwus?currentPageId=6989dbbd1da6285c17aaf19a" }
];

(function(){
  const keywordMap = {
    "Home": [
      "contents", "index", "navigation", "budget book", "budget sections", "chapters", "pages", "find a page", "where is"
    ],

    "GFOA Distinguished Budget Presentation Award": [
      "gfoa", "distinguished budget award", "budget presentation award", "award", "recognition", "government finance officers association", "budget award criteria"
    ],

    "Transmittal Letter": [
      "letter", "budget message", "county administrator message", "executive message", "introduction", "overview letter", "budget highlights", "recommended budget"
    ],

    "Budget-in-Brief": [
      "budget brief", "summary", "quick summary", "highlights", "overview", "taxes", "millage", "property taxes", "ad valorem taxes", "ad valoram taxes", "revenues", "expenses", "public safety", "capital projects", "total budget"
    ],

    "Overview of Walton County": [
      "county profile", "community profile", "demographics", "population", "history", "location", "walton county", "about the county", "economic indicators", "county overview"
    ],

    "Organizational Structure": [
      "org chart", "organization chart", "departments", "county structure", "governance", "board structure", "reporting structure", "administration structure"
    ],

    "Strategic Initiatives": [
      "strategic plan", "goals", "priorities", "initiatives", "objectives", "county priorities", "strategic priorities", "performance", "vision", "mission"
    ],

    "Budget Overview": [
      "budget overview", "overview hub", "budget process", "calendar", "transmittal", "budget message", "county profile", "fund structure", "financial policies", "strategic initiatives"
    ],

    "Departments": [
      "departments", "department directory", "services", "office directory", "county services", "browse departments", "department budgets", "department staffing", "performance measures"
    ],

    "Budget Process & Calendar": [
      "budget process", "calendar", "budget calendar", "timeline", "budget adoption", "hearings", "public hearing", "tentative budget", "final budget", "truth in millage", "trim", "millage dates", "budget cycle"
    ],

    "Fund Descriptions and Structure": [
      "funds", "fund structure", "fund accounting", "general fund", "special revenue fund", "capital projects fund", "enterprise fund", "internal service fund", "governmental funds", "fiduciary funds", "fund descriptions"
    ],

    "Department to Fund Relationship": [
      "department fund", "which fund", "fund relationship", "department funding", "funded by", "department to fund", "general fund departments", "special revenue departments"
    ],

    "Financial Policies": [
      "policies", "financial policy", "reserve policy", "fund balance", "debt policy", "investment policy", "budget policy", "accounting policy", "fiscal policy", "reserves"
    ],

    "Consolidated Financial Schedules": [
      "consolidated schedule", "financial schedule", "all funds", "total all funds", "total revenues", "total expenses", "revenues by fund", "expenses by fund", "fund totals", "combined schedule", "summary schedule"
    ],

    "Fund Financial Schedules": [
      "fund schedule", "fund financials", "fund detail", "general fund schedule", "transportation fund", "fine and forfeiture fund", "tourist development fund", "solid waste fund", "capital projects fund", "non-major funds", "fund revenue", "fund expense"
    ],

    "Summary of Revenues": [
      "revenues", "revenue", "revenue summary", "property taxes", "ad valorem taxes", "ad valoram taxes", "taxes", "tourist development taxes", "tdt", "tourist tax", "bed tax", "sales tax", "charges for services", "intergovernmental revenues", "fines", "forfeitures", "miscellaneous revenue", "permits", "fees", "special assessments", "millage", "taxable value"
    ],

    "Summary of Expenses": [
      "expenses", "expenditures", "spending", "expense summary", "appropriations", "operating expenses", "personnel services", "operating costs", "capital outlay", "debt service", "public safety", "general government", "transportation", "culture recreation", "human services"
    ],

    "Summary of Interfund Transfers": [
      "transfers", "interfund transfers", "transfer in", "transfer out", "other financing sources", "other financing uses", "fund transfers", "subsidy", "fund support"
    ],

    "Summary of Personnel": [
      "personnel", "positions", "fte", "full time equivalent", "staffing", "headcount", "employees", "authorized positions", "new positions", "vacancies", "payroll", "salary", "benefits"
    ],

    "Summary of Machinery, Vehicles & Equipment": [
      "machinery", "vehicles", "equipment", "fleet", "capital equipment", "mve", "vehicle replacement", "equipment replacement", "heavy equipment", "trucks", "public works equipment"
    ],

    "Financials": [
      "financials", "financial hub", "financial summaries", "revenues", "expenses", "fund schedules", "debt", "forecast", "transfers", "personnel", "equipment", "supplemental"
    ],

    "Board of County Commissioners": [
      "bcc", "board", "commissioners", "county commission", "county commissioners", "district commissioners", "governing board", "legislative", "board budget"
    ],

    "Clerk of Courts & County Comptroller": [
      "clerk", "clerk of court", "comptroller", "finance", "accounting", "court records", "official records", "constitutional officer", "clerk budget"
    ],

    "Property Appraiser": [
      "property appraiser", "assessed value", "taxable value", "property values", "assessment", "ad valorem", "ad valoram", "property taxes", "tax roll", "constitutional officer"
    ],

    "Sheriff's Office": [
      "sheriff", "law enforcement", "public safety", "deputies", "jail", "corrections", "detention", "patrol", "sheriff office", "constitutional officer", "fine and forfeiture"
    ],

    "Supervisor of Elections": [
      "elections", "supervisor elections", "voting", "election administration", "voter registration", "polling places", "constitutional officer"
    ],

    "Tax Collector": [
      "tax collector", "tax collection", "property tax collection", "licenses", "tags", "dmv", "business tax", "tourist development tax collection", "constitutional officer"
    ],

    "Circuit Court": [
      "circuit court", "court", "judicial", "court services", "courthouse", "trial court", "state court"
    ],

    "County Court": [
      "county court", "court", "judicial", "misdemeanor", "civil traffic", "small claims", "court services"
    ],

    "Court Technology & Innovations": [
      "court technology", "court tech", "technology", "innovations", "case management", "court systems", "judicial technology"
    ],

    "Guardian Ad Litem": [
      "guardian ad litem", "gal", "child advocacy", "children", "dependency court", "court appointed advocate"
    ],

    "Medical Examiner": [
      "medical examiner", "me", "autopsy", "forensics", "death investigation", "district medical examiner"
    ],

    "Non-Profit Funding Program": [
      "nonprofit", "non-profit", "outside agency", "agency funding", "community funding", "grants", "human services funding", "local aid"
    ],

    "Public Defender": [
      "public defender", "pd", "indigent defense", "legal defense", "court appointed attorney", "judicial"
    ],

    "South Walton Fire & State Control": [
      "south walton fire", "swfd", "fire", "fire control", "fire district", "ems", "emergency response", "public safety", "fire services"
    ],

    "State Attorney": [
      "state attorney", "prosecutor", "prosecution", "criminal justice", "court", "judicial"
    ],

    "Statutory & Other Agency Funding": [
      "statutory funding", "agency funding", "outside agencies", "mandated funding", "state required", "other agencies", "intergovernmental"
    ],

    "Walton County Health Department": [
      "health department", "public health", "county health", "florida department of health", "clinic", "environmental health", "health services"
    ],

    "Building Construction and Maintenance": [
      "building maintenance", "facilities", "construction maintenance", "county buildings", "facility maintenance", "repairs", "building services"
    ],

    "Building Department": [
      "building department", "building permits", "permits", "inspections", "construction permits", "building code", "permit fees", "development review"
    ],

    "Code Compliance": [
      "code compliance", "code enforcement", "violations", "ordinance", "compliance", "citations", "nuisance", "property maintenance"
    ],

    "County Administration": [
      "administration", "county administrator", "county manager", "executive", "leadership", "county operations", "management"
    ],

    "Eagle Springs Golf and Recreation Center": [
      "eagle springs", "golf", "recreation center", "golf course", "parks", "recreation", "clubhouse"
    ],

    "Eagle Springs Grill": [
      "eagle springs grill", "grill", "restaurant", "food service", "golf grill", "concessions"
    ],

    "Emergency Management": [
      "emergency management", "em", "disaster", "hurricane", "preparedness", "response", "mitigation", "emergency operations", "eoc"
    ],

    "Engineering Department": [
      "engineering", "roads", "drainage", "stormwater", "traffic", "infrastructure", "project management", "transportation projects", "civil engineering"
    ],

    "Environmental Resources": [
      "environmental", "environmental resources", "natural resources", "water quality", "coastal", "beach", "conservation", "stormwater", "environment"
    ],

    "Extension Office": [
      "extension", "uf ifas", "agriculture", "4-h", "horticulture", "family consumer sciences", "cooperative extension"
    ],

    "Geographic Info Systems": [
      "gis", "geographic information systems", "mapping", "maps", "spatial data", "parcel maps", "addressing", "geospatial"
    ],

    "Housing & Urban Development": [
      "housing", "hud", "urban development", "affordable housing", "community development", "housing assistance", "grants", "ship", "cdbg"
    ],

    "Human Resources": [
      "human resources", "hr", "employees", "benefits", "recruiting", "hiring", "risk management", "training", "personnel"
    ],

    "Libraries": [
      "library", "libraries", "public library", "books", "library services", "branches", "literacy", "youth services"
    ],

    "Mosquito Control": [
      "mosquito", "mosquito control", "vector control", "spraying", "pest control", "public health", "mosquito abatement"
    ],

    "Mossy Head Wastewater Treatment Facility": [
      "mossy head", "wastewater", "wwtf", "treatment facility", "sewer", "utilities", "wastewater treatment", "mossy head industrial park"
    ],

    "Office of Management and Budget": [
      "omb", "budget office", "management and budget", "budget", "financial planning", "budget development", "budget monitoring", "performance"
    ],

    "Office of the County Attorney": [
      "county attorney", "legal", "legal services", "litigation", "contracts", "ordinances", "resolutions", "legal counsel"
    ],

    "Planning": [
      "planning", "planning department", "land use", "zoning", "development review", "comprehensive plan", "growth management", "permits", "planning applications"
    ],

    "Probation": [
      "probation", "community supervision", "offender supervision", "court services", "misdemeanor probation", "pretrial"
    ],

    "Public Works": [
      "public works", "roads", "road maintenance", "bridges", "right of way", "drainage", "transportation", "paving", "maintenance", "infrastructure"
    ],

    "Purchasing": [
      "purchasing", "procurement", "contracts", "bids", "rfp", "solicitations", "vendors", "purchase orders", "buying"
    ],

    "Recreation": [
      "recreation", "parks", "parks and recreation", "athletics", "sports", "community centers", "playgrounds", "recreational programs"
    ],

    "Soil Conservation": [
      "soil conservation", "soil", "conservation", "agriculture", "erosion", "water conservation", "natural resources"
    ],

    "Solid Waste": [
      "solid waste", "trash", "garbage", "landfill", "recycling", "waste disposal", "transfer station", "sanitation", "tipping fees"
    ],

    "Tourism Administration": [
      "tourism", "tourism administration", "tourist development", "tdc", "tdt", "tourist development tax", "tourist development taxes", "bed tax", "tourist tax", "destination marketing", "beaches", "visitor services"
    ],

    "Tourism Beach Operations": [
      "beach operations", "tourism beach", "beach maintenance", "beach access", "beach cleaning", "beach services", "coastal", "tourist development", "tdt", "bed tax"
    ],

    "Tourism Lifeguard Services and Beach Safety": [
      "lifeguard", "beach safety", "lifeguard services", "beach rescue", "water safety", "public safety", "tourism", "beach patrol", "tdt"
    ],

    "Veteran Services": [
      "veterans", "veteran services", "va", "benefits", "veterans assistance", "claims", "military", "service members"
    ],

    "Capital Improvement Plan": [
      "cip", "capital improvement plan", "capital projects", "projects", "infrastructure projects", "roads", "facilities", "parks projects", "project search", "capital spending", "five year plan", "construction projects"
    ],

    "Debt Overview": [
      "debt", "bonds", "loans", "debt service", "principal", "interest", "bond rating", "outstanding debt", "long term debt", "borrowing"
    ],

    "Financial Forecast": [
      "forecast", "financial forecast", "projection", "long range plan", "future years", "revenue forecast", "expense forecast", "financial outlook", "assumptions"
    ],

    "Glossary, Acronyms, and Frequently Asked Questions": [
      "glossary", "acronyms", "faq", "frequently asked questions", "definitions", "terms", "what does", "meaning", "millage", "ad valorem", "tdt", "cip", "fte", "fund balance"
    ],

    "Statistical & Supplemental Information": [
      "statistics", "statistical", "supplemental", "demographic", "economic", "historical", "trend", "population", "taxable value", "principal taxpayers", "assessed value", "debt statistics"
    ]
  };

  const localHrefMap = {
    "Home": "home.html",
    "GFOA Distinguished Budget Presentation Award": "gfoa-distinguished-budget-presentation-award.html",
    "Transmittal Letter": "transmittal-letter.html",
    "Overview of Walton County": "overview-of-walton-county.html",
    "Organizational Structure": "organizational-structure.html",
    "Strategic Initiatives": "strategic-initiatives.html",
    "Budget Overview": "budget-overview.html",
    "Departments": "departments.html",
    "Budget Process & Calendar": "budget-process-and-calendar.html",
    "Fund Descriptions and Structure": "fund-descriptions-and-structure.html",
    "Department to Fund Relationship": "department-to-fund-relationship.html",
    "Financial Policies": "financial-policies.html",
    "Consolidated Financial Schedules": "consolidated-financial-schedules.html",
    "Fund Financial Schedules": "fund-financial-schedules.html",
    "Summary of Revenues": "summary-of-revenues.html",
    "Summary of Expenses": "summary-of-expenses.html",
    "Summary of Interfund Transfers": "summary-of-interfund-transfers.html",
    "Summary of Personnel": "summary-of-personnel.html",
    "Summary of Machinery, Vehicles & Equipment": "summary-of-machinery-vehicles-and-equipment.html",
    "Financials": "financials.html",
    "Board of County Commissioners": "board-of-county-commissioners.html",
    "Clerk of Courts & County Comptroller": "clerk-of-courts-and-county-comptroller.html",
    "Property Appraiser": "property-appraiser.html",
    "Sheriff's Office": "sheriffs-office.html",
    "Supervisor of Elections": "supervisor-of-elections.html",
    "Tax Collector": "tax-collector.html",
    "Circuit Court": "circuit-court.html",
    "County Court": "county-court.html",
    "Court Technology & Innovations": "court-technology-and-innovations.html",
    "Guardian Ad Litem": "guardian-ad-litem.html",
    "Medical Examiner": "medical-examiner.html",
    "Non-Profit Funding Program": "non-profit-funding-program.html",
    "Public Defender": "public-defender.html",
    "South Walton Fire & State Control": "south-walton-fire-and-state-control.html",
    "State Attorney": "state-attorney.html",
    "Statutory & Other Agency Funding": "statutory-and-other-agency-funding.html",
    "Walton County Health Department": "walton-county-health-department.html",
    "Building Construction and Maintenance": "building-construction-and-maintenance.html",
    "Building Department": "building-department.html",
    "Code Compliance": "code-compliance.html",
    "County Administration": "county-administration.html",
    "Eagle Springs Golf and Recreation Center": "eagle-springs-golf-and-recreation-center.html",
    "Eagle Springs Grill": "eagle-springs-grill.html",
    "Emergency Management": "emergency-management.html",
    "Engineering Department": "engineering-department.html",
    "Environmental Resources": "environmental-resources.html",
    "Extension Office": "extension-office.html",
    "Geographic Info Systems": "geographic-info-systems.html",
    "Housing & Urban Development": "housing-and-urban-development.html",
    "Human Resources": "human-resources.html",
    "Libraries": "libraries.html",
    "Mosquito Control": "mosquito-control.html",
    "Mossy Head Wastewater Treatment Facility": "mossy-head-wastewater-treatment-facility.html",
    "Office of Management and Budget": "office-of-management-and-budget.html",
    "Office of the County Attorney": "office-of-the-county-attorney.html",
    "Planning": "planning.html",
    "Probation": "probation.html",
    "Public Works": "public-works.html",
    "Purchasing": "purchasing.html",
    "Recreation": "recreation.html",
    "Soil Conservation": "soil-conservation.html",
    "Solid Waste": "solid-waste.html",
    "Tourism Administration": "tourism-administration.html",
    "Tourism Beach Operations": "tourism-beach-operations.html",
    "Tourism Lifeguard Services and Beach Safety": "tourism-lifeguard-services-and-beach-safety.html",
    "Veteran Services": "veteran-services.html",
    "Capital Improvement Plan": "capital-improvement-plan.html",
    "CIP Project Search": "search.html",
    "Capital Projects Fund Schedule": "cip-capital-projects.html",
    "Grant Funded Schedule": "cip-grants.html",
    "Sheriff Fund Schedule": "cip-sheriff.html",
    "Tourist Development Fund Schedule": "cip-tourist-development.html",
    "Transportation Fund Schedule": "cip-transportation.html",
    "Debt Overview": "debt-overview.html",
    "Financial Forecast": "financial-forecast.html",
    "Glossary, Acronyms, and Frequently Asked Questions": "glossary-acronyms-and-frequently-asked-questions.html",
    "Statistical & Supplemental Information": "statistical-and-supplemental-information.html"
  };

  function normalizeBudgetPageHref(page){
    const localHref = localHrefMap[page.title];
    if(!localHref){
      return page.href;
    }

    const isPagesPath = /\/pages\//.test(window.location.pathname);
    return isPagesPath ? localHref : "pages/" + localHref;
  }

  window.wcBudgetPages.forEach(function(page){
    page.href = normalizeBudgetPageHref(page);

    const keywords = keywordMap[page.title] || [];

    page.keywords = Array.from(new Set([
      ...(Array.isArray(page.keywords) ? page.keywords : []),
      ...keywords
    ]));
  });
})();
