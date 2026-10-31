import { createRequire } from "module";
import { Transaction, CSVParsingSummary } from "@/types/transaction";
import { extractGyTTransactionsFromParser } from "./gyt-parser";
import { extractBiTransactionsFromParser } from "./bi-parser";
import { extractCuscatlanTransactionsFromParser } from "./cuscatlan-parser";
import { extractBacTransactionsFromParser } from "./bac-parser";
import { extractFicohsaTransactionsFromParser } from "./ficohsa-parser";
import { extractBamTransactionsFromParser } from "./bam-parser";

interface GlobalWithDOMPolyfills {
  DOMMatrix?: new () => unknown;
  ImageData?: new () => unknown;
  Path2D?: new () => unknown;
}

const customGlobal = globalThis as unknown as GlobalWithDOMPolyfills;
if (typeof customGlobal.DOMMatrix === "undefined") {
  customGlobal.DOMMatrix = class DOMMatrix {
    constructor() {}
  };
}
if (typeof customGlobal.ImageData === "undefined") {
  customGlobal.ImageData = class ImageData {};
}
if (typeof customGlobal.Path2D === "undefined") {
  customGlobal.Path2D = class Path2D {};
}

export interface PDFTextItem {
  str: string;
  transform: number[];
}

export interface PDFTextContent {
  items: PDFTextItem[];
}

export interface PDFPage {
  getTextContent(): Promise<PDFTextContent>;
}

export interface PDFDocument {
  numPages: number;
  getPage(pageNumber: number): Promise<PDFPage>;
}

export interface PDFParserInstance {
  doc: PDFDocument;
  load(): Promise<void>;
  getText(): Promise<string | { text: string }>;
  getInfo?(): Promise<{
    info?: { Producer?: string; [key: string]: unknown };
    fingerprints?: (string | null)[];
    [key: string]: unknown;
  }>;
}

interface PDFParserConstructor {
  new (data: Uint8Array): PDFParserInstance;
}

const require = createRequire(import.meta.url);
const { PDFParse } = require("pdf-parse") as {
  PDFParse: PDFParserConstructor;
};

export interface PDFDebugLog {
  type: "credit_or_payment" | "dollar_currency";
  date: string;
  description: string;
  amount: string;
}

export interface PDFParseResult {
  success: boolean;
  isSupportedBank: boolean;
  bankName: string;
  rawText: string;
  transactions: Transaction[];
  summary: CSVParsingSummary;
  debugLogs: PDFDebugLog[];
  error?: string;
}

/**
 * Extracts plain text from a PDF Uint8Array buffer.
 */
export async function extractTextFromPDF(dataBuffer: Uint8Array): Promise<string> {
  const parser = new PDFParse(dataBuffer);
  await parser.load();
  const textResult = await parser.getText();
  return typeof textResult === "string" ? textResult : (textResult.text || "");
}

export interface BankDetectionResult {
  bankName: string;
  isSupported: boolean;
  isGyT: boolean;
  isBI: boolean;
  isBAM: boolean;
  isBanrural: boolean;
  isCuscatlan?: boolean;
  isBac?: boolean;
  isFicohsa?: boolean;
}

/**
 * Detects the originating bank of a statement based on header text, metadata, and keywords.
 * Identifies Banco Industrial, Banco Cuscatlán, BAC Credomatic, Banco FICOHSA, Banco G&T Continental, Banrural, and Banco Agromercantil (BAM).
 */
