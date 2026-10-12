import { describe, expect, it } from "vitest";
import { computeKpiStatus, parseCsv } from "@/lib/campaigns/analytics";

describe("computeKpiStatus", () => {
  it("is ACHIEVED once actual reaches target, regardless of deadline", () => {
    expect(computeKpiStatus(100, 100, null)).toBe("ACHIEVED");
    expect(computeKpiStatus(100, 150, new Date(Date.now() - 1000))).toBe("ACHIEVED");
  });

  it("is MISSED once the deadline has passed without reaching target", () => {
    expect(computeKpiStatus(100, 50, new Date(Date.now() - 24 * 60 * 60 * 1000))).toBe("MISSED");
  });

  it("is ON_TRACK with no deadline and target not yet reached", () => {
    expect(computeKpiStatus(100, 50, null)).toBe("ON_TRACK");
  });

  it("is AT_RISK when the deadline is close and progress is behind pace", () => {
    const soon = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000); // 3 days out
    expect(computeKpiStatus(100, 10, soon)).toBe("AT_RISK");
  });

  it("is ON_TRACK when the deadline is close but progress is good", () => {
    const soon = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
    expect(computeKpiStatus(100, 95, soon)).toBe("ON_TRACK");
  });

  it("is ON_TRACK when the deadline is far away even with low progress", () => {
    const farOut = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);
    expect(computeKpiStatus(100, 5, farOut)).toBe("ON_TRACK");
  });
});

describe("parseCsv", () => {
  it("parses a simple comma-delimited file", () => {
    const rows = parseCsv("a,b,c\n1,2,3");
    expect(rows).toEqual([["a", "b", "c"], ["1", "2", "3"]]);
  });

  it("handles quoted fields containing commas", () => {
    const rows = parseCsv('name,note\n"Smith, Jane",hello');
    expect(rows).toEqual([["name", "note"], ["Smith, Jane", "hello"]]);
  });

  it("handles escaped double quotes inside a quoted field", () => {
    const rows = parseCsv('note\n"She said ""hi"""');
    expect(rows).toEqual([["note"], ['She said "hi"']]);
  });

  it("handles CRLF line endings without producing blank rows", () => {
    const rows = parseCsv("a,b\r\n1,2\r\n3,4");
    expect(rows).toEqual([["a", "b"], ["1", "2"], ["3", "4"]]);
  });
});
