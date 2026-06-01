/**
 * Apartment Inventory Excel Report Generator
 * 
 * Generates professional Excel reports for apartment listings with:
 * - Comprehensive property details
 * - Pricing and availability
 * - Photo counts and neighborhoods
 * - Summary statistics
 * - Data quality indicators
 */

import { Workbook, Worksheet, Font, PatternFill, Alignment, Border, Side } from "openpyxl";
import { PropertyApartment } from "../propertyDatabase";

// Theme colors (Elegant Black)
const THEME = {
  primary: "2D2D2D",
  light: "E5E5E5",
  accent: "2D2D2D",
  positive: "2E7D32",
  negative: "C62828",
};

const FONTS = {
  serif: "Source Serif Pro",
  sans: "Calibri",
};

const BORDERS = {
  thin: new Border({
    left: new Side({ style: "thin", color: "CCCCCC" }),
    right: new Side({ style: "thin", color: "CCCCCC" }),
    top: new Side({ style: "thin", color: "CCCCCC" }),
    bottom: new Side({ style: "thin", color: "CCCCCC" }),
  }),
};

export async function generateApartmentInventoryReport(apartments: PropertyApartment[]): Promise<Buffer> {
  const workbook = new Workbook();
  
  // Create Overview sheet
  const overviewSheet = workbook.addWorksheet("Overview");
  createOverviewSheet(overviewSheet, apartments);
  
  // Create Inventory sheet
  const inventorySheet = workbook.addWorksheet("Inventory");
  createInventorySheet(inventorySheet, apartments);
  
  // Create Summary sheet
  const summarySheet = workbook.addWorksheet("Summary");
  createSummarySheet(summarySheet, apartments);
  
  // Set default sheet to Overview
  workbook.worksheets[0].state = "visible";
  
  // Return workbook as buffer
  const buffer = await workbook.xlsx.writeBuffer();
  return buffer as Buffer;
}

function createOverviewSheet(ws: Worksheet, apartments: PropertyApartment[]): void {
  ws.sheet_view.showGridLines = false;
  ws.column_dimensions["A"].width = 3;
  
  // Title
  ws.cell(2, 2).value = "Apartment Inventory Report";
  ws.cell(2, 2).font = new Font({
    name: FONTS.serif,
    size: 18,
    bold: true,
    color: THEME.primary,
  });
  
  // Generated date
  ws.cell(3, 2).value = `Generated: ${new Date().toLocaleDateString("en-US")}`;
  ws.cell(3, 2).font = new Font({
    name: FONTS.sans,
    size: 10,
    italic: true,
    color: "666666",
  });
  
  // Key metrics section
  const metrics = calculateMetrics(apartments);
  
  ws.cell(5, 2).value = "KEY METRICS";
  ws.cell(5, 2).font = new Font({
    name: FONTS.serif,
    size: 14,
    bold: true,
    color: THEME.primary,
  });
  
  let row = 6;
  const metricItems = [
    ["Total Properties", metrics.total],
    ["With Pricing", metrics.withPricing],
    ["With Photos", metrics.withPhotos],
    ["Average Rent", `$${metrics.avgRent.toLocaleString()}`],
    ["Price Range", `$${metrics.minRent.toLocaleString()} - $${metrics.maxRent.toLocaleString()}`],
    ["Neighborhoods", metrics.neighborhoods],
    ["Average Bedrooms", metrics.avgBedrooms.toFixed(1)],
  ];
  
  for (const [label, value] of metricItems) {
    ws.cell(row, 2).value = label;
    ws.cell(row, 2).font = new Font({ name: FONTS.sans, size: 11 });
    
    ws.cell(row, 3).value = value;
    ws.cell(row, 3).font = new Font({ name: FONTS.sans, size: 11, bold: true });
    ws.cell(row, 3).alignment = new Alignment({ horizontal: "right" });
    
    row += 1;
  }
  
  // Contents section
  row += 2;
  ws.cell(row, 2).value = "CONTENTS";
  ws.cell(row, 2).font = new Font({
    name: FONTS.serif,
    size: 14,
    bold: true,
    color: THEME.primary,
  });
  
  row += 1;
  const sheets = ["Inventory", "Summary"];
  for (const sheet of sheets) {
    const cell = ws.cell(row, 2);
    cell.value = sheet;
    cell.hyperlink = `#'${sheet}'!A1`;
    cell.font = new Font({
      name: FONTS.sans,
      size: 11,
      color: THEME.accent,
      underline: "single",
    });
    row += 1;
  }
}

