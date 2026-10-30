"use client";

import React, { useState, useRef } from "react";
import { Icons } from "@/components/icons";
import {
  validateUploadedFile,
  FileValidationSuccess,
  SupportedFileType,
} from "@/lib/file-validator";

export interface SelectedFileItem {
  file: File;
  meta: FileValidationSuccess;
}

interface FileUploadProps {
  onFileRouted?: (file: File, type: SupportedFileType) => void;
  onFilesRouted?: (files: { file: File; type: SupportedFileType }[]) => void;
  onOpenSimpleList?: () => void;
}

export function FileUpload({
  onFileRouted,
  onFilesRouted,
  onOpenSimpleList,
}: FileUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<SelectedFileItem[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [routeStatus, setRouteStatus] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleProcessFiles = (incomingFiles: File[]) => {
    setErrorMessage(null);
    setRouteStatus(null);

    if (incomingFiles.length === 0) return;

    const validated: SelectedFileItem[] = [];
    const errors: string[] = [];

    for (const file of incomingFiles) {
      const validation = validateUploadedFile(file);
      if (validation.valid) {
        validated.push({ file, meta: validation });
      } else {
        errors.push(`"${file.name}": ${validation.error}`);
      }
    }

    if (errors.length > 0) {
      setErrorMessage(errors.join(" | "));
    }

    if (validated.length > 0) {
      setSelectedFiles((prev) => {
        // Avoid duplicate files by name and size in current selection
        const existingKeys = new Set(prev.map((p) => `${p.file.name}_${p.file.size}`));
        const filteredNew = validated.filter(
          (v) => !existingKeys.has(`${v.file.name}_${v.file.size}`)
        );
        return [...prev, ...filteredNew];
      });
    }
  };


  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      handleProcessFiles(files);
    }
    // Reset input value so same files can be re-selected if needed
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files || []);
    if (files.length > 0) {
      handleProcessFiles(files);
    }
  };

  const handleRemoveFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
    if (selectedFiles.length <= 1) {
      setErrorMessage(null);
      setRouteStatus(null);
    }
  };

  const handleClearAll = () => {
    setSelectedFiles([]);
    setErrorMessage(null);
    setRouteStatus(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleTriggerPicker = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleConfirmRouting = () => {
    if (selectedFiles.length === 0) return;

    if (onFilesRouted) {
      onFilesRouted(
        selectedFiles.map((s) => ({
          file: s.file,
          type: s.meta.fileType,
        }))
      );
    } else if (onFileRouted && selectedFiles.length > 0) {
      onFileRouted(selectedFiles[0].file, selectedFiles[0].meta.fileType);
    }
  };

  const hasFiles = selectedFiles.length > 0;
  const isMultiple = selectedFiles.length > 1;

  return (
    <div className="space-y-4">
      {/* Hidden Multi-File Input */}
      <input
        ref={fileInputRef}
        type="file"
        id="file-upload-input"
        multiple
        accept=".pdf,.csv,text/csv,application/pdf"
        className="sr-only"
        onChange={handleFileChange}
      />

      {/* Error Alert */}
      {errorMessage && (
        <div
          role="alert"
          className="flex items-start justify-between gap-3 p-3.5 rounded-lg border border-red-200 bg-red-50 text-red-900 text-xs dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300 animate-in fade-in"
        >
          <div className="flex items-start gap-2.5">
            <Icons.AlertCircle className="w-4 h-4 mt-0.5 text-red-600 dark:text-red-400 flex-shrink-0" />
            <p className="leading-relaxed">{errorMessage}</p>
          </div>
          <button
            type="button"
            onClick={() => setErrorMessage(null)}
            className="text-red-700 hover:text-red-900 dark:text-red-400 dark:hover:text-red-200 cursor-pointer"
            aria-label="Cerrar mensaje de error"
          >
            <Icons.X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Routing Success / Notification */}
      {routeStatus && (
        <div
          role="status"
          className="flex items-start justify-between gap-3 p-3.5 rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-900 text-xs dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300"
        >
          <div className="flex items-start gap-2.5">
            <Icons.CheckCircle2 className="w-4 h-4 mt-0.5 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
            <p className="leading-relaxed font-medium">{routeStatus}</p>
          </div>
          <button
            type="button"
            onClick={() => setRouteStatus(null)}
            className="text-emerald-700 hover:text-emerald-900 dark:text-emerald-400 dark:hover:text-emerald-200 cursor-pointer"
            aria-label="Cerrar notificación"
          >
            <Icons.X className="w-4 h-4" />
          </button>
        </div>
      )}

      {!hasFiles ? (
        /* Idle State: Side-by-Side Ingestion Cards (Files & Simple List) */
        <div
          className={
            onOpenSimpleList
              ? "grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6"
              : ""
          }
        >
          {/* File Upload Dropzone */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={handleTriggerPicker}
            className={`border border-dashed rounded-2xl p-6 sm:p-8 text-center flex flex-col items-center justify-between gap-4 cursor-pointer transition-all ${
              isDragging
                ? "border-zinc-900 bg-zinc-100/80 dark:border-zinc-200 dark:bg-zinc-900/80 shadow-sm"
                : "border-zinc-300 bg-white hover:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-950 dark:hover:border-zinc-600 hover:shadow-xs"
            }`}
          >
            <div className="w-12 h-12 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-700 dark:text-zinc-200">
              <Icons.Upload className="w-6 h-6" />
            </div>

            <div className="space-y-1.5 max-w-xs">
              <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                Subir estados de cuenta
              </p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
                Arrastra tus archivos en PDF o CSV, o haz clic para seleccionarlos desde tu dispositivo.
              </p>
            </div>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleTriggerPicker();
              }}
              className="mt-1 inline-flex items-center gap-2 px-4 py-2 text-xs font-medium rounded-lg bg-zinc-900 text-white hover:bg-zinc-800 transition-colors focus:outline-hidden focus:ring-2 focus:ring-zinc-900 focus:ring-offset-2 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 dark:focus:ring-zinc-100 cursor-pointer shadow-xs"
            >
              <Icons.FileText className="w-3.5 h-3.5" />
              <span>Seleccionar archivos</span>
            </button>
          </div>

          {/* Quick Expense List Card */}
          {onOpenSimpleList && (
            <div
              onClick={onOpenSimpleList}
              className="border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 hover:border-zinc-400 dark:hover:border-zinc-600 rounded-2xl p-6 sm:p-8 text-center flex flex-col items-center justify-between gap-4 cursor-pointer transition-all hover:shadow-xs group"
            >
              <div className="w-12 h-12 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-700 dark:text-zinc-200 group-hover:scale-105 transition-transform">
                <Icons.List className="w-6 h-6" />
              </div>

              <div className="space-y-1.5 max-w-xs">
                <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                  Pegar o escribir lista
                </p>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
                  Ingresa tus gastos en formato simple como &quot;Walmart 150&quot; o &quot;40 super 24&quot; sin necesidad de subir archivos.
                </p>
              </div>

              <button
                type="button"
                id="btn-open-simple-list"
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenSimpleList();
                }}
                className="mt-1 inline-flex items-center gap-2 px-4 py-2 text-xs font-medium rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer shadow-2xs"
              >
                <Icons.List className="w-3.5 h-3.5" />
                <span>Ingresar lista rápida</span>
              </button>
            </div>
          )}
        </div>
      ) : (
        /* File(s) Selected: Preview & Actions */
        <div className="border border-zinc-200 rounded-lg bg-white p-5 sm:p-6 dark:border-zinc-800 dark:bg-zinc-950 space-y-4 animate-in fade-in">
          {/* Header */}
          <div className="flex items-center justify-between pb-3 border-b border-zinc-100 dark:border-zinc-800">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                {selectedFiles.length === 1
                  ? "1 archivo listo para procesar"
                  : `${selectedFiles.length} archivos listos para procesar`}
              </span>
              <span className="text-3xs px-2 py-0.5 rounded-full font-mono bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                Lote
              </span>
            </div>

            <button
              type="button"
              onClick={handleClearAll}
              className="text-2xs text-zinc-500 hover:text-red-600 dark:hover:text-red-400 transition-colors cursor-pointer"
            >
              Limpiar selección
            </button>
          </div>

          {/* File Items List */}
          <div className="space-y-2 max-h-60 overflow-y-auto pr-1 divide-y divide-zinc-100 dark:divide-zinc-900">
            {selectedFiles.map((item, idx) => (
              <div
                key={`${item.file.name}_${idx}`}
                className="pt-2 first:pt-0 flex items-center justify-between gap-3 text-xs"
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="w-8 h-8 rounded-lg bg-zinc-100 flex items-center justify-center text-zinc-700 flex-shrink-0 dark:bg-zinc-800 dark:text-zinc-200">
                    {item.meta.fileType === "pdf" ? (
                      <Icons.FileText className="w-4 h-4" />
                    ) : (
                      <Icons.FileSpreadsheet className="w-4 h-4" />
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <span className="font-medium text-zinc-900 truncate block dark:text-zinc-100">
                      {item.file.name}
                    </span>
                    <div className="flex items-center gap-2 text-3xs text-zinc-400">
                      <span>{item.meta.fileSizeFormatted}</span>
                      <span>·</span>
                      <span className="uppercase font-mono">{item.meta.fileType}</span>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleRemoveFile(idx)}
                  className="p-1 rounded text-zinc-400 hover:text-red-600 hover:bg-red-50 dark:hover:text-red-400 dark:hover:bg-red-950/40 transition-colors cursor-pointer"
                  title="Eliminar este archivo de la selección"
                  aria-label={`Eliminar ${item.file.name}`}
                >
                  <Icons.Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>

          {/* Action Row */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-3 border-t border-zinc-100 dark:border-zinc-800">
            <button
              type="button"
              onClick={handleTriggerPicker}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium text-zinc-600 hover:text-zinc-900 border border-zinc-200 rounded-lg hover:bg-zinc-50 dark:text-zinc-400 dark:border-zinc-700 dark:hover:text-zinc-200 dark:hover:bg-zinc-900 transition-colors cursor-pointer"
            >
              <Icons.Plus className="w-3.5 h-3.5" />
              <span>Agregar otro archivo</span>
            </button>

            <button
              type="button"
              id="btn-confirm-routing"
              onClick={handleConfirmRouting}
              className="inline-flex items-center justify-center gap-2 px-4 py-2 text-xs font-medium rounded-lg bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 transition-colors cursor-pointer shadow-xs"
            >
              <span>
                {isMultiple
                  ? `Continuar con ${selectedFiles.length} archivos`
                  : `Continuar con ${selectedFiles[0]?.meta.fileType.toUpperCase() || "archivo"}`}
              </span>
              <Icons.ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
