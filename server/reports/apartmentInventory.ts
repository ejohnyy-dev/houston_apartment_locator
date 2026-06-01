/**
 * Apartment Inventory Excel Report Generator
 * 
 * Generates professional Excel reports for apartment listings with:
 * - Comprehensive property details
 * - Pricing and availability
 * - Photo counts and neighborhoods
 * - Summary statistics
 */

import ExcelJS from "exceljs";
import { PropertyApartment } from "../propertyDatabase";

// Theme colors
const COLORS = {
  primary: "2D2D2D",
  accent: "C9A84C",
  lightGray: "F5F5F5",
  white: "FFFFFF",
  positive: "2E7D32",
};

export async function generateApartmentInventoryReport(apartments: PropertyApartment[]): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Houston Apartment Locator";
  workbook.created = new Date();

  // Create Overview sheet
  const overviewSheet = workbook.addWorksheet("Overview");
  createOverviewSheet(overviewSheet, apartments);

  // Create Inventory sheet
  const inventorySheet = workbook.addWorksheet("Inventory");
  createInventorySheet(inventorySheet, apartments);

  // Create Summary sheet
  const summarySheet = workbook.addWorksheet("Summary");
  createSummarySheet(summarySheet, apartments);

  // Return workbook as buffer
  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

function createOverviewSheet(ws: ExcelJS.Worksheet, apartments: PropertyApartment[]): void {
  ws.views = [{ showGridLines: false }];

  // Title
  ws.getCell("B2").value = "Apartment Inventory Report";
  ws.getCell("B2").font = { name: "Calibri", size: 18, bold: true, color: { argb: COLORS.primary } };

  // Generated date
  ws.getCell("B3").value = `Generated: ${new Date().toLocaleDateString("en-US")}`;
  ws.getCell("B3").font = { name: "Calibri", size: 10, italic: true, color: { argb: "666666" } };

  // Key metrics
  const metrics = calculateMetrics(apartments);

  ws.getCell("B5").value = "KEY METRICS";
  ws.getCell("B5").font = { name: "Calibri", size: 14, bold: true, color: { argb: COLORS.primary } };

  const metricItems: [string, string | number][] = [
    ["Total Properties", metrics.total],
    ["With Pricing", metrics.withPricing],
    ["With Photos", metrics.withPhotos],
    ["Average Rent", `$${metrics.avgRent.toLocaleString()}`],
    ["Price Range", `$${metrics.minRent.toLocaleString()} – $${metrics.maxRent.toLocaleString()}`],
    ["Neighborhoods", metrics.neighborhoods],
    ["Average Bedrooms", metrics.avgBedrooms.toFixed(1)],
  ];

  metricItems.forEach(([label, value], i) => {
    const row = 6 + i;
    ws.getCell(`B${row}`).value = label;
    ws.getCell(`B${row}`).font = { name: "Calibri", size: 11 };
    ws.getCell(`C${row}`).value = value;
    ws.getCell(`C${row}`).font = { name: "Calibri", size: 11, bold: true };
    ws.getCell(`C${row}`).alignment = { horizontal: "right" };
  });

  // Column widths
  ws.getColumn("A").width = 3;
  ws.getColumn("B").width = 22;
  ws.getColumn("C").width = 22;
}

