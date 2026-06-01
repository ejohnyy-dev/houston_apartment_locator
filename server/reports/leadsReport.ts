/**
 * Leads Report Generator
 * 
 * Generates professional Excel reports for lead capture data with:
 * - Lead contact information
 * - Inquiry details and preferences
 * - Timeline and source tracking
 * - Summary statistics and trends
 */

import ExcelJS from "exceljs";

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

const COLORS = {
  primary: "2D2D2D",
  accent: "C9A84C",
  lightGray: "F5F5F5",
  white: "FFFFFF",
};

export async function generateLeadsReport(leads: LeadRecord[]): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Houston Apartment Locator";
  workbook.created = new Date();

  const overviewSheet = workbook.addWorksheet("Overview");
  createOverviewSheet(overviewSheet, leads);

  const leadsSheet = workbook.addWorksheet("Leads");
  createLeadsSheet(leadsSheet, leads);

  const summarySheet = workbook.addWorksheet("Summary");
  createSummarySheet(summarySheet, leads);

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

function createOverviewSheet(ws: ExcelJS.Worksheet, leads: LeadRecord[]): void {
  ws.views = [{ showGridLines: false }];

  ws.getCell("B2").value = "Leads Report";
  ws.getCell("B2").font = { name: "Calibri", size: 18, bold: true, color: { argb: COLORS.primary } };

  ws.getCell("B3").value = `Generated: ${new Date().toLocaleDateString("en-US")}`;
  ws.getCell("B3").font = { name: "Calibri", size: 10, italic: true, color: { argb: "666666" } };

  const metrics = calculateMetrics(leads);

  ws.getCell("B5").value = "KEY METRICS";
  ws.getCell("B5").font = { name: "Calibri", size: 14, bold: true, color: { argb: COLORS.primary } };

  const metricItems: [string, string | number][] = [
    ["Total Leads", metrics.total],
    ["This Month", metrics.thisMonth],
    ["This Week", metrics.thisWeek],
    ["Today", metrics.today],
    ["Unique Apartments", metrics.uniqueApartments],
    ["Top Source", metrics.topSource],
  ];

  metricItems.forEach(([label, value], i) => {
    const row = 6 + i;
    ws.getCell(`B${row}`).value = label;
    ws.getCell(`B${row}`).font = { name: "Calibri", size: 11 };
    ws.getCell(`C${row}`).value = value;
    ws.getCell(`C${row}`).font = { name: "Calibri", size: 11, bold: true };
    ws.getCell(`C${row}`).alignment = { horizontal: "right" };
  });

  ws.getColumn("A").width = 3;
  ws.getColumn("B").width = 22;
  ws.getColumn("C").width = 22;
}

function createLeadsSheet(ws: ExcelJS.Worksheet, leads: LeadRecord[]): void {
  ws.views = [{ showGridLines: false, state: "frozen", xSplit: 0, ySplit: 4 }];

  ws.getCell("B2").value = "Lead Details";
  ws.getCell("B2").font = { name: "Calibri", size: 14, bold: true, color: { argb: COLORS.primary } };

  const headers = ["Date", "Name", "Email", "Phone", "Apartment", "Move-In Date", "Source"];
  const headerCols = ["B", "C", "D", "E", "F", "G", "H"];

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

  const sortedLeads = [...leads].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  sortedLeads.forEach((lead, index) => {
    const rowNum = 5 + index;
    const values: (string | number)[] = [
      lead.createdAt.toLocaleDateString("en-US"),
      lead.name,
      lead.email,
      lead.phone,
      lead.apartmentName,
      lead.moveInDate || "",
      lead.source,
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

      if (index % 2 === 0) {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLORS.lightGray } };
      }
    });
  });

  ws.getColumn("A").width = 3;
  ws.getColumn("B").width = 14;
  ws.getColumn("C").width = 22;
  ws.getColumn("D").width = 22;
  ws.getColumn("E").width = 16;
  ws.getColumn("F").width = 24;
  ws.getColumn("G").width = 14;
  ws.getColumn("H").width = 14;
}

function createSummarySheet(ws: ExcelJS.Worksheet, leads: LeadRecord[]): void {
  ws.views = [{ showGridLines: false }];

  ws.getCell("B2").value = "Summary Statistics";
  ws.getCell("B2").font = { name: "Calibri", size: 14, bold: true, color: { argb: COLORS.primary } };

  // Top apartments
  ws.getCell("B4").value = "TOP APARTMENTS";
  ws.getCell("B4").font = { name: "Calibri", size: 12, bold: true, color: { argb: COLORS.primary } };

  const aptHeaders = ["Apartment", "Leads", "% of Total"];
  const aptCols = ["B", "C", "D"];

  aptHeaders.forEach((header, i) => {
    const cell = ws.getCell(`${aptCols[i]}5`);
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

  const apartmentStats = calculateApartmentStats(leads);
  const totalLeads = leads.length;
  let row = 6;

  for (const [apartment, count] of apartmentStats.slice(0, 10)) {
    ws.getCell(`B${row}`).value = apartment;
    ws.getCell(`C${row}`).value = count;
    ws.getCell(`D${row}`).value = totalLeads > 0 ? count / totalLeads : 0;
    ws.getCell(`D${row}`).numFmt = "0.0%";

    aptCols.forEach((col) => {
      ws.getCell(`${col}${row}`).border = {
        top: { style: "thin", color: { argb: "EEEEEE" } },
        bottom: { style: "thin", color: { argb: "EEEEEE" } },
        left: { style: "thin", color: { argb: "EEEEEE" } },
        right: { style: "thin", color: { argb: "EEEEEE" } },
      };
    });

    row++;
  }

  // Leads by source
  row += 2;
  ws.getCell(`B${row}`).value = "LEADS BY SOURCE";
  ws.getCell(`B${row}`).font = { name: "Calibri", size: 12, bold: true, color: { argb: COLORS.primary } };
  row++;

  const srcHeaders = ["Source", "Count", "% of Total"];
  srcHeaders.forEach((header, i) => {
    const cell = ws.getCell(`${aptCols[i]}${row}`);
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
  row++;

  const sourceStats = calculateSourceStats(leads);
  for (const [source, count] of sourceStats) {
    ws.getCell(`B${row}`).value = source;
    ws.getCell(`C${row}`).value = count;
    ws.getCell(`D${row}`).value = totalLeads > 0 ? count / totalLeads : 0;
    ws.getCell(`D${row}`).numFmt = "0.0%";

    aptCols.forEach((col) => {
      ws.getCell(`${col}${row}`).border = {
        top: { style: "thin", color: { argb: "EEEEEE" } },
        bottom: { style: "thin", color: { argb: "EEEEEE" } },
        left: { style: "thin", color: { argb: "EEEEEE" } },
        right: { style: "thin", color: { argb: "EEEEEE" } },
      };
    });

    row++;
  }

  ws.getColumn("A").width = 3;
  ws.getColumn("B").width = 26;
  ws.getColumn("C").width = 10;
  ws.getColumn("D").width = 12;
}

function calculateMetrics(leads: LeadRecord[]) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const thisMonth = leads.filter((l) => l.createdAt >= monthStart).length;
  const thisWeek = leads.filter((l) => l.createdAt >= weekAgo).length;
  const todayCount = leads.filter((l) => {
    const d = new Date(l.createdAt.getFullYear(), l.createdAt.getMonth(), l.createdAt.getDate());
    return d.getTime() === today.getTime();
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
