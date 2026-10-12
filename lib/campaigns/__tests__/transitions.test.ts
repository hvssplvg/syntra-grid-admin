import { describe, expect, it } from "vitest";
import { assertCampaignIsEditable, assertValidStatusTransition } from "@/lib/campaigns/server";
import { assertValidContentTransition } from "@/lib/campaigns/content";

describe("Campaign status transitions", () => {
  it("allows DRAFT -> PLANNING", () => {
    expect(() => assertValidStatusTransition("DRAFT", "PLANNING")).not.toThrow();
  });

  it("allows a no-op transition to the same status", () => {
    expect(() => assertValidStatusTransition("ACTIVE", "ACTIVE")).not.toThrow();
  });

  it("rejects an invalid jump from DRAFT straight to ACTIVE", () => {
    expect(() => assertValidStatusTransition("DRAFT", "ACTIVE")).toThrow();
  });

  it("rejects any transition out of COMPLETED", () => {
    expect(() => assertValidStatusTransition("COMPLETED", "ACTIVE")).toThrow();
    expect(() => assertValidStatusTransition("COMPLETED", "CANCELLED")).toThrow();
  });

  it("rejects any transition out of CANCELLED", () => {
    expect(() => assertValidStatusTransition("CANCELLED", "ACTIVE")).toThrow();
  });

  it("rejects any transition out of ARCHIVED (restore is a dedicated action, not a status PATCH)", () => {
    expect(() => assertValidStatusTransition("ARCHIVED", "DRAFT")).toThrow();
  });
});

describe("Campaign editability", () => {
  it("allows editing a DRAFT campaign", () => {
    expect(() => assertCampaignIsEditable("DRAFT")).not.toThrow();
  });

  it("blocks editing a COMPLETED campaign", () => {
    expect(() => assertCampaignIsEditable("COMPLETED")).toThrow();
  });

  it("blocks editing a CANCELLED campaign", () => {
    expect(() => assertCampaignIsEditable("CANCELLED")).toThrow();
  });

  it("blocks editing an ARCHIVED campaign", () => {
    expect(() => assertCampaignIsEditable("ARCHIVED")).toThrow();
  });
});

describe("Campaign content status transitions", () => {
  it("allows DRAFT -> IN_PROGRESS -> READY_FOR_REVIEW", () => {
    expect(() => assertValidContentTransition("DRAFT", "IN_PROGRESS")).not.toThrow();
    expect(() => assertValidContentTransition("IN_PROGRESS", "READY_FOR_REVIEW")).not.toThrow();
  });

  it("never allows a direct transition to PUBLISHED from any status", () => {
    expect(() => assertValidContentTransition("APPROVED", "PUBLISHED")).toThrow();
    expect(() => assertValidContentTransition("SCHEDULED", "PUBLISHED")).toThrow();
    expect(() => assertValidContentTransition("DRAFT", "PUBLISHED")).toThrow();
  });

  it("allows READY_FOR_REVIEW -> CHANGES_REQUESTED -> IN_PROGRESS (the resubmission loop)", () => {
    expect(() => assertValidContentTransition("READY_FOR_REVIEW", "CHANGES_REQUESTED")).not.toThrow();
    expect(() => assertValidContentTransition("CHANGES_REQUESTED", "IN_PROGRESS")).not.toThrow();
  });

  it("rejects a transition out of a terminal ARCHIVED state", () => {
    expect(() => assertValidContentTransition("ARCHIVED", "DRAFT")).toThrow();
  });
});
