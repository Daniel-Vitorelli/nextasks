"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import Image from "next/image";

import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ImageCrop,
  ImageCropApply,
  ImageCropContent,
} from "@/components/ui/image-crop";
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

const MAX_AVATAR_FILE_BYTES = 10 * 1024 * 1024;

function initialsOf(name?: string): string {
  if (!name) return "";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

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
  const [imageStatus, setImageStatus] = useState<SaveStatus>("idle");
  const [imageError, setImageError] = useState<string | null>(null);
  const [pendingAvatarFile, setPendingAvatarFile] = useState<File | null>(null);
  const [croppedImage, setCroppedImage] = useState<string | null>(null);
  const avatarInputRef = useRef<HTMLInputElement | null>(null);

  const saveAvatar = async (image: string | null) => {
    setImageStatus("saving");
    try {
      const response = await fetch("/api/user", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image }),
      });
      if (!response.ok) throw new Error("Failed to update avatar");

      await refetchUser?.();
      setImageStatus("saved");
    } catch {
      setImageStatus("error");
    }
  };

  const handleAvatarFileSelected = (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    setImageError(null);
    if (!file) return;
    if (file.size > MAX_AVATAR_FILE_BYTES) {
      setImageError(t("avatarFileTooLarge"));
      return;
    }
    setPendingAvatarFile(file);
    setCroppedImage(null);
  };

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
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full border bg-muted">
            {user?.image ? (
              <Image
                alt="avatar"
                className="size-full object-cover"
                height={80}
                src={user.image}
                unoptimized
                width={80}
              />
            ) : (
              <span className="text-lg font-semibold text-muted-foreground">
                {initialsOf(user?.name) || "?"}
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={avatarInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleAvatarFileSelected}
            />
            <Button
              type="button"
              variant="outline"
              onClick={() => avatarInputRef.current?.click()}
              disabled={imageStatus === "saving"}
            >
              {imageStatus === "saving" ? <Spinner /> : t("avatarChange")}
            </Button>
            {user?.image && (
              <Button
                type="button"
                variant="ghost"
                onClick={() => void saveAvatar(null)}
                disabled={imageStatus === "saving"}
              >
                {t("avatarRemove")}
              </Button>
            )}
          </div>
          {imageStatus === "saved" && (
            <p className="text-sm text-muted-foreground">{t("saved")}</p>
          )}
          {imageStatus === "error" && (
            <p className="text-sm text-destructive">{t("saveError")}</p>
          )}
          {imageError && (
            <p className="text-sm text-destructive">{imageError}</p>
          )}
        </div>

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

      <Dialog
        open={pendingAvatarFile !== null && croppedImage === null}
        onOpenChange={(open) => {
          if (!open) {
            setPendingAvatarFile(null);
            setCroppedImage(null);
          }
        }}
      >
        {pendingAvatarFile && (
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{t("avatarDialogTitle")}</DialogTitle>
              <DialogDescription>
                {t("avatarDialogDescription")}
              </DialogDescription>
            </DialogHeader>
            <ImageCrop
              aspect={1}
              circularCrop
              file={pendingAvatarFile}
              maxImageSize={1024 * 1024}
              onCrop={(data) => {
                setCroppedImage(data);
                setPendingAvatarFile(null);
                void saveAvatar(data);
              }}
            >
              <ImageCropContent className="max-w-full" />
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setPendingAvatarFile(null);
                    setCroppedImage(null);
                  }}
                >
                  {t("cancel")}
                </Button>
                <ImageCropApply asChild>
                  <Button type="button">{t("avatarApply")}</Button>
                </ImageCropApply>
              </DialogFooter>
            </ImageCrop>
          </DialogContent>
        )}
      </Dialog>
    </Card>
  );
}