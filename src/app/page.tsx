"use client";

import { useState } from "react";
import { Icons } from "@/components/icons";
import { FileUpload } from "@/components/file-upload";
import { SupportedFileType } from "@/lib/file-validator";

export default function Home() {
  const [routedFile, setRoutedFile] = useState<{
    file: File;
    type: SupportedFileType;
  } | null>(null);

  const handleFileRouted = (file: File, type: SupportedFileType) => {
    setRoutedFile({ file, type });
  };

  return (
    <div className="min-h-screen flex flex-col bg-white text-zinc-900 antialiased selection:bg-zinc-900 selection:text-white dark:bg-zinc-950 dark:text-zinc-100">
      {/* Minimal Top Header */}
      <header className="border-b border-zinc-200/80 dark:border-zinc-800/80">
        <div className="max-w-3xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-md bg-zinc-900 text-white flex items-center justify-center dark:bg-zinc-100 dark:text-zinc-900">
              <Icons.Wallet className="w-4 h-4" />
            </div>
            <span className="text-sm font-semibold tracking-tight">
              Control de Gastos
            </span>
          </div>

          <div className="text-xs text-zinc-500 font-mono tracking-tight dark:text-zinc-400">
            GTQ · Q
          </div>
        </div>
      </header>

      {/* Main Workspace */}
      <main className="flex-1 max-w-3xl w-full mx-auto px-6 py-16 space-y-8">
        {/* Title & Introduction */}
        <section className="space-y-2">
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
            Organiza tus gastos mensuales
          </h1>
          <p className="text-sm sm:text-base text-zinc-600 dark:text-zinc-400 leading-relaxed">
            Carga tu estado de cuenta bancario o archivo de movimientos para clasificar tus consumos, supervisar suscripciones y obtener un resumen claro de tus finanzas.
          </p>
        </section>

        {/* File Ingestion Workspace */}
        <section className="border border-zinc-200 rounded-xl bg-zinc-50/50 p-6 sm:p-8 dark:border-zinc-800 dark:bg-zinc-900/40 space-y-6">
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

          <FileUpload onFileRouted={handleFileRouted} />

          {routedFile && (
            <div className="text-xs text-zinc-500 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 border-t border-zinc-200/80 pt-3 dark:border-zinc-800/80">
              <span>
                Archivo seleccionado:{" "}
                <strong className="text-zinc-800 dark:text-zinc-200 font-medium">
                  {routedFile.file.name}
                </strong>
              </span>
              <span className="font-mono text-zinc-400">
                {routedFile.type === "csv"
                  ? "Ruta: Extracción CSV (US-003)"
                  : "Ruta: Detección Bancaria PDF (US-004)"}
              </span>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
