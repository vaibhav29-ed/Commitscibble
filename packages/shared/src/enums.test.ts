import { describe, expect, it } from "vitest";
import { JOB_TRANSITIONS, assertTransition, canTransition } from "./enums.js";

describe("job state machine", () => {
  it("allows the documented happy path", () => {
    expect(canTransition("QUEUED", "RUNNING")).toBe(true);
    expect(canTransition("RUNNING", "SUCCEEDED")).toBe(true);
    expect(canTransition("RUNNING", "FAILED")).toBe(true);
    expect(canTransition("RUNNING", "RETRYING")).toBe(true);
    expect(canTransition("RETRYING", "RUNNING")).toBe(true);
    expect(canTransition("FAILED", "QUEUED")).toBe(true);
  });

  it("rejects transitions out of terminal states", () => {
    expect(canTransition("SUCCEEDED", "RUNNING")).toBe(false);
    expect(canTransition("CANCELLED", "RUNNING")).toBe(false);
    expect(canTransition("SUCCEEDED", "FAILED")).toBe(false);
  });

  it("rejects skipping RUNNING", () => {
    expect(canTransition("QUEUED", "SUCCEEDED")).toBe(false);
  });

  it("throws on an illegal transition", () => {
    expect(() => assertTransition("SUCCEEDED", "RUNNING")).toThrow(/Illegal job state transition/);
  });

  it("has no transitions pointing from terminal states", () => {
    expect(JOB_TRANSITIONS.SUCCEEDED).toEqual([]);
    expect(JOB_TRANSITIONS.CANCELLED).toEqual([]);
  });
});
