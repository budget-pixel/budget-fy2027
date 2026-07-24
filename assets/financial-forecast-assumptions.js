(function () {
  "use strict";

  const funds = [
    ["001", "General Fund"],
    ["107", "Fine & Forfeiture / Sheriff"],
    ["101", "Transportation Fund"],
    ["112", "Solid Waste Fund"],
    ["300", "Capital Projects Fund"],
    ["111", "Tourist Development Fund"]
  ];

  const revenueCategories = [
    "General Government Taxes",
    "Intergovernmental Revenues",
    "Charges for Services",
    "Miscellaneous Revenue",
    "Permits Fees and Special Assessments",
    "Other Sources",
    "Judgments, Fines and Forfeits"
  ];

  const expenseCategories = [
    "Personnel Services",
    "Operating Expenses",
    "Capital Outlay",
    "Grants and Aids",
    "Debt Service",
    "Other Uses / Transfers"
  ];

  const revenueManual = {
    "General Government Taxes": [0.025, 0.025, 0.025, 0.025],
    "Intergovernmental Revenues": [0.015, 0.015, 0.015, 0.015],
    "Charges for Services": [0.02, 0.02, 0.02, 0.02],
    "Miscellaneous Revenue": [0.01, 0.01, 0.01, 0.01],
    "Permits Fees and Special Assessments": [0.02, 0.02, 0.02, 0.02],
    "Other Sources": [0, 0, 0, 0],
    "Judgments, Fines and Forfeits": [0, 0, 0, 0]
  };

  const expenseManual = {
    "Personnel Services": [0.035, 0.035, 0.035, 0.035],
    "Operating Expenses": [0.03, 0.03, 0.03, 0.03],
    "Capital Outlay": [0.02, 0.02, 0.02, 0.02],
    "Grants and Aids": [0.025, 0.025, 0.025, 0.025],
    "Debt Service": [0, 0, 0, 0],
    "Other Uses / Transfers": [0.01, 0.01, 0.01, 0.01]
  };

  const fundOverrides = {
    "001": {
      expense: {
        "Personnel Services": [0.02, 0.02, 0.02, 0.02],
        "Operating Expenses": [0.02, 0.02, 0.02, 0.02],
        "Capital Outlay": [0.02, 0.02, 0.02, 0.02],
        "Grants and Aids": [0.02, 0.02, 0.02, 0.02],
        "Debt Service": [0, 0, 0, 0],
        "Other Uses / Transfers": [0.02, 0.02, 0.02, 0.02]
      },
      method: "revenue-constrained growth",
      notes: "General Fund department expenditures are limited to 2% annual growth so recurring costs remain supportable by projected recurring revenue. BCC Contingency remains flat, and separately linked interfund transfers retain their shared-revenue assumptions."
    },
    "101": {
      revenue: {
        "Other Sources": [0.025, 0.025, 0.025, 0.025]
      },
      method: "shared revenue growth",
      notes: "Transportation's share of the Local Discretionary Sales Surtax is recorded as an Interfund Transfer In. The transfer is forecast at the same 2.5% annual growth rate as the shared sales-tax revenue while fund balance remains free to increase or decrease."
    },
    "107": {
      method: "transfer-supported forecast",
      notes: "The Sheriff Fund's Interfund Transfer In is calculated each year as the amount needed to support forecast expenditures after applying the fund's other projected revenues. The Walton County Sheriff's Office expense line uses a 2.5% management estimate while other Fund 107 expenses retain their normal assumptions."
    },
    "300": {
      revenue: {
        "Other Sources": [0, 0, 0, 0],
        "Intergovernmental Revenues": [0, 0, 0, 0]
      },
      expense: {
        "Capital Outlay": [null, null, null, null],
        "Other Uses / Transfers": [null, null, null, null]
      },
      method: "CIP schedule/manual financing",
      notes: "Capital Projects Fund expenditures are driven by the Capital Improvement Plan. Revenue/transfers remain manual because financing may come from transfers, grants, debt proceeds, reserves, or other one-time sources."
    },
    "111": {
      revenue: {
        "General Government Taxes": [0.01, 0.01, 0.01, 0.01],
        "Charges for Services": [0.01, 0.01, 0.01, 0.01],
        "Miscellaneous Revenue": [0, 0, 0, 0]
      },
      method: "conservative manual growth",
      notes: "Tourist Development Fund revenue uses conservative manual assumptions because tourism-related revenue may fluctuate."
    }
  };

  function assumptionRows(lineType, categories, defaults) {
    const rows = [];
    funds.forEach(([fundCode, fundName]) => {
      categories.forEach((category) => {
        const override = fundOverrides[fundCode] && fundOverrides[fundCode][lineType] && fundOverrides[fundCode][lineType][category];
        const rates = override || defaults[category] || [null, null, null, null];
        const hasManual = rates.some((rate) => rate !== null && rate !== undefined && rate !== "");
        rows.push({
          fund_code: fundCode,
          fund_name: fundName,
          line_type: lineType,
          category,
          fy2028_assumption: rates[0],
          fy2029_assumption: rates[1],
          fy2030_assumption: rates[2],
          fy2031_assumption: rates[3],
          method: override ? (fundOverrides[fundCode].method || "manual override") : "manual growth assumption",
          manual_override: hasManual,
          notes: override ? (fundOverrides[fundCode].notes || "") : "Editable manual assumption. Blank values fall back to the capped suggested trend."
        });
      });
    });
    return rows;
  }

  window.WCFinancialForecastAssumptions = assumptionRows("revenue", revenueCategories, revenueManual)
    .concat(assumptionRows("expense", expenseCategories, expenseManual));
})();
