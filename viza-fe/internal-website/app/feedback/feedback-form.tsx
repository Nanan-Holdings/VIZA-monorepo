"use client";

import { FormEvent, useRef, useState } from "react";
import Link from "next/link";
import { CheckCircle, PaperPlaneTilt } from "@phosphor-icons/react";
import { ActionButton } from "@/components/ui/action-button";
import { ApplicationCheckbox, ApplicationRadio } from "@/components/ui/application-checkbox";
import { ApplicationFormField } from "@/components/ui/application-form-field";
import { ApplicationFormInputGroup } from "@/components/ui/application-form-input";
import { ApplicationFormPanel } from "@/components/ui/application-form-panel";
import {
  ApplicationFormSelectContent,
  ApplicationFormSelectItem,
  ApplicationFormSelectTrigger,
} from "@/components/ui/application-form-select";
import { ApplicationFormTextarea } from "@/components/ui/application-form-textarea";
import { InputGroupInput } from "@/components/ui/input-group";
import { Select, SelectValue } from "@/components/ui/select";
import { feedbackCopy, feedbackTasks, feedbackTypes } from "./feedback-copy";

type FeedbackFormProps = { locale: string };
type Rating = "1" | "2" | "3" | "4" | "5";

const ratingValues: Rating[] = ["1", "2", "3", "4", "5"];

export function FeedbackForm({ locale }: FeedbackFormProps) {
  const language = locale === "en" ? "en" : "zh";
  const copy = feedbackCopy[language];
  const openedAt = useRef(Date.now());
  const [experienceRating, setExperienceRating] = useState<Rating | "">("");
  const [easeRating, setEaseRating] = useState<Rating | "">("");
  const [task, setTask] = useState("");
  const [feedbackType, setFeedbackType] = useState("");
  const [description, setDescription] = useState("");
  const [reproduceSteps, setReproduceSteps] = useState("");
  const [expectedResult, setExpectedResult] = useState("");
  const [environment, setEnvironment] = useState("");
  const [contactConsent, setContactConsent] = useState(false);
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  function reset() {
    setExperienceRating("");
    setEaseRating("");
    setTask("");
    setFeedbackType("");
    setDescription("");
    setReproduceSteps("");
    setExpectedResult("");
    setEnvironment("");
    setContactConsent(false);
    setEmail("");
    setError(null);
    setSent(false);
    openedAt.current = Date.now();
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) return;

    if (!experienceRating || !easeRating || !task || !feedbackType || description.trim().length < 10 || (contactConsent && !email.trim())) {
      setError(copy.required);
      return;
    }

    setError(null);
    setIsSubmitting(true);
    const form = event.currentTarget;
    const honeypot = new FormData(form).get("company")?.toString() ?? "";

    try {
      const response = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          experienceRating: Number(experienceRating),
          easeRating: Number(easeRating),
          task,
          feedbackType,
          description,
          reproduceSteps,
          expectedResult,
          environment,
          contactConsent,
          email,
          locale: language,
          elapsedMs: Date.now() - openedAt.current,
          company: honeypot,
        }),
      });
      if (!response.ok) throw new Error("Feedback request failed");
      setSent(true);
    } catch {
      setError(copy.error);
    } finally {
      setIsSubmitting(false);
    }
  }

  if (sent) {
    return (
      <ApplicationFormPanel className="px-5 py-10 text-center sm:px-10 sm:py-14">
        <CheckCircle className="mx-auto size-11 text-brand-500" weight="fill" aria-hidden="true" />
        <h2 className="mt-5 text-[24px] font-medium tracking-[-0.5px] text-foreground">{copy.successTitle}</h2>
        <p className="mx-auto mt-3 max-w-md text-[15px] leading-7 text-muted-foreground">{copy.successBody}</p>
        <ActionButton className="mt-7" variant="secondary" onClick={reset}>{copy.sendAnother}</ActionButton>
      </ApplicationFormPanel>
    );
  }

  return (
    <form id="feedback-form" onSubmit={handleSubmit} noValidate>
      <input className="sr-only" tabIndex={-1} autoComplete="off" name="company" aria-hidden="true" />
      <ApplicationFormPanel className="overflow-hidden">
        <section className="border-b border-border-hairline px-5 py-5 sm:flex sm:items-center sm:justify-between sm:gap-6 sm:px-8">
          <div>
            <p className="text-[13px] font-medium uppercase tracking-[0.1em] text-muted-foreground">{copy.identityTitle}</p>
            <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">{copy.identityDescription}</p>
          </div>
          <div className="mt-4 flex shrink-0 flex-wrap items-center gap-3 sm:mt-0">
            <span className="text-sm font-medium text-foreground">{copy.anonymous}</span>
            <ActionButton asChild size="sm" variant="secondary">
              <Link href="/client/login?returnTo=%2Ffeedback">{copy.login}</Link>
            </ActionButton>
          </div>
        </section>

        <div id="feedback-fields" className="space-y-8 px-5 py-7 sm:px-8 sm:py-8">
          <section>
            <p className="text-[13px] font-medium uppercase tracking-[0.1em] text-muted-foreground">01 · {copy.experience}</p>
            <div className="mt-5 grid gap-6 sm:grid-cols-2">
              <RatingField label={copy.experience} value={experienceRating} onChange={setExperienceRating} copy={copy} />
              <RatingField label={copy.ease} value={easeRating} onChange={setEaseRating} copy={copy} />
            </div>
          </section>

          <section className="border-t border-border-hairline pt-8">
            <p className="text-[13px] font-medium uppercase tracking-[0.1em] text-muted-foreground">02 · {copy.feedbackType}</p>
            <div className="mt-5 grid gap-6 sm:grid-cols-2">
              <FieldSelect id="task" label={copy.task} value={task} onChange={setTask} options={feedbackTasks.map((value) => ({ value, label: copy.tasks[value] }))} />
              <FieldSelect id="feedback-type" label={copy.feedbackType} value={feedbackType} onChange={setFeedbackType} options={feedbackTypes.map((value) => ({ value, label: copy.types[value] }))} />
            </div>
          </section>

          <section className="border-t border-border-hairline pt-8">
            <p className="text-[13px] font-medium uppercase tracking-[0.1em] text-muted-foreground">03 · {copy.description}</p>
            <ApplicationFormField className="mt-5" htmlFor="description" label={copy.description} helperText={copy.descriptionHint} required>
              <ApplicationFormTextarea id="description" value={description} onChange={(event) => setDescription(event.target.value)} minLength={10} maxLength={4000} rows={6} required className="min-h-36 resize-y text-[15px]" />
            </ApplicationFormField>
          </section>

          {feedbackType === "bug" ? (
            <section className="border-t border-border-hairline pt-8">
              <p className="text-[13px] font-medium uppercase tracking-[0.1em] text-muted-foreground">{copy.bugDetailsTitle}</p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{copy.bugDetailsBody}</p>
              <div className="mt-5 grid gap-6 sm:grid-cols-2">
                <ApplicationFormField htmlFor="reproduce" label={copy.reproduce}>
                  <ApplicationFormTextarea id="reproduce" value={reproduceSteps} onChange={(event) => setReproduceSteps(event.target.value)} maxLength={2000} rows={4} className="min-h-28 resize-y text-[15px]" />
                </ApplicationFormField>
                <ApplicationFormField htmlFor="expected" label={copy.expected}>
                  <ApplicationFormTextarea id="expected" value={expectedResult} onChange={(event) => setExpectedResult(event.target.value)} maxLength={2000} rows={4} className="min-h-28 resize-y text-[15px]" />
                </ApplicationFormField>
              </div>
            </section>
          ) : null}

          <section className="border-t border-border-hairline pt-8">
            <ApplicationFormField htmlFor="environment" label={copy.environment}>
              <ApplicationFormInputGroup className="h-12" filled={Boolean(environment)}>
                <InputGroupInput id="environment" value={environment} onChange={(event) => setEnvironment(event.target.value)} maxLength={300} className="h-12 text-[15px]" />
              </ApplicationFormInputGroup>
            </ApplicationFormField>
          </section>

          <section className="border-t border-border-hairline pt-8">
            <p className="text-[13px] font-medium uppercase tracking-[0.1em] text-muted-foreground">04 · {copy.contact}</p>
            <div className="mt-5">
              <ApplicationCheckbox checked={contactConsent} onCheckedChange={setContactConsent} label={copy.contactYes} />
            </div>
            {contactConsent ? <ApplicationFormField className="mt-5 max-w-md" htmlFor="email" label={copy.email} required><ApplicationFormInputGroup className="h-12" filled={Boolean(email)}><InputGroupInput id="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} maxLength={320} required className="h-12 text-[15px]" /></ApplicationFormInputGroup></ApplicationFormField> : null}
          </section>

          <div className="flex flex-col items-start gap-4 border-t border-border-hairline pt-8">
            {error ? <p role="alert" className="text-sm font-medium text-destructive">{error}</p> : null}
            <ActionButton type="submit" loading={isSubmitting} loadingText={copy.submitting}>
              {!isSubmitting ? <PaperPlaneTilt aria-hidden="true" /> : null}
              {copy.submit}
            </ActionButton>
          </div>
        </div>
      </ApplicationFormPanel>
    </form>
  );
}

