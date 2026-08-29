export type RecordEditRole = "contributor" | "admin";

const ROLE_POWER: Readonly<Record<string, number>> = {
  viewer: 0,
  reviewer: 1,
  contributor: 2,
  "capture-manager": 3,
  "proposal-manager": 3,
  admin: 4,
  owner: 5,
};

export function resolveRecordActionAccess({
  currentRole,
  mutable,
  deletable,
  updateUrl,
  deleteUrl,
  editRole = "contributor",
}: {
  currentRole: string;
  mutable?: boolean;
  deletable?: boolean;
  updateUrl?: string;
  deleteUrl?: string;
  editRole?: RecordEditRole;
}) {
  const actorPower = ROLE_POWER[currentRole] ?? 0;
  const canEditByRole = actorPower >= (editRole === "admin" ? 4 : 2);
  const canDeleteByRole = actorPower >= 4;

  return {
    canEdit: Boolean(mutable && updateUrl && canEditByRole),
    canDelete: Boolean(deletable && deleteUrl && canDeleteByRole),
    roleReason:
      mutable && !canEditByRole
        ? editRole === "admin"
          ? "Editing this record requires the admin role or higher."
          : "Editing this record requires the contributor role or higher."
        : deletable && !canDeleteByRole
          ? "Deleting or archiving records requires the admin role or higher."
          : null,
  };
}
