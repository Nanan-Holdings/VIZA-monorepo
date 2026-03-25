"use client";

interface QuizQuestionProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}

export function QuizQuestion({
  title,
  subtitle,
  children,
}: QuizQuestionProps) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl sm:text-2xl md:text-3xl font-semibold text-[#1a1a1a] mb-2 leading-tight tracking-tight">
          {title}
        </h2>
        {subtitle && (
          <p className="text-sm md:text-base text-[#989898] leading-relaxed">
            {subtitle}
          </p>
        )}
      </div>
      <div>{children}</div>
    </div>
  );
}
