"use client";

import { CircleNotch as Loader2 } from "@phosphor-icons/react";
import { Document, Page, pdfjs } from "react-pdf";

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url
).toString();

interface DocumentPdfPreviewProps {
  name: string;
  previewUrl: string;
  onError: () => void;
}

export function DocumentPdfPreview({
  name,
  previewUrl,
  onError,
}: DocumentPdfPreviewProps) {
  const loading = (
    <span className="flex h-[122px] w-[86px] items-center justify-center rounded-[3px] border border-[#e5e7eb] bg-white">
      <Loader2 className="h-5 w-5 animate-spin text-brand-500" aria-hidden="true" />
      <span className="sr-only">Loading preview of {name}</span>
    </span>
  );

  return (
    <div role="img" aria-label={`Preview of ${name}`}>
      <Document
        file={previewUrl}
        loading={loading}
        error={null}
        noData={null}
        onLoadError={onError}
        className="overflow-hidden rounded-[3px] border border-[#e5e7eb] bg-white"
      >
        <Page
          pageNumber={1}
          height={122}
          loading={loading}
          onRenderError={onError}
          renderAnnotationLayer={false}
          renderTextLayer={false}
        />
      </Document>
    </div>
  );
}