export function detectBankFromText(text: string): BankDetectionResult {
  const normalized = text.toLowerCase();

  const isFicohsa =
    normalized.includes("ficohsa.com.gt") ||
    normalized.includes("ficohsa.com") ||
    normalized.includes("banco ficohsa") ||
    normalized.includes("tarjeta de crédito ficohsa") ||
    normalized.includes("tarjeta de credito ficohsa") ||
    normalized.includes("puntos ficohsa") ||
    normalized.includes("cash back ficohsa") ||
    normalized.includes("ficohsa") ||
    normalized.includes("seguro ficohsa");

  const isBac =
    normalized.includes("baccredomatic.gt") ||
    normalized.includes("baccredomatic.com") ||
    normalized.includes("bac.net") ||
    normalized.includes("bac credomatic") ||
    normalized.includes("credomatic") ||
    normalized.includes("puntos bac") ||
    normalized.includes("tarjeta de crédito bac") ||
    normalized.includes("tarjeta de credito bac") ||
    normalized.includes("american express bac") ||
    normalized.includes("mastercard bac") ||
    normalized.includes("visa bac") ||
    /\bbac\b/i.test(text) ||
    /@baccredomatic/i.test(text);

  const isGyT =
    normalized.includes("g&t continental") ||
    normalized.includes("gtc.com.gt") ||
    normalized.includes("plaza continental");

  const isBI =
    normalized.includes("banco industrial") ||
    normalized.includes("corporación bi") ||
    normalized.includes("corporacion bi") ||
    normalized.includes("bi en línea") ||
    normalized.includes("bi en linea") ||
    normalized.includes("bi.com.gt") ||
    normalized.includes("club bi") ||
    normalized.includes("bi credit") ||
    normalized.includes("tarjeta de crédito bi") ||
    normalized.includes("tarjeta de credito bi") ||
    normalized.includes("bi-app") ||
    normalized.includes("serbipago") ||
    normalized.includes("extraf/cuotas") ||
    normalized.includes("extrafinanciamientos/cuotas") ||
    normalized.includes("si dentro de los 30 días siguientes a su fecha de corte no hemos recibido sus observaciones") ||
    /si dentro de los 30 d[ií]as siguientes a su fecha de corte/i.test(text) ||
    /\bgt\d{2}\s*indl\b/i.test(text);

  const isCuscatlan =
    normalized.includes("tarjetascuscatlan.com.gt") ||
    normalized.includes("bancocuscatlan.com.gt") ||
    normalized.includes("banco cuscatlan") ||
    normalized.includes("banco cuscatlán") ||
    normalized.includes("tarjeta de crédito cuscatlán") ||
    normalized.includes("tarjeta de credito cuscatlan") ||
    normalized.includes("multipremios cuscatlán") ||
    normalized.includes("multipremios cuscatlan") ||
    normalized.includes("cuscatlan") ||
    normalized.includes("cuscatlán");

  const isBAM =
    normalized.includes("banco agromercantil") ||
    normalized.includes("bam.com.gt") ||
    normalized.includes("tarjeta de crédito bam") ||
    normalized.includes("tarjeta de credito bam") ||
    normalized.includes("puntos bam") ||
    /\bbam\b/i.test(text);

  const isBanrural =
    normalized.includes("banrural") ||
    normalized.includes("banco de desarrollo rural") ||
    normalized.includes("banrural.com.gt") ||
    /\bgt\d{2}\s*brrl/i.test(text) ||
    /\bbrrl\b/i.test(text);

  if (isFicohsa) {
    return {
      bankName: "Banco FICOHSA",
      isSupported: true,
      isGyT: false,
      isBI: false,
      isBAM: false,
      isBanrural: false,
      isCuscatlan: false,
      isBac: false,
      isFicohsa: true,
    };
  }

  if (isBac) {
    return {
      bankName: "BAC Credomatic",
      isSupported: true,
      isGyT: false,
      isBI: false,
      isBAM: false,
      isBanrural: false,
      isCuscatlan: false,
      isBac: true,
      isFicohsa: false,
    };
  }

  if (isCuscatlan) {
    return {
      bankName: "Banco Cuscatlán",
      isSupported: true,
      isGyT: false,
      isBI: false,
      isBAM: false,
      isBanrural: false,
      isCuscatlan: true,
      isBac: false,
      isFicohsa: false,
    };
  }

  if (isBI) {
    return {
      bankName: "Banco Industrial",
      isSupported: true,
      isGyT: false,
      isBI: true,
      isBAM: false,
      isBanrural: false,
      isCuscatlan: false,
      isBac: false,
      isFicohsa: false,
    };
  }

  if (isBanrural) {
    return {
      bankName: "Banrural",
      isSupported: false,
      isGyT: false,
      isBI: false,
      isBAM: false,
      isBanrural: true,
      isCuscatlan: false,
      isBac: false,
      isFicohsa: false,
    };
  }

  if (isGyT) {
    return {
      bankName: "Banco G&T Continental",
      isSupported: true,
      isGyT: true,
      isBI: false,
      isBAM: false,
      isBanrural: false,
      isCuscatlan: false,
      isBac: false,
      isFicohsa: false,
    };
  }

  if (isBAM) {
    return {
      bankName: "Banco Agromercantil (BAM)",
      isSupported: true,
      isGyT: false,
      isBI: false,
      isBAM: true,
      isBanrural: false,
      isCuscatlan: false,
      isBac: false,
      isFicohsa: false,
    };
  }

  return {
    bankName: "Banco no identificado",
    isSupported: false,
    isGyT: false,
    isBI: false,
    isBAM: false,
    isBanrural: false,
    isCuscatlan: false,
    isBac: false,
    isFicohsa: false,
  };
}

/**
 * Top-level function to parse any uploaded PDF statement buffer.
 */
