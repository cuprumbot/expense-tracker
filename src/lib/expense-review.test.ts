import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { Transaction, CustomCategory } from "@/types/transaction";

describe("US-010: Expense Review & Customization Logic", () => {
  const sampleTransactions: Transaction[] = [
    {
      id: "tx-1",
      date: "2026-09-01",
      description: "Supermercado La Torre",
      amount: 150.5,
      currency: "GTQ",
      category: "Supermercado",
      classificationSource: "local",
    },
    {
      id: "tx-2",
      date: "2026-09-02",
      description: "Netflix Subscription",
      amount: 65.0,
      currency: "GTQ",
      category: "Suscripciones",
      classificationSource: "local",
      isSubscription: true,
    },
    {
      id: "tx-3",
      date: "2026-09-03",
      description: "Compra Desconocida",
      amount: 80.0,
      currency: "GTQ",
      category: "Pendiente",
      classificationSource: "local",
    },
  ];

  it("adds a custom category and prevents case-insensitive duplicates", () => {
    const customCategories: CustomCategory[] = [];
    const addCategory = (name: string, color: string) => {
      if (
        customCategories.some(
          (c) => c.name.toLowerCase() === name.trim().toLowerCase()
        )
      ) {
        throw new Error(`Ya existe una categoría con el nombre ${name}`);
      }
      const newCat: CustomCategory = {
        id: `custom-${Date.now()}`,
        name: name.trim(),
        color,
      };
      customCategories.push(newCat);
      return newCat;
    };

    const cat1 = addCategory("Gimnasio", "#10b981");
    assert.equal(cat1.name, "Gimnasio");
    assert.equal(customCategories.length, 1);

    assert.throws(
      () => addCategory("gimnasio", "#f59e0b"),
      /Ya existe una categoría/
    );
  });

  it("edits an individual transaction and recalculates amounts", () => {
    let list = [...sampleTransactions];
    const updateTx = (updated: Transaction) => {
      list = list.map((t) => (t.id === updated.id ? updated : t));
    };

    updateTx({
      ...list[0],
      description: "Supermercado La Torre Zona 14",
      amount: 200.0,
      classificationSource: "manual",
    });

    assert.equal(list[0].description, "Supermercado La Torre Zona 14");
    assert.equal(list[0].amount, 200.0);
    assert.equal(list[0].classificationSource, "manual");

    const total = list.reduce((sum, t) => sum + t.amount, 0);
    assert.equal(total, 345.0);
  });

  it("deletes an individual transaction and updates collection", () => {
    let list = [...sampleTransactions];
    const deleteTx = (id: string) => {
      list = list.filter((t) => t.id !== id);
    };

    deleteTx("tx-3");
    assert.equal(list.length, 2);
    assert.equal(list.find((t) => t.id === "tx-3"), undefined);

    const total = list.reduce((sum, t) => sum + t.amount, 0);
    assert.equal(total, 215.5);
  });

  it("bulk assigns categories to multiple transactions and updates sources", () => {
    let list = [...sampleTransactions];
    const bulkAssign = (ids: string[], newCat: string) => {
      const idSet = new Set(ids);
      const isSub = newCat.toLowerCase() === "suscripciones";
      list = list.map((t) => {
        if (idSet.has(t.id)) {
          return {
            ...t,
            category: newCat,
            classificationSource: "manual" as const,
            isSubscription: isSub ? true : undefined,
          };
        }
        return t;
      });
    };

    bulkAssign(["tx-1", "tx-3"], "Servicios Básicos");

    assert.equal(list[0].category, "Servicios Básicos");
    assert.equal(list[0].classificationSource, "manual");
    assert.equal(list[2].category, "Servicios Básicos");
    assert.equal(list[2].classificationSource, "manual");
    assert.equal(list[1].category, "Suscripciones"); // Untouched
  });

  it("correctly identifies unclassified items vs classified sources", () => {
    const getBadgeLabel = (tx: Transaction) => {
      if (!tx.category || tx.category === "Pendiente") return "Sin clasificar";
      if (tx.classificationSource === "local") return "Local";
      if (tx.classificationSource === "llm") return "IA";
      return "Manual";
    };

    assert.equal(getBadgeLabel(sampleTransactions[0]), "Local");
    assert.equal(getBadgeLabel(sampleTransactions[1]), "Local");
    assert.equal(getBadgeLabel(sampleTransactions[2]), "Sin clasificar");
  });
});
