"use client";

import { useState } from "react";
import { AlertTriangle, Loader2, ShieldPlus, UserCog } from "lucide-react";

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useChangeUserRole } from "@/hooks/use-admin";
import { useToast } from "@/hooks/use-toast";
import { apiErrorMessage } from "@/lib/api-error-message";
import { roleLabel } from "@/lib/enum-labels";
import { useTranslations } from "@/lib/i18n";
import type { AdminAssignableRole } from "@/services/admin.service";

// The user panel's "Role" section: promote an existing account to admin, or
// (SYSTEM_ADMIN only) demote an admin. docs/specs/admin/user-role-change.md.
//
// The server decides; the buttons only mirror it so nobody is offered a change
// that can only 403: an ADMIN may grant ADMIN to a member, a SYSTEM_ADMIN may
// also grant SYSTEM_ADMIN and change an admin's role, and nobody changes their
// own. Refusals the panel cannot predict (a project in progress, money in a
// live round, an unverified email) come back as X-Error-Code and are shown in
// the visitor's language.

const ADMIN_ROLES = ["ADMIN", "SYSTEM_ADMIN"];
const MEMBER_TARGETS: AdminAssignableRole[] = ["ADMIN", "SYSTEM_ADMIN"];
const ADMIN_TARGETS: AdminAssignableRole[] = [
  "SYSTEM_ADMIN",
  "ADMIN",
  "INVESTOR",
  "SME",
];

const ERROR_KEYS: Record<string, string> = {
  USER_NOT_FOUND: "admin.userRole.errors.notFound",
  ROLE_CHANGE_SELF: "admin.userRole.errors.self",
  ROLE_CHANGE_FORBIDDEN: "admin.userRole.errors.forbidden",
  ROLE_UNCHANGED: "admin.userRole.errors.unchanged",
  ROLE_CHANGE_NOT_SUPPORTED: "admin.userRole.errors.notSupported",
  ROLE_CHANGE_SUSPENDED: "admin.userRole.errors.suspended",
  ROLE_CHANGE_EMAIL_UNVERIFIED: "admin.userRole.errors.emailUnverified",
  ROLE_CHANGE_OPEN_PROJECT: "admin.userRole.errors.openProject",
  ROLE_CHANGE_LIVE_INVESTMENT: "admin.userRole.errors.liveInvestment",
  LAST_SYSTEM_ADMIN: "admin.userRole.errors.lastSystemAdmin",
};

/** The roles `myRole` may move an account with `targetRole` to. */
function allowedTargets(
  myRole: string | null | undefined,
  targetRole: string | null | undefined,
): AdminAssignableRole[] {
  const iAmSystemAdmin = myRole === "SYSTEM_ADMIN";
  if (ADMIN_ROLES.includes(targetRole ?? "")) {
    return iAmSystemAdmin
      ? ADMIN_TARGETS.filter((role) => role !== targetRole)
      : [];
  }
  return iAmSystemAdmin ? MEMBER_TARGETS : ["ADMIN"];
}

interface UserRoleSectionProps {
  userId: string;
  email: string;
  displayName: string;
  currentRole: string | null | undefined;
  myRole: string | null | undefined;
  isSelf: boolean;
  onChanged: () => void;
}

