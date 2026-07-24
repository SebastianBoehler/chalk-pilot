"use client";

import { Button } from "@/components/ui/button";
import type { CameraUse } from "@/features/setup/camera-use";
import { CameraStep } from "./camera-step";
import { SetupShell } from "./setup-shell";

interface CameraSetupStageProps {
  cameraReady: boolean;
  enabled: boolean;
  presenterTracking: boolean;
  visible: boolean;
  onContinue: () => void;
  onPresenterTrackingChange: (enabled: boolean) => void;
  onReady: (video: HTMLVideoElement, stream: MediaStream) => void;
}

export function CameraSetupStage({
  cameraReady,
  enabled,
  presenterTracking,
  visible,
  onContinue,
  onPresenterTrackingChange,
  onReady,
}: CameraSetupStageProps) {
  if (!enabled) return null;
  return (
    <div
      aria-hidden={!visible}
      className={
        visible
          ? ""
          : "pointer-events-none fixed inset-0 -z-10 size-px overflow-hidden opacity-0"
      }
    >
      <SetupShell>
        <CameraStep
          onPresenterTrackingChange={onPresenterTrackingChange}
          onReady={onReady}
          presenterTracking={presenterTracking}
        />
        {cameraReady && (
          <Button className="mt-6" onClick={onContinue} type="button">
            Continue
          </Button>
        )}
      </SetupShell>
    </div>
  );
}

export function cameraUseForTracking(enabled: boolean): CameraUse {
  return enabled ? "room-wide" : "board-focused";
}
