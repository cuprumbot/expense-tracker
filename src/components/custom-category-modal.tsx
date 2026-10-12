"use client";

import React, { useState } from "react";
import { Icons } from "@/components/icons";
import { CustomCategory } from "@/types/transaction";

interface CustomCategoryModalProps {
  isOpen: boolean;
  existingCategoryNames: string[];
  onSave: (category: CustomCategory) => void;
  onClose: () => void;
}

const PRESET_COLORS = [
  { name: "Esmeralda", hex: "#10b981" },
  { name: "Ámbar", hex: "#f59e0b" },
  { name: "Azul", hex: "#3b82f6" },
  { name: "Índigo", hex: "#6366f1" },
  { name: "Violeta", hex: "#8b5cf6" },
  { name: "Rosa", hex: "#f43f5e" },
  { name: "Fucsia", hex: "#ec4899" },
  { name: "Teal", hex: "#14b8a6" },
  { name: "Naranja", hex: "#f97316" },
  { name: "Cian", hex: "#06b6d4" },
  { name: "Lima", hex: "#84cc16" },
  { name: "Pizarra", hex: "#64748b" },
];

export function CustomCategoryModal({
  isOpen,
  existingCategoryNames,
  onSave,
  onClose,
}: CustomCategoryModalProps) {
  const [name, setName] = useState("");
  const [color, setColor] = useState("#10b981");
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedName = name.trim();
    if (!trimmedName) {
      setError("Debes ingresar un nombre para la categoría.");
      return;
    }

    if (
      existingCategoryNames.some(
        (existing) => existing.trim().toLowerCase() === trimmedName.toLowerCase()
      )
    ) {
      setError(`Ya existe una categoría llamada "${trimmedName}".`);
      return;
    }

    const newCategory: CustomCategory = {
      id: `custom_cat_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      name: trimmedName,
      color,
    };

    onSave(newCategory);
    setName("");
    setColor("#10b981");
    setError(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
      <div className="w-full max-w-md bg-white dark:bg-zinc-950 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-xl overflow-hidden p-6 space-y-5 animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 flex items-center justify-center">
              <Icons.Tag className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                Nueva categoría
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Crea una categoría personalizada con nombre y color.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 cursor-pointer p-1 rounded-md"
            title="Cerrar"
          >
            <Icons.X className="w-4 h-4" />
          </button>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="p-3 rounded-lg border border-red-200 bg-red-50 text-red-800 text-xs dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200 flex items-center gap-2">
            <Icons.AlertCircle className="w-4 h-4 shrink-0 text-red-600 dark:text-red-400" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Category Name */}
          <div className="space-y-1.5">
            <label
              htmlFor="category-name-input"
              className="block text-xs font-medium text-zinc-700 dark:text-zinc-300"
            >
              Nombre de la categoría
            </label>
            <input
              id="category-name-input"
              type="text"
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej. Mascotas, Gimnasio, Educación..."
              className="w-full px-3 py-2 text-xs rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:outline-hidden focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100"
            />
          </div>

          {/* Color Selection */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
                Color representativo
              </label>
              <div className="flex items-center gap-1.5">
                <input
                  type="color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="w-5 h-5 rounded cursor-pointer border-0 p-0 bg-transparent"
                  title="Seleccionar color personalizado"
                />
                <span className="text-2xs font-mono text-zinc-500 uppercase">
                  {color}
                </span>
              </div>
            </div>

            {/* Color Palette Grid */}
            <div className="grid grid-cols-6 gap-2">
              {PRESET_COLORS.map((preset) => (
                <button
                  key={preset.hex}
                  type="button"
                  onClick={() => setColor(preset.hex)}
                  title={preset.name}
                  className={`h-7 rounded-md border flex items-center justify-center transition-all cursor-pointer ${
                    color.toLowerCase() === preset.hex.toLowerCase()
                      ? "ring-2 ring-zinc-900 dark:ring-zinc-100 scale-105 border-white"
                      : "border-transparent hover:scale-105"
                  }`}
                  style={{ backgroundColor: preset.hex }}
                >
                  {color.toLowerCase() === preset.hex.toLowerCase() && (
                    <Icons.Check className="w-3.5 h-3.5 text-white drop-shadow-xs" />
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Live Preview */}
          <div className="p-3 rounded-lg border border-zinc-100 bg-zinc-50/60 dark:border-zinc-800 dark:bg-zinc-900/40 space-y-1">
            <span className="text-3xs uppercase tracking-wider text-zinc-400 font-semibold block">
              Vista previa de etiqueta
            </span>
            <div className="flex items-center gap-2 pt-1">
              <span
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border"
                style={{
                  backgroundColor: `${color}18`,
                  color: color,
                  borderColor: `${color}40`,
                }}
              >
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: color }}
                />
                <span>{name.trim() || "Nombre de categoría"}</span>
              </span>
            </div>
          </div>

          {/* Form Actions */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-100 dark:border-zinc-800">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 text-xs font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-medium text-white bg-zinc-900 hover:bg-zinc-800 rounded-lg dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 transition-colors shadow-xs cursor-pointer inline-flex items-center gap-1.5"
            >
              <Icons.Check className="w-3.5 h-3.5" />
              <span>Guardar categoría</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
