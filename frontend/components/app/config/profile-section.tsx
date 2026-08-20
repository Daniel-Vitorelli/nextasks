"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";

import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useSession } from "@/components/app/session-provider";

type SaveStatus = "idle" | "saving" | "saved" | "error";

export function ProfileSection() {
  const t = useTranslations("app.config.profile");
  const { user, refetchUser } = useSession() ?? {};
  const router = useRouter();

  // O perfil completo chega assíncrono (via /api/user): o valor exibido
  // deriva do usuário atual, com um "draft" apenas enquanto se edita.
  const [nameDraft, setNameDraft] = useState<string | null>(null);
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [passwordStatus, setPasswordStatus] = useState<SaveStatus>("idle");
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const saveName = async () => {
    if (nameDraft === null) return;
    setStatus("saving");
    try {
      const response = await fetch("/api/user", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: nameDraft }),
      });
      if (!response.ok) throw new Error("Failed to update profile");

      await authClient.updateUser({ name: nameDraft });
      await refetchUser?.();
      setNameDraft(null);
      setStatus("saved");
    } catch {
      setStatus("error");
    }
  };

  const changePassword = async () => {
    setPasswordError(null);
    setPasswordStatus("saving");
    authClient.changePassword(
      { currentPassword, newPassword },
      {
        onSuccess: () => {
          setPasswordStatus("saved");
          setCurrentPassword("");
          setNewPassword("");
        },
        onError: (ctx) => {
          setPasswordStatus("error");
          setPasswordError(ctx.error.message ?? t("changeError"));
        },
      },
    );
  };

  const deleteAccount = async () => {
    setDeleting(true);
    authClient.deleteUser(
      {},
      {
        onSuccess: () => {
          router.push("/");
        },
        onError: () => {
          setDeleting(false);
        },
      },
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
        <CardDescription>{t("description")}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <div className="flex-1 space-y-2">
            <Label htmlFor="profile-name">{t("nameLabel")}</Label>
            <Input
              id="profile-name"
              autoComplete="name"
              value={nameDraft ?? user?.name ?? ""}
              onChange={(event) => {
                setNameDraft(event.target.value);
                if (status !== "idle") setStatus("idle");
              }}
              maxLength={50}
            />
          </div>
          <Button
            type="button"
            onClick={() => void saveName()}
            disabled={
              status === "saving" ||
              nameDraft === null ||
              nameDraft.trim().length === 0
            }
          >
            {status === "saving" ? <Spinner /> : t("save")}
          </Button>
        </div>
        {status === "saved" && (
          <p className="text-sm text-muted-foreground">{t("saved")}</p>
        )}
        {status === "error" && (
          <p className="text-sm text-destructive">{t("saveError")}</p>
        )}

        <div className="flex flex-col gap-2 border-t pt-6">
          <Label>{t("emailLabel")}</Label>
          <p className="text-sm text-muted-foreground">{user?.email}</p>
        </div>

        <div className="flex flex-col gap-2 border-t pt-6">
          <Label htmlFor="profile-current-password">{t("currentPassword")}</Label>
          <Input
            id="profile-current-password"
            type="password"
            autoComplete="current-password"
            value={currentPassword}
            onChange={(event) => {
              setCurrentPassword(event.target.value);
              if (passwordStatus !== "idle") setPasswordStatus("idle");
            }}
          />
          <Label htmlFor="profile-new-password">{t("newPassword")}</Label>
          <Input
            id="profile-new-password"
            type="password"
            autoComplete="new-password"
            value={newPassword}
            onChange={(event) => {
              setNewPassword(event.target.value);
              if (passwordStatus !== "idle") setPasswordStatus("idle");
            }}
          />
          <Button
            type="button"
            variant="outline"
            className="w-fit"
            onClick={() => void changePassword()}
            disabled={
              passwordStatus === "saving" ||
              currentPassword.length === 0 ||
              newPassword.length === 0
            }
          >
            {passwordStatus === "saving" ? <Spinner /> : t("changePassword")}
          </Button>
          {passwordStatus === "saved" && (
            <p className="text-sm text-muted-foreground">{t("passwordChanged")}</p>
          )}
          {passwordStatus === "error" && (
            <p className="text-sm text-destructive">
              {passwordError ?? t("changeError")}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-3 border-t pt-6">
          <p className="font-semibold text-destructive">{t("dangerTitle")}</p>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                type="button"
                variant="outline"
                className="w-fit text-destructive"
              >
                {t("deleteAccount")}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{t("deleteTitle")}</AlertDialogTitle>
                <AlertDialogDescription>
                  {t("deleteDescription")}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-destructive text-white hover:bg-destructive/90"
                  onClick={() => void deleteAccount()}
                  disabled={deleting}
                >
                  {deleting ? <Spinner /> : t("deleteConfirm")}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </CardContent>
    </Card>
  );
}