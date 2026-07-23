import type { InvoiceRecord } from "./invoice-data";
import { formatInvoiceDate, formatInvoiceMoney } from "./invoice-data";

export async function downloadInvoicePdf(
  invoice: InvoiceRecord,
  vatNumber: string,
) {
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const left = 18;
  const right = pageWidth - 18;
  const label = invoice.type === "credit_note" ? "CREDIT NOTE" : "INVOICE";

  pdf.setFillColor(255, 255, 255);
  pdf.rect(0, 0, pageWidth, pageHeight, "F");
  pdf.setFillColor(44, 36, 31);
  pdf.rect(0, 0, pageWidth, 42, "F");
  pdf.setTextColor(248, 244, 239);
  pdf.setFont("times", "italic");
  pdf.setFontSize(24);
  pdf.text("TUFFFINDS", left, 21);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);
  pdf.setTextColor(205, 194, 184);
  pdf.text("Personal sourcing and luxury concierge", left, 29);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(10);
  pdf.setTextColor(248, 244, 239);
  pdf.text(label, right, 18, { align: "right" });
  pdf.setFontSize(13);
  pdf.text(invoice.invoiceNumber, right, 27, { align: "right" });

  pdf.setTextColor(43, 35, 30);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(8);
  pdf.text("BILL TO", left, 55);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(10);
  pdf.text(invoice.clientName || "Client", left, 63);
  pdf.setFontSize(8.5);
  let addressY = 69;
  if (invoice.clientEmail) {
    pdf.text(invoice.clientEmail, left, addressY);
    addressY += 5;
  }
  if (invoice.clientAddress) {
    const addressLines = pdf.splitTextToSize(invoice.clientAddress, 75);
    pdf.text(addressLines, left, addressY);
  }

  const metaX = 122;
  const metaValueX = right;
  const metaRows = [
    ["Issue date", formatInvoiceDate(invoice.issueDate)],
    [
      invoice.type === "credit_note" ? "Credit date" : "Payment due",
      formatInvoiceDate(invoice.type === "credit_note" ? invoice.issueDate : invoice.dueDate),
    ],
    ["Currency", invoice.currency],
    ...(vatNumber ? [["VAT number", vatNumber]] : []),
  ];
  metaRows.forEach(([key, value], index) => {
    const y = 55 + index * 7;
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8);
    pdf.setTextColor(120, 105, 95);
    pdf.text(key, metaX, y);
    pdf.setFont("helvetica", "bold");
    pdf.setTextColor(43, 35, 30);
    pdf.text(value, metaValueX, y, { align: "right" });
  });

  const tableTop = 96;
  pdf.setFillColor(244, 240, 234);
  pdf.rect(left, tableTop, right - left, 10, "F");
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(7.5);
  pdf.setTextColor(105, 88, 77);
  pdf.text("DESCRIPTION", left + 3, tableTop + 6.5);
  pdf.text("QTY", 125, tableTop + 6.5, { align: "right" });
  pdf.text("NET", 151, tableTop + 6.5, { align: "right" });
  pdf.text("VAT", 170, tableTop + 6.5, { align: "right" });
  pdf.text("TOTAL", right - 3, tableTop + 6.5, { align: "right" });

  let y = tableTop + 17;
  invoice.lineItems.forEach((item) => {
    const description = pdf.splitTextToSize(item.description, 82);
    const rowHeight = Math.max(11, description.length * 4 + 4);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8.5);
    pdf.setTextColor(55, 45, 39);
    pdf.text(description, left + 3, y);
    pdf.text(String(item.quantity), 125, y, { align: "right" });
    pdf.text(formatInvoiceMoney(item.netAmount, invoice.currency), 151, y, {
      align: "right",
    });
    pdf.text(`${item.vatRate}%`, 170, y, { align: "right" });
    pdf.setFont("helvetica", "bold");
    pdf.text(formatInvoiceMoney(item.grossAmount, invoice.currency), right - 3, y, {
      align: "right",
    });
    y += rowHeight;
    pdf.setDrawColor(230, 222, 214);
    pdf.line(left, y - 4, right, y - 4);
  });

  y += 4;
  const totalsX = 126;
  const totalRows = [
    ["Net", invoice.netTotal],
    ["VAT", invoice.vatTotal],
    [invoice.type === "credit_note" ? "Credit total" : "Total due", invoice.grossTotal],
  ] as const;
  totalRows.forEach(([key, value], index) => {
    const rowY = y + index * 8;
    const isTotal = index === totalRows.length - 1;
    if (isTotal) {
      pdf.setDrawColor(90, 72, 61);
      pdf.line(totalsX, rowY - 4.5, right, rowY - 4.5);
    }
    pdf.setFont("helvetica", isTotal ? "bold" : "normal");
    pdf.setFontSize(isTotal ? 10 : 8.5);
    pdf.setTextColor(isTotal ? 43 : 105, isTotal ? 35 : 91, isTotal ? 30 : 81);
    pdf.text(key, totalsX, rowY);
    pdf.text(formatInvoiceMoney(value, invoice.currency), right, rowY, {
      align: "right",
    });
  });

  const footerY = 274;
  if (invoice.notes || invoice.reason) {
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(7.5);
    pdf.setTextColor(105, 88, 77);
    pdf.text(invoice.type === "credit_note" ? "REASON" : "NOTES", left, footerY - 16);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8);
    pdf.setTextColor(80, 67, 59);
    pdf.text(
      pdf.splitTextToSize(invoice.reason || invoice.notes, 105),
      left,
      footerY - 10,
    );
  }
  pdf.setDrawColor(220, 211, 202);
  pdf.line(left, footerY, right, footerY);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(7.5);
  pdf.setTextColor(125, 111, 101);
  pdf.text("TUFFFINDS", left, footerY + 8);
  pdf.text("info@tufffinds.com", right, footerY + 8, { align: "right" });

  pdf.save(`${invoice.invoiceNumber}.pdf`);
}
