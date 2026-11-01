import React, { useState, useEffect, useRef } from 'react';
import { useCreateReportMutation, useReportStatus } from '../../api/queries';
import { FileText, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';

interface ReportButtonProps {
  citySlug: string;
}

export const ReportButton: React.FC<ReportButtonProps> = ({ citySlug }) => {
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const downloadedJobRef = useRef<string | null>(null);

  const createReportMutation = useCreateReportMutation();
  const { data: reportStatus, error: reportError } = useReportStatus(activeJobId);

  const handleGenerateReport = async () => {
    try {
      setSuccessMessage(null);
      const res = await createReportMutation.mutateAsync(citySlug);
      setActiveJobId(res.id);
    } catch (err) {
      console.error('Failed to trigger report generation:', err);
    }
  };

  useEffect(() => {
    if (
      reportStatus?.status === 'done' &&
      reportStatus.download_url &&
      downloadedJobRef.current !== reportStatus.id
    ) {
      downloadedJobRef.current = reportStatus.id;

      // Create a temporary link to trigger file download
      const link = document.createElement('a');
      link.href = reportStatus.download_url;
      link.download = `${citySlug}_subsidence_report.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      const t1 = setTimeout(() => {
        setSuccessMessage('Report downloaded!');
        setActiveJobId(null);
      }, 0);

      const t2 = setTimeout(() => {
        setSuccessMessage(null);
      }, 4000);

      return () => {
        clearTimeout(t1);
        clearTimeout(t2);
      };
    } else if (reportStatus?.status === 'failed') {
      const t = setTimeout(() => setActiveJobId(null), 0);
      return () => clearTimeout(t);
    }
  }, [reportStatus, citySlug]);

  const isPending =
    createReportMutation.isPending ||
    (activeJobId !== null && reportStatus?.status !== 'done' && reportStatus?.status !== 'failed');

  return (
    <div className="relative flex items-center">
      <button
        onClick={handleGenerateReport}
        disabled={isPending}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition shadow-2xs ${
          isPending
            ? 'bg-blue-50 border-blue-200 text-blue-700 cursor-wait'
            : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50 hover:border-gray-300'
        }`}
        title="Generate automated PDF summary report"
        aria-label="Generate PDF summary report"
      >
        {isPending ? (
          <>
            <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-600" />
            <span>Building PDF...</span>
          </>
        ) : successMessage ? (
          <>
            <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />
            <span className="text-green-700">{successMessage}</span>
          </>
        ) : (
          <>
            <FileText className="w-3.5 h-3.5 text-blue-600" />
            <span>PDF Report</span>
          </>
        )}
      </button>

      {reportError && (
        <div className="absolute top-full mt-1 right-0 bg-red-50 border border-red-200 text-red-700 text-[11px] p-2 rounded shadow-md z-40 flex items-center gap-1 whitespace-nowrap">
          <AlertCircle className="w-3.5 h-3.5" />
          <span>Failed to generate report</span>
        </div>
      )}
    </div>
  );
};
