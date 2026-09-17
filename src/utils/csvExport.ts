import { Order } from '../types';

/**
 * Escapes a string field for standard CSV compliance (RFC 4180)
 */
function escapeCSV(value: any): string {
  if (value === null || value === undefined) return '""';
  const stringValue = String(value);
  // Replace double quotes with two double quotes
  const escaped = stringValue.replace(/"/g, '""');
  return `"${escaped}"`;
}

/**
 * Initiates a browser download for a CSV string with UTF-8 BOM
 */
export function downloadCSV(filename: string, csvContent: string) {
  // \uFEFF ensures UTF-8 BOM so spreadsheet apps (Excel, Sheets) render Khmer & symbols properly
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Exports order records to a downloadable CSV for external bookkeeping
 */
export function exportOrdersToCSV(orders: Order[], customTitle: string = 'Order_History') {
  const headers = [
    'Order ID',
    'Date & Time',
    'Status',
    'Customer Name',
    'Buyer Username',
    'Roblox Recipient',
    'Product Title',
    'Category',
    'Unit Price (USD)',
    'Total (USD)',
    'Total Approx (KHR)',
    'Payment Method',
    'Delivery Type',
    'Telegram Alert Sent',
    'Telegram Status',
    'Delivered Key / Account Credentials',
  ];

  const rows = orders.map((order) => {
    const productName = order.product?.title || order.productName || 'N/A';
    const category = order.product?.category || 'General';
    const unitPrice = order.product?.price !== undefined ? order.product.price.toFixed(2) : (order.totalUSD || 0).toFixed(2);
    const quantity = order.quantity || 1;
    const totalUSD = order.totalUSD !== undefined ? order.totalUSD.toFixed(2) : '0.00';
    const totalKHR = Math.round((order.totalUSD || 0) * 4100).toLocaleString('en-US');
    const customerName = order.customerName || 'Guest Buyer';
    const buyerUsername = order.buyerUsername || 'N/A';
    const robloxUsername = order.recipientRobloxUsername || 'N/A';
    const isDispatched = order.telegramDispatched === true || order.telegramDispatchStatus === 'success';
    const telegramStatus = isDispatched ? 'Sent' : 'Failed / Pending';
    const paymentMethod = order.paymentMethod === 'Balance' ? 'Store Wallet Balance' : 'Bakong KHQR (Scan to Pay)';
    const deliveryType = order.product?.deliveryType || order.fulfillmentType || 'Instant';
    const dateFormatted = order.date && order.time ? `${order.date} ${order.time}` : new Date(order.timestamp || Date.now()).toISOString();
    const deliveredAccount = order.credentialsDelivered 
      ? `User: ${order.credentialsDelivered.username} | Pass: ${order.credentialsDelivered.password}`
      : 'N/A';

    return [
      escapeCSV(order.id),
      escapeCSV(dateFormatted),
      escapeCSV(order.status.toUpperCase()),
      escapeCSV(customerName),
      escapeCSV(buyerUsername),
      escapeCSV(robloxUsername),
      escapeCSV(productName),
      escapeCSV(category),
      escapeCSV(unitPrice),
      escapeCSV(quantity),
      escapeCSV(totalUSD),
      escapeCSV(totalKHR),
      escapeCSV(paymentMethod),
      escapeCSV(deliveryType),
      escapeCSV(isDispatched ? 'YES' : 'NO'),
      escapeCSV(telegramStatus),
      escapeCSV(deliveredAccount),
    ].join(',');
  });

  const timestamp = new Date().toISOString().split('T')[0];
  const csvContent = [headers.join(','), ...rows].join('\r\n');
  const filename = `uchiro_store_${customTitle.toLowerCase()}_${timestamp}.csv`;

  downloadCSV(filename, csvContent);
}

export interface DailyFinancialData {
  day: number;
  date: string;
  shortDate: string;
  revenue: number;
  cumulative: number;
  ordersCount: number;
  target: number;
  isPeak?: boolean;
  dayOfWeek: string;
}

export interface FinancialAnalyticsSummary {
  monthName: string;
  year: number;
  totalRevenueUSD: number;
  avgDailyUSD: number;
  peakRevenueUSD: number;
  peakDate: string;
  totalOrders: number;
  projectedMonthEndUSD: number;
}

/**
 * Exports financial performance and daily revenue breakdown to CSV
 */
export function exportFinancialAnalyticsToCSV(
  dailyData: DailyFinancialData[],
  summary: FinancialAnalyticsSummary
) {
  const summarySection = [
    `"=== UCHIRO STORE FINANCIAL PERFORMANCE SUMMARY ==="`,
    `"Period",${escapeCSV(`${summary.monthName} ${summary.year}`)}`,
    `"Total Period Revenue (USD)",${escapeCSV(`$${summary.totalRevenueUSD.toFixed(2)}`)}`,
    `"Total Period Revenue (KHR)",${escapeCSV(`៛${Math.round(summary.totalRevenueUSD * 4100).toLocaleString('en-US')}`)}`,
    `"Daily Average Revenue (USD)",${escapeCSV(`$${summary.avgDailyUSD.toFixed(2)}`)}`,
    `"Peak Day Record (USD)",${escapeCSV(`$${summary.peakRevenueUSD.toFixed(2)} (${summary.peakDate})`)}`,
    `"Total Orders Cleared",${escapeCSV(summary.totalOrders)}`,
    `"Projected Month-End (USD)",${escapeCSV(`$${summary.projectedMonthEndUSD.toFixed(2)}`)}`,
    `"Export Timestamp",${escapeCSV(new Date().toISOString())}`,
    `""`, // empty row separator
  ];

  const dailyHeaders = [
    'Day',
    'Date',
    'Day of Week',
    'Daily Revenue (USD)',
    'Daily Revenue (KHR)',
    'Cumulative Revenue (USD)',
    'Cumulative Revenue (KHR)',
    'Orders Cleared',
    'Daily Target (USD)',
    'Target Achieved (%)',
    'Peak Day Indicator',
  ];

  const dailyRows = dailyData.map((d) => {
    const revKHR = Math.round(d.revenue * 4100);
    const cumKHR = Math.round(d.cumulative * 4100);
    const achievementPct = d.target > 0 ? Math.round((d.revenue / d.target) * 100) : 100;

    return [
      escapeCSV(d.day),
      escapeCSV(d.date),
      escapeCSV(d.dayOfWeek),
      escapeCSV((d.revenue || 0).toFixed(2)),
      escapeCSV(revKHR.toLocaleString('en-US')),
      escapeCSV((d.cumulative || 0).toFixed(2)),
      escapeCSV(cumKHR.toLocaleString('en-US')),
      escapeCSV(d.ordersCount),
      escapeCSV((d.target || 0).toFixed(2)),
      escapeCSV(`${achievementPct}%`),
      escapeCSV(d.isPeak ? 'YES (PEAK)' : 'NORMAL'),
    ].join(',');
  });

  const csvContent = [
    ...summarySection,
    `"=== DAILY REVENUE BREAKDOWN & GROWTH METRICS ==="`,
    dailyHeaders.join(','),
    ...dailyRows,
  ].join('\r\n');

  const filename = `uchiro_financial_performance_${summary.monthName.toLowerCase()}_${summary.year}.csv`;
  downloadCSV(filename, csvContent);
}
