import * as dotenv from 'dotenv';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env.local') });
dotenv.config({ path: path.join(__dirname, '../.env') });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error('Missing Supabase credentials');
const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const repairIncomplete = process.argv.includes('--repair-incomplete');
const dryRun = process.argv.includes('--dry-run');

const {
  createEmptyVisaConversationState,
  normalizePassportCountryIso3,
  normalizeVisaConversationState,
  updateVisaConversationState,
} = await import('../src/services/visa-conversation-state.service.js');

async function main(): Promise<void> {
  const { data: sessions, error } = await supabase
    .from('visa_chat_sessions')
    .select('id, applicant_id, memory_json, memory_revision')
    .order('created_at', { ascending: true });
  if (error) throw new Error(error.message);

  let updated = 0;
  let skipped = 0;
  for (const session of sessions ?? []) {
    const row = session as {
      id: string;
      applicant_id: string;
      memory_json: unknown;
      memory_revision: number | string | null;
    };
    const hasExistingMemory = Boolean(
      row.memory_json &&
      typeof row.memory_json === 'object' &&
      Object.keys(row.memory_json as object).length > 0
    );
    if (hasExistingMemory && !repairIncomplete) {
      skipped += 1;
      continue;
    }

    const [{ data: messages }, { data: profile }] = await Promise.all([
      supabase
        .from('visa_chat_messages')
        .select('role, content')
        .eq('session_id', row.id)
        .in('role', ['user', 'assistant'])
        .order('created_at', { ascending: true }),
      supabase
        .from('applicant_profiles')
        .select('nationality, passport_issuing_country')
        .eq('id', row.applicant_id)
        .maybeSingle(),
    ]);

    let state = createEmptyVisaConversationState();
    const history: Array<{ role: 'user' | 'assistant'; content: string }> = [];
    for (const message of messages ?? []) {
      const turn = message as { role: 'user' | 'assistant'; content: string };
      history.push(turn);
      if (turn.role === 'user') {
        state = updateVisaConversationState(state, history, turn.content);
      }
    }

    const stablePassport =
      (profile as { nationality?: string | null } | null)?.nationality ??
      (profile as { passport_issuing_country?: string | null } | null)
        ?.passport_issuing_country ??
      null;
    if (!state.passportCountryIso3 && stablePassport) {
      state = normalizeVisaConversationState({
        ...state,
        nationality: state.nationality ?? stablePassport,
        passportCountryIso3: normalizePassportCountryIso3(stablePassport),
        passportType: state.passportType,
        fieldSources: {
          ...state.fieldSources,
          nationality: 'profile',
          passportCountryIso3: 'profile',
        },
      });
    }

    if (hasExistingMemory && repairIncomplete) {
      const existing = normalizeVisaConversationState(
        row.memory_json as Partial<typeof state>
      );
      const memoryScore = (value: typeof state): number =>
        Number(Boolean(value.passportCountryIso3 || value.nationality)) +
        Number(Boolean(value.residenceCountry)) +
        Number(Boolean(value.destinationCountries.length || value.mainDestination)) +
        Number(Boolean(value.tripPurpose)) +
        Number(Boolean(value.stayLengthDays)) +
        Number(Boolean(value.firstEntryCountry)) +
        Object.keys(value.schengenDaySplit).length;
      if (memoryScore(state) <= memoryScore(existing)) {
        skipped += 1;
        continue;
      }
    }

    const revision = Number(row.memory_revision ?? 0) + 1;
    if (dryRun) {
      updated += 1;
      continue;
    }
    const now = new Date().toISOString();
    const { error: updateError } = await supabase
      .from('visa_chat_sessions')
      .update({
        memory_json: state,
        memory_revision: revision,
        memory_updated_at: now,
        updated_at: now,
      })
      .eq('id', row.id)
      .eq('memory_revision', Number(row.memory_revision ?? 0));
    if (updateError) throw new Error(updateError.message);
    updated += 1;
  }
  console.log(
    `${dryRun ? 'Would backfill' : 'Backfilled'} ${updated} visa chat sessions; skipped ${skipped}`
  );
}

await main();
