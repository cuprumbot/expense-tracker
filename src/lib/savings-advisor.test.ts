import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildSavingsPayload,
  validateSavingsPayload,
  buildSavingsPrompt,
  parseSavingsResponse,
  SavingsPayload,
} from "./savings-advisor";
import { ReportingMetrics } from "./reporting";
import { SubscriptionSummary } from "./expense-classifier";

describe("US-014: Savings Advisor Unit Tests", () => {
  const mockMetrics: ReportingMetrics = {
    totalSpend: 4500,
    totalTransactionsCount: 12,
    classifiedCount: 12,
    pendingCount: 0,
    isFullyClassified: true,
    topCategory: {
      category: "Supermercado",
      total: 2500,
      count: 5,
      percentage: 55.6,
      isTopCategory: true,
    },
    categories: [
      {
        category: "Supermercado",
        total: 2500,
        count: 5,
        percentage: 55.6,
        isTopCategory: true,
      },
      {
        category: "Restaurantes y Cafés",
        total: 1500,
        count: 4,
        percentage: 33.3,
        isTopCategory: false,
      },
      {
        category: "Suscripciones",
        total: 500,
        count: 3,
        percentage: 11.1,
        isTopCategory: false,
      },
    ],
  };

  const mockSubscriptionSummary: SubscriptionSummary = {
    transactions: [],
    count: 2,
    totalMonthlyCommitment: 250,
    services: [
      {
        id: "tx-sub-1",
        name: "Netflix Standard",
        amount: 109,
        date: "2024-05-12",
      },
      {
        id: "tx-sub-2",
        name: "Spotify Family",
        amount: 141,
        date: "2024-05-18",
      },
    ],
  };

  it("builds strictly aggregated payload with detailed recurring subscriptions", () => {
    const payload = buildSavingsPayload(mockMetrics, mockSubscriptionSummary);

    assert.equal(payload.totalSpendGTQ, 4500);
    assert.equal(payload.currency, "GTQ");

    // Aggregated categories
    assert.equal(payload.categoryBreakdown.length, 3);
    const groceryCat = payload.categoryBreakdown.find(
      (c) => c.categorySpanish === "Supermercado"
    );
    assert.ok(groceryCat);
    assert.equal(groceryCat?.category, "Groceries & Supermarkets");
    assert.equal(groceryCat?.totalGTQ, 2500);
    assert.equal(groceryCat?.percentage, 55.6);
    assert.equal(groceryCat?.transactionCount, 5);

    // Detailed recurring expenses
    assert.equal(payload.recurringExpenses.count, 2);
    assert.equal(payload.recurringExpenses.totalMonthlyCommitmentGTQ, 250);
    assert.equal(payload.recurringExpenses.services.length, 2);
    assert.equal(payload.recurringExpenses.services[0].serviceName, "Netflix Standard");
    assert.equal(payload.recurringExpenses.services[0].monthlyAmountGTQ, 109);
    assert.equal(payload.recurringExpenses.services[0].chargeDate, "2024-05-12");
  });

  it("validates safe payloads adhering to Split-Brain architecture", () => {
    const payload = buildSavingsPayload(mockMetrics, mockSubscriptionSummary);
    const validation = validateSavingsPayload(payload);

    assert.equal(validation.isValid, true);
  });

  it("rejects payloads with unredacted sensitive PII in recurring service descriptions", () => {
    const leakyPayload: SavingsPayload = {
      totalSpendGTQ: 3000,
      currency: "GTQ",
      categoryBreakdown: [
        {
          category: "Groceries",
          categorySpanish: "Supermercado",
          totalGTQ: 3000,
          percentage: 100,
          transactionCount: 2,
        },
      ],
      recurringExpenses: {
        totalMonthlyCommitmentGTQ: 500,
        count: 1,
        services: [
          {
            serviceName: "PAGO MENSUAL GT75 INDL 0101 0000 0006 9579 8863",
            monthlyAmountGTQ: 500,
            chargeDate: "2024-05-01",
          },
        ],
      },
    };

    const validation = validateSavingsPayload(leakyPayload);
    assert.equal(validation.isValid, false);
    assert.match(validation.reason || "", /IBAN/i);
  });

  it("builds prompt with English category references and GTQ currency denomination", () => {
    const payload = buildSavingsPayload(mockMetrics, mockSubscriptionSummary);
    const prompt = buildSavingsPrompt(payload);

    assert.match(prompt, /Groceries & Supermarkets/);
    assert.match(prompt, /Netflix Standard/);
    assert.match(prompt, /GTQ/);
  });

  it("parses valid JSON response into structured recommendations with Spanish copy", () => {
    const mockLLMOutput = JSON.stringify({
      resumenGeneral: "Tu principal oportunidad de ahorro se concentra en las compras de supermercado y servicios de streaming.",
      potencialAhorroMensualTotalGTQ: 350,
      oportunidadesInmediatas: [
        {
          id: "accion-1",
          title: "Consolidar plataformas de streaming",
          description: "Evalúa cancelar Netflix temporalmente mientras utilizas Spotify, o comparte un plan familiar.",
          category: "Suscripciones",
          estimatedMonthlySavingsGTQ: 109,
        },
        {
          id: "accion-2",
          title: "Lista semanal de compras",
          description: "Comprar productos perecederos en mercados locales reduce el gasto de supermercado hasta un 15%.",
          category: "Supermercado",
          estimatedMonthlySavingsGTQ: 241,
        },
      ],
      estrategiasLargoPlazo: [
        {
          id: "estrategia-1",
          title: "Aplicar la regla 50/30/20",
          description: "Destina máximo 50% a necesidades básicas y comienza un fondo de emergencia en Quetzales.",
        },
      ],
      analisisPorCategoria: [
        {
          category: "Supermercado",
          status: "elevado",
          observation: "Representa el 55.6% de tu gasto mensual, por encima del promedio recomendado (30-35%).",
          recommendation: "Planifica un menú semanal y compara precios entre cadenas locales.",
        },
      ],
    });

    const parsed = parseSavingsResponse(mockLLMOutput);

    assert.equal(parsed.potencialAhorroMensualTotalGTQ, 350);
    assert.equal(parsed.oportunidadesInmediatas.length, 2);
    assert.equal(parsed.oportunidadesInmediatas[0].title, "Consolidar plataformas de streaming");
    assert.equal(parsed.oportunidadesInmediatas[0].estimatedMonthlySavingsGTQ, 109);
    assert.equal(parsed.estrategiasLargoPlazo.length, 1);
    assert.equal(parsed.analisisPorCategoria.length, 1);
    assert.equal(parsed.analisisPorCategoria[0].status, "elevado");
  });

  it("strips markdown fences and calculates total potential savings if omitted", () => {
    const rawFenced = `\`\`\`json
    {
      "resumen_general": "Perfil con oportunidad de optimización.",
      "oportunidades_inmediatas": [
        {
          "titulo": "Ajuste en cafés y restaurantes",
          "descripcion": "Preparar café en casa.",
          "categoria": "Restaurantes y Cafés",
          "ahorroEstimadoMensualGTQ": 200
        }
      ],
      "estrategias_largo_plazo": [],
      "analisis_por_categoria": []
    }
    \`\`\``;

    const parsed = parseSavingsResponse(rawFenced);
    assert.equal(parsed.potencialAhorroMensualTotalGTQ, 200);
    assert.equal(parsed.oportunidadesInmediatas[0].title, "Ajuste en cafés y restaurantes");
  });
});