function createInventorySheet(ws: ExcelJS.Worksheet, apartments: PropertyApartment[]): void {
  ws.views = [{ showGridLines: false, state: "frozen", xSplit: 0, ySplit: 4 }];

  // Title
  ws.getCell("B2").value = "Apartment Inventory";
  ws.getCell("B2").font = { name: "Calibri", size: 14, bold: true, color: { argb: COLORS.primary } };

  // Headers
  const headers = ["Name", "Neighborhood", "Bedrooms", "Bathrooms", "Min Rent", "Max Rent", "Photos", "Built Year"];
  const headerCols = ["B", "C", "D", "E", "F", "G", "H", "I"];

  headers.forEach((header, i) => {
    const cell = ws.getCell(`${headerCols[i]}4`);
    cell.value = header;
    cell.font = { name: "Calibri", size: 10, bold: true, color: { argb: COLORS.white } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLORS.primary } };
    cell.alignment = { horizontal: "center", vertical: "middle" };
    cell.border = {
      top: { style: "thin", color: { argb: "CCCCCC" } },
      bottom: { style: "thin", color: { argb: "CCCCCC" } },
      left: { style: "thin", color: { argb: "CCCCCC" } },
      right: { style: "thin", color: { argb: "CCCCCC" } },
    };
  });

  // Data rows
  apartments.forEach((apt, index) => {
    const rowNum = 5 + index;
    const values: (string | number | null)[] = [
      apt.name,
      apt.neighborhood || "",
      apt.bedrooms,
      apt.bathrooms,
      apt.rentMin || "",
      apt.rentMax || "",
      apt.photos.length,
      apt.builtYear || "",
    ];

    values.forEach((value, colIndex) => {
      const cell = ws.getCell(`${headerCols[colIndex]}${rowNum}`);
      cell.value = value as ExcelJS.CellValue;
      cell.font = { name: "Calibri", size: 10 };
      cell.border = {
        top: { style: "thin", color: { argb: "EEEEEE" } },
        bottom: { style: "thin", color: { argb: "EEEEEE" } },
        left: { style: "thin", color: { argb: "EEEEEE" } },
        right: { style: "thin", color: { argb: "EEEEEE" } },
      };

      // Currency format for rent columns
      if (colIndex === 4 || colIndex === 5) {
        cell.numFmt = "$#,##0";
        cell.alignment = { horizontal: "right" };
      }

      // Alternate row shading
      if (index % 2 === 0) {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLORS.lightGray } };
      }
    });
  });

  // Column widths
  ws.getColumn("A").width = 3;
  ws.getColumn("B").width = 32;
  ws.getColumn("C").width = 18;
  ws.getColumn("D").width = 10;
  ws.getColumn("E").width = 10;
  ws.getColumn("F").width = 12;
  ws.getColumn("G").width = 12;
  ws.getColumn("H").width = 8;
  ws.getColumn("I").width = 12;
}

function createSummarySheet(ws: ExcelJS.Worksheet, apartments: PropertyApartment[]): void {
  ws.views = [{ showGridLines: false }];

  ws.getCell("B2").value = "Summary Statistics";
  ws.getCell("B2").font = { name: "Calibri", size: 14, bold: true, color: { argb: COLORS.primary } };

  ws.getCell("B4").value = "PROPERTIES BY NEIGHBORHOOD";
  ws.getCell("B4").font = { name: "Calibri", size: 12, bold: true, color: { argb: COLORS.primary } };

  // Neighborhood table headers
  const nhHeaders = ["Neighborhood", "Count", "Avg Rent", "Min Rent", "Max Rent"];
  const nhCols = ["B", "C", "D", "E", "F"];

  nhHeaders.forEach((header, i) => {
    const cell = ws.getCell(`${nhCols[i]}5`);
    cell.value = header;
    cell.font = { name: "Calibri", size: 10, bold: true, color: { argb: COLORS.white } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLORS.primary } };
    cell.border = {
      top: { style: "thin", color: { argb: "CCCCCC" } },
      bottom: { style: "thin", color: { argb: "CCCCCC" } },
      left: { style: "thin", color: { argb: "CCCCCC" } },
      right: { style: "thin", color: { argb: "CCCCCC" } },
    };
  });

  const neighborhoodStats = calculateNeighborhoodStats(apartments);
  let row = 6;

  for (const [neighborhood, stats] of Object.entries(neighborhoodStats).sort((a, b) => b[1].count - a[1].count)) {
    ws.getCell(`B${row}`).value = neighborhood;
    ws.getCell(`C${row}`).value = stats.count;
    ws.getCell(`D${row}`).value = stats.avgRent;
    ws.getCell(`E${row}`).value = stats.minRent;
    ws.getCell(`F${row}`).value = stats.maxRent;

    ["D", "E", "F"].forEach((col) => {
      ws.getCell(`${col}${row}`).numFmt = "$#,##0";
      ws.getCell(`${col}${row}`).alignment = { horizontal: "right" };
    });

    nhCols.forEach((col) => {
      ws.getCell(`${col}${row}`).border = {
        top: { style: "thin", color: { argb: "EEEEEE" } },
        bottom: { style: "thin", color: { argb: "EEEEEE" } },
        left: { style: "thin", color: { argb: "EEEEEE" } },
        right: { style: "thin", color: { argb: "EEEEEE" } },
      };
    });

    row++;
  }

  // Column widths
  ws.getColumn("A").width = 3;
  ws.getColumn("B").width = 24;
  ws.getColumn("C").width = 10;
  ws.getColumn("D").width = 12;
  ws.getColumn("E").width = 12;
  ws.getColumn("F").width = 12;
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