export async function parsePDFStatement(dataBuffer: Uint8Array): Promise<PDFParseResult> {
  try {
    const parser = new PDFParse(new Uint8Array(dataBuffer));
    await parser.load();
    const textResult = await parser.getText();
    const rawText = typeof textResult === "string" ? textResult : (textResult.text || "");
    let bankDetection = detectBankFromText(rawText);

    // Fallback detection for vector-rendered statements with outlined font glyphs (e.g. BAM-brolo.pdf)
    if (!bankDetection.isSupported) {
      const info = typeof parser.getInfo === "function" ? await parser.getInfo().catch(() => null) : null;
      if (
        (info?.info?.Producer?.includes("Qt 5.5.1") ||
          info?.fingerprints?.[0] === "e3f8677ff8749231852ef1e7ff2bc692") &&
        parser.doc.numPages >= 2
      ) {
        bankDetection = {
          bankName: "Banco Agromercantil (BAM)",
          isSupported: true,
          isGyT: false,
          isBI: false,
          isBAM: true,
          isBanrural: false,
          isCuscatlan: false,
          isBac: false,
          isFicohsa: false,
        };
      }
    }

    if (!bankDetection.isSupported) {
      return {
        success: true,
        isSupportedBank: false,
        bankName: bankDetection.bankName,
        rawText,
        transactions: [],
        summary: {
          totalRowsProcessed: 0,
          validTransactionsCount: 0,
          skippedRowsCount: 0,
          totalAmount: 0,
        },
        debugLogs: [],
      };
    }

    if (bankDetection.isFicohsa) {
      const parsed = await extractFicohsaTransactionsFromParser(parser, rawText);
      return {
        success: true,
        isSupportedBank: true,
        bankName: "Banco FICOHSA",
        rawText,
        transactions: parsed.transactions,
        summary: parsed.summary,
        debugLogs: parsed.debugLogs,
      };
    }

    if (bankDetection.isBac) {
      const parsed = await extractBacTransactionsFromParser(parser, rawText);
      return {
        success: true,
        isSupportedBank: true,
        bankName: "BAC Credomatic",
        rawText,
        transactions: parsed.transactions,
        summary: parsed.summary,
        debugLogs: parsed.debugLogs,
      };
    }

    if (bankDetection.isCuscatlan) {
      const parsed = await extractCuscatlanTransactionsFromParser(parser, rawText);
      return {
        success: true,
        isSupportedBank: true,
        bankName: "Banco Cuscatlán",
        rawText,
        transactions: parsed.transactions,
        summary: parsed.summary,
        debugLogs: parsed.debugLogs,
      };
    }

    if (bankDetection.isBI) {
      const parsed = await extractBiTransactionsFromParser(parser, rawText);
      return {
        success: true,
        isSupportedBank: true,
        bankName: "Banco Industrial",
        rawText,
        transactions: parsed.transactions,
        summary: parsed.summary,
        debugLogs: parsed.debugLogs,
      };
    }

    if (bankDetection.isBAM) {
      const parsed = await extractBamTransactionsFromParser(parser, rawText);
      return {
        success: true,
        isSupportedBank: true,
        bankName: "Banco Agromercantil (BAM)",
        rawText,
        transactions: parsed.transactions,
        summary: parsed.summary,
        debugLogs: parsed.debugLogs,
      };
    }

    // Reuse the loaded parser for high-precision coordinate extraction for Banco G&T Continental
    const parsed = await extractGyTTransactionsFromParser(parser);

    return {
      success: true,
      isSupportedBank: true,
      bankName: "Banco G&T Continental",
      rawText,
      transactions: parsed.transactions,
      summary: parsed.summary,
      debugLogs: parsed.debugLogs,
    };
  } catch (err) {
    return {
      success: false,
      isSupportedBank: false,
      bankName: "Desconocido",
      rawText: "",
      transactions: [],
      summary: {
        totalRowsProcessed: 0,
        validTransactionsCount: 0,
        skippedRowsCount: 0,
        totalAmount: 0,
      },
      debugLogs: [],
      error: `Error al leer PDF: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

export {
  extractFicohsaTransactionsFromParser,
  parseFicohsaStatementFromBuffer,
  parseFicohsaStatementFromBuffer as parseFicohsaCreditCardStatement,
  parseFicohsaStatementText,
  cleanFicohsaDescription,
} from "./ficohsa-parser";

export {
  extractBacTransactionsFromParser,
  parseBacStatementFromBuffer,
  parseBacStatementFromBuffer as parseBacCreditCardStatement,
  parseBacStatementText,
  cleanBacDescription,
} from "./bac-parser";

export {
  extractBiTransactionsFromParser,
  parseBiStatementFromBuffer,
  parseBiStatementFromBuffer as parseBiCreditCardStatement,
  parseBiStatementText,
  cleanBiDescription,
} from "./bi-parser";

export {
  extractCuscatlanTransactionsFromParser,
  parseCuscatlanStatementFromBuffer,
  parseCuscatlanStatementFromBuffer as parseCuscatlanCreditCardStatement,
  parseCuscatlanStatementText,
  cleanCuscatlanDescription,
} from "./cuscatlan-parser";

export {
  extractBamTransactionsFromParser,
  parseBamStatementFromBuffer,
  parseBamStatementFromBuffer as parseBamCreditCardStatement,
  parseBamStatementText,
  cleanBamDescription,
} from "./bam-parser";

export {
  extractGyTTransactionsFromParser,
  parseGyTStatementFromBuffer,
  parseGyTStatementText,
  cleanGyTDescription,
  cleanMerchantDescription,
  isNonExpenseGyTLine,
  isNonExpenseLine,
  normalizeStatementDate,
  parseGyTStatement,
} from "./gyt-parser";
