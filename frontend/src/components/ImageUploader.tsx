import React, { useRef, useState } from 'react';
import { Upload, X, AlertTriangle, Sparkles } from 'lucide-react';
import type { UploadedSlicePreview } from '../types';

interface Props {
  dataset: 'cancer' | 'covid';
  slices: UploadedSlicePreview[];
  setSlices: React.Dispatch<React.SetStateAction<UploadedSlicePreview[]>>;
  onLoadDemo: () => void;
  isLoadingDemo: boolean;
  disabled?: boolean;
}

const ALLOWED_EXTS = ['.png', '.jpg', '.jpeg', '.tif', '.tiff', '.bmp', '.webp'];

export const ImageUploader: React.FC<Props> = ({
  dataset,
  slices,
  setSlices,
  onLoadDemo,
  isLoadingDemo,
  disabled = false,
}) => {
  const [dragActive, setDragActive] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFiles = (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    setErrorMessage(null);

    const newSlices: UploadedSlicePreview[] = [];
    let hasError = false;

    Array.from(fileList).forEach((file) => {
      const ext = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();
      if (!ALLOWED_EXTS.includes(ext)) {
        setErrorMessage(
          `File '${file.name}' has unsupported format '${ext}'. Allowed static formats: PNG, JPG, JPEG, TIFF, BMP, WebP.`
        );
        hasError = true;
        return;
      }

      if (file.size > 50 * 1024 * 1024) {
        setErrorMessage(`File '${file.name}' exceeds the 50 MB per-file limit.`);
        hasError = true;
        return;
      }

      const previewUrl = URL.createObjectURL(file);
      newSlices.push({
        id: `${file.name}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        file,
        previewUrl,
        sizeBytes: file.size,
      });
    });

    if (!hasError || newSlices.length > 0) {
      setSlices((prev) => [...prev, ...newSlices]);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (disabled) return;
    handleFiles(e.dataTransfer.files);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled) setDragActive(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
  };

  const removeSlice = (id: string) => {
    setSlices((prev) => {
      const target = prev.find((s) => s.id === id);
      if (target) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((s) => s.id !== id);
    });
  };

  const clearAll = () => {
    slices.forEach((s) => URL.revokeObjectURL(s.previewUrl));
    setSlices([]);
    setErrorMessage(null);
  };

  const totalBytes = slices.reduce((acc, curr) => acc + curr.sizeBytes, 0);
  const totalMB = (totalBytes / (1024 * 1024)).toFixed(2);

  return (
    <div className="space-y-4">
      {/* Upload Zone */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => !disabled && fileInputRef.current?.click()}
        className={`relative flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-8 text-center transition-all cursor-pointer ${
          dragActive
            ? 'border-cyan-400 bg-cyan-950/30 ring-4 ring-cyan-500/20'
            : 'border-slate-800 bg-slate-900/50 hover:border-slate-700 hover:bg-slate-900/80'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".png,.jpg,.jpeg,.tif,.tiff,.bmp,.webp"
          onChange={(e) => handleFiles(e.target.files)}
          disabled={disabled}
          className="hidden"
        />

        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 mb-3 shadow-inner">
          <Upload className="h-7 w-7" />
        </div>

        <h4 className="text-base font-semibold text-slate-100">
          Upload CT Examination Slices
        </h4>
        <p className="mt-1 text-xs text-slate-400 max-w-md">
          Drag and drop static axial CT slices belonging to one examination, or click to browse.
        </p>

        <div className="mt-4 flex flex-wrap items-center justify-center gap-2 text-[11px] text-slate-400">
          <span className="rounded bg-slate-800 px-2 py-0.5 font-mono">PNG, JPG, TIFF, BMP, WebP</span>
          <span>•</span>
          <span>Max 120 slices per case</span>
          <span>•</span>
          <span>Single-case examination only</span>
        </div>
      </div>

      {/* Error notification */}
      {errorMessage && (
        <div className="flex items-center gap-2 rounded-xl border border-rose-500/30 bg-rose-950/30 p-3 text-xs text-rose-300">
          <AlertTriangle className="h-4 w-4 shrink-0 text-rose-400" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Action Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 text-xs text-slate-400">
          <span className="font-semibold text-slate-200">{slices.length}</span> slice{slices.length === 1 ? '' : 's'} queued
          {slices.length > 0 && <span>({totalMB} MB total)</span>}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onLoadDemo}
            disabled={disabled || isLoadingDemo}
            className="flex items-center gap-1.5 rounded-lg border border-cyan-500/30 bg-cyan-950/40 px-3 py-1.5 text-xs font-medium text-cyan-300 transition-colors hover:bg-cyan-900/50 hover:text-cyan-200 disabled:opacity-50"
          >
            <Sparkles className="h-3.5 w-3.5 text-cyan-400" />
            <span>{isLoadingDemo ? 'Generating...' : `Load Sample ${dataset.toUpperCase()} Series`}</span>
          </button>

          {slices.length > 0 && (
            <button
              type="button"
              onClick={clearAll}
              disabled={disabled}
              className="rounded-lg border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs font-medium text-slate-400 transition-colors hover:bg-slate-800 hover:text-slate-200 disabled:opacity-50"
            >
              Clear All
            </button>
          )}
        </div>
      </div>

      {/* Slices Thumbnail Grid */}
      {slices.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs font-medium text-slate-400">
            <span>Scan Series Overview</span>
            <span className="text-[11px] text-slate-400">Artifact preview prior to inference</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 max-h-80 overflow-y-auto p-1 rounded-xl border border-slate-800/80 bg-slate-950/60">
            {slices.map((slice, index) => (
              <div
                key={slice.id}
                className="group relative flex flex-col overflow-hidden rounded-xl border border-slate-800 bg-slate-900/90 transition-all hover:border-slate-700"
              >
                {/* Image preview */}
                <div className="relative aspect-square w-full bg-black/80 flex items-center justify-center overflow-hidden">
                  <img
                    src={slice.previewUrl}
                    alt={slice.file.name}
                    className="h-full w-full object-contain filter contrast-125"
                  />
                  <div className="absolute top-1 left-1 rounded bg-slate-950/80 px-1.5 py-0.5 text-[9px] font-mono text-cyan-300 border border-slate-700/60">
                    #{index + 1}
                  </div>
                  {!disabled && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeSlice(slice.id);
                      }}
                      className="absolute top-1 right-1 rounded bg-rose-950/80 p-1 text-rose-300 opacity-0 transition-opacity hover:bg-rose-900 group-hover:opacity-100"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </div>

                {/* Info */}
                <div className="p-2 text-[10px]">
                  <p className="truncate font-medium text-slate-200" title={slice.file.name}>
                    {slice.file.name}
                  </p>
                  <p className="text-slate-400">
                    {(slice.sizeBytes / 1024).toFixed(1)} KB
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
