"use client";

import { useState, useEffect } from "react";
import { Icons } from "@/components/icons";
import { FileUpload } from "@/components/file-upload";
import { ColumnMappingModal } from "@/components/column-mapping-modal";
import { AnonymizationModal } from "@/components/anonymization-modal";
import { TransactionTable } from "@/components/transaction-table";
import { DashboardView } from "@/components/dashboard-view";
import { BatchProgress } from "@/components/batch-progress";
import { SupportedFileType, validateUploadedFile } from "@/lib/file-validator";
import { processBatchFiles, BatchItem } from "@/lib/batch-processor";
import { parseCSVContent } from "@/lib/csv-parser";
import {
  classifyTransactions,
  UNCLASSIFIED_THRESHOLD,
  AVAILABLE_CATEGORIES,
  shouldTriggerLLMClassification,
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
import { SavingsRecommendationResponse } from "@/lib/savings-advisor";
import { deduplicateTransactions } from "@/lib/deduplication";
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
  const [savingsRecommendations, setSavingsRecommendations] =
    useState<SavingsRecommendationResponse | null>(null);
  const [rawCSVText, setRawCSVText] = useState<string | null>(null);
  const [bankName, setBankName] = useState<string | null>(null);

  const [savedSession, setSavedSession] = useState<StoredSession | null>(null);
  const [hasHydratedStorage, setHasHydratedStorage] = useState(false);
  const [isClearConfirmOpen, setIsClearConfirmOpen] = useState(false);
  const [isResetSessionModalOpen, setIsResetSessionModalOpen] = useState(false);
  const [wipeCustomCategoriesOnReset, setWipeCustomCategoriesOnReset] = useState(false);
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
  const [duplicateNotification, setDuplicateNotification] = useState<string | null>(null);

  const [batchItems, setBatchItems] = useState<BatchItem[] | null>(null);
  const [batchSummaryNotification, setBatchSummaryNotification] = useState<string | null>(null);
  const [batchErrors, setBatchErrors] = useState<{ fileName: string; error: string }[]>([]);
  const [isAddMoreModalOpen, setIsAddMoreModalOpen] = useState(false);

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

  const [unclassifiedThreshold, setUnclassifiedThreshold] =
    useState<number>(UNCLASSIFIED_THRESHOLD);
  const [exchangeRate, setExchangeRate] = useState<number>(7.85);

  // Fetch runtime server configuration dynamically (Option A: Server-Driven via API)
  useEffect(() => {
    fetch("/api/config")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) {
          if (
            typeof data.unclassifiedThreshold === "number" &&
            data.unclassifiedThreshold > 0
          ) {
            setUnclassifiedThreshold(data.unclassifiedThreshold);
          }
          if (
            typeof data.exchangeRate?.rate === "number" &&
            data.exchangeRate.rate > 0
          ) {
            setExchangeRate(data.exchangeRate.rate);
          }
        }
      })
      .catch(() => {
        // Fallback gracefully to default constants
      });
  }, []);

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
        savingsRecommendations,
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
    savingsRecommendations,
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

  const ensureUniqueTransactionIds = (txs: Transaction[]): Transaction[] => {
    const seen = new Set<string>();
    return txs.map((tx, idx) => {
      let id = tx.id;
      if (!id || seen.has(id)) {
        id = `${id || "tx"}_${Date.now()}_${idx + 1}_${Math.random().toString(36).substring(2, 7)}`;
      }
      seen.add(id);
      return { ...tx, id };
    });
  };

  const handleResumeSession = () => {
    if (!savedSession) return;
    const sanitizedTxs = ensureUniqueTransactionIds(savedSession.transactions);
    setTransactions(sanitizedTxs);
    setSummary(savedSession.summary);
    if (savedSession.customCategories?.length > 0) {
      setCustomCategories(savedSession.customCategories);
    }
    if (savedSession.savingsRecommendations) {
      setSavingsRecommendations(savedSession.savingsRecommendations);
    }
    setBankName(savedSession.bankName || null);
    setSavedSession(null);
  };

  const handleStartFresh = () => {
    clearStoredSession(false);
    setSavedSession(null);
    setDuplicateNotification(null);
  };

  const handleConfirmResetSession = () => {
    if (wipeCustomCategoriesOnReset) {
      clearStoredSession(true);
      setCustomCategories([]);
      saveStoredCategories([]);
    } else {
      clearStoredSession(false);
    }

    handleReset();
    setSavedSession(null);
    setIsResetSessionModalOpen(false);
    setWipeCustomCategoriesOnReset(false);

    setStorageNotification(
      wipeCustomCategoriesOnReset
        ? "Se ha reiniciado la sesión y se han eliminado las categorías personalizadas."
        : "Se ha reiniciado la sesión. Las categorías personalizadas se han conservado."
    );
    setTimeout(() => {
      setStorageNotification(null);
    }, 4000);
  };

  const handleConfirmClearData = () => {
    clearStoredSession();
    handleReset();
    setCustomCategories([]);
    setSavingsRecommendations(null);
    setSavedSession(null);
    setDuplicateNotification(null);
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
    detectedBankName: string | null = null,
    sourceFileName?: string | null
  ) => {
    const existing = transactions || [];
    const dedup = deduplicateTransactions(
      rawTransactions,
      existing,
      sourceFileName || routedFile?.file.name
    );

    if (dedup.isAllDuplicates) {
      setDuplicateNotification(dedup.notificationMessage);
      return;
    }

    if (dedup.discardedCount > 0) {
      setDuplicateNotification(dedup.notificationMessage);
    } else {
      setDuplicateNotification(null);
    }

    const existingIds = new Set(existing.map((t) => t.id));
    const uniqueIdTransactions = dedup.uniqueTransactions.map((tx, idx) => {
      let uniqueId = tx.id;
      if (!uniqueId || existingIds.has(uniqueId)) {
        uniqueId = `${uniqueId || "tx"}_${Date.now()}_${idx + 1}_${Math.random().toString(36).substring(2, 7)}`;
      }
      existingIds.add(uniqueId);
      return {
        ...tx,
        id: uniqueId,
      };
    });

    const classifiedUnique = classifyTransactions(uniqueIdTransactions);
    const combinedTransactions =
      existing.length > 0 ? [...existing, ...classifiedUnique] : classifiedUnique;

    const combinedTotal = Number(
      combinedTransactions.reduce((acc, t) => acc + t.amount, 0).toFixed(2)
    );

    const updatedSummary: CSVParsingSummary = {
      ...parsedSummary,
      validTransactionsCount: combinedTransactions.length,
      totalAmount: combinedTotal,
    };

    setTransactions(combinedTransactions);
    setSummary(updatedSummary);
    setBankName(detectedBankName || bankName);

    const pending = combinedTransactions.filter(
      (tx) => !tx.category || tx.category === "Pendiente"
    );

    // Threshold Rule: If pending > unclassifiedThreshold (default: 10), trigger LLM assistance.
    // If <= threshold, skip LLM call and allow manual assignment.
    if (shouldTriggerLLMClassification(pending.length, unclassifiedThreshold)) {
      await classifyPendingWithLLM(pending, combinedTransactions);
    }
  };

  const handleBatchFilesRouted = async (
    files: { file: File; type: SupportedFileType }[] | File[]
  ) => {
    if (!files || files.length === 0) return;

    setBatchErrors([]);
    setBatchSummaryNotification(null);
    setPdfError(null);

    const validEntries: { file: File; type: SupportedFileType }[] = [];
    const validationErrors: { fileName: string; error: string }[] = [];

    for (const item of files) {
      if ("type" in item && (item.type === "pdf" || item.type === "csv")) {
        validEntries.push(item as { file: File; type: SupportedFileType });
      } else {
        const file = item as File;
        const validation = validateUploadedFile(file);
        if (validation.valid) {
          validEntries.push({ file, type: validation.fileType });
        } else {
          validationErrors.push({
            fileName: file.name,
            error:
              validation.error ||
              "Archivo no compatible o excede el límite de tamaño.",
          });
        }
      }
    }

    if (validationErrors.length > 0) {
      setBatchErrors(validationErrors);
    }

    if (validEntries.length === 0) {
      return;
    }

    const initialBatchItems: BatchItem[] = validEntries.map((entry, idx) => ({
      id: `batch-item-${idx}-${entry.file.name}`,
      file: entry.file,
      type: entry.type,
      status: "idle",
      statusMessage: "En espera",
      transactions: [],
    }));

    setBatchItems(initialBatchItems);

    try {
      const outcome = await processBatchFiles(validEntries, {
        onItemUpdate: (index, updatedItem) => {
          setBatchItems((prev) => {
            if (!prev) return null;
            const copy = [...prev];
            copy[index] = updatedItem;
            return copy;
          });
        },
      });

      if (outcome.errors.length > 0) {
        setBatchErrors((prev) => [...prev, ...outcome.errors]);
      }

      if (outcome.transactions.length > 0) {
        const successfulNames = validEntries
          .filter(
            (e) => !outcome.errors.some((err) => err.fileName === e.file.name)
          )
          .map((e) => e.file.name);

        const sourceLabel =
          successfulNames.length > 1
            ? `${successfulNames.length} archivos (${successfulNames.join(", ")})`
            : successfulNames[0] || "Lote de archivos";

        const totalAmt = Number(
          outcome.transactions
            .reduce((acc, t) => acc + t.amount, 0)
            .toFixed(2)
        );

        const batchSummary: CSVParsingSummary = {
          totalRowsProcessed: outcome.transactions.length,
          validTransactionsCount: outcome.transactions.length,
          skippedRowsCount: 0,
          totalAmount: totalAmt,
        };

        if (validEntries.length === 1) {
          setRoutedFile(validEntries[0]);
        }

        await processLoadedTransactions(
          outcome.transactions,
          batchSummary,
          validEntries.length === 1 ? null : "Consolidado multicuenta",
          sourceLabel
        );
      }

      setBatchSummaryNotification(outcome.summaryMessage);
    } catch (err) {
      console.error("Error durante el procesamiento por lotes:", err);
      setBatchErrors((prev) => [
        ...prev,
        {
          fileName: "Lote general",
          error: "Ocurrió un error inesperado al procesar los archivos.",
        },
      ]);
    } finally {
      setIsAddMoreModalOpen(false);
      setTimeout(() => {
        setBatchItems(null);
      }, 1200);
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
          processLoadedTransactions(result.transactions, result.summary, null, file.name);
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
          data.bankName,
          file.name
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
      processLoadedTransactions(result.transactions, result.summary, null, routedFile?.file.name);
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
        unsupportedBank?.bankName || "Banco no compatible",
        routedFile?.file.name
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
    setSavingsRecommendations(null);
    setDuplicateNotification(null);
    setBatchItems(null);
    setBatchSummaryNotification(null);
    setBatchErrors([]);
    setIsAddMoreModalOpen(false);
    setMappingModal({
      isOpen: false,
      headers: [],
      rawRows: [],
    });
  };

  const pendingTransactionsCount = transactions
    ? transactions.filter((t) => !t.category || t.category === "Pendiente").length
    : 0;
  const isDashboardActive = transactions !== null && pendingTransactionsCount < 10;

  return (
    <>
      {isDashboardActive ? (
        <DashboardView
          transactions={transactions}
          summary={summary}
          bankName={bankName}
          customCategories={customCategories}
          onAddMoreStatements={() => setIsAddMoreModalOpen(true)}
          onResetSession={() => {
            setWipeCustomCategoriesOnReset(false);
            setIsResetSessionModalOpen(true);
          }}
          onClearData={() => setIsClearConfirmOpen(true)}
          renderDrawerContent={() => (
            <TransactionTable
              transactions={transactions}
              summary={summary!}
              sourceLabel={
                bankName
                  ? `${bankName} · ${routedFile?.file.name || "Múltiples archivos"}`
                  : routedFile?.file.name || "Archivo de movimientos"
              }
              onReset={() => {
                setWipeCustomCategoriesOnReset(false);
                setIsResetSessionModalOpen(true);
              }}
              duplicateNotification={duplicateNotification}
              onDismissDuplicateNotification={() => setDuplicateNotification(null)}
              onAddMoreStatements={() => setIsAddMoreModalOpen(true)}
              batchSummaryNotification={batchSummaryNotification}
              onDismissBatchSummaryNotification={() => setBatchSummaryNotification(null)}
              batchErrors={batchErrors}
              onDismissBatchError={(fileName) =>
                setBatchErrors((prev) => prev.filter((e) => e.fileName !== fileName))
              }
              customCategories={customCategories}
              savingsRecommendations={null}
              onSavingsRecommendationsChange={setSavingsRecommendations}
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
              unclassifiedThreshold={unclassifiedThreshold}
              hideTopDashboard={true}
            />
          )}
        />
      ) : (
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

          <div className="flex items-center gap-3">
            {((transactions && transactions.length > 0) || savedSession) && (
              <button
                type="button"
                id="btn-reset-session"
                onClick={() => {
                  setWipeCustomCategoriesOnReset(false);
                  setIsResetSessionModalOpen(true);
                }}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-zinc-700 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700 rounded-lg transition-colors cursor-pointer border border-zinc-200/60 dark:border-zinc-700/60"
                title="Reiniciar sesión de transacciones"
              >
                <Icons.RotateCcw className="w-3.5 h-3.5" />
                <span>Reiniciar sesión</span>
              </button>
            )}

            <div className="text-xs text-zinc-500 font-mono tracking-tight dark:text-zinc-400">
              GTQ · Q
            </div>
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
              {/* Standalone duplicate warning banner if all duplicates uploaded without active table */}
              {duplicateNotification && (
                <div
                  role="alert"
                  id="duplicate-transactions-banner-standalone"
                  className="p-4 rounded-xl border border-amber-300 bg-amber-50 dark:border-amber-800/80 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200 flex items-start justify-between gap-3 shadow-xs animate-in fade-in duration-200"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-900/60 text-amber-700 dark:text-amber-300 flex items-center justify-center shrink-0 mt-0.5">
                      <Icons.AlertCircle className="w-4 h-4" />
                    </div>
                    <div className="space-y-0.5">
                      <h4 className="text-xs font-semibold text-amber-900 dark:text-amber-200">
                        Aviso de transacciones duplicadas
                      </h4>
                      <p className="text-xs text-amber-800 dark:text-amber-300 leading-relaxed font-medium">
                        {duplicateNotification}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setDuplicateNotification(null)}
                    aria-label="Cerrar notificación"
                    className="text-amber-600 hover:text-amber-800 dark:text-amber-400 dark:hover:text-amber-200 cursor-pointer p-1 rounded-md hover:bg-amber-100/60 dark:hover:bg-amber-900/40 transition-colors shrink-0"
                  >
                    <Icons.X className="w-4 h-4" />
                  </button>
                </div>
              )}

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

              {batchErrors.length > 0 && !transactions && (
                <div className="space-y-2">
                  {batchErrors.map((err) => (
                    <div
                      key={`main-batch-err-${err.fileName}`}
                      role="alert"
                      className="p-3.5 rounded-xl border border-red-200 bg-red-50 text-red-900 text-xs dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200 flex items-start justify-between gap-3 shadow-xs"
                    >
                      <div className="flex items-start gap-2.5">
                        <Icons.AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
                        <div>
                          <p className="font-semibold">Error al procesar {err.fileName}</p>
                          <p className="text-2xs text-red-700 dark:text-red-300 mt-0.5">{err.error}</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          setBatchErrors((prev) => prev.filter((e) => e.fileName !== err.fileName))
                        }
                        aria-label="Cerrar aviso"
                        className="text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-200 cursor-pointer p-0.5"
                      >
                        <Icons.X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {batchItems && batchItems.length > 0 ? (
                <BatchProgress items={batchItems} />
              ) : (
                <FileUpload
                  onFileRouted={handleFileRouted}
                  onFilesRouted={handleBatchFilesRouted}
                />
              )}
            </section>
          )
        ) : (
          <TransactionTable
            transactions={transactions}
            summary={summary}
            sourceLabel={
              bankName
                ? `${bankName} · ${routedFile?.file.name || "Múltiples archivos"}`
                : routedFile?.file.name || "Archivo de movimientos"
            }
            onReset={() => {
              setWipeCustomCategoriesOnReset(false);
              setIsResetSessionModalOpen(true);
            }}
            duplicateNotification={duplicateNotification}
            onDismissDuplicateNotification={() => setDuplicateNotification(null)}
            onAddMoreStatements={() => setIsAddMoreModalOpen(true)}
            batchSummaryNotification={batchSummaryNotification}
            onDismissBatchSummaryNotification={() => setBatchSummaryNotification(null)}
            batchErrors={batchErrors}
            onDismissBatchError={(fileName) =>
              setBatchErrors((prev) => prev.filter((e) => e.fileName !== fileName))
            }
            customCategories={customCategories}
            savingsRecommendations={savingsRecommendations}
            onSavingsRecommendationsChange={setSavingsRecommendations}
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
            unclassifiedThreshold={unclassifiedThreshold}
          />
        )}
      </main>
    </div>
    )}

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

      {/* Add More Bank Statements Modal (US-026) */}
      {isAddMoreModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="add-more-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-150"
        >
          <div className="w-full max-w-2xl bg-white dark:bg-zinc-950 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-2xl overflow-hidden p-6 space-y-5 animate-in zoom-in-95 duration-150">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 flex items-center justify-center shrink-0 mt-0.5">
                  <Icons.Plus className="w-5 h-5" />
                </div>
                <div className="space-y-1">
                  <h3
                    id="add-more-title"
                    className="text-sm font-semibold text-zinc-900 dark:text-zinc-100"
                  >
                    Agregar más estados de cuenta a la sesión
                  </h3>
                  <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
                    Selecciona o arrastra archivos PDF o CSV adicionales. Los nuevos movimientos se sumarán a los actuales y los duplicados serán omitidos automáticamente.
                  </p>
                </div>
              </div>
              <button
                type="button"
                id="btn-close-add-more-modal"
                onClick={() => setIsAddMoreModalOpen(false)}
                aria-label="Cerrar ventana"
                className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 p-1 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors cursor-pointer shrink-0"
              >
                <Icons.X className="w-4 h-4" />
              </button>
            </div>

            {batchItems && batchItems.length > 0 ? (
              <BatchProgress items={batchItems} />
            ) : (
              <FileUpload
                onFilesRouted={handleBatchFilesRouted}
                onFileRouted={(file, type) => handleBatchFilesRouted([{ file, type }])}
              />
            )}

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
              <button
                type="button"
                onClick={() => setIsAddMoreModalOpen(false)}
                className="px-3.5 py-1.5 text-xs font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Reset Session Confirmation Modal (US-027) */}
      {isResetSessionModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="reset-session-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-150"
        >
          <div className="w-full max-w-md bg-white dark:bg-zinc-950 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-xl overflow-hidden p-6 space-y-5 animate-in zoom-in-95 duration-150">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 flex items-center justify-center shrink-0 mt-0.5">
                <Icons.RotateCcw className="w-5 h-5" />
              </div>
              <div className="space-y-1.5 flex-1">
                <h3
                  id="reset-session-title"
                  className="text-sm font-semibold text-zinc-900 dark:text-zinc-100"
                >
                  ¿Deseas reiniciar la sesión?
                </h3>
                <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
                  ¿Deseas reiniciar la sesión? Se eliminarán las transacciones cargadas en esta sesión. Las categorías personalizadas se conservarán.
                </p>
              </div>
            </div>

            <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800">
              <label className="flex items-start gap-2.5 cursor-pointer text-xs text-zinc-700 dark:text-zinc-300 select-none">
                <input
                  type="checkbox"
                  id="checkbox-wipe-custom-categories"
                  checked={wipeCustomCategoriesOnReset}
                  onChange={(e) => setWipeCustomCategoriesOnReset(e.target.checked)}
                  className="mt-0.5 rounded border-zinc-300 dark:border-zinc-700 text-zinc-900 focus:ring-zinc-500 cursor-pointer"
                />
                <span>
                  Eliminar también las categorías personalizadas creadas (restablecimiento total de fábrica).
                </span>
              </label>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
              <button
                type="button"
                id="btn-cancel-reset-session"
                onClick={() => {
                  setIsResetSessionModalOpen(false);
                  setWipeCustomCategoriesOnReset(false);
                }}
                className="px-3 py-2 text-xs font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                id="btn-confirm-reset-session"
                onClick={handleConfirmResetSession}
                className="px-3.5 py-2 text-xs font-medium text-white bg-amber-600 hover:bg-amber-700 dark:bg-amber-500 dark:hover:bg-amber-600 rounded-lg transition-colors shadow-xs cursor-pointer"
              >
                Reiniciar sesión
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
