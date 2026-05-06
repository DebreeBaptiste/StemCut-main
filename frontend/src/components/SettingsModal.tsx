"use client";

import { useEffect, useState } from "react";
import {
  X,
  FolderOpen,
  FolderSearch,
  RotateCw,
  Check,
  AlertCircle,
  HardDrive,
} from "lucide-react";

declare global {
  interface Window {
    electronAPI?: {
      getStorageDir: () => Promise<string>;
      chooseStorageDir: () => Promise<
        { newDir: string; oldDir: string } | string | null
      >;
      openPath: (p: string) => Promise<void>;
      saveDownload?: (base64Data: string, filename: string) => Promise<string>;
      getDownloadsDir?: () => Promise<string>;
      migrateStorageData?: (
        fromDir: string,
        toDir: string,
      ) => Promise<{ movedJobs: number; source: string; target: string }>;
    };
  }
}

interface Props {
  open: boolean;
  onClose: () => void;
}

type Status = "idle" | "loading" | "success" | "error";
type MigrateStatus = "idle" | "loading" | "success" | "error";

export default function SettingsModal({ open, onClose }: Props) {
  const [storageDir, setStorageDir] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [migrateStatus, setMigrateStatus] = useState<MigrateStatus>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [migrateMsg, setMigrateMsg] = useState("");
  const [previousStorageDir, setPreviousStorageDir] = useState("");
  const isElectron = typeof window !== "undefined" && !!window.electronAPI;

  useEffect(() => {
    if (open && isElectron) {
      window.electronAPI!.getStorageDir().then(setStorageDir);
    }
  }, [open, isElectron]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  async function handleChooseDir() {
    if (!window.electronAPI) return;
    setStatus("loading");
    setErrorMsg("");
    try {
      const result = await window.electronAPI.chooseStorageDir();
      if (result) {
        if (typeof result === "string") {
          setPreviousStorageDir(storageDir);
          setStorageDir(result);
          setMigrateStatus("idle");
          setMigrateMsg("");
        } else {
          setPreviousStorageDir(result.oldDir);
          setStorageDir(result.newDir);
          setMigrateStatus("idle");
          setMigrateMsg("");
        }
        setStatus("success");
        setTimeout(() => setStatus("idle"), 3000);
      } else {
        setStatus("idle");
      }
    } catch (e) {
      setErrorMsg((e as Error).message || "Erreur inconnue");
      setStatus("error");
    }
  }

  async function handleOpenDir() {
    if (!window.electronAPI || !storageDir) return;
    await window.electronAPI.openPath(storageDir);
  }

  async function handleMigrateData() {
    if (!window.electronAPI?.migrateStorageData) return;
    if (!previousStorageDir || !storageDir || previousStorageDir === storageDir)
      return;

    setMigrateStatus("loading");
    setErrorMsg("");
    setMigrateMsg("");
    try {
      const result = await window.electronAPI.migrateStorageData(
        previousStorageDir,
        storageDir,
      );
      setMigrateStatus("success");
      setMigrateMsg(
        `${result.movedJobs} projet(s) migre(s). Dossier source conserve.`,
      );
    } catch (e) {
      setMigrateStatus("error");
      setErrorMsg((e as Error).message || "Erreur de migration");
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[9998] flex items-center justify-center p-4">
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal card */}
      <div
        className="relative z-10 w-full max-w-[460px] rounded-2xl overflow-hidden shadow-2xl"
        style={{ border: "1px solid rgba(255,255,255,0.06)" }}
      >
        {/* Gradient accent strip */}
        <div
          className="h-[3px] w-full"
          style={{
            background: "linear-gradient(90deg, #7c3aed, #d946ef, #7c3aed)",
          }}
        />

        {/* Header */}
        <div
          className="px-6 pt-5 pb-4 flex items-start justify-between"
          style={{ background: "#111118" }}
        >
          <div>
            <h2 className="text-white font-semibold text-base tracking-tight">
              Paramètres
            </h2>
            <p className="text-gray-500 text-xs mt-0.5">StemCut v1.4.0</p>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-500 hover:text-white transition-all mt-0.5"
            style={{ background: "rgba(255,255,255,0.05)" }}
          >
            <X size={14} />
          </button>
        </div>

        {/* Divider */}
        <div style={{ height: "1px", background: "#1e1e2e" }} />

        {/* Content */}
        <div className="px-6 py-5 space-y-6" style={{ background: "#0d0d16" }}>
          {/* Storage section */}
          <div>
            <div className="flex items-center gap-2.5 mb-3">
              <div
                className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                style={{
                  background: "linear-gradient(135deg, #7c3aed33, #d946ef22)",
                  border: "1px solid #7c3aed55",
                }}
              >
                <HardDrive size={14} className="text-violet-400" />
              </div>
              <div>
                <p className="text-white text-sm font-medium leading-none">
                  Répertoire de stockage
                </p>
                <p className="text-gray-600 text-xs mt-1">
                  Musiques et stems extraits
                </p>
              </div>
            </div>

            {/* Path display */}
            <div
              className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl mb-3"
              style={{ background: "#0a0a12", border: "1px solid #1e1e2e" }}
            >
              <FolderSearch size={13} className="text-violet-500 shrink-0" />
              <span
                className="text-gray-400 text-xs font-mono truncate flex-1 select-text"
                title={storageDir}
                dir="ltr"
              >
                {storageDir || "—"}
              </span>
            </div>

            {/* Action buttons */}
            <div className="flex gap-2">
              <button
                onClick={handleChooseDir}
                disabled={status === "loading" || !isElectron}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed flex-1 justify-center"
                style={{
                  background:
                    status === "success"
                      ? "linear-gradient(135deg, #16a34a, #15803d)"
                      : "linear-gradient(135deg, #7c3aed, #d946ef)",
                  boxShadow:
                    status === "success"
                      ? "0 0 20px rgba(22,163,74,0.25)"
                      : "0 0 20px rgba(124,58,237,0.25)",
                }}
              >
                {status === "loading" ? (
                  <>
                    <RotateCw size={13} className="animate-spin" />
                    Redémarrage...
                  </>
                ) : status === "success" ? (
                  <>
                    <Check size={13} />
                    Enregistré !
                  </>
                ) : (
                  <>
                    <FolderOpen size={13} />
                    Changer le dossier
                  </>
                )}
              </button>

              <button
                onClick={handleOpenDir}
                disabled={!storageDir || !isElectron}
                className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs text-gray-400 hover:text-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                style={{ border: "1px solid #1e1e2e" }}
                title="Ouvrir dans l'explorateur"
              >
                <FolderSearch size={13} />
                Ouvrir
              </button>
            </div>

            {/* Restart hint */}
            {status === "idle" && (
              <p className="text-gray-600 text-xs mt-2.5 flex items-center gap-1.5">
                <RotateCw size={10} />
                Changer le dossier affectera uniquement les nouveaux fichiers.
              </p>
            )}

            {previousStorageDir && previousStorageDir !== storageDir && (
              <div className="mt-3">
                <button
                  onClick={handleMigrateData}
                  disabled={migrateStatus === "loading" || !isElectron}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{
                    background:
                      migrateStatus === "success"
                        ? "linear-gradient(135deg, #16a34a, #15803d)"
                        : "linear-gradient(135deg, #2563eb, #1d4ed8)",
                  }}
                >
                  {migrateStatus === "loading" ? (
                    <>
                      <RotateCw size={13} className="animate-spin" />
                      Migration en cours...
                    </>
                  ) : migrateStatus === "success" ? (
                    <>
                      <Check size={13} />
                      Migration terminee
                    </>
                  ) : (
                    <>
                      <FolderOpen size={13} />
                      Migrer les anciens fichiers
                    </>
                  )}
                </button>
                <p className="text-gray-600 text-xs mt-2">
                  Copie manuelle depuis: {previousStorageDir}
                </p>
                {migrateMsg && (
                  <p className="text-green-400 text-xs mt-1">{migrateMsg}</p>
                )}
              </div>
            )}

            {/* Error */}
            {(status === "error" || migrateStatus === "error") && (
              <div
                className="flex items-center gap-2 mt-3 px-3 py-2 rounded-lg"
                style={{
                  background: "rgba(239,68,68,0.08)",
                  border: "1px solid rgba(239,68,68,0.2)",
                }}
              >
                <AlertCircle size={12} className="text-red-400 shrink-0" />
                <span className="text-red-300 text-xs">{errorMsg}</span>
              </div>
            )}
          </div>

          {/* Non-Electron warning */}
          {!isElectron && (
            <div
              className="flex items-center gap-2 px-3 py-2 rounded-lg"
              style={{
                background: "rgba(245,158,11,0.08)",
                border: "1px solid rgba(245,158,11,0.2)",
              }}
            >
              <AlertCircle size={12} className="text-amber-400 shrink-0" />
              <span className="text-amber-300 text-xs">
                Disponible uniquement dans l&apos;application desktop.
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
