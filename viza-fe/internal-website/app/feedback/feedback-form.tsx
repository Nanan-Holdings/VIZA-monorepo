"use client";

import { FormEvent, useRef, useState } from "react";
import Link from "next/link";
import { CheckCircle, CircleNotch, PaperPlaneTilt } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
      <section className="rounded-xl border bg-white p-8 text-center shadow-sm sm:p-12">
        <CheckCircle className="mx-auto size-12 text-emerald-600" weight="fill" aria-hidden="true" />
        <h2 className="mt-5 text-2xl font-semibold">{copy.successTitle}</h2>
        <p className="mt-3 text-muted-foreground">{copy.successBody}</p>
        <Button className="mt-7" variant="outline" onClick={reset}>{copy.sendAnother}</Button>
      </section>
    );
  }

  return (
    <form id="feedback-form" onSubmit={handleSubmit} className="space-y-8 rounded-xl border bg-white p-6 shadow-sm sm:p-8" noValidate>
      <input className="sr-only" tabIndex={-1} autoComplete="off" name="company" aria-hidden="true" />
      <section className="rounded-lg border bg-brand-50/50 p-4 sm:flex sm:items-center sm:justify-between sm:gap-6">
        <div>
          <h2 className="text-base font-semibold">{copy.identityTitle}</h2>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">{copy.identityDescription}</p>
        </div>
        <div className="mt-4 flex shrink-0 flex-wrap gap-2 sm:mt-0">
          <Button asChild variant="outline"><Link href="/client/login?returnTo=%2Ffeedback">{copy.login}</Link></Button>
          <Button asChild variant="secondary"><a href="#feedback-fields">{copy.anonymous}</a></Button>
        </div>
      </section>
      <div id="feedback-fields" className="sr-only">{copy.anonymous}</div>
      <fieldset className="space-y-4">
        <legend className="text-base font-semibold">{copy.experience}</legend>
        <p className="text-sm text-muted-foreground">{copy.ratingHint}</p>
        <RatingInput label={copy.experience} value={experienceRating} onChange={setExperienceRating} />
      </fieldset>
      <fieldset className="space-y-4">
        <legend className="text-base font-semibold">{copy.ease}</legend>
        <RatingInput label={copy.ease} value={easeRating} onChange={setEaseRating} />
      </fieldset>
      <div className="grid gap-6 sm:grid-cols-2">
        <FieldSelect id="task" label={copy.task} value={task} onChange={setTask} options={feedbackTasks.map((value) => ({ value, label: copy.tasks[value] }))} />
        <FieldSelect id="feedback-type" label={copy.feedbackType} value={feedbackType} onChange={setFeedbackType} options={feedbackTypes.map((value) => ({ value, label: copy.types[value] }))} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="description">{copy.description}</Label>
        <Textarea id="description" value={description} onChange={(event) => setDescription(event.target.value)} minLength={10} maxLength={4000} rows={6} required />
        <p className="text-sm text-muted-foreground">{copy.descriptionHint}</p>
      </div>
      <div className="grid gap-6 sm:grid-cols-2">
        <div className="space-y-2"><Label htmlFor="reproduce">{copy.reproduce}</Label><Textarea id="reproduce" value={reproduceSteps} onChange={(event) => setReproduceSteps(event.target.value)} maxLength={2000} rows={4} /></div>
        <div className="space-y-2"><Label htmlFor="expected">{copy.expected}</Label><Textarea id="expected" value={expectedResult} onChange={(event) => setExpectedResult(event.target.value)} maxLength={2000} rows={4} /></div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="environment">{copy.environment}</Label>
        <Input id="environment" value={environment} onChange={(event) => setEnvironment(event.target.value)} maxLength={300} />
      </div>
      <fieldset className="space-y-3 border-t pt-6">
        <legend className="text-base font-semibold">{copy.contact}</legend>
        <label className="flex cursor-pointer items-center gap-3 text-sm"><input type="checkbox" checked={contactConsent} onChange={(event) => setContactConsent(event.target.checked)} className="size-4 rounded border-input text-primary focus:ring-ring" />{copy.contactYes}</label>
        {contactConsent ? <div className="max-w-md space-y-2"><Label htmlFor="email">{copy.email}</Label><Input id="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} maxLength={320} required /></div> : null}
      </fieldset>
      {error ? <p role="alert" className="text-sm font-medium text-destructive">{error}</p> : null}
      <Button type="submit" className="w-full sm:w-auto" disabled={isSubmitting}>
        {isSubmitting ? <CircleNotch className="animate-spin" aria-hidden="true" /> : <PaperPlaneTilt aria-hidden="true" />}
        {isSubmitting ? copy.submitting : copy.submit}
      </Button>
    </form>
  );
}

function RatingInput({ label, value, onChange }: { label: string; value: Rating | ""; onChange: (value: Rating) => void }) {
  return <div className="flex gap-2" role="radiogroup" aria-label={label}>{ratingValues.map((rating) => <button key={rating} type="button" role="radio" aria-checked={value === rating} onClick={() => onChange(rating)} className={`flex size-11 items-center justify-center rounded-md border text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring ${value === rating ? "border-primary bg-primary text-primary-foreground" : "border-input bg-background hover:bg-accent"}`}>{rating}</button>)}</div>;
}

function FieldSelect({ id, label, value, onChange, options }: { id: string; label: string; value: string; onChange: (value: string) => void; options: Array<{ value: string; label: string }> }) {
  return <div className="space-y-2"><Label htmlFor={id}>{label}</Label><select id={id} value={value} onChange={(event) => onChange(event.target.value)} required className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"><option value="" disabled>—</option>{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></div>;
}
