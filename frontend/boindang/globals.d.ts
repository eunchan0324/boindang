interface MediaTrackCapabilities {
  zoom?: {
    max: number;
    min: number;
    step: number;
  };
  // 다른 필요한 capability들도 여기에 추가할 수 있습니다.
}

interface MediaTrackSettings {
  zoom?: number;
  // 다른 필요한 setting들도 여기에 추가할 수 있습니다.
}

interface MediaTrackConstraintSet {
  zoom?: ConstrainDouble;
}

declare class ImageCapture {
  constructor(videoTrack: MediaStreamTrack);
  takePhoto(photoSettings?: PhotoSettings): Promise<Blob>;
  getPhotoCapabilities(): Promise<PhotoCapabilities>;
  getPhotoSettings(): Promise<PhotoSettings>;
  grabFrame(): Promise<ImageBitmap>;
  readonly track: MediaStreamTrack;
}

interface PhotoCapabilities {
  imageHeight: MediaSettingsRange;
  imageWidth: MediaSettingsRange;
  fillLightMode: FillLightMode[];
  redEyeReduction: RedEyeReduction;
}

interface PhotoSettings {
  fillLightMode?: FillLightMode;
  imageHeight?: number;
  imageWidth?: number;
  redEyeReduction?: boolean;
}

interface MediaSettingsRange {
  max: number;
  min: number;
  step: number;
}

type FillLightMode = "auto" | "off" | "flash";
type RedEyeReduction = "never" | "always" | "controllable";

// MediaStreamTrack.applyConstraints()가 advanced 속성을 받을 수 있도록 확장
interface MediaTrackConstraints extends MediaTrackConstraintSet {
  advanced?: MediaTrackConstraintSet[];
} 