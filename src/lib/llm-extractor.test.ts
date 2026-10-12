import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  validateSanitizedPayload,
  buildExtractionPrompt,
  parseLLMTransactionResponse,
  extractTransactionsWithGemini,
} from "./llm-extractor";

describe("llm-extractor unit tests", () => {
  it("validateSanitizedPayload accepts properly sanitized text", () => {
    const sanitized = `
      Tipo Monetaria QUETZALES
      Número [CUENTA_REDACTADA]
      Cuenta Estandarizada [CUENTA_REDACTADA]
      [NOMBRE_REDACTADO]
      [DIRECCION_REDACTADA]
      Día Doc. Descripción Débito Crédito Saldo
      01 184752 NOTA DEBITO SERBIPAGO 10.00 717.50
      04 103490 ACH [NOMBRE_REDACTADO] telefono 180.00 740.00
    `;

    const res = validateSanitizedPayload(sanitized);
    assert.equal(res.isValid, true);
  });

  it("validateSanitizedPayload rejects unredacted IBAN", () => {
    const raw = "Cuenta Estandarizada GT75 INDL 0101 0000 0006 9579 8863";
    const res = validateSanitizedPayload(raw);
    assert.equal(res.isValid, false);
    assert.ok(res.reason?.includes("IBAN"));
  });

  it("validateSanitizedPayload rejects unredacted bank account", () => {
    const raw = "Número de cuenta: 069-579886-3";
    const res = validateSanitizedPayload(raw);
    assert.equal(res.isValid, false);
    assert.ok(res.reason?.includes("cuenta bancaria"));
  });

  it("validateSanitizedPayload rejects unredacted DPI", () => {
    const raw = "Identificación DPI: 2345 67890 0101";
    const res = validateSanitizedPayload(raw);
    assert.equal(res.isValid, false);
    assert.ok(res.reason?.includes("DPI"));
  });

  it("validateSanitizedPayload rejects unredacted email", () => {
    const raw = "Contacto: usuario.ejemplo@gmail.com";
    const res = validateSanitizedPayload(raw);
    assert.equal(res.isValid, false);
    assert.ok(res.reason?.includes("correo electrónico"));
  });

  it("buildExtractionPrompt combines bank header and sanitized body", () => {
    const prompt = buildExtractionPrompt("Texto del extracto", "Banco Industrial");
    assert.ok(prompt.includes("Banco Industrial"));
    assert.ok(prompt.includes("Texto del extracto"));
  });

  it("parseLLMTransactionResponse parses a valid JSON array into canonical transactions", () => {
    const rawLLMJson = JSON.stringify([
      { date: "2025-07-01", description: "NOTA DEBITO SERBIPAGO", amount: 10.0 },
      { date: "2025-07-04", description: "ACH [NOMBRE_REDACTADO] telefono", amount: 180.0 },
      { date: "2025-07-12", description: "NOTA DEBITO ATM 456 AGENCIA", amount: 150.0 },
    ]);

    const txs = parseLLMTransactionResponse(rawLLMJson);
    assert.equal(txs.length, 3);
    assert.equal(txs[0].date, "2025-07-01");
    assert.equal(txs[0].description, "NOTA DEBITO SERBIPAGO");
    assert.equal(txs[0].amount, 10.0);
    assert.equal(txs[0].currency, "GTQ");
    assert.equal(txs[0].classificationSource, "llm");
    assert.ok(txs[0].id.startsWith("llm-tx-"));
  });

  it("parseLLMTransactionResponse strips markdown code fences", () => {
    const fenced = `\`\`\`json
[
  { "date": "2025-07-18", "description": "NOTA DEBITO", "amount": 109.00 },
  { "date": "2025-07-20", "description": "COMPLEMENTO DE DOS ETB", "amount": 500.00 }
]
\`\`\``;

    const txs = parseLLMTransactionResponse(fenced);
    assert.equal(txs.length, 2);
    assert.equal(txs[0].amount, 109.0);
    assert.equal(txs[1].amount, 500.0);
  });

  it("parseLLMTransactionResponse handles wrapped object { transactions: [...] }", () => {
    const wrapped = JSON.stringify({
      transactions: [
        { date: "2025-07-28", description: "fin de semana", amount: 255.0 },
      ],
    });

    const txs = parseLLMTransactionResponse(wrapped);
    assert.equal(txs.length, 1);
    assert.equal(txs[0].description, "fin de semana");
  });

  it("extractTransactionsWithGemini fails gracefully with informative message when API key is missing", async () => {
    await assert.rejects(
      async () => {
        await extractTransactionsWithGemini(
          "Texto anonimizado [NOMBRE_REDACTADO]",
          "Banco Test",
          ""
        );
      },
      (err: Error) => {
        assert.ok(err.message.includes("GEMINI_API_KEY"));
        return true;
      }
    );
  });
});
