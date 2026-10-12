import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  normalizeText,
  matchMerchantCategory,
  classifyTransaction,
  classifyTransactions,
  getClassificationStats,
  MerchantCatalog,
} from "./expense-classifier";
import { Transaction } from "@/types/transaction";

describe("expense-classifier unit tests", () => {
  it("normalizes text by stripping accents, uppercase, and punctuation", () => {
    assert.equal(normalizeText("San Martín Zona 10!"), "san martin zona 10");
    assert.equal(normalizeText("  LA  TORRE...  "), "la torre");
    assert.equal(normalizeText("Restaurante & Café (Cayalá)"), "restaurante cafe cayala");
  });

  it("classifies variants of 'La Torre' (Zona 10, Zona 4, Zona 14) as 'Supermercado'", () => {
    const variants = [
      "La Torre Zona 10",
      "La Torre Zona 4",
      "La Torre Zona 14",
      "SUPERMERCADO LA TORRE CAYALA",
      "LA TORRE 14",
    ];

    for (const v of variants) {
      const match = matchMerchantCategory(v);
      assert.equal(match.category, "Supermercado", `Failed for variant: ${v}`);
      assert.equal(match.source, "local");
    }
  });

  it("classifies standard merchants from US-007 acceptance criteria", () => {
    // Supermercado
    assert.equal(matchMerchantCategory("Paiz Pradera").category, "Supermercado");
    assert.equal(matchMerchantCategory("Walmart Roosevelt").category, "Supermercado");
    assert.equal(matchMerchantCategory("Despensa Familiar San Juan").category, "Supermercado");
    assert.equal(matchMerchantCategory("Suma Express").category, "Supermercado");

    // Restaurantes y Cafés
    assert.equal(matchMerchantCategory("Pollo Campero Obelisco").category, "Restaurantes y Cafés");
    assert.equal(matchMerchantCategory("San Martín Pastelería").category, "Restaurantes y Cafés");
    assert.equal(matchMerchantCategory("McDonalds Zona 9").category, "Restaurantes y Cafés");
    assert.equal(matchMerchantCategory("Starbucks Fontabella").category, "Restaurantes y Cafés");
    assert.equal(matchMerchantCategory("Wendy's Zona 10").category, "Restaurantes y Cafés");
    assert.equal(matchMerchantCategory("Taco Bell Pradera").category, "Restaurantes y Cafés");
    assert.equal(matchMerchantCategory("Restaurante Anafres").category, "Restaurantes y Cafés");

    // Servicios Básicos
    assert.equal(matchMerchantCategory("Pago EEGSA Luz").category, "Servicios Básicos");
    assert.equal(matchMerchantCategory("Empagua Servicio de Agua").category, "Servicios Básicos");
    assert.equal(matchMerchantCategory("Claro Postpago").category, "Servicios Básicos");
    assert.equal(matchMerchantCategory("Tigo Prepago Recarga").category, "Servicios Básicos");
    assert.equal(matchMerchantCategory("Energuate Occidente").category, "Servicios Básicos");

    // Transporte y Combustible
    assert.equal(matchMerchantCategory("Estacion Shell Próceres").category, "Transporte y Combustible");
    assert.equal(matchMerchantCategory("Puma Energy Gasolina").category, "Transporte y Combustible");
    assert.equal(matchMerchantCategory("Texaco San Cristóbal").category, "Transporte y Combustible");
    assert.equal(matchMerchantCategory("Estación Uno Las Américas").category, "Transporte y Combustible");
    assert.equal(matchMerchantCategory("Uber Trip Guatemala").category, "Transporte y Combustible");
    assert.equal(matchMerchantCategory("TuMuni Parquimetro Z1").category, "Transporte y Combustible");

    // Salud y Farmacia
    assert.equal(matchMerchantCategory("Farmacias Meykos").category, "Salud y Farmacia");
    assert.equal(matchMerchantCategory("Farmacia Galeno").category, "Salud y Farmacia");
    assert.equal(matchMerchantCategory("Farmacias Batres").category, "Salud y Farmacia");
    assert.equal(matchMerchantCategory("Farmacias Cruz Verde").category, "Salud y Farmacia");

    // Entretenimiento y Compras
    assert.equal(matchMerchantCategory("Cemaco Peri-Roosevelt").category, "Entretenimiento y Compras");
    assert.equal(matchMerchantCategory("Almacenes Siman").category, "Entretenimiento y Compras");
    assert.equal(matchMerchantCategory("CC Miraflores").category, "Entretenimiento y Compras");
    assert.equal(matchMerchantCategory("Oakland Mall Tiendas").category, "Entretenimiento y Compras");
    assert.equal(matchMerchantCategory("Pradera Concepción").category, "Entretenimiento y Compras");

    // Suscripciones
    assert.equal(matchMerchantCategory("Netflix Guatemala").category, "Suscripciones");
    assert.equal(matchMerchantCategory("Spotify Premium").category, "Suscripciones");
    assert.equal(matchMerchantCategory("Disney Plus Mensual").category, "Suscripciones");
    assert.equal(matchMerchantCategory("ChatGPT Subscription").category, "Suscripciones");
  });

  it("assigns 'Pendiente' category to unrecognized merchant descriptions", () => {
    const unknown = "TRANSFERENCIA INTERNA EXTRAÑA 99882";
    const match = matchMerchantCategory(unknown);
    assert.equal(match.category, "Pendiente");
    assert.equal(match.source, "unclassified");
  });

  it("classifyTransaction tags matched items with classificationSource: 'local'", () => {
    const tx: Transaction = {
      id: "tx-1",
      date: "2026-10-01",
      description: "Supermercado Paiz Las Américas",
      amount: 450.5,
      currency: "GTQ",
    };

    const classified = classifyTransaction(tx);
    assert.equal(classified.category, "Supermercado");
    assert.equal(classified.classificationSource, "local");
    assert.equal(classified.isSubscription, undefined);

    const subTx: Transaction = {
      id: "tx-2",
      date: "2026-10-02",
      description: "Netflix Guatemala",
      amount: 85,
      currency: "GTQ",
    };
    const subClassified = classifyTransaction(subTx);
    assert.equal(subClassified.category, "Suscripciones");
    assert.equal(subClassified.classificationSource, "local");
    assert.equal(subClassified.isSubscription, true);
  });

  it("supports configurable catalog passed dynamically", () => {
    const customCatalog: MerchantCatalog = {
      categories: [
        {
          id: "mascotas",
          name: "Mascotas y Veterinaria",
          keywords: ["pet", "veterinaria", "arcano"],
        },
      ],
      defaultCategory: "Sin clasificar",
    };

    const match1 = matchMerchantCategory("Pet shop zona 14", customCatalog);
    assert.equal(match1.category, "Mascotas y Veterinaria");

    const match2 = matchMerchantCategory("Supermercado Paiz", customCatalog);
    assert.equal(match2.category, "Sin clasificar");
  });

  it("classifyTransactions and getClassificationStats compute accurate metrics", () => {
    const rawTxs: Transaction[] = [
      { id: "1", date: "2026-10-01", description: "La Torre Zona 10", amount: 200, currency: "GTQ" },
      { id: "2", date: "2026-10-02", description: "Pollo Campero", amount: 150, currency: "GTQ" },
      { id: "3", date: "2026-10-03", description: "Algo desconocido", amount: 50, currency: "GTQ" },
    ];

    const classified = classifyTransactions(rawTxs);
    assert.equal(classified[0].category, "Supermercado");
    assert.equal(classified[1].category, "Restaurantes y Cafés");
    assert.equal(classified[2].category, "Pendiente");

    const stats = getClassificationStats(classified);
    assert.equal(stats.total, 3);
    assert.equal(stats.classifiedCount, 2);
    assert.equal(stats.pendingCount, 1);
    assert.equal(stats.categoryBreakdown["Supermercado"].totalAmount, 200);
    assert.equal(stats.categoryBreakdown["Restaurantes y Cafés"].totalAmount, 150);
  });
});
