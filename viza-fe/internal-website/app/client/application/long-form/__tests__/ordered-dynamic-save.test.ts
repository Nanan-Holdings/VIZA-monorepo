import { describe, expect, it, vi } from "vitest";
import { createOrderedDynamicSaveQueue } from "../ordered-dynamic-save";

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

async function flushMicrotasks() {
  await Promise.resolve();
  await Promise.resolve();
}

describe("createOrderedDynamicSaveQueue", () => {
  it("joins a pending navigation save for the same snapshot", async () => {
    const firstSave = deferred<void>();
    const save = vi.fn(() => firstSave.promise);
    const queue = createOrderedDynamicSaveQueue(save);

    const autosave = queue.enqueue("application-1", { first_name: "Ada" });
    await flushMicrotasks();
    const navigation = queue.enqueue("application-1", { first_name: "Ada" });

    expect(save).toHaveBeenCalledTimes(1);
    firstSave.resolve();
    await Promise.all([autosave, navigation]);
    expect(save).toHaveBeenCalledWith("application-1", { first_name: "Ada" });
  });

  it("serializes a newer edit behind the pending snapshot", async () => {
    const firstSave = deferred<void>();
    const secondSave = deferred<void>();
    const save = vi
      .fn<(
        applicationId: string,
        patch: Record<string, string>,
      ) => Promise<void>>()
      .mockReturnValueOnce(firstSave.promise)
      .mockReturnValueOnce(secondSave.promise);
    const queue = createOrderedDynamicSaveQueue(save);

    const first = queue.enqueue("application-1", { first_name: "Ada" });
    await flushMicrotasks();
    const second = queue.enqueue("application-1", { first_name: "Grace" });
    await flushMicrotasks();

    expect(save).toHaveBeenCalledTimes(1);
    firstSave.resolve();
    await vi.waitFor(() => expect(save).toHaveBeenCalledTimes(2));
    expect(save).toHaveBeenNthCalledWith(2, "application-1", { first_name: "Grace" });

    secondSave.resolve();
    await Promise.all([first, second]);
  });

  it("does not drop a revert that follows an intervening edit", async () => {
    const firstSave = deferred<void>();
    const secondSave = deferred<void>();
    const thirdSave = deferred<void>();
    const save = vi
      .fn<(
        applicationId: string,
        patch: Record<string, string>,
      ) => Promise<void>>()
      .mockReturnValueOnce(firstSave.promise)
      .mockReturnValueOnce(secondSave.promise)
      .mockReturnValueOnce(thirdSave.promise);
    const queue = createOrderedDynamicSaveQueue(save);

    const first = queue.enqueue("application-1", { first_name: "Ada" });
    await flushMicrotasks();
    const second = queue.enqueue("application-1", { first_name: "Grace" });
    const third = queue.enqueue("application-1", { first_name: "Ada" });

    firstSave.resolve();
    await vi.waitFor(() => expect(save).toHaveBeenNthCalledWith(2, "application-1", { first_name: "Grace" }));
    secondSave.resolve();
    await vi.waitFor(() => expect(save).toHaveBeenNthCalledWith(3, "application-1", { first_name: "Ada" }));
    thirdSave.resolve();
    await Promise.all([first, second, third]);
  });

  it("does not skip a revert while another patch is pending after a prior success", async () => {
    const secondSave = deferred<void>();
    const save = vi
      .fn<(
        applicationId: string,
        patch: Record<string, string>,
      ) => Promise<void>>()
      .mockResolvedValueOnce(undefined)
      .mockReturnValueOnce(secondSave.promise)
      .mockResolvedValueOnce(undefined);
    const queue = createOrderedDynamicSaveQueue(save);

    await queue.enqueue("application-1", { first_name: "Ada" });
    const second = queue.enqueue("application-1", { first_name: "Grace" });
    await flushMicrotasks();
    const third = queue.enqueue("application-1", { first_name: "Ada" });

    expect(save).toHaveBeenCalledTimes(2);
    secondSave.resolve();
    await Promise.all([second, third]);
    expect(save).toHaveBeenNthCalledWith(3, "application-1", { first_name: "Ada" });
  });

  it("leaves a failed snapshot retryable", async () => {
    const save = vi
      .fn<(
        applicationId: string,
        patch: Record<string, string>,
      ) => Promise<void>>()
      .mockRejectedValueOnce(new Error("temporary save failure"))
      .mockResolvedValueOnce(undefined);
    const queue = createOrderedDynamicSaveQueue(save);
    const patch = { first_name: "Ada" };

    await expect(queue.enqueue("application-1", patch)).rejects.toThrow("temporary save failure");
    await queue.enqueue("application-1", patch);

    expect(save).toHaveBeenCalledTimes(2);
    expect(save).toHaveBeenLastCalledWith("application-1", patch);
  });

  it("isolates identical patches by application", async () => {
    const save = vi.fn(async () => undefined);
    const queue = createOrderedDynamicSaveQueue(save);
    const patch = { first_name: "Ada" };

    await Promise.all([
      queue.enqueue("application-1", patch),
      queue.enqueue("application-2", patch),
    ]);

    expect(save).toHaveBeenCalledTimes(2);
    expect(save).toHaveBeenCalledWith("application-1", patch);
    expect(save).toHaveBeenCalledWith("application-2", patch);
  });

  it("does not cache completed saves when external data may have changed", async () => {
    const save = vi.fn(async () => undefined);
    const queue = createOrderedDynamicSaveQueue(save);
    const patch = { first_name: "Ada" };

    await queue.enqueue("application-1", patch);
    await queue.enqueue("application-1", patch);

    expect(save).toHaveBeenCalledTimes(2);
  });

  it("registers slow identity resolution and later writes in the shared submission barrier", async () => {
    const identity = deferred<string>();
    const secondWrite = deferred<void>();
    const writes: string[] = [];
    const tail = { current: Promise.resolve() };
    const queue = createOrderedDynamicSaveQueue(undefined, tail);
    const first = queue.enqueue("application-1", { name: "first" }, async (patch) => {
      await identity.promise;
      writes.push(patch.name);
    });
    const second = queue.enqueue("application-1", { name: "second" }, async (patch) => {
      writes.push(patch.name);
      await secondWrite.promise;
    });
    let drained = false;
    const barrier = tail.current.then(() => { drained = true; });
    await flushMicrotasks();
    expect(writes).toEqual([]);
    identity.resolve("application-1");
    await vi.waitFor(() => expect(writes).toEqual(["first", "second"]));
    expect(drained).toBe(false);
    secondWrite.resolve();
    await Promise.all([first, second, barrier, queue.drain()]);
    expect(drained).toBe(true);
  });

  it("forces the final submission snapshot even when an identical autosave is pending", async () => {
    const pending = deferred<void>();
    const save = vi.fn< (id: string, patch: Record<string, string>) => Promise<void> >()
      .mockReturnValueOnce(pending.promise).mockResolvedValue(undefined);
    const queue = createOrderedDynamicSaveQueue(save);
    const patch = { name: "Ada" };
    const autosave = queue.enqueue("application-1", patch);
    const final = queue.enqueue("application-1", patch, undefined, { deduplicate: false });
    await flushMicrotasks();
    expect(save).toHaveBeenCalledTimes(1);
    pending.resolve();
    await Promise.all([autosave, final]);
    expect(save).toHaveBeenCalledTimes(2);
  });

  it("keeps draining when another save joins the tail while it is waiting", async () => {
    const firstWrite = deferred<void>();
    const secondWrite = deferred<void>();
    const save = vi.fn< (id: string, patch: Record<string, string>) => Promise<void> >()
      .mockReturnValueOnce(firstWrite.promise).mockReturnValueOnce(secondWrite.promise);
    const queue = createOrderedDynamicSaveQueue(save);
    const first = queue.enqueue("application-1", { name: "first" });
    let drained = false;
    const draining = queue.drain().then(() => { drained = true; });
    const second = queue.enqueue("application-1", { name: "second" });
    firstWrite.resolve();
    await vi.waitFor(() => expect(save).toHaveBeenCalledTimes(2));
    expect(drained).toBe(false);
    secondWrite.resolve();
    await Promise.all([first, second, draining]);
    expect(drained).toBe(true);
  });

  it("keeps a private immutable snapshot of a queued patch", async () => {
    const blocked = deferred<void>();
    const save = vi.fn< (id: string, patch: Record<string, string>) => Promise<void> >()
      .mockReturnValueOnce(blocked.promise).mockResolvedValue(undefined);
    const queue = createOrderedDynamicSaveQueue(save);
    const first = queue.enqueue("application-1", { name: "first" });
    const patch = { name: "second" };
    const second = queue.enqueue("application-1", patch);
    patch.name = "unsaved mutation";
    blocked.resolve();
    await Promise.all([first, second]);
    expect(save).toHaveBeenLastCalledWith("application-1", { name: "second" });
  });
});
