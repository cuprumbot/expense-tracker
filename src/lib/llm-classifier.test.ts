import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  validateExpenseClassificationPayload,
  buildClassificationPrompt,
  parseLLMClassificationResponse,
  UnclassifiedExpenseItem,
} from "./llm-classifier";

describe("llm-classifier unit tests (US-009)", () => {
  it("validates safe payloads adhering to Split-Brain architecture", () => {
    const validItems: UnclassifiedExpenseItem[] = [
      { id: "tx-1", description: "TIENDA LOCAL SAN JOSE", amount: 120.5 },
      { id: "tx-2", description: "FERRETERIA EL MARTILLO", amount: 45.0 },
    ];

    const result = validateExpenseClassificationPayload({
      unclassifiedTransactions: validItems,
      availableCategories: ["Supermercado", "Restaurantes y Cafés"],
    });

    assert.equal(result.isValid, true);
  });

  it("rejects payloads containing unredacted sensitive IBAN or DPI", () => {
    const leakyItems: UnclassifiedExpenseItem[] = [
      {
        id: "tx-1",
        description: "PAGO A GT75 INDL 0101 0000 0006 9579 8863",
        amount: 500,
      },
    ];

    const result = validateExpenseClassificationPayload({
      unclassifiedTransactions: leakyItems,
      availableCategories: ["Servicios Básicos"],
    });

    assert.equal(result.isValid, false);
    assert.match(result.reason || "", /IBAN/i);
  });

  it("builds structured prompt containing only descriptions and amounts", () => {
    const items: UnclassifiedExpenseItem[] = [
      { id: "tx-10", description: "LIBRERIA PROGRESO ZONA 1", amount: 80.0 },
    ];
    const categories = ["Supermercado", "Entretenimiento y Compras"];

    const prompt = buildClassificationPrompt(items, categories);

    assert.match(prompt, /LIBRERIA PROGRESO ZONA 1/);
    assert.match(prompt, /80/);
    assert.match(prompt, /Entretenimiento y Compras/);
    assert.doesNotMatch(prompt, /DPI/);
  });

  it("parses valid JSON response from Gemini Pro and flags subscriptions", () => {
    const rawResponse = JSON.stringify([
      { id: "tx-1", category: "Restaurantes y Cafés", isSubscription: false },
      { id: "tx-2", category: "Suscripciones", isSubscription: true },
    ]);

    const parsed = parseLLMClassificationResponse(rawResponse);
    assert.equal(parsed.length, 2);
    assert.equal(parsed[0].id, "tx-1");
    assert.equal(parsed[0].category, "Restaurantes y Cafés");
    assert.equal(parsed[0].isSubscription, undefined);
    assert.equal(parsed[1].id, "tx-2");
    assert.equal(parsed[1].category, "Suscripciones");
    assert.equal(parsed[1].isSubscription, true);
  });

  it("parses JSON response wrapped in markdown code blocks", () => {
    const wrapped = "```json\n" + JSON.stringify([
      { id: "tx-5", category: "Servicios Básicos" }
    ]) + "\n```";

    const parsed = parseLLMClassificationResponse(wrapped);
    assert.equal(parsed.length, 1);
    assert.equal(parsed[0].id, "tx-5");
    assert.equal(parsed[0].category, "Servicios Básicos");
  });
});
