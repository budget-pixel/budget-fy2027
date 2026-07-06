(function () {
  "use strict";

  const CAPITAL_PROJECTS_CSV_URL =
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vRc6KHhTwcdREn_SvLONy_cucXH8NxF45hgdyn8IoFGSeTbIVKtDGMMWsbgSFpMizxtxy_fE-pAMmiu/pub?gid=1388930304&single=true&output=csv";
  const FISCAL_YEARS = ["FY2027", "FY2028", "FY2029", "FY2030", "FY2031"];
  const PROJECT_IMAGE_FILES = [
    "abt-martin-dirt-to-pave.jpg",
    "amaryllis-lane-dirt-to-pave.jpg",
    "arbour-street-dirt-to-pave.jpg",
    "bluebottle-court-dirt-to-pave.jpg",
    "chat-holley-road-resurfacing.png",
    "clover-lane-dirt-to-pave.jpg",
    "cook-road-reconstruction.jpg",
    "cook-road-reconstruction.png",
    "cowslip-court-dirt-to-pave.jpg",
    "daisy-lane-dirt-to-pave.jpg",
    "dalton-drive.png",
    "hewett-bayou-connector-rd-e-lamb-drive-extension.jpg",
    "huckaba-road-604114-bridge-replacement.jpg",
    "huckaba_road_604114_bridge_replacement.jpg",
    "iris-lane-resurfacing.jpg",
    "laurel-lane-dirt-to-pave.jpg",
    "marigold-avenue-dirt-to-pave.jpg",
    "may-lilly-court-dirt-to-pave.jpg",
    "nancy-darby-rd-paving-resurfacing.jpg",
    "north-lake-drive.jpg",
    "oak-grove-road-phase-2-reconstruction-resurfacing.jpg",
    "oakwood-lakes-hwy-331-south-turn-lane.png",
    "passion-flower-street-dirt-to-pave.jpg",
    "pinetree-lane-dirt-to-pave.png",
    "rio-ranchero-road-dirt-to-pave.jpg"
  ];

  window.wcCipProjects = Array.isArray(window.wcCipProjects) ? window.wcCipProjects : [];

  function parseCSV(text) {
    const rows = [];
    let row = [];
    let field = "";
    let inQuotes = false;
    const src = String(text || "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");

    for (let i = 0; i < src.length; i++) {
      const ch = src[i];
      if (inQuotes) {
        if (ch === '"') {
          if (src[i + 1] === '"') {
            field += '"';
            i++;
          } else {
            inQuotes = false;
          }
        } else {
          field += ch;
        }
        continue;
      }

      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ",") {
        row.push(field);
        field = "";
      } else if (ch === "\n") {
        row.push(field);
        rows.push(row);
        row = [];
        field = "";
      } else {
        field += ch;
      }
    }

    if (field.length || row.length) {
      row.push(field);
      rows.push(row);
    }

    if (!rows.length) return [];
    const headers = rows[0].map((header) => String(header || "").trim());

    return rows
      .slice(1)
      .filter((cells) => cells.some((cell) => String(cell || "").trim() !== ""))
      .map((cells) => {
        const item = {};
        headers.forEach((header, index) => {
          item[header] = cells[index] !== undefined ? cells[index] : "";
        });
        return item;
      });
  }

  function cleanText(value) {
    return String(value === undefined || value === null ? "" : value)
      .replace(/\u00a0/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function get(row, key) {
    return cleanText(row && row[key]);
  }

  function parseMoney(value) {
    const text = cleanText(value).replace(/\$/g, "").replace(/,/g, "");
    if (!text || /^-+$/.test(text)) return 0;
    const amount = Number(text.replace(/[()]/g, ""));
    if (!Number.isFinite(amount)) return 0;
    return /^\(.*\)$/.test(text) ? -amount : amount;
  }

  function formatMoney(value) {
    return "$" + Math.round(Number(value || 0)).toLocaleString("en-US");
  }

  function slugify(value) {
    return cleanText(value)
      .toLowerCase()
      .replace(/&/g, " and ")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "capital-project";
  }

  function projectImageKey(value) {
    return slugify(value)
      .replace(/(^|-)rd(?=-|$)/g, "$1road")
      .replace(/huchaba/g, "huckaba");
  }

  function projectAssetPrefix() {
    const path = window.location && window.location.pathname ? window.location.pathname : "";
    return path.indexOf("/pages/") !== -1 ? "../assets/" : "assets/";
  }

  function projectImagePath(fileName) {
    return projectAssetPrefix() + "images/project-images/" + fileName;
  }

  function findProjectImage(row, values) {
    const imageOptions = PROJECT_IMAGE_FILES.map((fileName) => ({
      fileName,
      slug: projectImageKey(fileName.replace(/\.[a-z0-9]+$/i, ""))
    }));
    const candidates = values
      .concat([
        get(row, "Budget Project Name(s)"),
        get(row, "Budget Project Code(s)"),
        get(row, "Location Name"),
        get(row, "Budget Account Name(s)"),
        get(row, "Project Narrative"),
        get(row, "Pertinent Information")
      ])
      .map(projectImageKey)
      .filter(Boolean);
    const searchableText = candidates.join(" ");
    const normalizedTitle = projectImageKey(get(row, "Budget Project Name(s)") || values[0]);
    const match = imageOptions.find((image) => {
      return candidates.some((candidate) => {
        return candidate === image.slug ||
          image.slug.startsWith(candidate + "-") ||
          candidate.startsWith(image.slug + "-");
      }) || image.slug.split("-").every((token) => searchableText.includes(token));
    });

    const imageUrl = match ? projectImagePath(match.fileName) : "";

    if(/hu(?:ck|ch)aba/.test(searchableText)){
      console.log("[CIP project image debug]", {
        projectTitle:get(row, "Budget Project Name(s)") || values[0] || "",
        normalizedKey:normalizedTitle,
        matchedImageFilename:match ? match.fileName : "",
        image_url:imageUrl
      });
    }

    return imageUrl;
  }

  function compactNarrative(value, fallback) {
    const text = cleanText(value);
    return text || fallback || "No project narrative is currently available.";
  }

  function getStatusClass(phase) {
    const status = cleanText(phase).toLowerCase();
    if (status.includes("construction")) return "wc-status-construction";
    if (status.includes("design")) return "wc-status-design";
    if (status.includes("complete")) return "wc-status-complete";
    return "wc-status-planning";
  }

  function normalizeDepartment(row, title, fund, projectManager) {
    const rawDept = get(row, "Dept");
    const source = [
      rawDept,
      title,
      fund,
      projectManager,
      get(row, "Location Name"),
      get(row, "Budget Account Name(s)")
    ].join(" ").toLowerCase();

    if (/\bsheriff\b/.test(source)) return "Sheriff";
    if (/\btdt\b|\btdc\b|tourist|tourism|beach|dune|30a|miramar|visitor|gulfview|blue mountain/.test(source)) return "Beach Operations";
    if (/\bpw\b|\beng\b|public works|engineering|road|bridge|sidewalk|path|stormwater|drainage|intersection|connector|pave|overlay|resurfacing|transportation/.test(source)) return "Public Works/Engineering";
    // Checked before the generic Administration bucket below -- a sheet Dept
    // of "Building & Contruction Maintenance" (sic) would otherwise match
    // Administration's own "building construction"/"maintenance" terms
    // first and get misclassified (see the Roof Replacement Fire Station 4
    // project, which only ever showed up under the Administration filter
    // because of this).
    if (/\bfm\b|building.{0,4}(construction|contruction|maintenance)|\bfacilit|county buildings|renovation|rehab/.test(source)) return "Building Construction & Maintenance";
    if (/admin|library/.test(source)) return "Administration";
    return rawDept || "Capital Projects";
  }

  function departmentFilterValue(department) {
    const text = cleanText(department).toLowerCase();
    if (text.includes("public works") || text.includes("engineering")) return "public works";
    if (text.includes("beach") || text.includes("tourism")) return "beach operations";
    if (text.includes("sheriff")) return "sheriff";
    if (text.includes("administration") || text === "admin") return "administration";
    if (text.includes("building construction") || text.includes("maintenance")) return "building construction";
    return text;
  }

  function getPrimaryYear(fundingByYear) {
    if (!fundingByYear.length) return "";
    return fundingByYear[fundingByYear.length - 1].year;
  }

  function buildFallbackTitle(row, index) {
    const location = get(row, "Location Name");
    const code = get(row, "Budget Project Code(s)");
    const account = get(row, "Budget Account Name(s)");

    if (location) return location;
    if (account) return account + (code ? " " + code : "");
    return "Capital Project " + (index + 1);
  }

  function normalizeCapitalProjects(rows) {
    const slugCounts = {};

    return rows.map((row, index) => {
      const title = get(row, "Budget Project Name(s)") || buildFallbackTitle(row, index);
      const code = get(row, "Budget Project Code(s)");
      const yearlyFunding = FISCAL_YEARS
        .map((year) => ({
          year,
          amount_value: parseMoney(get(row, year + " Proposed")),
          amount: formatMoney(parseMoney(get(row, year + " Proposed")))
        }))
        .filter((item) => item.amount_value !== 0);
      const totalValue = parseMoney(get(row, "Total FY2027-FY2031"));
      const fund = get(row, "Budget Fund(s)");
      const phase = get(row, "Project Phase") || "Identification";
      const projectManager = get(row, "Project Manager");
      const department = normalizeDepartment(row, title, fund, projectManager);
      let baseSlug = slugify(title);
      if (slugCounts[baseSlug]) {
        baseSlug = slugify([title, code || fund || index + 1].filter(Boolean).join(" "));
      }
      const currentCount = slugCounts[baseSlug] || 0;
      slugCounts[baseSlug] = currentCount + 1;
      const slug = currentCount ? baseSlug + "-" + (currentCount + 1) : baseSlug;
      const targetYears = yearlyFunding.map((item) => item.year);
      const fundingSource = get(row, "Funding Source");
      const narrative = compactNarrative(
        get(row, "Project Narrative"),
        fundingSource || get(row, "Pertinent Information")
      );
      const accountName = get(row, "Budget Account Name(s)");
      const accountCode = get(row, "Budget Account Code(s)");
      const inHouseEngineeringValue = parseMoney(get(row, "In-House Engineering"));
      const isLegacyInHouseEngineeringRow =
        title.toLowerCase().includes("in-house engineering") ||
        accountCode === "534000";
      const hasInHouseEngineering = inHouseEngineeringValue > 0;
      const imageUrl = findProjectImage(row, [title, slug, code, accountName, accountCode]);

      return {
        title,
        slug,
        proposal_name: title,
        dept: department,
        department,
        department_filter: departmentFilterValue(department),
        project_code: code,
        project_manager: projectManager,
        estimated_completion_date: get(row, "Estimated Completion Date"),
        start_date: get(row, "Start Date"),
        priority: get(row, "Project Priority") || "None",
        strategic_goals: get(row, "Strategic Goals"),
        operational_impact: get(row, "Operational Impact"),
        pertinent_information: get(row, "Pertinent Information"),
        location_name: get(row, "Location Name"),
        location: get(row, "Location Name"),
        category: accountName || fund || "Capital Project",
        category_label: accountName || fund || "Capital Project",
        description: narrative,
        budget: formatMoney(totalValue),
        budget_value: totalValue,
        funding_by_year: yearlyFunding,
        funding: fund,
        funding_source: fundingSource,
        image_url: imageUrl,
        district: get(row, "Commissioner District") || "Not specified",
        target: targetYears.join(", ") || getPrimaryYear(yearlyFunding),
        target_years: targetYears,
        status_text: phase,
        status_class: getStatusClass(phase),
        budget_org_code: get(row, "Budget Org Code(s)"),
        budget_account_code: accountCode,
        budget_account_name: accountName,
        is_legacy_in_house_engineering_row: isLegacyInHouseEngineeringRow,
        has_in_house_engineering: hasInHouseEngineering,
        in_house_engineering_value: inHouseEngineeringValue,
        in_house_engineering_value_formatted: hasInHouseEngineering ? formatMoney(inHouseEngineeringValue) : "",
        in_house_engineering_rows: hasInHouseEngineering
          ? [{
              description: title,
              year: "FY2027",
              amount_value: inHouseEngineeringValue,
              amount: formatMoney(inHouseEngineeringValue)
            }]
          : [],
        raw: row
      };
    });
  }

  function fetchCapitalProjects() {
    return fetch(CAPITAL_PROJECTS_CSV_URL, { cache: "no-store" })
      .then((response) => {
        if (!response.ok) {
          throw new Error("Capital projects sheet request failed with status " + response.status);
        }
        return response.text();
      })
      .then(parseCSV)
      .then(normalizeCapitalProjects)
      .then((projects) => {
        window.wcCipProjects = projects;
        return projects;
      });
  }

  window.wcCipFiscalYears = FISCAL_YEARS.slice();
  window.wcCipProjectsReady = fetchCapitalProjects().catch((error) => {
    console.error("Walton CIP: failed to load capital project sheet", error);
    window.wcCipProjects = [];
    return [];
  });
})();
