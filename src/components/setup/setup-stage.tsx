"use client";

import { ErrorPanel } from "@/components/ui/error-panel";
import {
  type BoardCalibration,
  type BoardController,
} from "@/features/board/board-controller";
import type { BoardCorners } from "@/features/board/types";
import type { PersonBox } from "@/features/recording/presenter-tracker";
import type { SetupState } from "@/features/setup/setup-machine";
import { CalibrationStep } from "./calibration-step";
import { MicrophoneStep } from "./microphone-step";
import { OutputPreviewStep } from "./output-preview-step";
import { ReadyStep } from "./ready-step";
import { SetupShell } from "./setup-shell";

interface SetupStageProps {
  setup: SetupState;
  board?: BoardController;
  video?: HTMLVideoElement;
  cameraStream?: MediaStream;
  calibration?: BoardCalibration;
  calibrationStatus: "detecting" | "ready" | "error";
  error?: string;
  starting: boolean;
  onMicrophoneConfirm: (stream: MediaStream) => void;
  onDetectBoard: () => void;
  onCalibrationConfirm: () => void;
  onCornersChange: (corners: BoardCorners) => void;
  onPreviewBack: () => void;
  onPreviewContinue: (presenter?: PersonBox) => void;
  onStart: () => void;
}

export function SetupStage(props: SetupStageProps) {
  return (
    <SetupShell>
      {props.setup.step === "microphone" && (
        <MicrophoneStep onConfirm={props.onMicrophoneConfirm} />
      )}
      {props.setup.step === "calibration" && (
        <>
          {props.error && !props.calibration && (
            <ErrorPanel
              actionLabel="Try detection again"
              message={props.error}
              onAction={props.onDetectBoard}
              title="Board processing needs attention"
            />
          )}
          {props.calibration && (
            <>
              {!props.calibration.autoDetected && (
                <p className="text-muted mb-4 text-sm">
                  No clear rectangle was found. Position the four visible
                  handles manually, then confirm the corrected preview.
                </p>
              )}
              <CalibrationStep
                corners={props.calibration.corners}
                onConfirm={props.onCalibrationConfirm}
                onCornersChange={props.onCornersChange}
                onDetect={props.onDetectBoard}
                rectifiedUrl={props.calibration.rectifiedUrl}
                sourceSize={props.calibration.sourceSize}
                sourceUrl={props.calibration.sourceUrl}
                status={props.calibrationStatus}
              />
            </>
          )}
        </>
      )}
      {props.setup.step === "preview" &&
        props.board &&
        props.video &&
        props.cameraStream &&
        props.calibration && (
          <OutputPreviewStep
            board={props.board}
            cameraUse={props.setup.cameraUse}
            corners={props.calibration.corners}
            onBack={props.onPreviewBack}
            onContinue={props.onPreviewContinue}
            sourceStream={props.cameraStream}
            sourceVideo={props.video}
          />
        )}
      {props.setup.step === "ready" && (
        <ReadyStep
          boardReady={props.setup.calibration === "confirmed"}
          busy={props.starting}
          cameraReady={props.setup.camera === "ready"}
          error={props.error}
          microphoneReady={props.setup.microphone === "confirmed"}
          onStart={props.onStart}
          openAiReady={props.setup.openai === "ready"}
        />
      )}
    </SetupShell>
  );
}
