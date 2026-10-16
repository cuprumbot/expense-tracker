import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  formatBatchSummaryMessage,
  processBatchFiles,
  processSingleFile,
  BatchItem,
} from "./batch-processor";

describe("US-026: Multi-File Batch Processing & Aggregation Unit Tests", () => {
  it("formats the Spanish summary outcome string correctly", () => {
    assert.equal(
      formatBatchSummaryMessage(1, 1),
      "1 archivo procesado exitosamente, 1 transacción añadida."
    );
    assert.equal(
      formatBatchSummaryMessage(1, 24),
      "1 archivo procesado exitosamente, 24 transacciones añadidas."
    );
    assert.equal(
      formatBatchSummaryMessage(3, 45),
      "3 archivos procesados exitosamente, 45 transacciones añadidas."
    );
    assert.equal(
      formatBatchSummaryMessage(0, 0),
      "0 archivos procesados exitosamente, 0 transacciones añadidas."
    );
  });

  it("processes a batch of multiple CSV files and aggregates all valid transactions", async () => {
    const csvContent1 = `Fecha,Descripcion,Monto
2026-03-01,SUPERMERCADO LA TORRE,350.00
2026-03-02,GASOLINERA SHELL,200.00`;

    const csvContent2 = `Fecha,Descripcion,Monto
2026-03-05,PAIZ PRADERA,120.00
2026-03-06,RESTAURANTE SAN MARTIN,85.50
2026-03-07,FARMACIA GALENO,60.00`;

    const file1 = new File([csvContent1], "gastos_semana1.csv", { type: "text/csv" });
    const file2 = new File([csvContent2], "gastos_semana2.csv", { type: "text/csv" });

    const batch = [
      { file: file1, type: "csv" as const },
      { file: file2, type: "csv" as const },
    ];

    const updates: { index: number; status: string; statusMsg?: string }[] = [];
    const outcome = await processBatchFiles(batch, {
      onItemUpdate: (idx, item) => {
        updates.push({ index: idx, status: item.status, statusMsg: item.statusMessage });
      },
    });

    assert.equal(outcome.totalFiles, 2);
    assert.equal(outcome.successfulFiles, 2);
    assert.equal(outcome.failedFiles, 0);
    assert.equal(outcome.transactions.length, 5);
    assert.equal(
      outcome.summaryMessage,
      "2 archivos procesados exitosamente, 5 transacciones añadidas."
    );
    assert.equal(outcome.errors.length, 0);

    // Verify progress updates occurred
    assert.ok(updates.some((u) => u.status === "processing" && u.statusMsg?.includes("gastos_semana1.csv")));
    assert.ok(updates.some((u) => u.status === "completed" && u.index === 0));
    assert.ok(updates.some((u) => u.status === "processing" && u.statusMsg?.includes("gastos_semana2.csv")));
    assert.ok(updates.some((u) => u.status === "completed" && u.index === 1));
  });

  it("supports simultaneous mixed format batch ingestion (CSV and PDF)", async () => {
    const csvContent = `Fecha,Descripcion,Monto
2026-03-01,SUPERMERCADO LA TORRE,150.00`;
    const csvFile = new File([csvContent], "movimientos.csv", { type: "text/csv" });

    const pdfBuffer = new Uint8Array([37, 80, 68, 70]); // %PDF mock
    const pdfFile = new File([pdfBuffer], "estado_cuenta_gyt.pdf", { type: "application/pdf" });

    const mockPdfHandler = async () => ({
      success: true,
      isSupportedBank: true,
      bankName: "Banco G&T Continental",
      transactions: [
        {
          id: "pdf-tx-1",
          date: "2026-03-02",
          description: "PAGO EN LINEA EMPAGUA",
          amount: 80.0,
          currency: "GTQ" as const,
        },
        {
          id: "pdf-tx-2",
          date: "2026-03-03",
          description: "CLARO TELEFONIA",
          amount: 250.0,
          currency: "GTQ" as const,
        },
      ],
      summary: {
        totalRowsProcessed: 2,
        validTransactionsCount: 2,
        skippedRowsCount: 0,
        totalAmount: 330.0,
      },
    });

    const batch = [
      { file: csvFile, type: "csv" as const },
      { file: pdfFile, type: "pdf" as const },
    ];

    const outcome = await processBatchFiles(batch, {
      pdfHandler: mockPdfHandler,
    });

    assert.equal(outcome.successfulFiles, 2);
    assert.equal(outcome.failedFiles, 0);
    assert.equal(outcome.transactions.length, 3);
    assert.equal(
      outcome.summaryMessage,
      "2 archivos procesados exitosamente, 3 transacciones añadidas."
    );
  });

  it("handles individual file failure while successfully processing valid files in the batch", async () => {
    const validCSV = `Fecha,Descripcion,Monto
2026-03-01,SUPERMERCADO LA TORRE,150.00`;
    const validFile = new File([validCSV], "gastos_validos.csv", { type: "text/csv" });

    // Malformed CSV without recognizable data or invalid format
    const invalidFile = new File(["DATOS CORRUPTOS SIN COLUMNAS"], "archivo_invalido.csv", {
      type: "text/csv",
    });

    const pdfFile = new File([new Uint8Array([0, 1, 2])], "error_pdf.pdf", { type: "application/pdf" });

    const mockFailingPdfHandler = async () => ({
      success: false,
      error: "El archivo no contiene un formato de estado de cuenta válido.",
    });

    const batch = [
      { file: validFile, type: "csv" as const },
      { file: invalidFile, type: "csv" as const },
      { file: pdfFile, type: "pdf" as const },
    ];

    const outcome = await processBatchFiles(batch, {
      pdfHandler: mockFailingPdfHandler,
    });

    assert.equal(outcome.totalFiles, 3);
    assert.equal(outcome.successfulFiles, 1);
    assert.equal(outcome.failedFiles, 2);
    // Valid transactions from file 1 are preserved
    assert.equal(outcome.transactions.length, 1);
    assert.equal(outcome.transactions[0].description, "SUPERMERCADO LA TORRE");

    // Specific error messages are recorded for the failing files
    assert.equal(outcome.errors.length, 2);
    assert.equal(outcome.errors[0].fileName, "archivo_invalido.csv");
    assert.ok(outcome.errors[0].error.length > 0);
    assert.equal(outcome.errors[1].fileName, "error_pdf.pdf");
    assert.equal(
      outcome.errors[1].error,
      "El archivo no contiene un formato de estado de cuenta válido."
    );

    assert.equal(
      outcome.summaryMessage,
      "1 archivo procesado exitosamente, 1 transacción añadida."
    );
  });
});
