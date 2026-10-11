"use client";

import { Upload } from "lucide-react";
import Card from "@/components/ui/Card";

export default function UploadCard({
  title = "Upload Content",
  description = "Add new files, lessons, or course materials.",
}) {
  return (
    <Card className="p-5">
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-700">
          <Upload className="h-5 w-5" />
        </div>
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
          <p className="mt-1 text-sm leading-6 text-slate-500">{description}</p>

          <div className="mt-5 rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center">
            <p className="text-sm font-medium text-slate-700">
              Drag and drop files here
            </p>
            <p className="mt-1 text-xs text-slate-500">
              PDF, video, notes, or course resources
            </p>
            <button type="button" className="btn-secondary mt-4">
              Choose File
            </button>
          </div>
        </div>
      </div>
    </Card>
  );
}
