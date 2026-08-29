import { describe, expect, it } from "vitest";
import {
  canonicalizeReleaseValue,
  collectReleaseCitationChunkIds,
  deriveReleaseProposalState,
} from "@/lib/release-manifest";

describe("release governance helpers", () => {
  it("canonicalizes nested records while preserving array order", () => {
    const left = canonicalizeReleaseValue({
      z: 3,
      nested: { beta: 2, alpha: 1, omitted: undefined },
      list: [{ second: "b", first: "a" }, "tail"],
    });
    const right = canonicalizeReleaseValue({
      list: [{ first: "a", second: "b" }, "tail"],
      nested: { alpha: 1, beta: 2 },
      z: 3,
    });

    expect(JSON.stringify(left)).toBe(JSON.stringify(right));
    expect(left).toEqual({
      list: [{ first: "a", second: "b" }, "tail"],
      nested: { alpha: 1, beta: 2 },
      z: 3,
    });
  });

  it("collects exact proposal chunk IDs once in canonical order", () => {
    expect(
      collectReleaseCitationChunkIds(
        {
          sections: [
            { citations: [{ chunkId: "chunk-b" }, { chunkId: "chunk-a" }] },
            { citations: [{ chunkId: "chunk-b" }, { chunkId: "  " }] },
          ],
        },
        [{ chunkId: "chunk-c" }, { chunk_id: "not-a-supported-reference" }],
      ),
    ).toEqual(["chunk-a", "chunk-b", "chunk-c"]);
  });

  it("derives final state only for a valid release", () => {
    expect(deriveReleaseProposalState(true, true, "gold-team")).toEqual({
      status: "final",
      reviewStage: "final",
      submissionStatus: "validated",
    });
    expect(deriveReleaseProposalState(false, true, "gold-team")).toEqual({
      status: "approved",
      reviewStage: "gold-team",
      submissionStatus: "not-ready",
    });
    expect(deriveReleaseProposalState(false, false, "red-team")).toEqual({
      status: "in-review",
      reviewStage: "red-team",
      submissionStatus: "not-ready",
    });
  });
});
