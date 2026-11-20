import React from 'react';
import {
  BookOpen,
  Database,
  Scissors,
  Cpu,
  AlertTriangle,
  Calculator,
} from 'lucide-react';

export const MethodologyPage: React.FC = () => {
  return (
    <div className="space-y-8 pb-12 max-w-5xl mx-auto">
      {/* Header */}
      <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-6 sm:p-8 space-y-3">
        <div className="inline-flex items-center gap-1.5 rounded-full border border-cyan-500/30 bg-cyan-950/40 px-3 py-0.5 text-xs font-semibold text-cyan-300">
          <BookOpen className="h-3.5 w-3.5 text-cyan-400" />
          <span>Research Documentation</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
          Methodology & Model Card
        </h1>
        <p className="text-xs text-slate-300 leading-relaxed max-w-3xl">
          Comprehensive scientific documentation of dataset auditing, duplicate-image leakage containment,
          preprocessing architectures, cross-validation protocols, and mathematical aggregation logic.
        </p>
      </div>

      {/* Section 1: Dataset Audit & Leakage Grouping */}
      <div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-6 sm:p-8 space-y-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
            <Database className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">
              1. Dataset Audit & Leakage Grouping
            </h2>
            <p className="text-xs text-slate-400">Graph-connected duplicate containment</p>
          </div>
        </div>

        <div className="text-xs text-slate-300 space-y-3 leading-relaxed">
          <p>
            Public CT image datasets commonly exhibit identical, near-identical, or slightly transformed duplicate slices
            distributed across class directories or separate patient IDs. Performing standard random train/test splits under
            such conditions causes massive <strong>data leakage</strong>, artificially inflating reported validation metrics.
          </p>
          <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4 space-y-2">
            <p className="font-semibold text-cyan-300">Auditing and Partitioning Strategy:</p>
            <ul className="list-disc list-inside space-y-1 text-slate-400">
              <li>
                <strong className="text-slate-200">Perceptual and Exact Hashing:</strong> Every slice was audited for duplicate detection.
              </li>
              <li>
                <strong className="text-slate-200">Connected Component Graphing:</strong> Connected components formed discrete <em>leakage groups</em>.
              </li>
              <li>
                <strong className="text-slate-200">Strict Group-Aware Splitting:</strong> All slices belonging to a leakage group were partitioned
                exclusively into either train or test splits. Slices from the same group never crossed evaluation boundaries.
              </li>
              <li>
                <strong className="text-slate-200">Group Totals:</strong> Cancer dataset yielded 69 development groups (875 images) and 13 test groups (198 images).
                COVID dataset yielded 178 development groups (3,553 images) and 32 test groups (615 images).
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Section 2: Preprocessing Pipelines */}
      <div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-6 sm:p-8 space-y-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10 border border-blue-500/30 text-blue-400">
            <Scissors className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">
              2. Preprocessing Architecture & Crop V2
            </h2>
            <p className="text-xs text-slate-400">Uniform slice standardization</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          {/* Cancer Preprocessing */}
          <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-cyan-300">Cancer Model Preprocessing</h3>
              <span className="rounded bg-cyan-950 px-2 py-0.5 text-[10px] font-mono text-cyan-400 border border-cyan-800">
                Crop V2 Applied
              </span>
            </div>
            <ul className="space-y-2 text-slate-300">
              <li>
                <strong className="text-white">Cancer Crop V2:</strong> Discards 12% from top, 10% from bottom, and 6% from left and right margins.
                This strips burned-in scanner orientation markers, patient label bars, and bed edges.
              </li>
              <li>
                <strong className="text-white">Aspect-Ratio Preserved Padding:</strong> Padded to 224 × 224 with black margins using high-fidelity LANCZOS interpolation.
              </li>
              <li>
                <strong className="text-white">Alpha Channel Compositing:</strong> Transparency or RGBA bands are composited onto a black background.
              </li>
              <li>
                <strong className="text-white">Normalization:</strong> Standard ImageNet channel scaling (mean: [0.485, 0.456, 0.406], std: [0.229, 0.224, 0.225]).
              </li>
            </ul>
          </div>

          {/* COVID Preprocessing */}
          <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-blue-300">COVID / Pulmonary Preprocessing</h3>
              <span className="rounded bg-blue-950 px-2 py-0.5 text-[10px] font-mono text-blue-400 border border-blue-800">
                No Cancer Crop
              </span>
            </div>
            <ul className="space-y-2 text-slate-300">
              <li>
                <strong className="text-white">No Spatial Cropping:</strong> Peripheral subpleural ground-glass opacities in COVID-19 frequently occur
                at the thoracic margins; cropping would eliminate critical diagnostic visual indicators.
              </li>
              <li>
                <strong className="text-white">Aspect-Ratio Preserved Padding:</strong> Centered and padded to 224 × 224 with black margins.
              </li>
              <li>
                <strong className="text-white">Alpha Channel Compositing:</strong> Uniform black background paste for transparent PNG inputs.
              </li>
              <li>
                <strong className="text-white">Normalization:</strong> Identical ImageNet channel normalization.
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Section 3: Model Architecture & Training Protocol */}
      <div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-6 sm:p-8 space-y-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-500/10 border border-purple-500/30 text-purple-400">
            <Cpu className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">
              3. DenseNet121 Architecture & Two-Phase Training
            </h2>
            <p className="text-xs text-slate-400">Feature reuse and transfer learning</p>
          </div>
        </div>

        <div className="text-xs text-slate-300 space-y-3 leading-relaxed">
          <p>
            Both workflows employ <strong>DenseNet121</strong> (Densely Connected Convolutional Networks). Dense connectivity ensures maximum
            information flow between layers via concatenated feature maps, mitigating vanishing gradients and encouraging feature reuse across low-level
            parenchyma textures and high-level lesion morphology.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4 space-y-1.5">
              <p className="font-bold text-white">Phase 1: Classifier Head Warm-up</p>
              <p className="text-slate-400 text-[11px]">
                The DenseNet121 convolutional backbone was frozen while training the replaced 3-class linear head
                (<code className="text-cyan-300 font-mono">nn.Linear(in_features=1024, out_features=3)</code>) for 5 epochs using cross-entropy loss.
              </p>
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4 space-y-1.5">
              <p className="font-bold text-white">Phase 2: End-to-End Fine-Tuning</p>
              <p className="text-slate-400 text-[11px]">
                All layers were unfrozen with a reduced learning rate and cosine annealing scheduler. Cancer converged after 4 fine-tune epochs (9 total);
                COVID converged after 11 fine-tune epochs (16 total).
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Section 4: Aggregation Mathematics */}
      <div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-6 sm:p-8 space-y-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
            <Calculator className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">
              4. Arithmetic Mean Softmax Aggregation
            </h2>
            <p className="text-xs text-slate-400">Mathematical formulation of multi-slice case inference</p>
          </div>
        </div>

        <div className="text-xs text-slate-300 space-y-3 leading-relaxed">
          <p>
            A patient CT examination consists of multiple 2D axial slices{' '}
            <code className="text-cyan-300 font-mono">S = &#123;s₁, s₂, ..., s_N&#125;</code>.
            Rather than performing crude majority voting over discrete hard labels (which discards continuous confidence gradients and induces arbitrary tie-breaking),
            the platform computes the <strong>arithmetic mean of slice softmax vectors</strong>:
          </p>

          <div className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4 font-mono text-center text-xs text-cyan-300 space-y-2">
            <div>
              p(c | s_i) = exp(z_i,c) / &sum; exp(z_i,k)
            </div>
            <div className="text-white font-bold">
              p&#772;(c) = (1 / N) &times; &sum; p(c | s_i)
            </div>
            <div className="text-emerald-400">
              y&#770; = argmax p&#772;(c)
            </div>
          </div>

          <p className="text-[11px] text-slate-400">
            This aggregation method ensures that every slice contributes its full continuous probability mass, preserving nuance across
            slices where disease pathology is only partially expressed.
          </p>
        </div>
      </div>

      {/* Section 5: Limitations & Ethical Governance */}
      <div className="rounded-3xl border border-amber-500/30 bg-amber-950/20 p-6 sm:p-8 space-y-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-amber-200">
              5. Known Limitations & Research Governance
            </h2>
            <p className="text-xs text-amber-400/80">Ethical constraints and operational boundaries</p>
          </div>
        </div>

        <div className="text-xs text-slate-300 space-y-2.5 leading-relaxed">
          <p>
            <strong className="text-amber-200">• Experimental Prototype:</strong> ThoracicAI is not a certified medical device and has not undergone prospective clinical trials.
            It must never be used for diagnostic or therapeutic determinations.
          </p>
          <p>
            <strong className="text-amber-200">• Uncalibrated Softmax Scores:</strong> Softmax scores represent mathematical network activations, not calibrated epidemiological or clinical Bayesian probabilities.
          </p>
          <p>
            <strong className="text-amber-200">• Limited Independent Test Group Cohort:</strong> The untouched test cohort contains 13 leakage groups for cancer and 32 groups for COVID.
            Generalization across diverse external scanner manufacturers, slice thicknesses, and contrast protocols may vary.
          </p>
          <p>
            <strong className="text-amber-200">• Static Image Support Only:</strong> Currently validated strictly for standard static image formats (PNG, JPG, TIFF, BMP, WebP).
            DICOM volumetric reconstruction and NIfTI 3D pipelines require distinct, separate validation.
          </p>
          <p>
            <strong className="text-amber-200">• Zero Persistent Image Storage:</strong> Uploaded images are processed strictly in-memory during request execution and are discarded immediately.
            No raw medical scans or patient metadata are stored or logged.
          </p>
        </div>
      </div>
    </div>
  );
};
