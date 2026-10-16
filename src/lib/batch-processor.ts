import { Transaction, CSVParsingSummary } from "@/types/transaction";
import { SupportedFileType, validateUploadedFile, FileValidationSuccess } from "@/lib/file-validator";
import { parseCSVContent } from "@/lib/csv-parser";

export type BatchItemStatus = "idle" | "processing" | "completed" | "error";

export interface BatchItem {
  id: string;
  file: File;
  type: SupportedFileType;
  status: BatchItemStatus;
  statusMessage?: string;
  transactions: Transaction[];
  summary?: CSVParsingSummary;
  bankName?: string | null;
  error?: string | null;
}

export interface BatchProcessingOutcome {
  totalFiles: number;
  successfulFiles: number;
  failedFiles: number;
  transactions: Transaction[];
  summaryMessage: string;
  errors: { fileName: string; error: string }[];
}

/**
 * Formats the Spanish summary message for a completed batch upload.
 * Example: "3 archivos procesados exitosamente, 45 transacciones añadidas."
 */
export function formatBatchSummaryMessage(
  successfulFiles: number,
  addedTransactions: number
): string {
  const fileWord =
    successfulFiles === 1 ? "archivo procesado exitosamente" : "archivos procesados exitosamente";
  const txWord =
    addedTransactions === 1 ? "transacción añadida" : "transacciones añadidas";
  return `${successfulFiles} ${fileWord}, ${addedTransactions} ${txWord}.`;
}

export type PDFParseHandler = (
  file: File
) => Promise<{
  success: boolean;
  isSupportedBank?: boolean;
  bankName?: string;
  transactions?: Transaction[];
  summary?: CSVParsingSummary;
  rawText?: string;
  error?: string;
}>;

/**
 * Default client-side PDF parser calling the local /api/parse-pdf endpoint.
 */
export async function defaultPDFParser(file: File) {
  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch("/api/parse-pdf", {
    method: "POST",
    body: formData,
  });

  const data = await res.json();
  if (!res.ok || !data.success) {
    return {
      success: false,
      error: data.error || "Ocurrió un error al procesar el archivo PDF.",
    };
  }

  return data;
}

/**
 * Processes a single file (CSV or PDF) and returns extracted transactions.
 */
export async function processSingleFile(
  file: File,
  type: SupportedFileType,
  pdfHandler: PDFParseHandler = defaultPDFParser
): Promise<{
  success: boolean;
  transactions: Transaction[];
  summary?: CSVParsingSummary;
  bankName?: string | null;
  error?: string;
  needsMapping?: boolean;
}> {
  if (type === "csv") {
    try {
      const text = await file.text();
      const result = parseCSVContent(text);

      if (result.needsMapping) {
        return {
          success: false,
          needsMapping: true,
          transactions: [],
          error: "El archivo CSV contiene columnas ambiguas que requieren configuración manual.",
        };
      }

      if (!result.success) {
        return {
          success: false,
          transactions: [],
          error: result.error || "No se pudo interpretar el archivo CSV.",
        };
      }

      return {
        success: true,
        transactions: result.transactions,
        summary: result.summary,
        bankName: null,
      };
    } catch (err) {
      return {
        success: false,
        transactions: [],
        error: `Error al leer CSV: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  }

  if (type === "pdf") {
    try {
      const data = await pdfHandler(file);

      if (!data.success) {
        return {
          success: false,
          transactions: [],
          error: data.error || "No se pudo procesar el estado de cuenta PDF.",
        };
      }

      if (data.isSupportedBank === false) {
        return {
          success: false,
          transactions: [],
          error: `El estado de cuenta (${data.bankName || "banco no compatible"}) requiere anonimización previa para extracción con IA.`,
        };
      }

      return {
        success: true,
        transactions: data.transactions || [],
        summary: data.summary,
        bankName: data.bankName || "Banco G&T Continental",
      };
    } catch (err) {
      return {
        success: false,
        transactions: [],
        error: `Error al procesar PDF: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  }

  return {
    success: false,
    transactions: [],
    error: `Tipo de archivo no compatible: ${type}`,
  };
}

/**
 * Processes a batch of files sequentially, reporting status changes for each file,
 * and aggregating all valid transactions while recording specific errors for failed files.
 */
export async function processBatchFiles(
  files: { file: File; type: SupportedFileType }[],
  options: {
    pdfHandler?: PDFParseHandler;
    onItemUpdate?: (index: number, item: BatchItem) => void;
  } = {}
): Promise<BatchProcessingOutcome> {
  const items: BatchItem[] = files.map((f, i) => ({
    id: `batch-item-${i}-${f.file.name}`,
    file: f.file,
    type: f.type,
    status: "idle",
    statusMessage: "En espera",
    transactions: [],
  }));

  const allTransactions: Transaction[] = [];
  const errors: { fileName: string; error: string }[] = [];
  let successfulFiles = 0;

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    item.status = "processing";
    item.statusMessage = `Procesando ${item.file.name}...`;
    options.onItemUpdate?.(i, { ...item });

    const result = await processSingleFile(
      item.file,
      item.type,
      options.pdfHandler || defaultPDFParser
    );

    if (result.success) {
      item.status = "completed";
      item.statusMessage = `Completado (${result.transactions.length} transacciones)`;
      const fileSalt = `b${i + 1}`;
      const uniqueBatchTransactions = result.transactions.map((tx, txIdx) => ({
        ...tx,
        id: tx.id.includes(fileSalt)
          ? tx.id
          : `${tx.id}_${fileSalt}_${txIdx + 1}`,
      }));
      item.transactions = uniqueBatchTransactions;
      item.summary = result.summary;
      item.bankName = result.bankName;
      allTransactions.push(...uniqueBatchTransactions);
      successfulFiles++;
    } else {
      item.status = "error";
      item.error = result.error || "Error al procesar el archivo.";
      item.statusMessage = item.error;
      errors.push({
        fileName: item.file.name,
        error: item.error,
      });
    }

    options.onItemUpdate?.(i, { ...item });
  }

  return {
    totalFiles: items.length,
    successfulFiles,
    failedFiles: errors.length,
    transactions: allTransactions,
    summaryMessage: formatBatchSummaryMessage(successfulFiles, allTransactions.length),
    errors,
  };
}
