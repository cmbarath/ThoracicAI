import React from 'react';
import { ShieldAlert, AlertTriangle } from 'lucide-react';

interface Props {
  variant?: 'top' | 'card';
}

export const DisclaimerBanner: React.FC<Props> = ({ variant = 'top' }) => {
  if (variant === 'card') {
    return (
      <div className="rounded-xl border border-amber-500/30 bg-amber-950/20 p-4 text-xs text-amber-300">
        <div className="flex items-start gap-2.5">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
          <div className="space-y-1">
            <p className="font-semibold text-amber-200 uppercase tracking-wider text-[11px]">
              Experimental Research Protocol — Not for Diagnostic Use
            </p>
            <p className="text-amber-300/80 leading-relaxed">
              This application is an academic research workbench. It does not provide medical advice, diagnosis, or clinical certainty.
              Outputs represent uncalibrated model softmax scores, not patient-specific probabilities.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="border-b border-amber-500/20 bg-gradient-to-r from-amber-950/40 via-amber-900/20 to-amber-950/40 px-4 py-2 text-xs text-amber-300/90">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <ShieldAlert className="h-4 w-4 shrink-0 text-amber-400" />
          <span className="font-medium text-amber-200">Research Use Only:</span>
          <span className="hidden md:inline text-amber-300/80">
            Experimental thoracic CT classification prototype. Not clinically validated or approved as a medical device.
          </span>
          <span className="md:hidden text-amber-300/80">
            Experimental research prototype only.
          </span>
        </div>
        <div className="shrink-0 rounded-full bg-amber-500/10 px-2.5 py-0.5 text-[11px] font-mono text-amber-400 border border-amber-500/30">
          DenseNet-121 Benchmark
        </div>
      </div>
    </div>
  );
};