export function UserRoleSection({
  userId,
  email,
  displayName,
  currentRole,
  myRole,
  isSelf,
  onChanged,
}: UserRoleSectionProps) {
  const { t, locale } = useTranslations();
  const { toast } = useToast();
  const { mutateAsync: changeRole, isPending } = useChangeUserRole();
  const [choice, setChoice] = useState<AdminAssignableRole | null>(null);
  const [note, setNote] = useState("");

  const targets = allowedTargets(myRole, currentRole);
  const targetIsAdmin = ADMIN_ROLES.includes(currentRole ?? "");
  const blockedReason = isSelf
    ? t("admin.userRole.blockedSelf")
    : targets.length === 0
      ? t("admin.userRole.blockedAdmin")
      : null;

  const promoting = choice !== null && ADMIN_ROLES.includes(choice);
  const leavingConsole = choice !== null && !promoting;
  const external =
    promoting && !email.trim().toLowerCase().endsWith("@fundlok.com");
  const fromLabel = currentRole
    ? roleLabel(t, currentRole)
    : t("admin.userRole.noRole");

  const close = () => {
    if (isPending) return;
    setChoice(null);
    setNote("");
  };

  const handleConfirm = async () => {
    if (!choice) return;
    try {
      await changeRole({
        id: userId,
        body: { role: choice, note: note.trim() || null },
      });
      toast({
        title: t("admin.userRole.changed"),
        description: t("admin.userRole.changedDescription")
          .replace("{name}", displayName)
          .replace("{role}", roleLabel(t, choice)),
      });
      setChoice(null);
      setNote("");
      onChanged();
    } catch (err) {
      const code = (err as { code?: string } | null)?.code;
      const key = code ? ERROR_KEYS[code] : undefined;
      toast({
        variant: "destructive",
        title: t("admin.userRole.failed"),
        description: key
          ? t(key)
          : apiErrorMessage(err, locale, t("common.tryAgain")),
      });
    }
  };

  return (
    <section className="space-y-3">
      <div className="space-y-1">
        <h4 className="text-sm font-semibold text-foreground">
          {t("admin.userRole.heading")}
        </h4>
        <p className="text-xs leading-relaxed text-muted-foreground">
          {targetIsAdmin
            ? t("admin.userRole.adminDescription")
            : t("admin.userRole.memberDescription")}
        </p>
      </div>

      {blockedReason ? (
        <p className="flex items-start gap-2 rounded-xl border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
          <AlertTriangle
            className="mt-px h-4 w-4 shrink-0 text-amber-600"
            aria-hidden
          />
          <span>{blockedReason}</span>
        </p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {targets.map((role) => (
            <Button
              key={role}
              type="button"
              size="sm"
              variant="outline"
              className="flex-auto"
              disabled={isPending}
              onClick={() => setChoice(role)}
            >
              {ADMIN_ROLES.includes(role) ? (
                <ShieldPlus className="mr-2 h-3.5 w-3.5" aria-hidden />
              ) : (
                <UserCog className="mr-2 h-3.5 w-3.5" aria-hidden />
              )}
              {t("admin.userRole.changeTo").replace(
                "{role}",
                roleLabel(t, role),
              )}
            </Button>
          ))}
        </div>
      )}

      <AlertDialog
        open={choice !== null}
        onOpenChange={(open) => {
          if (!open) close();
        }}
      >
        <AlertDialogContent className="sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("admin.userRole.confirmTitle").replace(
                "{role}",
                choice ? roleLabel(t, choice) : "",
              )}
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2 pt-1 text-left">
              <span className="block font-medium text-foreground [overflow-wrap:anywhere]">
                {t("admin.userRole.confirmFromTo")
                  .replace("{email}", email)
                  .replace("{from}", fromLabel)
                  .replace("{to}", choice ? roleLabel(t, choice) : "")}
              </span>
              <span className="block">
                {promoting
                  ? t("admin.userRole.confirmPromote")
                  : t("admin.userRole.confirmDemote")}
              </span>
              {external && (
                <span className="block rounded-lg border border-amber-500/20 bg-amber-500/10 p-3 text-xs leading-relaxed text-amber-900 dark:text-amber-200">
                  {t("admin.userRole.externalWarning").replace(
                    "{email}",
                    email,
                  )}
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>

          <Textarea
            rows={2}
            maxLength={500}
            value={note}
            disabled={isPending}
            placeholder={t("admin.userPreview.notePlaceholder")}
            aria-label={t("admin.userPreview.notePlaceholder")}
            onChange={(event) => setNote(event.target.value)}
          />

          <AlertDialogFooter className="gap-2 sm:gap-2">
            <AlertDialogCancel disabled={isPending}>
              {t("common.cancel")}
            </AlertDialogCancel>
            <Button
              type="button"
              variant={leavingConsole ? "destructive" : "default"}
              disabled={isPending}
              onClick={handleConfirm}
            >
              {isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
              )}
              {isPending
                ? t("admin.userRole.saving")
                : t("admin.userRole.confirmAction")}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
