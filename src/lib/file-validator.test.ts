import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { formatFileSize, validateUploadedFile } from "./file-validator";

describe("formatFileSize", () => {
  it("formats bytes, kilobytes and megabytes correctly", () => {
    assert.strictEqual(formatFileSize(500), "500 B");
    assert.strictEqual(formatFileSize(1024), "1.0 KB");
    assert.strictEqual(formatFileSize(1536), "1.5 KB");
    assert.strictEqual(formatFileSize(1048576), "1.00 MB");
    assert.strictEqual(formatFileSize(2621440), "2.50 MB");
  });

  it("handles 0 or negative values", () => {
    assert.strictEqual(formatFileSize(0), "0 B");
    assert.strictEqual(formatFileSize(-100), "0 B");
  });
});

describe("validateUploadedFile", () => {
  it("accepts valid PDF files and routes to 'pdf'", () => {
    const result = validateUploadedFile({
      name: "estado_cuenta_marzo.pdf",
      size: 1048576,
      type: "application/pdf",
    });

    assert.strictEqual(result.valid, true);
    if (result.valid) {
      assert.strictEqual(result.fileType, "pdf");
      assert.strictEqual(result.fileName, "estado_cuenta_marzo.pdf");
      assert.strictEqual(result.fileSizeFormatted, "1.00 MB");
    }
  });

  it("accepts valid CSV files and routes to 'csv'", () => {
    const result = validateUploadedFile({
      name: "gastos_2026.csv",
      size: 2048,
      type: "text/csv",
    });

    assert.strictEqual(result.valid, true);
    if (result.valid) {
      assert.strictEqual(result.fileType, "csv");
      assert.strictEqual(result.fileName, "gastos_2026.csv");
      assert.strictEqual(result.fileSizeFormatted, "2.0 KB");
    }
  });

  it("rejects unsupported file formats with Spanish error message", () => {
    const result = validateUploadedFile({
      name: "gastos.xlsx",
      size: 50000,
    });

    assert.strictEqual(result.valid, false);
    if (!result.valid) {
      assert.match(result.error, /Formato de archivo no compatible/);
      assert.match(result.error, /\.xlsx/);
    }
  });

  it("rejects empty files (0 bytes)", () => {
    const result = validateUploadedFile({
      name: "vacio.pdf",
      size: 0,
    });

    assert.strictEqual(result.valid, false);
    if (!result.valid) {
      assert.match(result.error, /vacío/);
    }
  });
});
