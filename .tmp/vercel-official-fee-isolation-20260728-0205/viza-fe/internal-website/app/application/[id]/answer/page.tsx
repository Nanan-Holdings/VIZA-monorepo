import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  loadQuestionSetForApplication,
  type QuestionSetRecord,
} from "@/app/actions/question-sets";
import { loadDynamicAnswers } from "@/app/actions/visa-application-answers";
import { AnswerForm } from "./_components/AnswerForm";

interface AnswerPageProps {
  params: Promise<{ id: string }>;
}

export const dynamic = "force-dynamic";

export default async function ApplicationAnswerPage({ params }: AnswerPageProps) {
  const { id: applicationId } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  const { set, error } = await loadQuestionSetForApplication(applicationId);
  if (error || !set) {
    return (
      <main className="min-h-screen bg-[#fafafa] px-6 py-10">
        <div className="mx-auto max-w-2xl rounded-xl border border-input bg-white p-6 shadow-sm">
          <h1 className="text-xl font-semibold text-foreground">
            Unable to load questions
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">{error || "Question set not configured."}</p>
        </div>
      </main>
    );
  }

  const { answers } = await loadDynamicAnswers(applicationId);

  return (
    <main className="min-h-screen bg-[#fafafa] px-6 py-10">
      <div className="mx-auto max-w-2xl">
        <header className="mb-6">
          <h1 className="text-2xl font-semibold text-foreground">
            {set.country} · {set.visa_type.replace(/_/g, " ")}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Save-as-you-go. Answers persist on each blur — leave any time and resume here.
          </p>
        </header>
        <AnswerForm
          applicationId={applicationId}
          questionSet={set as QuestionSetRecord}
          initialAnswers={answers}
        />
      </div>
    </main>
  );
}
