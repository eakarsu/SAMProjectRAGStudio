import { describe, expect, it } from "vitest";
import { detectedTableRowRecord } from "@/components/procurement-workspaces";

describe("non-AI table record details", () => {
  it("creates a row-specific protected evidence record for detected tables", () => {
    const descriptor = detectedTableRowRecord({
      documentId: "doc-1",
      documentTitle: "Solicitation package",
      tableIndex: 2,
      pageNumber: 7,
      source: "OCR table 3",
      columns: ["Requirement", "Due date"],
      row: ["Submit pricing volume", "2026-09-30"],
      rowIndex: 4,
    });

    expect(descriptor).toMatchObject({
      kind: "detected-table-row",
      id: "doc-1-table-2-row-4",
      title: "Detected table row 5",
      subtitle: "Solicitation package · page 7",
      mutable: false,
      deletable: false,
    });
    expect(descriptor.record).toMatchObject({
      pageNumber: 7,
      source: "OCR table 3",
      rowNumber: 5,
      column_1: "Submit pricing volume",
      column_2: "2026-09-30",
    });
    expect(descriptor.fields.map((field) => field.label)).toEqual([
      "Page",
      "Source",
      "Row",
      "Requirement",
      "Due date",
    ]);
    expect(descriptor.fields.every((field) => field.readOnly)).toBe(true);
  });

  it("keeps duplicate detected-table headings as separate detail fields", () => {
    const descriptor = detectedTableRowRecord({
      documentId: "doc-2",
      documentTitle: "Amendment",
      tableIndex: 0,
      pageNumber: 1,
      source: "native text",
      columns: ["Value", "Value"],
      row: ["first", "second"],
      rowIndex: 0,
    });

    expect(descriptor.record.column_1).toBe("first");
    expect(descriptor.record.column_2).toBe("second");
  });
});
