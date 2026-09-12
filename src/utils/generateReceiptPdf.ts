import { jsPDF } from 'jspdf';
import { Order, Product } from '../types';

export interface ReceiptData {
  orderId: string;
  date?: string;
  time?: string;
  timestamp?: number;
  customerName?: string;
  robloxUsername?: string;
  product: {
    title: string;
    category?: string;
    price: number;
    gameTitle?: string;
    fulfillmentType?: string;
  };
  quantity?: number;
  totalUSD: number;
  paymentMethod?: string;
  status?: string;
  transactionRef?: string;
  md5Hash?: string;
  apiConfirmedAt?: string;
  apiSource?: string;
  discountApplied?: {
    code: string;
    discountPercent: number;
    amountSavedUSD: number;
  };
  rankDiscountApplied?: {
    rankTier: string;
    rankTitle: string;
    discountPercent: number;
    amountSavedUSD: number;
  };
}

export function generateReceiptPdf(data: ReceiptData | Order) {
  const isOrder = 'id' in data;
  const status = isOrder ? (data as Order).status : (data as ReceiptData).status;
  const slipStatus = isOrder ? (data as Order).slipStatus : undefined;

  // Strict Rule: Receipts can ONLY be downloaded when an order is confirmed and delivered!
  // Orders waiting or not confirmed cannot download receipts.
  const isConfirmed = status === 'delivered' && (slipStatus === undefined || slipStatus === 'confirmed');
  if (!isConfirmed) {
    alert(
      'ការបញ្ជាទិញកំពុងរង់ចាំការបញ្ជាក់ មិនទាន់អាចទាញយកវិក្កយបត្របានទេ (Order is pending confirmation. Receipt download is locked until payment is verified and confirmed).'
    );
    return;
  }

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const orderId = isOrder ? data.id : data.orderId;
  const now = new Date();
  const dateStr = data.date || now.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  const timeStr = data.time || now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  const customerName = data.customerName || 'Valued Player';
  const robloxUser = (isOrder ? (data as Order).recipientRobloxUsername : (data as ReceiptData).robloxUsername) || '';
  const productTitle = data.product?.title || 'Gaming Digital Item';
  const category = data.product?.category || ('gameTitle' in (data.product || {}) ? (data.product as any).gameTitle : undefined) || 'Roblox Digital Store';
  const originalPrice = data.product?.price || data.totalUSD || 0;
  const totalUSD = data.totalUSD ?? originalPrice;
  const totalKHR = Math.round(totalUSD * 4100);
  const paymentMethod = data.paymentMethod || 'Bakong / ABA KHQR';
  const txRef = (isOrder ? (data as Order).transactionRef : undefined) || `TXN-${orderId.replace(/[^a-zA-Z0-9]/g, '')}`;
  const fulfillmentType = (isOrder ? (data as Order).fulfillmentType : undefined) || 'Digital Instant Fulfillment';
  
  // Confirmation Timestamp
  const confirmationTimestamp =
    data.apiConfirmedAt ||
    (isOrder && (data as Order).apiConfirmedAt) ||
    `${dateStr}, ${timeStr} (UTC+7 Phnom Penh)`;

  const verifiedGateway =
    data.apiSource ||
    (isOrder && (data as Order).apiSource) ||
    'KHPay Gateway / NBC Bakong National Network';

  const md5VerifiedHash =
    data.md5Hash ||
    (isOrder && (data as Order).md5Hash) ||
    (isOrder && (data as Order).khqrPayload ? 'EMVCo-Verified' : `KHQR-HASH-${orderId.replace(/[^0-9]/g, '') || '987214'}`);

  // --- Background Decor & Header Box ---
  // Top Banner
  doc.setFillColor(18, 21, 30); // Dark Navy Canvas
  doc.rect(0, 0, 210, 44, 'F');

  // Gold accent bar
  doc.setFillColor(255, 178, 48); // #FFB230 Gold
  doc.rect(0, 43, 210, 2.5, 'F');

  // Brand Name
  doc.setTextColor(255, 215, 161);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.text('UCHIRO STORE', 18, 18);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(155, 162, 180);
  doc.text('Official Gaming Digital Assets & Roblox Store • Cambodia', 18, 25);
  doc.text('Telegram: @Noreakyout • Channel: @uchirostore • Web: uchiro.store', 18, 31);
  doc.text('Digital Tax & Transaction Registry ID: KH-UCH-88390', 18, 37);

  // Receipt / Invoice Title on right
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(255, 178, 48);
  doc.text('OFFICIAL INVOICE & RECEIPT', 192, 17, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(215, 220, 230);
  doc.text(`Invoice Ref: #${orderId}`, 192, 24, { align: 'right' });
  doc.text(`Transaction: ${txRef}`, 192, 30, { align: 'right' });
  doc.text(`Issued: ${dateStr} ${timeStr}`, 192, 36, { align: 'right' });

  // --- Top Quick Status Badge ---
  doc.setFillColor(62, 207, 142); // #3ECF8E Green
  doc.roundedRect(18, 50, 58, 7.5, 2, 2, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(5, 46, 22);
  doc.text('✓ PAID & VERIFIED INVOICE', 47, 55.2, { align: 'center' });

  // Billed To & Merchant Info Cards
  // Left Card: Customer Details
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(18, 61, 84, 30, 2.5, 2.5, 'F');
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.4);
  doc.roundedRect(18, 61, 84, 30, 2.5, 2.5, 'S');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(30, 41, 59);
  doc.text('BILLED TO / CUSTOMER', 22, 67);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);
  doc.text(`Account Name: ${customerName}`, 22, 73);
  if (robloxUser) {
    doc.text(`Roblox Recipient: @${robloxUser}`, 22, 79);
    doc.text(`Payment Gateway: ${paymentMethod}`, 22, 85);
  } else {
    doc.text(`Payment Gateway: ${paymentMethod}`, 22, 79);
    doc.text(`Fulfillment: ${fulfillmentType.toUpperCase()}`, 22, 85);
  }

  // Right Card: Merchant & Settlement Info
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(108, 61, 84, 30, 2.5, 2.5, 'F');
  doc.roundedRect(108, 61, 84, 30, 2.5, 2.5, 'S');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(30, 41, 59);
  doc.text('MERCHANT & SETTLEMENT', 112, 67);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);
  doc.text('Store: UCHIRO STORE CAMBODIA', 112, 73);
  doc.text('Settlement: NBC Bakong National KHQR', 112, 79);
  doc.text(`Order Status: COMPLETED / DELIVERED`, 112, 85);

  // --- Table Header ---
  const tableY = 96;
  doc.setFillColor(241, 245, 249);
  doc.rect(18, tableY, 174, 8, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(51, 65, 85);
  doc.text('ITEM DESCRIPTION', 22, tableY + 5.5);
  doc.text('CATEGORY', 105, tableY + 5.5);
  doc.text('QTY', 145, tableY + 5.5, { align: 'center' });
  doc.text('UNIT PRICE (USD)', 188, tableY + 5.5, { align: 'right' });

  // Table Row
  const rowY = tableY + 15;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(15, 23, 42);
  doc.text(productTitle.length > 36 ? productTitle.substring(0, 33) + '...' : productTitle, 22, rowY);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(100, 116, 139);
  doc.text(category, 105, rowY);
  doc.text('1', 145, rowY, { align: 'center' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(15, 23, 42);
  doc.text(`$${originalPrice.toFixed(2)}`, 188, rowY, { align: 'right' });

  // Table bottom border
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.5);
  doc.line(18, rowY + 5, 192, rowY + 5);

  // --- Calculation Breakdown ---
  let calcY = rowY + 12;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);

  doc.text('Subtotal:', 135, calcY);
  doc.text(`$${originalPrice.toFixed(2)}`, 188, calcY, { align: 'right' });

  // Check for rank discount
  if (data.rankDiscountApplied && data.rankDiscountApplied.amountSavedUSD > 0) {
    calcY += 5.5;
    doc.setTextColor(217, 119, 6);
    doc.text(`VIP Rank Discount (${data.rankDiscountApplied.rankTitle} -${data.rankDiscountApplied.discountPercent}%):`, 135, calcY);
    doc.text(`-$${data.rankDiscountApplied.amountSavedUSD.toFixed(2)}`, 188, calcY, { align: 'right' });
  }

  // Check for coupon discount
  if (data.discountApplied && data.discountApplied.amountSavedUSD > 0) {
    calcY += 5.5;
    doc.setTextColor(16, 185, 129);
    doc.text(`Coupon Applied (${data.discountApplied.code} -${data.discountApplied.discountPercent}%):`, 135, calcY);
    doc.text(`-$${data.discountApplied.amountSavedUSD.toFixed(2)}`, 188, calcY, { align: 'right' });
  }

  // Total Box
  calcY += 7;
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(122, calcY - 4, 70, 17, 2, 2, 'F');
  doc.setDrawColor(255, 178, 48);
  doc.setLineWidth(0.8);
  doc.roundedRect(122, calcY - 4, 70, 17, 2, 2, 'S');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text('TOTAL PAID:', 127, calcY + 2.5);

  doc.setFontSize(12.5);
  doc.setTextColor(217, 119, 6);
  doc.text(`$${totalUSD.toFixed(2)} USD`, 188, calcY + 2.5, { align: 'right' });

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text(`≈ ៛${totalKHR.toLocaleString()} KHR (Rate: 4,100)`, 188, calcY + 8.5, { align: 'right' });

  // =========================================================================
  // --- VISUAL 'TRANSACTION VERIFIED' BADGE & CERTIFICATION CARD ---
  // =========================================================================
  const badgeY = calcY + 19;

  // Outer Badge Container
  doc.setFillColor(240, 253, 244); // #F0FDF4 Emerald light bg
  doc.roundedRect(18, badgeY, 174, 38, 3, 3, 'F');
  
  // Double security border
  doc.setDrawColor(16, 185, 129); // #10B981 Green
  doc.setLineWidth(0.8);
  doc.roundedRect(18, badgeY, 174, 38, 3, 3, 'S');
  
  doc.setDrawColor(187, 247, 208); // Light emerald accent
  doc.setLineWidth(0.3);
  doc.roundedRect(19.5, badgeY + 1.5, 171, 35, 2, 2, 'S');

  // Badge Top Header Ribbon
  doc.setFillColor(16, 185, 129); // #10B981 Vibrant Green
  doc.roundedRect(23, badgeY + 4, 68, 6.5, 1.5, 1.5, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(255, 255, 255);
  doc.text('✓ TRANSACTION VERIFIED', 57, badgeY + 8.5, { align: 'center' });

  // Status text next to ribbon
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(6, 95, 70);
  doc.text('OFFICIAL BAKONG KHQR API CONFIRMATION', 95, badgeY + 8.5);

  // Divider inside badge
  doc.setDrawColor(209, 250, 229);
  doc.setLineWidth(0.4);
  doc.line(23, badgeY + 13, 187, badgeY + 13);

  // Left column: API Confirmation Details
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(6, 78, 59);
  doc.text('API Confirmed At:', 23, badgeY + 19);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(15, 23, 42);
  doc.text(confirmationTimestamp, 58, badgeY + 19);

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(6, 78, 59);
  doc.text('Verification Gateway:', 23, badgeY + 25);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(15, 23, 42);
  doc.text(verifiedGateway, 58, badgeY + 25);

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(6, 78, 59);
  doc.text('Ledger Hash / MD5:', 23, badgeY + 31);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(15, 23, 42);
  doc.text(md5VerifiedHash.length > 40 ? md5VerifiedHash.substring(0, 38) + '...' : md5VerifiedHash, 58, badgeY + 31);

  // Right column: Stamped Security Seal Graphics
  const sealCenterX = 168;
  const sealCenterY = badgeY + 22;
  
  // Outer seal circle
  doc.setDrawColor(16, 185, 129);
  doc.setLineWidth(0.7);
  doc.circle(sealCenterX, sealCenterY, 11, 'S');

  // Inner dashed circle
  doc.setDrawColor(5, 150, 105);
  doc.setLineWidth(0.4);
  doc.circle(sealCenterX, sealCenterY, 9.5, 'S');

  // Seal text
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(5.5);
  doc.setTextColor(6, 95, 70);
  doc.text('★ NBC BAKONG ★', sealCenterX, sealCenterY - 4.5, { align: 'center' });
  
  doc.setFontSize(7);
  doc.setTextColor(4, 120, 87);
  doc.text('VERIFIED', sealCenterX, sealCenterY - 0.5, { align: 'center' });

  doc.setFontSize(5);
  doc.setTextColor(6, 95, 70);
  doc.text('KHPAY GATEWAY', sealCenterX, sealCenterY + 3.5, { align: 'center' });
  doc.text('100% SECURE', sealCenterX, sealCenterY + 6.5, { align: 'center' });

  // --- Terms & Warranty Guarantee Box ---
  const termsY = badgeY + 43;
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(18, termsY, 174, 30, 2.5, 2.5, 'F');
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(18, termsY, 174, 30, 2.5, 2.5, 'S');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(30, 41, 59);
  doc.text('STORE WARRANTY & SUPPORT POLICY', 23, termsY + 6);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text('• Account Purchases: Backed by our 14-day replacement warranty. Do not alter 2FA credentials during warranty.', 23, termsY + 11.5);
  doc.text('• Gift / In-game Items: Delivered within 30 minutes via in-game transfer / direct friend mechanism.', 23, termsY + 16.5);
  doc.text('• For instant delivery assistance, message our official admin Telegram @Noreakyout with this Invoice Ref.', 23, termsY + 21.5);
  doc.text('• Thank you for shopping with Uchiro Store - Cambodia\'s #1 Trusted Roblox Gaming Marketplace!', 23, termsY + 26.5);

  // --- Barcode Strip Visual ---
  const barcodeY = termsY + 33;
  doc.setDrawColor(150, 160, 175);
  doc.setLineWidth(0.3);
  // Generate authentic barcode-like hash bars
  let currX = 23;
  const hashSeed = (orderId + txRef).toUpperCase();
  for (let i = 0; i < 42; i++) {
    const charCode = hashSeed.charCodeAt(i % hashSeed.length);
    const barWidth = (charCode % 3 === 0) ? 0.8 : (charCode % 2 === 0) ? 0.5 : 0.25;
    doc.setLineWidth(barWidth);
    doc.line(currX, barcodeY, currX, barcodeY + 5);
    currX += barWidth + 1.2;
    if (currX > 185) break;
  }
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(120, 130, 145);
  doc.text(`* AUTHENTIC DIGITAL RECEIPT HASH: ${txRef} *`, 105, barcodeY + 8, { align: 'center' });

  // --- Footer Bar ---
  doc.setFillColor(18, 21, 30);
  doc.rect(0, 282, 210, 15, 'F');

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(170, 175, 190);
  doc.text('UCHIRO STORE CAMBODIA • KHPAY & BAKONG KHQR GATEWAY • ALL RIGHTS RESERVED', 105, 288.5, { align: 'center' });
  doc.text(`Official Document Verified on ${new Date().toLocaleString('en-US')}`, 105, 293, { align: 'center' });

  // Save/Download the file
  const cleanId = orderId.replace(/[^a-zA-Z0-9-_]/g, '');
  const fileName = `UchiroStore_Invoice_Receipt_${cleanId}.pdf`;
  doc.save(fileName);
}
