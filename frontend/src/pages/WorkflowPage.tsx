import React, { useState } from 'react';
import {
  Layers,
  Sparkles,
  Play,
  RotateCcw,
  FileText,
  AlertTriangle,
  Info,
} from 'lucide-react';
import { ImageUploader } from '../components/ImageUploader';
import { ScoreDistributionChart } from '../components/ScoreDistributionChart';
import { SliceTable } from '../components/SliceTable';
import { CaseReportModal } from '../components/CaseReportModal';
import {
  runPredictCancer,
  runPredictCovid,
  runPredictSample,
} from '../services/api';
import type { PredictionResponse, UploadedSlicePreview } from '../types';

interface Props {
  dataset: 'cancer' | 'covid';
}

function generateCaseId(dataset: 'cancer' | 'covid'): string {
  const prefix = dataset === 'cancer' ? 'CAN' : 'COV';
  const randHex = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `CASE-${prefix}-${randHex}`;
}

export const WorkflowPage: React.FC<Props> = ({ dataset }) => {
  const [slices, setSlices] = useState<UploadedSlicePreview[]>([]);
  const [caseId, setCaseId] = useState<string>(() => generateCaseId(dataset));
  const [isProcessing, setIsProcessing] = useState(false);
  const [isLoadingDemo, setIsLoadingDemo] = useState(false);
  const [prediction, setPrediction] = useState<PredictionResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showReportModal, setShowReportModal] = useState(false);

  const isCancer = dataset === 'cancer';
  const workflowTitle = isCancer
    ? 'Workflow A: Thoracic Cancer Classification'
    : 'Workflow B: COVID & Pulmonary Disease Classification';
  const classNames = isCancer
    ? ['Benign', 'Malignant', 'Normal']
    : ['COVID-19', 'Normal', 'Other pulmonary disease'];

  const resetCase = () => {
    slices.forEach((s) => URL.revokeObjectURL(s.previewUrl));
    setSlices([]);
    setPrediction(null);
    setErrorMessage(null);
    setCaseId(generateCaseId(dataset));
  };

  const handleLoadDemo = async () => {
    setIsLoadingDemo(true);
    setErrorMessage(null);
    try {
      const result = await runPredictSample(dataset);
      setPrediction(result);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed loading demo sample scan.');
    } finally {
      setIsLoadingDemo(false);
    }
  };

  const handleRunInference = async () => {
    if (slices.length === 0) {
      setErrorMessage('Please upload or queue at least one CT slice image.');
      return;
    }

    setIsProcessing(true);
    setErrorMessage(null);

    try {
      const files = slices.map((s) => s.file);
      const result = isCancer
        ? await runPredictCancer(files)
        : await runPredictCovid(files);

      setPrediction(result);
    } catch (err: any) {
      setErrorMessage(err.message || 'An error occurred during inference.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-8 pb-12">
      {/* Workflow Header & Case Bar */}
      <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-6 sm:p-8 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div
              className={`flex h-12 w-12 items-center justify-center rounded-2xl border shadow-inner ${
                isCancer
                  ? 'border-cyan-500/30 bg-cyan-500/10 text-cyan-400'
                  : 'border-blue-500/30 bg-blue-500/10 text-blue-400'
              }`}
            >
              {isCancer ? <Layers className="h-6 w-6" /> : <Sparkles className="h-6 w-6" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                  {workflowTitle}
                </h1>
                <span className="rounded bg-slate-800 border border-slate-700 px-2 py-0.5 text-[10px] font-mono text-cyan-300">
                  DenseNet-121
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                {isCancer
                  ? 'ImageNet pretrained • 9 epochs • Crop V2 (top 12%, bottom 10%, left/right 6%)'
                  : 'ImageNet pretrained • 16 epochs • Full aspect ratio preservation with pad'}
              </p>
            </div>
          </div>

          {/* Anonymous Case Bar */}
          <div className="flex items-center gap-2 rounded-2xl border border-slate-800 bg-slate-950/70 px-4 py-2">
            <div className="text-right">
              <p className="text-[10px] uppercase font-semibold text-slate-400 tracking-wider">
                Anonymous Research Case
              </p>
              <p className="font-mono text-xs font-bold text-cyan-300">
                {prediction ? prediction.case_id : caseId}
              </p>
            </div>
            <button
              type="button"
              onClick={resetCase}
              title="Generate New Case Session"
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-slate-100 transition-colors"
            >
              <RotateCcw className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Classes Bar */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-800 text-xs">
          <span className="text-slate-400 font-medium">Label Hierarchy:</span>
          {classNames.map((c, i) => (
            <span
              key={c}
              className="rounded-md border border-slate-700/80 bg-slate-800/80 px-2.5 py-0.5 text-slate-300 font-medium"
            >
              {i + 1}. {c}
            </span>
          ))}
          <span className="text-slate-400 ml-auto hidden sm:inline">
            Zero Patient Identifiers Required
          </span>
        </div>
      </div>

      {/* Main Analysis Workbench Area */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Upload & Controls */}
        <div className="lg:col-span-5 space-y-6">
          <div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-6 space-y-5">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wider">
                1. CT Slices Ingestion
              </h3>
              <span className="text-xs text-slate-400">Step 1 of 2</span>
            </div>

            <ImageUploader
              dataset={dataset}
              slices={slices}
              setSlices={setSlices}
              onLoadDemo={handleLoadDemo}
              isLoadingDemo={isLoadingDemo}
              disabled={isProcessing}
            />

            {/* Run Button */}
            <button
              type="button"
              onClick={handleRunInference}
              disabled={isProcessing || slices.length === 0}
              className={`flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 text-sm font-bold shadow-xl transition-all ${
                slices.length > 0 && !isProcessing
                  ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-slate-950 shadow-cyan-500/25 hover:opacity-95'
                  : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
              }`}
            >
              {isProcessing ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-slate-950 border-t-transparent" />
                  <span>Processing Slices with DenseNet121...</span>
                </>
              ) : (
                <>
                  <Play className="h-4 w-4 fill-current" />
                  <span>Analyze Case Slices ({slices.length})</span>
                </>
              )}
            </button>

            {/* Error Message */}
            {errorMessage && (
              <div className="flex items-start gap-2.5 rounded-xl border border-rose-500/30 bg-rose-950/30 p-3.5 text-xs text-rose-300">
                <AlertTriangle className="h-4 w-4 shrink-0 text-rose-400 mt-0.5" />
                <div className="space-y-0.5">
                  <p className="font-semibold text-rose-200">Processing Failed</p>
                  <p className="text-rose-300/80">{errorMessage}</p>
                </div>
              </div>
            )}
          </div>

          {/* Workflow specific notes card */}
          <div className="rounded-2xl border border-slate-800/80 bg-slate-900/40 p-4 text-xs text-slate-400 space-y-2">
            <div className="flex items-center gap-2 text-slate-200 font-semibold">
              <Info className="h-4 w-4 text-cyan-400" />
              <span>Preprocessing & Aggregation Architecture</span>
            </div>
            <p className="leading-relaxed text-[11px]">
              {isCancer
                ? 'Cancer Crop V2 is applied uniformly across all slices: 12% top, 10% bottom, and 6% left/right margins are removed to discard scanner metadata, table borders, and periphery markers.'
                : 'COVID-19 model preserves natural lung aspect ratio: images are centered with black padding to 224×224 without cropping, maintaining bilateral peripheral visual contexts.'}
            </p>
            <p className="leading-relaxed text-[11px]">
              Inference is computed for each slice individually, followed by calculating the arithmetic mean of slice softmax vectors.
            </p>
          </div>
        </div>

        {/* Right Column: Prediction Results */}
        <div className="lg:col-span-7 space-y-6">
          {prediction ? (
            <div className="space-y-6">
              {/* Aggregate Classification Card */}
              <div className="rounded-3xl border border-cyan-500/40 bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 p-6 sm:p-8 space-y-6 shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 right-0 -mr-16 -mt-16 h-48 w-48 rounded-full bg-cyan-500/10 blur-2xl pointer-events-none" />

                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-4">
                  <div>
                    <span className="text-[10px] font-mono font-semibold uppercase tracking-wider text-cyan-400">
                      Aggregated Case Classification
                    </span>
                    <h2 className="text-3xl font-extrabold text-white tracking-tight mt-0.5">
                      {prediction.predicted_class}
                    </h2>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setShowReportModal(true)}
                      className="flex items-center gap-1.5 rounded-xl border border-cyan-500/30 bg-cyan-950/40 px-3.5 py-2 text-xs font-semibold text-cyan-300 hover:bg-cyan-900/40 transition-colors"
                    >
                      <FileText className="h-4 w-4 text-cyan-400" />
                      <span>Case Report</span>
                    </button>
                    <button
                      type="button"
                      onClick={resetCase}
                      className="flex items-center gap-1 rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-xs font-medium text-slate-300 hover:bg-slate-800"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      <span>New Scan</span>
                    </button>
                  </div>
                </div>

                {/* Single slice warning */}
                {prediction.is_single_slice && (
                  <div className="flex items-start gap-2.5 rounded-xl border border-amber-500/30 bg-amber-950/20 p-3.5 text-xs text-amber-300">
                    <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400 mt-0.5" />
                    <div>
                      <p className="font-semibold text-amber-200">Single-Slice Result Warning</p>
                      <p className="text-amber-300/80 text-[11px] mt-0.5 leading-relaxed">
                        Only one CT slice was provided. This result reflects a single cross-section and is not directly comparable
                        to the group-level multi-slice benchmarks.
                      </p>
                    </div>
                  </div>
                )}

                {/* Metrics ribbon */}
                <div className="grid grid-cols-3 gap-3 rounded-2xl bg-slate-950/60 border border-slate-800 p-3 text-center text-xs">
                  <div>
                    <p className="text-slate-400 text-[10px]">Case Slices</p>
                    <p className="font-mono font-bold text-white text-base mt-0.5">
                      {prediction.number_of_slices}
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-400 text-[10px]">Top Mean Score</p>
                    <p className="font-mono font-bold text-cyan-300 text-base mt-0.5">
                      {(prediction.class_scores[prediction.predicted_class] * 100).toFixed(2)}%
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-400 text-[10px]">Aggregation</p>
                    <p className="font-mono font-semibold text-slate-300 text-[11px] mt-1 truncate" title={prediction.aggregation}>
                      Mean Softmax
                    </p>
                  </div>
                </div>

                {/* Score distribution bar chart */}
                <div className="space-y-2">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Arithmetic Mean Softmax Distribution
                  </h4>
                  <ScoreDistributionChart
                    classScores={prediction.class_scores}
                  />
                </div>
              </div>

              {/* Slice table */}
              <div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-6">
                <SliceTable
                  slices={prediction.slice_predictions}
                  uploadedPreviews={slices}
                  caseId={prediction.case_id}
                  dataset={dataset}
                />
              </div>
            </div>
          ) : (
            /* Empty State */
            <div className="flex flex-col items-center justify-center rounded-3xl border border-slate-800/80 bg-slate-900/40 p-12 text-center min-h-[460px]">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-800/80 border border-slate-700/60 text-slate-400 mb-4">
                <Layers className="h-8 w-8 stroke-[1.8]" />
              </div>
              <h3 className="text-base font-bold text-slate-200">
                Awaiting Scan Slices
              </h3>
              <p className="mt-1 text-xs text-slate-400 max-w-sm leading-relaxed">
                Upload one or more axial CT slices on the left, or click "Load Sample {dataset.toUpperCase()} Series"
                to run a test analysis instantly.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Case Report Modal */}
      {showReportModal && prediction && (
        <CaseReportModal
          prediction={prediction}
          onClose={() => setShowReportModal(false)}
        />
      )}
    </div>
  );
};
