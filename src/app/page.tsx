"use client";

import { useState } from "react";
import { Icons } from "@/components/icons";
import { FileUpload } from "@/components/file-upload";
import { ColumnMappingModal } from "@/components/column-mapping-modal";
import { AnonymizationModal } from "@/components/anonymization-modal";
import { TransactionTable } from "@/components/transaction-table";
import { SupportedFileType } from "@/lib/file-validator";
import { parseCSVContent } from "@/lib/csv-parser";
import {
  Transaction,
  CSVParsingSummary,
  CSVColumnMapping,
} from "@/types/transaction";

export default function Home() {
  const [routedFile, setRoutedFile] = useState<{
    file: File;
    type: SupportedFileType;
  } | null>(null);

  const [transactions, setTransactions] = useState<Transaction[] | null>(null);
  const [summary, setSummary] = useState<CSVParsingSummary | null>(null);
  const [rawCSVText, setRawCSVText] = useState<string | null>(null);
  const [bankName, setBankName] = useState<string | null>(null);

  const [isProcessingPDF, setIsProcessingPDF] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [unsupportedBank, setUnsupportedBank] = useState<{
    bankName: string;
    rawText: string;
  } | null>(null);
  const [isAnonymizeModalOpen, setIsAnonymizeModalOpen] = useState(false);
  const [confirmedSanitizedText, setConfirmedSanitizedText] = useState<string | null>(null);

  const [mappingModal, setMappingModal] = useState<{
    isOpen: boolean;
    headers: string[];
    rawRows: Record<string, string>[];
    ambiguityReason?: string;
    detectedMapping?: Partial<CSVColumnMapping>;
  }>({
    isOpen: false,
    headers: [],
    rawRows: [],
  });

  const handleFileRouted = async (file: File, type: SupportedFileType) => {
    setRoutedFile({ file, type });
    setPdfError(null);
    setUnsupportedBank(null);

    if (type === "csv") {
      try {
        const text = await file.text();
        setRawCSVText(text);

        const result = parseCSVContent(text);

        if (result.needsMapping) {
          setMappingModal({
            isOpen: true,
            headers: result.headers,
            rawRows: result.rawRows,
            ambiguityReason: result.ambiguityReason,
            detectedMapping: result.detectedMapping,
          });
        } else if (result.success) {
          setTransactions(result.transactions);
          setSummary(result.summary);
          setBankName(null);
        }
      } catch (err) {
        console.error("Error al procesar el archivo CSV:", err);
      }
    } else if (type === "pdf") {
      setIsProcessingPDF(true);

      try {
        const formData = new FormData();
        formData.append("file", file);

        const res = await fetch("/api/parse-pdf", {
          method: "POST",
          body: formData,
        });

        const data = await res.json();

        if (!res.ok || !data.success) {
          setPdfError(
            data.error ||
              "Ocurrió un error al procesar el estado de cuenta PDF."
          );
          return;
        }

        if (!data.isSupportedBank) {
          setUnsupportedBank({
            bankName: data.bankName || "Banco no identificado",
            rawText: data.rawText || "",
          });
          setIsAnonymizeModalOpen(true);
          setConfirmedSanitizedText(null);
          return;
        }

        // Log debug entries in the browser terminal (DevTools console)
        if (data.debugLogs && Array.isArray(data.debugLogs)) {
          data.debugLogs.forEach(
            (log: { type: string; date: string; description: string; amount: string }) => {
              if (log.type === "credit_or_payment") {
                console.log(
                  `[Depuración PDF - Entrada en Crédito/Pagos] Fecha: ${log.date} | Descripción: ${log.description} | Monto: ${log.amount}`
                );
              } else if (log.type === "dollar_currency") {
                console.log(
                  `[Depuración PDF - Entrada en $] Fecha: ${log.date} | Descripción: ${log.description} | Monto: ${log.amount}`
                );
              }
            }
          );
        }

        setBankName(data.bankName);
        setTransactions(data.transactions);
        setSummary(data.summary);
      } catch (err) {
        console.error("Error al enviar PDF para procesamiento local:", err);
        setPdfError(
          "No se pudo completar el análisis local del archivo PDF."
        );
      } finally {
        setIsProcessingPDF(false);
      }
    }
  };

  const handleConfirmMapping = (mapping: CSVColumnMapping) => {
    if (!rawCSVText) return;

    const result = parseCSVContent(rawCSVText, mapping);

    if (result.success && !result.needsMapping) {
      setTransactions(result.transactions);
      setSummary(result.summary);
      setMappingModal((prev) => ({ ...prev, isOpen: false }));
    }
  };

  const handleConfirmAnonymization = (sanitizedText: string) => {
    setConfirmedSanitizedText(sanitizedText);
    setIsAnonymizeModalOpen(false);
  };

  const handleCancelAnonymization = () => {
    setIsAnonymizeModalOpen(false);
  };

  const handleReset = () => {
    setRoutedFile(null);
    setTransactions(null);
    setSummary(null);
    setRawCSVText(null);
    setBankName(null);
    setIsProcessingPDF(false);
    setPdfError(null);
    setUnsupportedBank(null);
    setIsAnonymizeModalOpen(false);
    setConfirmedSanitizedText(null);
    setMappingModal({
      isOpen: false,
      headers: [],
      rawRows: [],
    });
  };

  return (
    <div className="min-h-screen flex flex-col bg-white text-zinc-900 antialiased selection:bg-zinc-900 selection:text-white dark:bg-zinc-950 dark:text-zinc-100">
      {/* Minimal Top Header */}
      <header className="border-b border-zinc-200/80 dark:border-zinc-800/80">
        <div className="max-w-3xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-md bg-zinc-900 text-white flex items-center justify-center dark:bg-zinc-100 dark:text-zinc-900">
              <Icons.Wallet className="w-4 h-4" />
            </div>
            <span className="text-sm font-semibold tracking-tight">
              Control de Gastos
            </span>
          </div>

          <div className="text-xs text-zinc-500 font-mono tracking-tight dark:text-zinc-400">
            GTQ · Q
          </div>
        </div>
      </header>

      {/* Main Workspace */}
      <main className="flex-1 max-w-3xl w-full mx-auto px-6 py-16 space-y-8">
        {/* Title & Introduction */}
        <section className="space-y-2">
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
            Organiza tus gastos mensuales
          </h1>
          <p className="text-sm sm:text-base text-zinc-600 dark:text-zinc-400 leading-relaxed">
            Carga tu estado de cuenta bancario o archivo de movimientos para clasificar tus consumos, supervisar suscripciones y obtener un resumen claro de tus finanzas.
          </p>
        </section>

        {/* Dynamic Processing States */}
        {isProcessingPDF && (
          <section className="border border-zinc-200 rounded-xl bg-zinc-50/50 p-8 dark:border-zinc-800 dark:bg-zinc-900/40 text-center space-y-4">
            <div className="w-10 h-10 mx-auto rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-700 dark:text-zinc-200">
              <Icons.RefreshCw className="w-5 h-5 animate-spin" />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                Procesando estado de cuenta en el dispositivo...
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Extrayendo texto y detectando entidad bancaria de forma 100% privada.
              </p>
            </div>
          </section>
        )}

        {pdfError && !isProcessingPDF && (
          <section className="border border-red-200 bg-red-50/50 dark:border-red-900/50 dark:bg-red-950/20 p-6 rounded-xl space-y-3">
            <div className="flex items-start gap-3">
              <Icons.AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
              <div className="space-y-1 flex-1">
                <h3 className="text-sm font-semibold text-red-900 dark:text-red-200">
                  Error al procesar el archivo PDF
                </h3>
                <p className="text-xs text-red-700 dark:text-red-300">
                  {pdfError}
                </p>
              </div>
            </div>
            <div className="pt-2">
              <button
                type="button"
                onClick={handleReset}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-700 bg-red-100/80 hover:bg-red-200/80 rounded-lg dark:text-red-300 dark:bg-red-900/40 dark:hover:bg-red-900/60 transition-colors"
              >
                <Icons.RefreshCw className="w-3.5 h-3.5" />
                <span>Intentar de nuevo</span>
              </button>
            </div>
          </section>
        )}

        {unsupportedBank && !isProcessingPDF && confirmedSanitizedText && (
          <section className="border border-emerald-200 bg-emerald-50/50 dark:border-emerald-900/50 dark:bg-emerald-950/20 p-6 rounded-xl space-y-4">
            <div className="flex items-start gap-3">
              <Icons.ShieldCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
              <div className="space-y-1 flex-1">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-emerald-900 dark:text-emerald-200">
                    Texto anonimizado y verificado localmente
                  </h3>
                  <span className="text-2xs font-mono px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300">
                    {unsupportedBank.bankName}
                  </span>
                </div>
                <p className="text-xs text-emerald-800 dark:text-emerald-300/90 leading-relaxed pt-1">
                  Todos los identificadores personales (nombres, cuentas, direcciones, NIT y contacto) han sido sustituidos por etiquetas de protección. Ningún dato sensible saldrá de tu navegador.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2 border-t border-emerald-200/60 dark:border-emerald-900/40">
              <button
                type="button"
                onClick={() => setIsAnonymizeModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-emerald-800 bg-white border border-emerald-300 rounded-lg hover:bg-emerald-50 dark:text-emerald-200 dark:bg-zinc-900 dark:border-emerald-800 dark:hover:bg-zinc-800 transition-colors"
              >
                <Icons.Eye className="w-3.5 h-3.5" />
                <span>Revisar anonimización</span>
              </button>
              <button
                type="button"
                onClick={handleReset}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-zinc-700 bg-white border border-zinc-200 rounded-lg hover:bg-zinc-50 dark:text-zinc-300 dark:bg-zinc-900 dark:border-zinc-700 dark:hover:bg-zinc-800 transition-colors"
              >
                <Icons.RefreshCw className="w-3.5 h-3.5" />
                <span>Cargar otro archivo</span>
              </button>
              <div className="text-2xs text-emerald-700 dark:text-emerald-400 font-mono ml-auto">
                Listo para US-006 (Extracción con IA)
              </div>
            </div>
          </section>
        )}

        {unsupportedBank && !isProcessingPDF && !confirmedSanitizedText && (
          <section className="border border-amber-200 bg-amber-50/50 dark:border-amber-900/50 dark:bg-amber-950/20 p-6 rounded-xl space-y-4">
            <div className="flex items-start gap-3">
              <Icons.Info className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div className="space-y-1 flex-1">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-amber-900 dark:text-amber-200">
                    Banco no compatible para extracción directa
                  </h3>
                  <span className="text-2xs font-mono px-2 py-0.5 rounded bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-300">
                    {unsupportedBank.bankName}
                  </span>
                </div>
                <p className="text-xs text-amber-800 dark:text-amber-300/90 leading-relaxed pt-1">
                  El formato de este archivo no corresponde a Banco G&amp;T Continental.
                  Para procesarlo sin comprometer su privacidad, el documento debe anonimizarse localmente antes de continuar.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2 border-t border-amber-200/60 dark:border-amber-900/40">
              <button
                type="button"
                onClick={() => setIsAnonymizeModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-zinc-900 hover:bg-zinc-800 rounded-lg dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 transition-colors"
              >
                <Icons.Lock className="w-3.5 h-3.5" />
                <span>Revisar y anonimizar datos</span>
              </button>
              <button
                type="button"
                onClick={handleReset}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-zinc-700 bg-white border border-zinc-200 rounded-lg hover:bg-zinc-50 dark:text-zinc-300 dark:bg-zinc-900 dark:border-zinc-700 dark:hover:bg-zinc-800 transition-colors"
              >
                <Icons.RefreshCw className="w-3.5 h-3.5" />
                <span>Cargar otro archivo</span>
              </button>
            </div>
          </section>
        )}

        {/* Dynamic Workspace: File Ingestion or Extracted Transactions Table */}
        {!transactions || !summary ? (
          !isProcessingPDF && !pdfError && !unsupportedBank && (
            <section className="border border-zinc-200 rounded-xl bg-zinc-50/50 p-6 sm:p-8 dark:border-zinc-800 dark:bg-zinc-900/40 space-y-6">
              <div className="flex items-center justify-between border-b border-zinc-200/80 pb-4 dark:border-zinc-800/80">
                <span className="text-xs font-medium tracking-tight text-zinc-700 dark:text-zinc-300">
                  Carga de documento
                </span>
                <div className="flex items-center gap-3 text-xs text-zinc-500 dark:text-zinc-400">
                  <span>PDF</span>
                  <span className="text-zinc-300 dark:text-zinc-700">/</span>
                  <span>CSV</span>
                </div>
              </div>

              <FileUpload onFileRouted={handleFileRouted} />
            </section>
          )
        ) : (
          <TransactionTable
            transactions={transactions}
            summary={summary}
            sourceLabel={
              bankName
                ? `${bankName} · ${routedFile?.file.name}`
                : routedFile?.file.name || "Archivo de movimientos"
            }
            onReset={handleReset}
          />
        )}
      </main>

      {/* Ambiguous Column Mapping Modal */}
      <ColumnMappingModal
        isOpen={mappingModal.isOpen}
        headers={mappingModal.headers}
        rawPreviewRows={mappingModal.rawRows}
        ambiguityReason={mappingModal.ambiguityReason}
        initialMapping={mappingModal.detectedMapping}
        onConfirm={handleConfirmMapping}
        onCancel={() => setMappingModal((prev) => ({ ...prev, isOpen: false }))}
      />

      {/* Unsupported Bank Anonymization Modal */}
      {unsupportedBank && (
        <AnonymizationModal
          isOpen={isAnonymizeModalOpen}
          bankName={unsupportedBank.bankName}
          rawText={unsupportedBank.rawText}
          onConfirm={handleConfirmAnonymization}
          onCancel={handleCancelAnonymization}
        />
      )}
    </div>
  );
}
