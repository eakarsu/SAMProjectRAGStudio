import { describe, expect, it } from "vitest";
import { resolveRecordActionAccess } from "@/lib/record-permissions";

const editable = {
  mutable: true,
  deletable: true,
  updateUrl: "/api/records/project/1",
  deleteUrl: "/api/records/project/1",
};

describe("record action permissions", () => {
  it("lets contributors edit while keeping deletion admin-only", () => {
    expect(
      resolveRecordActionAccess({ currentRole: "contributor", ...editable }),
    ).toEqual({
      canEdit: true,
      canDelete: false,
      roleReason: "Deleting or archiving records requires the admin role or higher.",
    });
  });

  it("lets admins and owners edit and delete", () => {
    for (const currentRole of ["admin", "owner"]) {
      expect(
        resolveRecordActionAccess({ currentRole, ...editable }),
      ).toMatchObject({ canEdit: true, canDelete: true, roleReason: null });
    }
  });

  it("keeps member administration restricted to admins", () => {
    expect(
      resolveRecordActionAccess({
        currentRole: "contributor",
        editRole: "admin",
        ...editable,
      }),
    ).toMatchObject({
      canEdit: false,
      canDelete: false,
      roleReason: "Editing this record requires the admin role or higher.",
    });
  });

  it("never enables actions without an explicit endpoint", () => {
    expect(
      resolveRecordActionAccess({
        currentRole: "owner",
        mutable: true,
        deletable: true,
      }),
    ).toMatchObject({ canEdit: false, canDelete: false });
  });
});
