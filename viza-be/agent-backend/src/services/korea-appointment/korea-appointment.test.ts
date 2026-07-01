import { describe, expect, it } from "vitest";

import {
  createDryRunKoreaAppointmentService,
  type KoreaAppointmentJob,
  type KoreaAppointmentSlot,
  type KoreaAppointmentRepository,
} from "./KoreaAppointmentService";

function createRepository(): KoreaAppointmentRepository {
  const jobs = new Map<string, KoreaAppointmentJob>();
  const slots = new Map<string, KoreaAppointmentSlot>();

  return {
    async getApplication(applicationId) {
      return {
        id: applicationId,
        userId: "user-1",
        visaType: "KR_C39_SHORT_TERM_VISIT",
        country: "south_korea",
      };
    },
    async getLatestJob(applicationId) {
      return [...jobs.values()].find((job) => job.applicationId === applicationId) ?? null;
    },
    async createJob(input) {
      const job = {
        id: "job-1",
        applicationId: input.applicationId,
        userId: input.userId,
        status: "appointment_slots_observed",
        selectedSlotId: null,
      };
      jobs.set(job.id, job);
      return job;
    },
    async insertSlots(_jobId, observedSlots) {
      return observedSlots.map((slot, index) => {
        const row = { ...slot, id: `slot-${index + 1}` };
        slots.set(row.id, row);
        return row;
      });
    },
    async selectSlot(jobId, slotId) {
      const job = jobs.get(jobId);
      jobs.set(jobId, { ...job, status: "appointment_slot_selection_required", selectedSlotId: slotId });
      return jobs.get(jobId);
    },
    async confirmBooking(jobId) {
      const job = jobs.get(jobId);
      jobs.set(jobId, { ...job, status: "appointment_booked" });
      return {
        id: "confirmation-1",
        jobId,
        confirmationNumber: "KR-DRYRUN-CONFIRM",
      };
    },
  };
}

describe("KoreaAppointmentService", () => {
  it("observes dry-run slots, requires a selected slot, then confirms booking", async () => {
    const service = createDryRunKoreaAppointmentService(createRepository());

    const started = await service.startSlotSearch({
      applicationId: "app-1",
      routingInput: { currentResidenceProvince: "上海市", hasResidenceProof: true },
    });
    expect(started.job.status).toBe("appointment_slots_observed");
    expect(started.slots.length).toBeGreaterThan(0);

    await expect(service.confirmBooking("app-1")).rejects.toThrow(/select an appointment slot/i);

    await service.selectSlot("app-1", started.slots[0].id);
    const confirmed = await service.confirmBooking("app-1");
    expect(confirmed.confirmation.confirmationNumber).toBe("KR-DRYRUN-CONFIRM");
  });
});
