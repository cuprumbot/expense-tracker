import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import { parsePDFStatement } from "./pdf-parser";
import { classifyTransactions } from "./expense-classifier";
import { deduplicateTransactions } from "./deduplication";
import { processBatchFiles, BatchProcessingOutcome } from "./batch-processor";
import { Transaction } from "@/types/transaction";

describe("US-071: Multi-Bank Ingestion End-to-End Verification (All 6 Parsers)", () => {
  const demoDir = path.resolve(process.cwd(), "demo");

  const bankStatements = [
    {
      fileName: "BI-max.pdf",
      expectedBank: "Banco Industrial",
      expectedParser: "bi-parser",
      minTransactions: 1,
    },
    {
      fileName: "CUSCATLAN-brolo.pdf",
      expectedBank: "Banco Cuscatlán",
      expectedParser: "cuscatlan-parser",
      minTransactions: 1,
    },
    {
      fileName: "BAC-brolo.pdf",
      expectedBank: "BAC Credomatic",
      expectedParser: "bac-parser",
      minTransactions: 1,
    },
    {
      fileName: "FICOHSA-brolo.pdf",
      expectedBank: "Banco FICOHSA",
      expectedParser: "ficohsa-parser",
      minTransactions: 1,
    },
    {
      fileName: "FICOHSA-chofo.pdf",
      expectedBank: "Banco FICOHSA",
      expectedParser: "ficohsa-parser",
      minTransactions: 1,
    },
    {
      fileName: "BAM-brolo.pdf",
      expectedBank: "Banco Agromercantil (BAM)",
      expectedParser: "bam-parser",
      minTransactions: 14,
    },
    {
      fileName: "2026-01.pdf",
      expectedBank: "Banco G&T Continental",
      expectedParser: "gyt-parser",
      minTransactions: 40,
    },
  ];

  for (const { fileName, expectedBank, expectedParser, minTransactions } of bankStatements) {
    it(`end-to-end: parses ${fileName} as ${expectedBank} (${expectedParser}) with valid transactions`, async () => {
      const filePath = path.join(demoDir, fileName);
      if (!fs.existsSync(filePath)) {
        return;
      }

      const buffer = fs.readFileSync(filePath);
      const result = await parsePDFStatement(new Uint8Array(buffer));

      assert.equal(result.success, true, `Expected success for ${fileName}`);
      assert.equal(result.isSupportedBank, true, `Expected supported bank for ${fileName}`);
      assert.equal(result.bankName, expectedBank, `Expected bank name ${expectedBank} for ${fileName}`);
      assert.ok(
        result.transactions.length >= minTransactions,
        `Expected at least ${minTransactions} transactions for ${fileName}, got ${result.transactions.length}`
      );

      // Verify canonical transaction shape
      for (const tx of result.transactions) {
        assert.ok(tx.id, "Transaction should have an id");
        assert.ok(tx.date && /^\d{4}-\d{2}-\d{2}$/.test(tx.date), `Date should be YYYY-MM-DD: ${tx.date}`);
        assert.ok(typeof tx.amount === "number" && tx.amount > 0, `Amount should be positive number: ${tx.amount}`);
        assert.equal(tx.currency, "GTQ", "Currency must be GTQ");
        assert.equal(tx.classificationSource, "local", "Source must be local");
        assert.ok(tx.description && tx.description.length > 0, "Description must be non-empty");

        if (tx.originalCurrency === "USD") {
          assert.ok(typeof tx.originalAmount === "number" && tx.originalAmount > 0);
          assert.ok(typeof tx.exchangeRateApplied === "number" && tx.exchangeRateApplied > 0);
        }
      }

      // Verify classification pipeline
      const classified = classifyTransactions(result.transactions);
      assert.equal(classified.length, result.transactions.length);
      for (const ctx of classified) {
        assert.ok(ctx.category, "Classified transaction should have a category");
      }
    });
  }

  describe("Multi-Currency Support & USD to GTQ Conversion", () => {
    it("converts foreign currency expenses to GTQ while preserving original amount and currency", async () => {
      // Test statements known to contain USD charges (BAC, G&T, BI, Ficohsa, BAM)
      const filesWithUsd = ["BAC-brolo.pdf", "2026-01.pdf", "FICOHSA-brolo.pdf"];
      let totalUsdFound = 0;

      for (const file of filesWithUsd) {
        const filePath = path.join(demoDir, file);
        if (!fs.existsSync(filePath)) continue;

        const buffer = fs.readFileSync(filePath);
        const result = await parsePDFStatement(new Uint8Array(buffer));
        const usdCharges = result.transactions.filter((tx) => tx.originalCurrency === "USD");
        totalUsdFound += usdCharges.length;

        for (const usdTx of usdCharges) {
          assert.equal(usdTx.currency, "GTQ", "Normalized currency must be GTQ");
          assert.equal(usdTx.originalCurrency, "USD");
          assert.ok(usdTx.originalAmount && usdTx.originalAmount > 0);
          assert.ok(usdTx.exchangeRateApplied && usdTx.exchangeRateApplied > 0);
          const expectedGtq = Number((usdTx.originalAmount * usdTx.exchangeRateApplied).toFixed(2));
          assert.ok(
            Math.abs(usdTx.amount - expectedGtq) <= 0.05,
            `Converted amount ${usdTx.amount} should be close to ${expectedGtq}`
          );
        }
      }

      assert.ok(totalUsdFound > 0, "Should have found USD transactions in test statements");
    });
  });

  describe("Deduplication Engine Integration Across Statements", () => {
    it("discards exact repeated transactions when uploading the same statement twice", async () => {
      const filePath = path.join(demoDir, "BI-max.pdf");
      if (!fs.existsSync(filePath)) return;

      const buffer = fs.readFileSync(filePath);
      const res1 = await parsePDFStatement(new Uint8Array(buffer));
      const res2 = await parsePDFStatement(new Uint8Array(buffer));

      const firstPass = deduplicateTransactions(res1.transactions, [], "BI-max.pdf");
      assert.equal(firstPass.uniqueTransactions.length, res1.transactions.length);
      assert.equal(firstPass.discardedCount, 0);

      // Re-uploading the exact same transactions against existing session
      const secondPass = deduplicateTransactions(
        res2.transactions,
        firstPass.uniqueTransactions,
        "BI-max.pdf"
      );
      assert.equal(secondPass.isAllDuplicates, true);
      assert.equal(secondPass.uniqueTransactions.length, 0);
      assert.equal(secondPass.discardedCount, res2.transactions.length);
      assert.ok(
        secondPass.notificationMessage?.includes("ya se encontraban registradas") ||
        secondPass.notificationMessage?.includes("omitidas")
      );
    });

    it("merges transactions from two different bank statements in the same session without deduplication loss", async () => {
      const biPath = path.join(demoDir, "BI-max.pdf");
      const cuscatlanPath = path.join(demoDir, "CUSCATLAN-brolo.pdf");
      if (!fs.existsSync(biPath) || !fs.existsSync(cuscatlanPath)) return;

      const biRes = await parsePDFStatement(new Uint8Array(fs.readFileSync(biPath)));
      const cuscatlanRes = await parsePDFStatement(new Uint8Array(fs.readFileSync(cuscatlanPath)));

      const session1 = biRes.transactions;
      const dedupResult = deduplicateTransactions(
        cuscatlanRes.transactions,
        session1,
        "CUSCATLAN-brolo.pdf"
      );

      // Different banks have different transactions, none should be falsely discarded as duplicates
      assert.equal(dedupResult.uniqueTransactions.length, cuscatlanRes.transactions.length);
      assert.equal(dedupResult.discardedCount, 0);

      const combined = [...session1, ...dedupResult.uniqueTransactions];
      assert.equal(combined.length, biRes.transactions.length + cuscatlanRes.transactions.length);
    });
  });

  describe("Batch Upload Simulation Across Multiple Banks", () => {
    it("processes a multi-bank batch sequentially returning consolidated outcome", async () => {
      const mockPdfHandler = async (file: File) => {
        const filePath = path.join(demoDir, file.name);
        if (fs.existsSync(filePath)) {
          const buf = fs.readFileSync(filePath);
          const res = await parsePDFStatement(new Uint8Array(buf));
          return {
            success: res.success,
            isSupportedBank: res.isSupportedBank,
            bankName: res.bankName,
            transactions: res.transactions,
            summary: res.summary,
          };
        }
        return { success: false, error: "Archivo no encontrado" };
      };

      const filesToProcess = [
        { file: new File(["dummy"], "BI-max.pdf"), type: "pdf" as const },
        { file: new File(["dummy"], "2026-01.pdf"), type: "pdf" as const },
        { file: new File(["dummy"], "FICOHSA-brolo.pdf"), type: "pdf" as const },
      ];

      const outcome: BatchProcessingOutcome = await processBatchFiles(filesToProcess, {
        pdfHandler: mockPdfHandler,
      });

      assert.equal(outcome.totalFiles, 3);
      assert.equal(outcome.successfulFiles, 3);
      assert.equal(outcome.failedFiles, 0);
      assert.ok(outcome.transactions.length > 50);
      assert.ok(outcome.summaryMessage.includes("3 archivos procesados exitosamente"));

      // Check unique IDs assigned across batch
      const ids = new Set(outcome.transactions.map((t) => t.id));
      assert.equal(ids.size, outcome.transactions.length, "All batch transactions must have unique ids");
    });
  });

  describe("Unsupported Statement Fallback", () => {
    it("gracefully marks unknown statements as unsupported without crashing", async () => {
      const minimalPdf = "%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [] /Count 0 >>\nendobj\nxref\n0 3\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \ntrailer\n<< /Size 3 /Root 1 0 R >>\nstartxref\n115\n%%EOF";
      const buffer = Buffer.from(minimalPdf, "utf-8");
      const result = await parsePDFStatement(new Uint8Array(buffer));

      assert.equal(result.success, true);
      assert.equal(result.isSupportedBank, false);
      assert.equal(result.bankName, "Banco no identificado");
      assert.equal(result.transactions.length, 0);
    });
  });
});
