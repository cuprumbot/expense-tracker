"use client";

import { useState, useEffect } from "react";
import { Icons } from "@/components/icons";
import { FileUpload } from "@/components/file-upload";
import { ColumnMappingModal } from "@/components/column-mapping-modal";
import { AnonymizationModal } from "@/components/anonymization-modal";
import { TransactionTable } from "@/components/transaction-table";
import { SupportedFileType } from "@/lib/file-validator";
import { parseCSVContent } from "@/lib/csv-parser";
import {
  classifyTransactions,
  UNCLASSIFIED_THRESHOLD,
  AVAILABLE_CATEGORIES,
} from "@/lib/expense-classifier";
import {
  ClassifyExpensesPayload,
  ClassifiedExpenseItem,
} from "@/lib/llm-classifier";
import {
  saveStoredSession,
  loadStoredSession,
  clearStoredSession,
  saveStoredCategories,
  loadStoredCategories,
  StoredSession,
} from "@/lib/storage";
import {
  Transaction,
  CSVParsingSummary,
  CSVColumnMapping,
  CustomCategory,
} from "@/types/transaction";

export default function Home() {
  const [routedFile, setRoutedFile] = useState<{
    file: File;
    type: SupportedFileType;
  } | null>(null);

  const [transactions, setTransactions] = useState<Transaction[] | null>(null);
  const [summary, setSummary] = useState<CSVParsingSummary | null>(null);
  const [customCategories, setCustomCategories] = useState<CustomCategory[]>([]);
  const [rawCSVText, setRawCSVText] = useState<string | null>(null);
  const [bankName, setBankName] = useState<string | null>(null);

  const [savedSession, setSavedSession] = useState<StoredSession | null>(null);
  const [hasHydratedStorage, setHasHydratedStorage] = useState(false);
  const [isClearConfirmOpen, setIsClearConfirmOpen] = useState(false);
  const [storageNotification, setStorageNotification] = useState<string | null>(null);

  const [isProcessingPDF, setIsProcessingPDF] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [unsupportedBank, setUnsupportedBank] = useState<{
    bankName: string;
    rawText: string;
  } | null>(null);
  const [isAnonymizeModalOpen, setIsAnonymizeModalOpen] = useState(false);
  const [confirmedSanitizedText, setConfirmedSanitizedText] = useState<string | null>(null);
  const [isExtractingWithLLM, setIsExtractingWithLLM] = useState(false);
  const [llmExtractionError, setLlmExtractionError] = useState<string | null>(null);

  const [isClassifyingWithLLM, setIsClassifyingWithLLM] = useState(false);
  const [llmClassificationError, setLlmClassificationError] = useState<string | null>(null);
  const [llmSuccessMessage, setLlmSuccessMessage] = useState<string | null>(null);

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

  // Hydrate stored data from localStorage on mount
  useEffect(() => {
    const storedCats = loadStoredCategories();
    if (storedCats.length > 0) {
      setCustomCategories(storedCats);
    }
    const session = loadStoredSession();
    if (session && session.transactions?.length > 0) {
      setSavedSession(session);
    }
    setHasHydratedStorage(true);
  }, []);

  // Auto-persist active session to localStorage
  useEffect(() => {
    if (!hasHydratedStorage) return;
    if (transactions && transactions.length > 0 && summary) {
      saveStoredSession({
        transactions,
        summary,
        customCategories,
        bankName,
        sourceLabel: bankName
          ? `${bankName} · ${routedFile?.file.name || "Archivo de movimientos"}`
          : routedFile?.file.name || "Archivo de movimientos",
      });
    }
  }, [
    transactions,
    summary,
    customCategories,
    bankName,
    routedFile,
    hasHydratedStorage,
  ]);

  // Auto-persist custom categories independently
  useEffect(() => {
    if (!hasHydratedStorage) return;
    if (customCategories.length > 0) {
      saveStoredCategories(customCategories);
    }
  }, [customCategories, hasHydratedStorage]);

  const handleResumeSession = () => {
    if (!savedSession) return;
    setTransactions(savedSession.transactions);
    setSummary(savedSession.summary);
    if (savedSession.customCategories?.length > 0) {
      setCustomCategories(savedSession.customCategories);
    }
    setBankName(savedSession.bankName || null);
    setSavedSession(null);
  };

  const handleStartFresh = () => {
    setSavedSession(null);
  };

  const handleConfirmClearData = () => {
    clearStoredSession();
    handleReset();
    setCustomCategories([]);
    setSavedSession(null);
    setIsClearConfirmOpen(false);
    setStorageNotification("Se han borrado todos los datos guardados en este navegador.");
    setTimeout(() => {
      setStorageNotification(null);
    }, 5000);
  };

  const classifyPendingWithLLM = async (
    pendingItems: Transaction[],
    currentTransactions: Transaction[]
  ) => {
    if (pendingItems.length === 0) return;

    setIsClassifyingWithLLM(true);
    setLlmClassificationError(null);
    setLlmSuccessMessage(null);

    try {
      const payload: ClassifyExpensesPayload = {
        unclassifiedTransactions: pendingItems.map((t) => ({
          id: t.id,
          description: t.description,
          amount: t.amount,
        })),
        availableCategories: AVAILABLE_CATEGORIES,
      };

      const res = await fetch("/api/classify-expenses", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setLlmClassificationError(
          data.error || "Ocurrió un error al clasificar los gastos con Gemini Pro."
        );
        return;
      }

      const classMap = new Map<string, ClassifiedExpenseItem>(
        data.classifications.map((c: ClassifiedExpenseItem) => [c.id, c])
      );

      setTransactions((prev) => {
        const base = prev || currentTransactions;
        return base.map((tx) => {
          const matched = classMap.get(tx.id);
          if (matched && matched.category && matched.category !== "Pendiente") {
            const isSub =
              matched.isSubscription === true ||
              matched.category.toLowerCase() === "suscripciones";
            return {
              ...tx,
              category: matched.category,
              classificationSource: "llm",
              isSubscription: isSub ? true : tx.isSubscription,
            };
          }
          return tx;
        });
      });

      setLlmSuccessMessage(
        `Se clasificaron ${data.count || data.classifications.length} gastos pendientes con Gemini Pro.`
      );
    } catch (err) {
      console.error("Error al clasificar gastos pendientes:", err);
      setLlmClassificationError(
        "No se pudo conectar con el servicio de clasificación por IA. Puedes clasificar los gastos pendientes manualmente."
      );
    } finally {
      setIsClassifyingWithLLM(false);
    }
  };

  const handleUpdateCategory = (
    transactionId: string,
    newCategory: string,
    applyToAllWithSameDescription: boolean = false,
    targetDescription?: string
  ) => {
    setTransactions((prev) => {
      if (!prev) return null;
      const targetTx = prev.find((t) => t.id === transactionId);
      const descToMatch = (targetDescription || targetTx?.description || "")
        .trim()
        .toLowerCase();

      return prev.map((tx) => {
        const matches = applyToAllWithSameDescription
          ? (tx.description || "").trim().toLowerCase() === descToMatch
          : tx.id === transactionId;

        if (matches) {
          const isSub =
            newCategory.toLowerCase() === "suscripciones" ||
            (tx.isSubscription && newCategory !== "Pendiente");
          return {
            ...tx,
            category: newCategory,
            classificationSource: "manual" as const,
            isSubscription: isSub ? true : undefined,
          };
        }
        return tx;
      });
    });
  };

  const handleAddCustomCategory = (category: CustomCategory) => {
    setCustomCategories((prev) => {
      if (prev.some((c) => c.name.toLowerCase() === category.name.toLowerCase())) {
        return prev;
      }
      return [...prev, category];
    });
  };

  const handleEditTransaction = (updatedTx: Transaction) => {
    setTransactions((prev) => {
      if (!prev) return null;
      const next = prev.map((t) => (t.id === updatedTx.id ? updatedTx : t));
      const newTotal = next.reduce((acc, t) => acc + t.amount, 0);
      setSummary((s) =>
        s
          ? {
              ...s,
              validTransactionsCount: next.length,
              totalAmount: Number(newTotal.toFixed(2)),
            }
          : null
      );
      return next;
    });
  };

  const handleDeleteTransaction = (transactionId: string) => {
    setTransactions((prev) => {
      if (!prev) return null;
      const next = prev.filter((t) => t.id !== transactionId);
      const newTotal = next.reduce((acc, t) => acc + t.amount, 0);
      setSummary((s) =>
        s
          ? {
              ...s,
              validTransactionsCount: next.length,
              totalAmount: Number(newTotal.toFixed(2)),
            }
          : null
      );
      return next;
    });
  };

  const handleBulkAssignCategory = (
    transactionIds: string[],
    newCategory: string
  ) => {
    const idSet = new Set(transactionIds);
    const isSub = newCategory.toLowerCase() === "suscripciones";
    setTransactions((prev) => {
      if (!prev) return null;
      return prev.map((t) => {
        if (idSet.has(t.id)) {
          return {
            ...t,
            category: newCategory,
            classificationSource: "manual" as const,
            isSubscription: isSub
              ? true
              : t.isSubscription && newCategory !== "Pendiente"
              ? t.isSubscription
              : undefined,
          };
        }
        return t;
      });
    });
  };

  const handleBulkDeleteTransactions = (transactionIds: string[]) => {
    const idSet = new Set(transactionIds);
    setTransactions((prev) => {
      if (!prev) return null;
      const next = prev.filter((t) => !idSet.has(t.id));
      const newTotal = next.reduce((acc, t) => acc + t.amount, 0);
      setSummary((s) =>
        s
          ? {
              ...s,
              validTransactionsCount: next.length,
              totalAmount: Number(newTotal.toFixed(2)),
            }
          : null
      );
      return next;
    });
  };

  const handleToggleSubscription = (transactionId: string) => {
    setTransactions((prev) => {
      if (!prev) return null;
      return prev.map((tx) => {
        if (tx.id === transactionId) {
          const isCurrentlySub =
            tx.isSubscription === true ||
            (tx.isSubscription !== false && tx.category === "Suscripciones");
          return {
            ...tx,
            isSubscription: !isCurrentlySub,
          };
        }
        return tx;
      });
    });
  };

  const processLoadedTransactions = async (
    rawTransactions: Transaction[],
    parsedSummary: CSVParsingSummary,
    detectedBankName: string | null = null
  ) => {
    const classified = classifyTransactions(rawTransactions);
    setTransactions(classified);
    setSummary(parsedSummary);
    setBankName(detectedBankName);

    const pending = classified.filter(
      (tx) => !tx.category || tx.category === "Pendiente"
    );

    // US-009 Threshold Rule: If pending > 5, trigger LLM assistance.
    // If <= 5, skip LLM call and allow manual assignment.
    if (pending.length > UNCLASSIFIED_THRESHOLD) {
      await classifyPendingWithLLM(pending, classified);
    }
  };

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
          processLoadedTransactions(result.transactions, result.summary, null);
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

        processLoadedTransactions(
          data.transactions,
          data.summary,
          data.bankName
        );
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
      processLoadedTransactions(result.transactions, result.summary, null);
      setMappingModal((prev) => ({ ...prev, isOpen: false }));
    }
  };

  const handleExtractWithLLM = async (sanitizedText: string) => {
    setIsExtractingWithLLM(true);
    setLlmExtractionError(null);

    try {
      const res = await fetch("/api/extract-transactions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sanitizedText,
          bankName: unsupportedBank?.bankName || "Banco no compatible",
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setLlmExtractionError(
          data.error || "Ocurrió un error al extraer transacciones con Gemini Pro."
        );
        return;
      }

      setUnsupportedBank(null);
      processLoadedTransactions(
        data.transactions,
        data.summary,
        unsupportedBank?.bankName || "Banco no compatible"
      );
    } catch (err) {
      console.error("Error al llamar a /api/extract-transactions:", err);
      setLlmExtractionError(
        "No se pudo conectar con el servicio de extracción por IA. Verifique su conexión y configuración."
      );
    } finally {
      setIsExtractingWithLLM(false);
    }
  };

  const handleConfirmAnonymization = (sanitizedText: string) => {
    setConfirmedSanitizedText(sanitizedText);
    setIsAnonymizeModalOpen(false);
    handleExtractWithLLM(sanitizedText);
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
    setIsExtractingWithLLM(false);
    setLlmExtractionError(null);
    setIsClassifyingWithLLM(false);
    setLlmClassificationError(null);
    setLlmSuccessMessage(null);
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
        <div className="max-w-5xl lg:max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
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
      <main className="flex-1 max-w-5xl lg:max-w-6xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14 space-y-8">
        {/* Title & Introduction */}
        <section className="space-y-2">
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
            Organiza tus gastos mensuales
          </h1>
          <p className="text-sm sm:text-base text-zinc-600 dark:text-zinc-400 leading-relaxed">
            Carga tu estado de cuenta bancario o archivo de movimientos para clasificar tus consumos, supervisar suscripciones y obtener un resumen claro de tus finanzas.
          </p>
        </section>

        {/* Storage Notification Toast */}
        {storageNotification && (
          <div className="p-3.5 rounded-xl border border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 text-xs text-zinc-800 dark:text-zinc-200 flex items-center justify-between gap-3 shadow-2xs">
            <div className="flex items-center gap-2">
              <Icons.CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>{storageNotification}</span>
            </div>
            <button
              type="button"
              onClick={() => setStorageNotification(null)}
              className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 cursor-pointer p-0.5"
            >
              <Icons.X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Saved Session Detection Banner (US-011) */}
        {savedSession && !transactions && !isProcessingPDF && !unsupportedBank && (
          <section className="border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 p-6 rounded-2xl shadow-xs space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 flex items-center justify-center shrink-0 mt-0.5">
                <Icons.FileText className="w-5 h-5" />
              </div>
              <div className="space-y-1 flex-1">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                      Sesión anterior guardada en el navegador
                    </h3>
                    <span className="text-3xs font-mono px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300">
                      {savedSession.transactions.length} transacciones
                    </span>
                  </div>
                </div>
                <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
                  {savedSession.sourceLabel ? `${savedSession.sourceLabel} · ` : ""}
                  Guardado el{" "}
                  {new Date(savedSession.savedAt).toLocaleDateString("es-GT", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                  . Puedes retomar tu sesión o comenzar una nueva carga.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 pt-2 border-t border-zinc-100 dark:border-zinc-800">
              <button
                type="button"
                onClick={handleResumeSession}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-zinc-900 hover:bg-zinc-800 rounded-lg dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 transition-colors shadow-xs cursor-pointer"
              >
                <Icons.Check className="w-3.5 h-3.5" />
                <span>Continuar sesión</span>
              </button>
              <button
                type="button"
                onClick={handleStartFresh}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-zinc-700 bg-zinc-100 hover:bg-zinc-200 rounded-lg dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700 transition-colors cursor-pointer"
              >
                <Icons.Upload className="w-3.5 h-3.5" />
                <span>Nueva carga de estado de cuenta</span>
              </button>
              <button
                type="button"
                onClick={() => setIsClearConfirmOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 rounded-lg dark:bg-red-950/40 dark:text-red-400 dark:hover:bg-red-900/60 ml-auto transition-colors cursor-pointer"
              >
                <Icons.Trash2 className="w-3.5 h-3.5" />
                <span>Borrar mis datos</span>
              </button>
            </div>
          </section>
        )}

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

        {/* LLM Extraction Loading State */}
        {isExtractingWithLLM && (
          <section className="border border-zinc-200 rounded-xl bg-zinc-50/50 p-8 dark:border-zinc-800 dark:bg-zinc-900/40 text-center space-y-4">
            <div className="w-10 h-10 mx-auto rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-700 dark:text-zinc-200">
              <Icons.Sparkles className="w-5 h-5 animate-spin" />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                Extrayendo transacciones con IA (Gemini Pro)...
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Analizando gastos y movimientos del estado de cuenta anonimizado. Tu identidad permanece 100% privada.
              </p>
            </div>
          </section>
        )}

        {/* LLM Extraction Error State */}
        {llmExtractionError && !isExtractingWithLLM && (
          <section className="border border-red-200 bg-red-50/50 dark:border-red-900/50 dark:bg-red-950/20 p-6 rounded-xl space-y-3">
            <div className="flex items-start gap-3">
              <Icons.AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
              <div className="space-y-1 flex-1">
                <h3 className="text-sm font-semibold text-red-900 dark:text-red-200">
                  Error en la extracción con Gemini Pro
                </h3>
                <p className="text-xs text-red-700 dark:text-red-300 leading-relaxed">
                  {llmExtractionError}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 pt-2">
              {confirmedSanitizedText && (
                <button
                  type="button"
                  onClick={() => handleExtractWithLLM(confirmedSanitizedText)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-zinc-900 hover:bg-zinc-800 rounded-lg dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 transition-colors"
                >
                  <Icons.RefreshCw className="w-3.5 h-3.5" />
                  <span>Reintentar extracción con IA</span>
                </button>
              )}
              {unsupportedBank && (
                <button
                  type="button"
                  onClick={() => setIsAnonymizeModalOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-zinc-700 bg-white border border-zinc-200 rounded-lg hover:bg-zinc-50 dark:text-zinc-300 dark:bg-zinc-900 dark:border-zinc-700 dark:hover:bg-zinc-800 transition-colors"
                >
                  <Icons.Eye className="w-3.5 h-3.5" />
                  <span>Revisar texto anonimizado</span>
                </button>
              )}
              <button
                type="button"
                onClick={handleReset}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-zinc-700 bg-white border border-zinc-200 rounded-lg hover:bg-zinc-50 dark:text-zinc-300 dark:bg-zinc-900 dark:border-zinc-700 dark:hover:bg-zinc-800 transition-colors"
              >
                <Icons.Upload className="w-3.5 h-3.5" />
                <span>Cargar archivo CSV en su lugar</span>
              </button>
            </div>
          </section>
        )}

        {unsupportedBank && !isProcessingPDF && !isExtractingWithLLM && !llmExtractionError && confirmedSanitizedText && (
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
                onClick={() => handleExtractWithLLM(confirmedSanitizedText)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-zinc-900 hover:bg-zinc-800 rounded-lg dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 transition-colors shadow-xs"
              >
                <Icons.Sparkles className="w-3.5 h-3.5" />
                <span>Extraer gastos con IA (Gemini Pro)</span>
              </button>
              <button
                type="button"
                onClick={() => setIsAnonymizeModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-zinc-700 bg-white border border-zinc-200 rounded-lg hover:bg-zinc-50 dark:text-zinc-300 dark:bg-zinc-900 dark:border-zinc-700 dark:hover:bg-zinc-800 transition-colors"
              >
                <Icons.Eye className="w-3.5 h-3.5" />
                <span>Revisar texto</span>
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

        {unsupportedBank && !isProcessingPDF && !isExtractingWithLLM && !llmExtractionError && !confirmedSanitizedText && (
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
          !isProcessingPDF && !pdfError && !unsupportedBank && !isExtractingWithLLM && !llmExtractionError && (
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
            customCategories={customCategories}
            onUpdateCategory={handleUpdateCategory}
            onAddCustomCategory={handleAddCustomCategory}
            onEditTransaction={handleEditTransaction}
            onDeleteTransaction={handleDeleteTransaction}
            onBulkAssignCategory={handleBulkAssignCategory}
            onBulkDeleteTransactions={handleBulkDeleteTransactions}
            onToggleSubscription={handleToggleSubscription}
            onClearData={() => setIsClearConfirmOpen(true)}
            onClassifyPendingWithLLM={() => {
              if (transactions) {
                const pending = transactions.filter(
                  (t) => !t.category || t.category === "Pendiente"
                );
                classifyPendingWithLLM(pending, transactions);
              }
            }}
            isClassifyingWithLLM={isClassifyingWithLLM}
            llmClassificationError={llmClassificationError}
            llmSuccessMessage={llmSuccessMessage}
          />
        )}
      </main>

      {/* Clear Data Confirmation Modal (US-011) */}
      {isClearConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white dark:bg-zinc-950 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-xl overflow-hidden p-6 space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-red-100 dark:bg-red-950/60 text-red-600 dark:text-red-400 flex items-center justify-center shrink-0 mt-0.5">
                <Icons.Trash2 className="w-5 h-5" />
              </div>
              <div className="space-y-1.5 flex-1">
                <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                  ¿Borrar todos mis datos?
                </h3>
                <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
                  Esta acción eliminará de forma permanente todas las transacciones, categorías personalizadas y preferencias almacenadas localmente en este navegador.
                </p>
                <p className="text-2xs text-red-600 dark:text-red-400 font-medium">
                  No se puede deshacer esta operación.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
              <button
                type="button"
                onClick={() => setIsClearConfirmOpen(false)}
                className="px-3 py-2 text-xs font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmClearData}
                className="px-3.5 py-2 text-xs font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors shadow-xs cursor-pointer"
              >
                Borrar mis datos
              </button>
            </div>
          </div>
        </div>
      )}

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
