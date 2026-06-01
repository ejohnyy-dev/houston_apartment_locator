/**
 * Leads Report Generator
 * 
 * Generates professional Excel reports for lead capture data with:
 * - Lead contact information
 * - Inquiry details and preferences
 * - Timeline and source tracking
 * - Summary statistics and trends
 */

import { Workbook, Worksheet, Font, PatternFill, Alignment, Border, Side } from "openpyxl";

export interface LeadRecord {
  id: string;
  name: string;
  email: string;
  phone: string;
  apartmentName: string;
  moveInDate?: string;
  message?: string;
  createdAt: Date;
  source: string;
}

// Theme colors (Elegant Black)
const THEME = {
  primary: "2D2D2D",
  light: "E5E5E5",
  accent: "2D2D2D",
  positive: "2E7D32",
  warning: "F57C00",
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

export async function generateLeadsReport(leads: LeadRecord[]): Promise<Buffer> {
  const workbook = new Workbook();
  
  // Create Overview sheet
  const overviewSheet = workbook.addWorksheet("Overview");
  createOverviewSheet(overviewSheet, leads);
  
  // Create Leads sheet
  const leadsSheet = workbook.addWorksheet("Leads");
  createLeadsSheet(leadsSheet, leads);
  
  // Create Summary sheet
  const summarySheet = workbook.addWorksheet("Summary");
  createSummarySheet(summarySheet, leads);
  
  // Set default sheet to Overview
  workbook.worksheets[0].state = "visible";
  
  // Return workbook as buffer
  const buffer = await workbook.xlsx.writeBuffer();
  return buffer as Buffer;
}

function createOverviewSheet(ws: Worksheet, leads: LeadRecord[]): void {
  ws.sheet_view.showGridLines = false;
  ws.column_dimensions["A"].width = 3;
  
  // Title
  ws.cell(2, 2).value = "Leads Report";
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
  
  // Key metrics
  const metrics = calculateMetrics(leads);
  
  ws.cell(5, 2).value = "KEY METRICS";
  ws.cell(5, 2).font = new Font({
    name: FONTS.serif,
    size: 14,
    bold: true,
    color: THEME.primary,
  });
  
  let row = 6;
  const metricItems = [
    ["Total Leads", metrics.total],
    ["This Month", metrics.thisMonth],
    ["This Week", metrics.thisWeek],
    ["Today", metrics.today],
    ["Unique Apartments", metrics.uniqueApartments],
    ["Top Source", metrics.topSource],
  ];
  
  for (const [label, value] of metricItems) {
    ws.cell(row, 2).value = label;
    ws.cell(row, 2).font = new Font({ name: FONTS.sans, size: 11 });
    
    ws.cell(row, 3).value = value;
    ws.cell(row, 3).font = new Font({ name: FONTS.sans, size: 11, bold: true });
    ws.cell(row, 3).alignment = new Alignment({ horizontal: "right" });
    
    row += 1;
  }
  
  // Contents
  row += 2;
  ws.cell(row, 2).value = "CONTENTS";
  ws.cell(row, 2).font = new Font({
    name: FONTS.serif,
    size: 14,
    bold: true,
    color: THEME.primary,
  });
  
  row += 1;
  const sheets = ["Leads", "Summary"];
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

function createLeadsSheet(ws: Worksheet, leads: LeadRecord[]): void {
  ws.sheet_view.showGridLines = false;
  ws.column_dimensions["A"].width = 3;
  
  // Title
  ws.cell(2, 2).value = "Lead Details";
  ws.cell(2, 2).font = new Font({
    name: FONTS.serif,
    size: 14,
    bold: true,
    color: THEME.primary,
  });
  
  // Column headers
  const headers = ["Date", "Name", "Email", "Phone", "Apartment", "Move-In Date", "Source"];
  
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
  
  // Sort leads by date (newest first)
  const sortedLeads = [...leads].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  
  // Data rows
  sortedLeads.forEach((lead, index) => {
    const row = headerRow + 1 + index;
    
    const values = [
      lead.createdAt.toLocaleDateString("en-US"),
      lead.name,
      lead.email,
      lead.phone,
      lead.apartmentName,
      lead.moveInDate || "",
      lead.source,
    ];
    
    values.forEach((value, colIndex) => {
      const cell = ws.cell(row, colIndex + 2);
      cell.value = value;
      cell.font = new Font({ name: FONTS.sans, size: 11 });
      cell.border = BORDERS.thin;
    });
  });
  
  // Freeze panes
  ws.views = [{ state: "frozen", xSplit: 1, ySplit: 4 }];
  
  // Set column widths
  ws.column_dimensions["B"].width = 12;
  ws.column_dimensions["C"].width = 20;
  ws.column_dimensions["D"].width = 18;
  ws.column_dimensions["E"].width = 16;
  ws.column_dimensions["F"].width = 20;
  ws.column_dimensions["G"].width = 14;
  ws.column_dimensions["H"].width = 12;
}

function createSummarySheet(ws: Worksheet, leads: LeadRecord[]): void {
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
  
  // Leads by apartment
  const apartmentStats = calculateApartmentStats(leads);
  
  ws.cell(4, 2).value = "TOP APARTMENTS";
  ws.cell(4, 2).font = new Font({
    name: FONTS.serif,
    size: 12,
    bold: true,
    color: THEME.primary,
  });
  
  // Headers
  const headerRow = 5;
  ws.cell(headerRow, 2).value = "Apartment";
  ws.cell(headerRow, 3).value = "Leads";
  ws.cell(headerRow, 4).value = "% of Total";
  
  [2, 3, 4].forEach((col) => {
    const cell = ws.cell(headerRow, col);
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
  
  // Data
  let row = headerRow + 1;
  const totalLeads = leads.length;
  
  for (const [apartment, count] of apartmentStats.slice(0, 10)) {
    ws.cell(row, 2).value = apartment;
    ws.cell(row, 3).value = count;
    ws.cell(row, 4).value = totalLeads > 0 ? count / totalLeads : 0;
    
    ws.cell(row, 4).number_format = "0.0%";
    
    [2, 3, 4].forEach((col) => {
      ws.cell(row, col).border = BORDERS.thin;
    });
    
    row += 1;
  }
  
  // Leads by source
  row += 2;
  ws.cell(row, 2).value = "LEADS BY SOURCE";
  ws.cell(row, 2).font = new Font({
    name: FONTS.serif,
    size: 12,
    bold: true,
    color: THEME.primary,
  });
  
  const sourceStats = calculateSourceStats(leads);
  
  row += 1;
  ws.cell(row, 2).value = "Source";
  ws.cell(row, 3).value = "Count";
  ws.cell(row, 4).value = "% of Total";
  
  [2, 3, 4].forEach((col) => {
    const cell = ws.cell(row, col);
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
  
  row += 1;
  for (const [source, count] of sourceStats) {
    ws.cell(row, 2).value = source;
    ws.cell(row, 3).value = count;
    ws.cell(row, 4).value = totalLeads > 0 ? count / totalLeads : 0;
    
    ws.cell(row, 4).number_format = "0.0%";
    
    [2, 3, 4].forEach((col) => {
      ws.cell(row, col).border = BORDERS.thin;
    });
    
    row += 1;
  }
  
  // Set column widths
  ws.column_dimensions["B"].width = 25;
  ws.column_dimensions["C"].width = 10;
  ws.column_dimensions["D"].width = 12;
}

function calculateMetrics(leads: LeadRecord[]) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
  const monthAgo = new Date(now.getFullYear(), now.getMonth(), 1);
  
  const thisMonth = leads.filter((l) => l.createdAt >= monthAgo).length;
  const thisWeek = leads.filter((l) => l.createdAt >= weekAgo).length;
  const todayCount = leads.filter((l) => {
    const leadDate = new Date(l.createdAt.getFullYear(), l.createdAt.getMonth(), l.createdAt.getDate());
    return leadDate.getTime() === today.getTime();
  }).length;
  
  const apartments = new Set(leads.map((l) => l.apartmentName));
  const sourceStats = calculateSourceStats(leads);
  const topSource = sourceStats.length > 0 ? sourceStats[0][0] : "N/A";
  
  return {
    total: leads.length,
    thisMonth,
    thisWeek,
    today: todayCount,
    uniqueApartments: apartments.size,
    topSource,
  };
}

function calculateApartmentStats(leads: LeadRecord[]): Array<[string, number]> {
  const stats: Record<string, number> = {};
  
  for (const lead of leads) {
    stats[lead.apartmentName] = (stats[lead.apartmentName] || 0) + 1;
  }
  
  return Object.entries(stats).sort((a, b) => b[1] - a[1]);
}

function calculateSourceStats(leads: LeadRecord[]): Array<[string, number]> {
  const stats: Record<string, number> = {};
  
  for (const lead of leads) {
    stats[lead.source] = (stats[lead.source] || 0) + 1;
  }
  
  return Object.entries(stats).sort((a, b) => b[1] - a[1]);
}