function RatingField({ label, value, onChange, copy }: { label: string; value: Rating | ""; onChange: (value: Rating) => void; copy: typeof feedbackCopy.en }) {
  return <ApplicationFormField label={label} helperText={copy.ratingHint} required>
    <div className="flex items-center justify-between gap-3">
      <span className="text-[12px] text-muted-foreground">{copy.ratingLow}</span>
      <div className="flex flex-wrap justify-end gap-x-3 gap-y-2" role="radiogroup" aria-label={label}>
        {ratingValues.map((rating) => <ApplicationRadio key={rating} name={label} value={rating} checked={value === rating} label={rating} onCheckedChange={() => onChange(rating)} />)}
      </div>
      <span className="text-[12px] text-muted-foreground">{copy.ratingHigh}</span>
    </div>
  </ApplicationFormField>;
}

function FieldSelect({ id, label, value, onChange, options }: { id: string; label: string; value: string; onChange: (value: string) => void; options: Array<{ value: string; label: string }> }) {
  return <ApplicationFormField htmlFor={id} label={label} required><Select value={value} onValueChange={onChange}><ApplicationFormSelectTrigger id={id} className="h-12 text-[15px]" filled={Boolean(value)}><SelectValue placeholder="—" /></ApplicationFormSelectTrigger><ApplicationFormSelectContent>{options.map((option) => <ApplicationFormSelectItem key={option.value} value={option.value}>{option.label}</ApplicationFormSelectItem>)}</ApplicationFormSelectContent></Select></ApplicationFormField>;
}