function createInventorySheet(ws: Worksheet, apartments: PropertyApartment[]): void {
  ws.sheet_view.showGridLines = false;
  ws.column_dimensions["A"].width = 3;
  
  // Title
  ws.cell(2, 2).value = "Apartment Inventory";
  ws.cell(2, 2).font = new Font({
    name: FONTS.serif,
    size: 14,
    bold: true,
    color: THEME.primary,
  });
  
  // Column headers
  const headers = [
    "Name",
    "Neighborhood",
    "Bedrooms",
    "Bathrooms",
    "Min Rent",
    "Max Rent",
    "Photos",
    "City",
    "Built Year",
  ];
  
  const headerRow = 4;
  headers.forEach((header, index) => {
    const cell = ws.cell(headerRow, index + 2);
    cell.value = header;
    cell.font = new Font({
      name: FONTS.serif,
      size: 10,
      bold: true,
      color: "FFFFFF",
    });
    cell.fill = new PatternFill({
      type: "solid",
      fgColor: THEME.primary,
    });
    cell.alignment = new Alignment({ horizontal: "center", vertical: "center" });
    cell.border = BORDERS.thin;
  });
  
  // Data rows
  apartments.forEach((apt, index) => {
    const row = headerRow + 1 + index;
    
    const values = [
      apt.name,
      apt.neighborhood || "",
      apt.bedrooms,
      apt.bathrooms,
      apt.rentMin,
      apt.rentMax || "",
      apt.photos.length,
      apt.city,
      apt.builtYear || "",
    ];
    
    values.forEach((value, colIndex) => {
      const cell = ws.cell(row, colIndex + 2);
      cell.value = value;
      cell.font = new Font({ name: FONTS.sans, size: 11 });
      cell.border = BORDERS.thin;
      
      // Format numbers
      if (colIndex === 4 || colIndex === 5) {
        cell.number_format = "$#,##0";
      }
      
      // Center align numeric columns
      if ([2, 3, 4, 5, 6, 8].includes(colIndex)) {
        cell.alignment = new Alignment({ horizontal: "right" });
      }
    });
  });
  
  // Freeze panes
  ws.views = [{ state: "frozen", xSplit: 1, ySplit: 4 }];
  
  // Set column widths
  ws.column_dimensions["B"].width = 30;
  ws.column_dimensions["C"].width = 15;
  ws.column_dimensions["D"].width = 10;
  ws.column_dimensions["E"].width = 10;
  ws.column_dimensions["F"].width = 12;
  ws.column_dimensions["G"].width = 12;
  ws.column_dimensions["H"].width = 8;
  ws.column_dimensions["I"].width = 12;
  ws.column_dimensions["J"].width = 12;
}

