import React from "react";
import type { EditScene } from "../../prepared-edit/schema.ts";
import { DEFAULT_SCENE_CAMERA_STRENGTH, defaultSnapAt, type SceneCameraMove, type SceneCameraSpec, type SceneCameraStrength } from "../../core/camera.ts";
import * as ops from "../ops/index.ts";
import { NumInput, type useRunner } from "./kit.tsx";

type Runner = ReturnType<typeof useRunner>;

/**
 * The camera choice of one scene card: a move, its strength and, for the snap-zoom, the frame it lands on.
 * A scene that cannot carry a camera (presenter, or a family with its own camera) only says so.
 * On a split scene the move acts on the graphics above the seam only; the row says so.
 */
export const SceneCameraRow: React.FC<{ scene: EditScene; run: Runner }> = ({ scene, run }) => {
  const id = scene.id;
  const camera = scene.camera;
  const refusal = ops.sceneCameraRefusal(scene);
  if (!camera && refusal) return <p className="pk-muted">{refusal}</p>;
  const set = (next: SceneCameraSpec | null) => run(`كاميرا المشهد ${id}`, (m) => ops.setSceneCamera(m, id, next), { coalesce: `scene:${id}:camera` });
  return (
    <div className="sp-row" title={scene.layout === "split" ? ops.CAMERA_TEXT.splitHint : undefined}>
      <label>{ops.CAMERA_TEXT.title}{" "}
        <select
          value={camera?.move ?? ""}
          aria-label={ops.CAMERA_TEXT.title}
          onChange={(e) => {
            const move = e.target.value as SceneCameraMove | "";
            set(move === "" ? null : { move, ...(camera?.strength ? { strength: camera.strength } : {}), ...(move === "snap-zoom" && camera?.at !== undefined ? { at: camera.at } : {}) });
          }}
        >
          <option value="">{ops.CAMERA_TEXT.none}</option>
          {ops.SCENE_CAMERA_OPTIONS.moves.map((move) => <option key={move} value={move}>{ops.CAMERA_MOVE_LABEL[move]}</option>)}
        </select>
      </label>
      {camera ? (
        <label>{ops.CAMERA_TEXT.strength}{" "}
          <select
            value={camera.strength ?? DEFAULT_SCENE_CAMERA_STRENGTH}
            aria-label={ops.CAMERA_TEXT.strength}
            onChange={(e) => set({ ...camera, strength: e.target.value as SceneCameraStrength })}
          >
            {ops.SCENE_CAMERA_OPTIONS.strengths.map((strength) => <option key={strength} value={strength}>{ops.CAMERA_STRENGTH_LABEL[strength]}</option>)}
          </select>
        </label>
      ) : null}
      {camera?.move === "snap-zoom" ? (
        <label title={ops.CAMERA_TEXT.cueHint} dir="ltr">{ops.CAMERA_TEXT.cue}{" "}
          <NumInput
            value={camera.at ?? defaultSnapAt(scene.durationInFrames)}
            min={0}
            max={Math.max(0, scene.durationInFrames - 1)}
            label={ops.CAMERA_TEXT.cue}
            onCommit={(n) => set({ ...camera, at: Math.round(n) }).ok}
          />
        </label>
      ) : null}
    </div>
  );
};
