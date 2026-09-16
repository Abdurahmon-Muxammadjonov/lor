/**
 * Termal printer kutubxonasi — brauzerda xavfsiz eksportlar.
 * (`network-server.ts` — `node:net` — bu yerdan ATAYIN eksport qilinmaydi; uni faqat API route ichida import qiling.)
 */
export type {
  TicketData,
  ReceiptData,
  ReceiptLine,
  PrintResult,
  PrinterErrorCode,
  PrinterStatus,
  Codepage,
  PaperWidthMm,
  TextAlign,
} from './types';
export { PrinterError, isPrinterError, toPrinterError } from './errors';
export {
  encodeText,
  prepareText,
  decodeBytes,
  isEncodable,
  codepageCommand,
  CODEPAGE_NUMBERS,
  CODEPAGE_NUMBERS_EPSON,
} from './encode';
export {
  EscPos,
  PAPER_COLUMNS,
  wrapText,
  fitText,
  padText,
  concatBytes,
  type EscPosOptions,
  type TableColumn,
  type TableOptions,
} from './escpos';
export { buildTicket } from './templates/ticket';
export { buildReceipt, receiptMoney, qtyText, lineDetail } from './templates/receipt';
export {
  printBytes,
  printTicket,
  printReceipt,
  printViaBrowser,
  testPrint,
  buildTestTicket,
  sendRaw,
  isRawTransport,
  type TestPrintOptions,
} from './print';
export { printerMessages, pm, fill, printerErrorText, type PrinterDict } from './messages';
export { bytesToBase64, base64ToBytes } from './base64';
export { PrintRawBodySchema, type PrintRawBody } from './schemas';
export { WebUsbTransport, ESCPOS_VENDOR_IDS, isWebUsbSupported, findBulkOutEndpoint, deviceLabel } from './transports/webusb';
export { QzTransport, loadQzTray, QZ_TRAY_SCRIPT_URL, type QzApi, type QzCertificate } from './transports/qz';
export { NetworkTransport, PRINT_RAW_ENDPOINT, networkErrorFromApi } from './transports/network';
export { BrowserPrintTransport, printInBrowser, type BrowserPrintOptions } from './transports/browser';