function createSummarySheet(ws: Worksheet, apartments: PropertyApartment[]): void {
  ws.sheet_view.showGridLines = false;
  ws.column_dimensions["A"].width = 3;
  
  // Title
  ws.cell(2, 2).value = "Summary Statistics";
  ws.cell(2, 2).font = new Font({
    name: FONTS.serif,
    size: 14,
    bold: true,
    color: THEME.primary,
  });
  
  const metrics = calculateMetrics(apartments);
  
  // Statistics by neighborhood
  const neighborhoodStats = calculateNeighborhoodStats(apartments);
  
  ws.cell(4, 2).value = "PROPERTIES BY NEIGHBORHOOD";
  ws.cell(4, 2).font = new Font({
    name: FONTS.serif,
    size: 12,
    bold: true,
    color: THEME.primary,
  });
  
  // Neighborhood headers
  const nhRow = 5;
  ws.cell(nhRow, 2).value = "Neighborhood";
  ws.cell(nhRow, 3).value = "Count";
  ws.cell(nhRow, 4).value = "Avg Rent";
  ws.cell(nhRow, 5).value = "Min Rent";
  ws.cell(nhRow, 6).value = "Max Rent";
  
  [2, 3, 4, 5, 6].forEach((col) => {
    const cell = ws.cell(nhRow, col);
    cell.font = new Font({
      name: FONTS.serif,
      size: 10,
      bold: true,
      color: "FFFFFF",
    });
    cell.fill = new PatternFill({
      type: "solid",
      fgColor: THEME.primary,
    });
    cell.border = BORDERS.thin;
  });
  
  // Neighborhood data
  let row = nhRow + 1;
  for (const [neighborhood, stats] of Object.entries(neighborhoodStats)) {
    ws.cell(row, 2).value = neighborhood;
    ws.cell(row, 3).value = stats.count;
    ws.cell(row, 4).value = stats.avgRent;
    ws.cell(row, 5).value = stats.minRent;
    ws.cell(row, 6).value = stats.maxRent;
    
    // Format currency columns
    [4, 5, 6].forEach((col) => {
      ws.cell(row, col).number_format = "$#,##0";
    });
    
    [2, 3, 4, 5, 6].forEach((col) => {
      ws.cell(row, col).border = BORDERS.thin;
    });
    
    row += 1;
  }
  
  // Set column widths
  ws.column_dimensions["B"].width = 20;
  ws.column_dimensions["C"].width = 10;
  ws.column_dimensions["D"].width = 12;
  ws.column_dimensions["E"].width = 12;
  ws.column_dimensions["F"].width = 12;
}

function calculateMetrics(apartments: PropertyApartment[]) {
  const withPricing = apartments.filter((a) => a.rentMin > 0);
  const withPhotos = apartments.filter((a) => a.photos.length > 0);
  const neighborhoods = new Set(apartments.map((a) => a.neighborhood).filter(Boolean));
  
  const rents = withPricing.map((a) => a.rentMin);
  const bedrooms = apartments.map((a) => a.bedrooms);
  
  return {
    total: apartments.length,
    withPricing: withPricing.length,
    withPhotos: withPhotos.length,
    avgRent: rents.length > 0 ? Math.round(rents.reduce((a, b) => a + b, 0) / rents.length) : 0,
    minRent: rents.length > 0 ? Math.min(...rents) : 0,
    maxRent: rents.length > 0 ? Math.max(...rents) : 0,
    neighborhoods: neighborhoods.size,
    avgBedrooms: bedrooms.length > 0 ? bedrooms.reduce((a, b) => a + b, 0) / bedrooms.length : 0,
  };
}

function calculateNeighborhoodStats(apartments: PropertyApartment[]) {
  const stats: Record<string, { count: number; rents: number[]; minRent: number; maxRent: number }> = {};
  
  for (const apt of apartments) {
    const nh = apt.neighborhood || "Unknown";
    if (!stats[nh]) {
      stats[nh] = { count: 0, rents: [], minRent: Infinity, maxRent: 0 };
    }
    stats[nh].count += 1;
    if (apt.rentMin > 0) {
      stats[nh].rents.push(apt.rentMin);
      stats[nh].minRent = Math.min(stats[nh].minRent, apt.rentMin);
      stats[nh].maxRent = Math.max(stats[nh].maxRent, apt.rentMin);
    }
  }
  
  const result: Record<string, { count: number; avgRent: number; minRent: number; maxRent: number }> = {};
  for (const [nh, data] of Object.entries(stats)) {
    result[nh] = {
      count: data.count,
      avgRent: data.rents.length > 0 ? Math.round(data.rents.reduce((a, b) => a + b, 0) / data.rents.length) : 0,
      minRent: data.minRent === Infinity ? 0 : data.minRent,
      maxRent: data.maxRent,
    };
  }
  
  return result;
}
