"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { BrandActionButton } from "@/components/client/brand-action-button";
import { Button } from "@/components/ui/button";

interface SubmissionDisclaimerDialogProps {
  open: boolean;
  submitting?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

const CHECKBOXES = [
  {
    id: "accurate",
    label: "我确认以上资料真实、完整，并已按护照和官方文件核对。",
  },
  {
    id: "responsibility",
    label: "我理解签证结果由对应国家或地区的官方机构决定，VIZA 不保证获批。",
  },
  {
    id: "updates",
    label: "我同意在提交前再次确认目的地入境政策、费用和处理时间可能变化。",
  },
] as const;

export function SubmissionDisclaimerDialog({
  open,
  submitting,
  onCancel,
  onConfirm,
}: SubmissionDisclaimerDialogProps) {
  const [checked, setChecked] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (open) setChecked({});
  }, [open]);

  const allChecked = useMemo(
    () => CHECKBOXES.every((item) => checked[item.id]),
    [checked],
  );

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="submission-disclaimer-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 px-4 py-6"
    >
      <div className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl">
        <header className="bg-[#c9082a] px-6 py-5 text-center text-white">
          <h2 id="submission-disclaimer-title" className="text-2xl font-semibold tracking-wide">
            NOTE
          </h2>
        </header>

        <div className="flex-1 overflow-y-auto px-6 py-6 sm:px-10">
          <div className="mx-auto flex max-w-3xl flex-col gap-6 text-[15px] leading-7 text-[#24272f] sm:text-base">
            <div className="flex gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-900">
              <AlertTriangle className="mt-1 h-5 w-5 shrink-0" />
              <p>
                以下为提交前占位声明。正式版本会替换为对应国家、签证类型和服务条款的官方确认内容。
              </p>
            </div>

            <p>
              请在提交前确认所有个人信息、护照信息、旅行安排、上传文件和自动生成的英文/官方格式内容均与您的真实文件一致。
              如发现任何不一致，请返回对应区域修改后再提交。
            </p>

            <ul className="list-disc space-y-3 pl-6">
              <li>申请资料一经提交，可能进入人工处理或外部官方系统准备流程。</li>
              <li>不同目的地的审核周期、费用、补件要求和入境政策可能随时调整。</li>
              <li>请妥善保存您的护照、申请编号、预约信息和付款记录。</li>
            </ul>

            <div className="border-t border-[#e5e7eb] pt-5">
              <p className="mb-4 font-semibold">提交确认</p>
              <div className="flex flex-col gap-4">
                {CHECKBOXES.map((item) => (
                  <label key={item.id} className="flex cursor-pointer items-start gap-3 text-sm font-medium text-[#24272f] sm:text-base">
                    <input
                      type="checkbox"
                      className="mt-1 h-5 w-5 shrink-0 rounded border-[#9aa6b2] accent-[#03346E]"
                      checked={Boolean(checked[item.id])}
                      onChange={(event) => {
                        setChecked((prev) => ({ ...prev, [item.id]: event.target.checked }));
                      }}
                    />
                    <span>{item.label}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        </div>

        <footer className="flex flex-col gap-3 border-t border-[#e5e7eb] bg-white px-6 py-5 sm:flex-row sm:justify-center">
          <Button
            type="button"
            variant="secondary"
            className="h-12 min-w-40 rounded-md bg-[#5f5f5f] text-base font-semibold text-white hover:bg-[#4c4c4c]"
            onClick={onCancel}
            disabled={submitting}
          >
            Cancel
          </Button>
          <BrandActionButton
            type="button"
            className="h-12 min-w-40 rounded-md"
            disabled={!allChecked || submitting}
            loading={submitting}
            loadingText="Submitting"
            onClick={onConfirm}
          >
            Next
          </BrandActionButton>
        </footer>
      </div>
    </div>
  );
}
