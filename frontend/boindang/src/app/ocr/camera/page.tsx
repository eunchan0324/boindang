"use client";

import { useState, useEffect, useRef, ChangeEvent, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { X, Image as ImageIcon, ListBullets, Lightbulb, ChartBar, ArrowCounterClockwise, Check, ArrowRight } from '@phosphor-icons/react';
import { postOcrAnalysis } from '@/api/ocr'; // 경로 확인 필요, @/api/ocr.ts 가정
import { getPresignedUrl } from '@/api/image';
import OcrProcessingScreen from '../components/OcrProcessingScreen'; // 새로 만든 컴포넌트 import
import { usePreventSwipeBack } from '@/hooks/usePreventSwipeBack'; // 커스텀 훅 import
import { ApiResponse } from '@/types/api';
import { PhotoStep, OcrResponseData } from '@/types/api/ocrCameraTypes';

// 각 단계별 가이드 메시지 정의
const guideMessages = {
  ingredient: {
    title: "원재료명 및 함량 (1/2)",
    main: "제품 뒷면의 '원재료명 및 함량' 부분을 모든 내용이 빠짐없이 나오도록 화면에 맞춰 촬영해주세요.",
    sub: [
      "글자가 선명하도록 빛 반사를 피해주세요",
      "원재료 전체를 프레임 안에 담아주세요."
    ]
  },
  nutritionInfo: {
    title: "영양 정보표 (2/2)",
    main: "제품의 '영양정보표' 전체가\n빠짐없이 나오도록 화면에 맞춰 촬영해주세요.",
    sub: [
      "글자가 선명하도록 빛 반사를 피해주세요.",
      "영양정보표 전체를 프레임 안에 담아주세요."
    ]
  }
};

// Helper to stop a stream
const stopMediaStream = (mediaStream: MediaStream | null) => {
  if (mediaStream) {
    mediaStream.getTracks().forEach(track => track.stop());
  }
};

// Base64 문자열을 Blob 객체로 변환하는 헬퍼 함수
async function base64ToBlob(base64: string, fileType: string): Promise<Blob> {
  const byteString = atob(base64.split(',')[1]);
  const ab = new ArrayBuffer(byteString.length);
  const ia = new Uint8Array(ab);
  for (let i = 0; i < byteString.length; i++) {
    ia[i] = byteString.charCodeAt(i);
  }
  return new Blob([ab], { type: fileType });
}

// 이미지를 S3에 업로드하고 CloudFront URL을 반환하는 함수
async function uploadImageAndGetCloudFrontUrl(base64Data: string, fileType: string, fileName: string): Promise<string> {
  if (!base64Data.startsWith('data:')) {
    console.warn("uploadImageAndGetCloudFrontUrl: base64Data가 data URI 형식이 아닙니다. 그대로 반환 시도:", base64Data.substring(0, 100));
    throw new Error("잘못된 형식의 이미지 데이터입니다 (Data URI 필요).");
  }

  // 1. Pre-signed URL 요청
  const presignedUrlResponse = await getPresignedUrl(fileType, fileName);
  console.log('[OCR Camera] Received presignedUrlResponse:', JSON.stringify(presignedUrlResponse, null, 2));

  // presignedUrlResponse.data가 존재하고, 그 안의 presignedUrl이 유효한 문자열인지 확인
  if (!presignedUrlResponse.success || !presignedUrlResponse.data || typeof presignedUrlResponse.data.presignedUrl !== 'string') {
    console.error('[OCR Camera] Failed to get valid pre-signed URL data. Response:', presignedUrlResponse);
    throw new Error(presignedUrlResponse.error || 'Pre-signed URL을 받아오는데 실패했습니다 (데이터가 없거나 presignedUrl이 유효하지 않음).');
  }
  // s3PresignedUrl에는 실제 S3 업로드 URL을 할당
  const s3PresignedUrl = presignedUrlResponse.data.presignedUrl;
  // objectKey는 API 응답에서 직접 가져옴
  const objectKey = presignedUrlResponse.data.fileKey;

  console.log('[OCR Camera] Using S3 Pre-signed URL for fetch:', s3PresignedUrl);
  console.log('[OCR Camera] Using Object Key for CloudFront URL:', objectKey);

  // 2. Base64를 Blob으로 변환
  const imageBlob = await base64ToBlob(base64Data, fileType);

  // 3. S3로 직접 업로드 (PUT 요청)
  const uploadResponse = await fetch(s3PresignedUrl, {
    method: 'PUT',
    headers: {
      'Content-Type': fileType,
    },
    body: imageBlob,
  });

  if (!uploadResponse.ok) {
    const errorText = await uploadResponse.text();
    console.error("S3 업로드 실패 응답:", errorText);
    throw new Error(`이미지 업로드에 실패했습니다 (S3). 상태: ${uploadResponse.status}`);
  }

  // 4. CloudFront URL 구성
  // 이전: s3PresignedUrl에서 objectKey 추출
  // const urlObject = new URL(s3PresignedUrl);
  // const objectKey = urlObject.pathname.startsWith('/') ? urlObject.pathname.substring(1) : urlObject.pathname;

  // 변경: API 응답에서 받은 fileKey를 사용
  const cloudFrontUrl = `https://d1d5plumlg2gxc.cloudfront.net/${objectKey}`;

  console.log(`이미지 업로드 성공: ${cloudFrontUrl}`);
  return cloudFrontUrl;
}

export default function OcrCameraPage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const guideTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null); // 캡처용 캔버스 참조
  const router = useRouter(); // useRouter 훅 사용
  const cameraPageContainerRef = useRef<HTMLDivElement>(null); // 스와이프 방지 및 높이 조절용 ref

  usePreventSwipeBack(cameraPageContainerRef, { edgeThreshold: 30 }); // 훅 사용

  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isGuideVisible, setIsGuideVisible] = useState(true);

  // 새로운 상태 추가
  const [currentPhotoStep, setCurrentPhotoStep] = useState<PhotoStep>('ingredient');
  const [ingredientPhoto, setIngredientPhoto] = useState<string | null>(null); // 이미지 데이터 URL 저장
  const [nutritionPhoto, setNutritionPhoto] = useState<string | null>(null); // 이미지 데이터 URL 저장
  const [isProcessing, setIsProcessing] = useState(false); // 처리 중 상태

  // 새로운 상태 추가 (미리보기 기능용)
  const [previewImageSrc, setPreviewImageSrc] = useState<string | null>(null);
  const [showPreviewScreen, setShowPreviewScreen] = useState(false);

  // 줌 기능 관련 상태
  const [zoomCapabilities, setZoomCapabilities] = useState<MediaTrackCapabilities['zoom'] | null>(null);
  const [currentZoom, setCurrentZoom] = useState<number>(1);
  const imageCaptureRef = useRef<ImageCapture | null>(null); // ImageCapture 참조

  // Ref to track if the initial camera setup and guide display has occurred
  const isInitialCameraSetupDone = useRef(false);
  const isStreamBeingInitialized = useRef(false); // Flag to prevent re-entrant calls

  // 높이 동적 조절 및 Body 스크롤 방지를 위한 useEffect
  useEffect(() => {
    document.body.classList.add('ocr-camera-active');

    const setVisualViewportHeight = () => {
      if (cameraPageContainerRef.current) {
        // cameraPageContainerRef.current.style.height = `${window.innerHeight}px`;
        if (window.visualViewport) {
          cameraPageContainerRef.current.style.height = `${window.visualViewport.height}px`;
        } else {
          cameraPageContainerRef.current.style.height = `${window.innerHeight}px`;
        }
      }
    };

    setVisualViewportHeight();
    const resizeTarget = window.visualViewport || window;
    resizeTarget.addEventListener('resize', setVisualViewportHeight);

    return () => {
      document.body.classList.remove('ocr-camera-active');
      resizeTarget.removeEventListener('resize', setVisualViewportHeight);
    };
  }, []); // 의존성 배열은 비워둡니다.

  const showGuideTemporarily = useCallback(() => {
    if (guideTimeoutRef.current) {
      clearTimeout(guideTimeoutRef.current);
    }
    setIsGuideVisible(true);
    guideTimeoutRef.current = setTimeout(() => {
      setIsGuideVisible(false);
    }, 3000);
  }, [setIsGuideVisible, guideTimeoutRef]);

  const getCameraStream = useCallback(async () => {
    if (isStreamBeingInitialized.current) {
      console.log("[Camera] Stream initialization already in progress. Skipping.");
      return;
    }
    console.log("[Camera] Attempting to get camera stream...");
    isStreamBeingInitialized.current = true;

    // Stop any existing stream before starting a new one
    if (videoRef.current && videoRef.current.srcObject) {
      console.log("[Camera] Stopping existing stream on videoRef.");
      stopMediaStream(videoRef.current.srcObject as MediaStream);
      videoRef.current.srcObject = null;
    }
    if (stream) {
      console.log("[Camera] Stopping existing stream from component state before new attempt.");
      stopMediaStream(stream);
      setStream(null);
      if (imageCaptureRef.current) {
        imageCaptureRef.current = null;
      }
    }

    try {
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: 'environment',
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          // 추가적인 고급 제어 옵션 (지원 여부 확인 필요)
          // zoom: currentZoom, // 초기 줌 값 설정 시도 (applyConstraints로 하는 것이 일반적)
        },
        audio: false
      };
      console.log("[Camera] Requesting user media with constraints:", constraints);
      const newStream = await navigator.mediaDevices.getUserMedia(constraints);
      console.log("[Camera] Got new stream:", newStream);
      setStream(newStream);

      const videoTrack = newStream.getVideoTracks()[0];
      if (videoTrack) {
        // ImageCapture API 인스턴스 생성
        if (typeof ImageCapture !== 'undefined') {
          imageCaptureRef.current = new ImageCapture(videoTrack);
          console.log("[Camera] ImageCapture initialized.");

          // 카메라 기능 확인 (줌 포함)
          const capabilities = videoTrack.getCapabilities();
          console.log("[Camera] Track Capabilities:", capabilities);
          if (capabilities.zoom) {
            setZoomCapabilities(capabilities.zoom);
            // 현재 줌 값 가져오기 (getSettings 사용)
            const settings = videoTrack.getSettings();
            if (settings.zoom) {
              setCurrentZoom(settings.zoom);
              console.log("[Camera] Initial zoom set from settings:", settings.zoom);
            } else {
              // capabilities.zoom.min이 존재하면 그 값으로, 아니면 1로 초기화
              const initialZoom = capabilities.zoom.min !== undefined ? capabilities.zoom.min : 1;
              setCurrentZoom(initialZoom);
              console.log("[Camera] Initial zoom set to min capability or 1:", initialZoom);
              // 필요하다면 applyConstraints로 초기 줌 설정
              // await videoTrack.applyConstraints({ advanced: [{ zoom: initialZoom }] });
            }
          } else {
            setZoomCapabilities(null);
            console.log("[Camera] Zoom not supported by this track.");
          }
        } else {
          console.warn("[Camera] ImageCapture API is not supported in this browser.");
        }
      }

      if (videoRef.current) {
        videoRef.current.srcObject = newStream;
        console.log("[Camera] Stream assigned to video element. videoRef.current.videoWidth:", videoRef.current.videoWidth);
        videoRef.current.onloadedmetadata = () => {
          console.log("[Camera] Video metadata loaded. Width:", videoRef.current?.videoWidth, "Height:", videoRef.current?.videoHeight);
        };
        videoRef.current.onplaying = () => {
          console.log("[Camera] Video started playing.");
        };
      } else {
        console.warn("[Camera] videoRef.current is null when trying to assign stream.");
      }
      setError(null);
    } catch (err) {
      console.error("[Camera] Error getting rear camera:", err);
      try {
        console.log("[Camera] Rear camera failed, trying front camera...");
        const frontConstraints: MediaStreamConstraints = { video: { facingMode: 'user' }, audio: false };
        const frontStream = await navigator.mediaDevices.getUserMedia(frontConstraints);
        console.log("[Camera] Got front stream:", frontStream);
        setStream(frontStream);
        if (videoRef.current) {
          videoRef.current.srcObject = frontStream;
          console.log("[Camera] Front stream assigned to video element.");
        }
        setError(null);
      } catch (frontErr) {
        console.error("[Camera] Error getting front camera:", frontErr);
        setStream(null);
      }
    } finally {
      isStreamBeingInitialized.current = false;
      console.log("[Camera] Stream initialization finished.");
    }
  }, [setStream, setError, stream]);

  // Effect for Meta Tags (runs once on mount and unmount)
  useEffect(() => {
    const setMetaTag = (name: string, content: string): string | null => {
      let metaTag = document.querySelector<HTMLMetaElement>(`meta[name="${name}"]`);
      let originalContent: string | null = null;

      if (metaTag) {
        originalContent = metaTag.getAttribute('content');
        metaTag.setAttribute('content', content);
      } else {
        metaTag = document.createElement('meta');
        metaTag.name = name;
        metaTag.content = content;
        document.head.appendChild(metaTag);
      }
      return originalContent;
    };

    const originalStatusBarStyle = setMetaTag('apple-mobile-web-app-status-bar-style', 'black');
    const originalThemeColor = setMetaTag('theme-color', '#000000');

    return () => {
      if (originalStatusBarStyle !== null) setMetaTag('apple-mobile-web-app-status-bar-style', originalStatusBarStyle);
      if (originalThemeColor !== null) setMetaTag('theme-color', originalThemeColor);
    };
  }, []); // Empty dependency array ensures this runs only on mount and unmount

  // Effect for Camera Stream and Guide UI
  useEffect(() => {
    if (!isInitialCameraSetupDone.current) {
      showGuideTemporarily();
      isInitialCameraSetupDone.current = true;
    }

    // Only attempt to get the stream if it's not already set
    // or if there was an error and we want to allow a retry implicitly by this effect re-running due to other deps.
    // However, for now, we'll rely on explicit retries (e.g., a button) or a more robust error recovery strategy.
    if (!stream && !error) { // Check for stream and no existing error
      getCameraStream();
    }

    // Cleanup for stream and guide timeout
    const currentGuideTimeoutRef = guideTimeoutRef.current;

    return () => {
      console.log("[Camera] Cleanup effect for stream/guide running.");
      // Stop the stream ONLY if the component is unmounting or stream source is truly changing.
      // If this cleanup runs too aggressively, it might stop the stream prematurely.
      // The stream from the `stream` state should be the source of truth for active stream.
      if (stream) { // Check the state variable `stream`
        // This condition needs to be more nuanced. When does this cleanup *need* to stop the stream?
        // Typically on unmount, or if getCameraStream is about to fetch a *different* stream.
        // For now, let's assume this cleanup is primarily for unmount or when `stream` itself becomes null.
        console.log("[Camera] Cleanup: Stopping stream from state as part of effect cleanup.");
        stopMediaStream(stream);
        // setStream(null); // Avoid setting state in cleanup if it causes loops or issues.
      }

      if (currentGuideTimeoutRef) {
        console.log("[Camera] Cleanup: Clearing guide timeout.");
        clearTimeout(currentGuideTimeoutRef);
      }
    };
    // Dependencies: `getCameraStream` (now more stable), `stream` (to react to its changes for cleanup or re-init), and `error` (to re-attempt if error clears)
  }, [getCameraStream, stream, error, showGuideTemporarily]);

  const handleAlbumClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const imageDataUrl = e.target?.result as string;
        setPreviewImageSrc(imageDataUrl);
        setShowPreviewScreen(true);
        setIsGuideVisible(false);
      };
      reader.readAsDataURL(file);

      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // 'X' 버튼 클릭 핸들러 (뒤로 가기)
  const handleCloseClick = () => {
    router.push('/');
  };

  const handleShowGuide = () => {
    setIsGuideVisible(true);
  };

  const processAndNavigate = async (newlySetNutritionPhoto?: string) => {
    console.log("[ProcessAndNavigate] Function START. Current state:", { ingredientPhoto, nutritionPhoto, newlySetNutritionPhoto }); // 추가된 로그 1

    const currentIngredientPhotoBase64 = ingredientPhoto;
    const finalNutritionPhotoBase64 = newlySetNutritionPhoto || nutritionPhoto;

    if (!currentIngredientPhotoBase64 || !finalNutritionPhotoBase64) {
      const errMessage = "원재료 및 영양 정보 사진이 모두 필요합니다.";
      setError(errMessage);
      console.error("[ProcessAndNavigate] Missing photos. Setting state to error."); // 추가된 로그
      localStorage.setItem('ocrAnalysisState', 'error');
      localStorage.setItem('ocrAnalysisMessage', errMessage);
      localStorage.removeItem('ocrResultId');
      localStorage.removeItem('ocrUserNavigatedHome');

      setCurrentPhotoStep('ingredient');
      setIngredientPhoto(null);
      setNutritionPhoto(null);
      setIsGuideVisible(true);
      setIsProcessing(false);
      return;
    }

    setIsProcessing(true);
    setError(null);
    // 분석 시작 시 processing 상태로 설정
    console.log("[ProcessAndNavigate] Setting localStorage to PROCESSING."); // 추가된 로그 2
    localStorage.setItem('ocrAnalysisState', 'processing');
    localStorage.setItem('ocrAnalysisMessage', '성분 분석을 위해 이미지를 처리 중입니다...');
    localStorage.removeItem('ocrResultId'); // 이전 결과 ID 제거
    localStorage.removeItem('ocrResultIdForToast'); // 관련 플래그 정리


    try {
      const ingredientFileType = 'image/jpeg';
      const nutritionFileType = 'image/jpeg';
      const ingredientFileName = `ingredient-${Date.now()}.jpg`;
      const nutritionFileName = `nutrition-${Date.now() + 1}.jpg`;

      console.log("원재료 이미지 업로드 시작...");
      // currentIngredientPhotoBase64와 finalNutritionPhotoBase64는 위의 null 체크로 인해 string임이 보장됨
      const ingredientCloudFrontUrl = await uploadImageAndGetCloudFrontUrl(currentIngredientPhotoBase64, ingredientFileType, ingredientFileName);

      console.log("영양정보 이미지 업로드 시작...");
      const nutritionCloudFrontUrl = await uploadImageAndGetCloudFrontUrl(finalNutritionPhotoBase64, nutritionFileType, nutritionFileName);

      const requestBody = {
        ingredient_image_url: ingredientCloudFrontUrl,
        nutrition_image_url: nutritionCloudFrontUrl,
      };

      console.log("OCR API 요청 (CloudFront URLs):", requestBody);
      console.log("[ProcessAndNavigate] Attempting to call postOcrAnalysis."); // 추가된 로그 3
      const ocrResponse: ApiResponse<OcrResponseData> = await postOcrAnalysis(requestBody);
      console.log("[ProcessAndNavigate] postOcrAnalysis call FINISHED. Response:", ocrResponse); // 추가된 로그 4

      // 1. API 요청 성공 여부 먼저 확인
      if (!ocrResponse.success) {
        console.warn("OCR API 요청 실패:", ocrResponse.error);
        const errorMessage = ocrResponse.error?.message || "OCR 분석 중 서버에서 오류가 발생했습니다. 잠시 후 다시 시도해주세요.";
        setError(errorMessage);
        // 에러 발생 시 localStorage 상태 업데이트
        console.warn("[ProcessAndNavigate] OCR API call FAILED. Setting localStorage to ERROR.", ocrResponse.error); // 추가된 로그
        localStorage.setItem('ocrAnalysisState', 'error');
        localStorage.setItem('ocrAnalysisMessage', errorMessage);
        localStorage.removeItem('ocrResultId');

        // BroadcastChannel로 상태 변경 알림 (에러)
        const errorChannel = new BroadcastChannel('ocr_status_channel');
        errorChannel.postMessage({
          status: 'error',
          message: errorMessage,
          resultId: null
        });
        errorChannel.close();

        return; // finally로 이동하여 setIsProcessing(false) 등을 처리
      }

      // 2. success 이고 data가 있는 경우 productId 확인
      const responseData = ocrResponse.data;
      if (!responseData) {
        console.warn("OCR API 응답 데이터가 없습니다. (success: true, data: null)");
        const errorMessage = "분석 결과를 받았지만, 내용이 비어있습니다. 다른 사진으로 시도해주세요.";
        setError(errorMessage);
        console.warn("[ProcessAndNavigate] OCR response data is NULL. Setting localStorage to ERROR."); // 추가된 로그
        localStorage.setItem('ocrAnalysisState', 'error');
        localStorage.setItem('ocrAnalysisMessage', errorMessage);
        localStorage.removeItem('ocrResultId');

        // BroadcastChannel로 상태 변경 알림 (에러)
        const errorChannel = new BroadcastChannel('ocr_status_channel');
        errorChannel.postMessage({
          status: 'error',
          message: errorMessage,
          resultId: null
        });
        errorChannel.close();

        return; // finally로 이동
      }

      const productId = responseData.productId;
      console.log("productId:", productId);

      if (productId) {
        // 1. "Unknown Product" 조기 차단
        if (responseData.productName === "Unknown Product") {
          console.warn("[Validation Fail] productName이 'Unknown Product'입니다. productId:", productId);
          const errorMessage = "제품 정보를 명확히 인식할 수 없습니다.\n사진을 다시 촬영해주세요.";
          setError(errorMessage);
          console.warn("[ProcessAndNavigate] Product name is 'Unknown Product'. Setting localStorage to ERROR."); // 추가된 로그
          localStorage.setItem('ocrAnalysisState', 'error');
          localStorage.setItem('ocrAnalysisMessage', errorMessage);
          localStorage.removeItem('ocrResultId');

          // BroadcastChannel로 상태 변경 알림 (에러)
          const errorChannel = new BroadcastChannel('ocr_status_channel');
          errorChannel.postMessage({
            status: 'error',
            message: errorMessage,
            resultId: null
          });
          errorChannel.close();

          return; // finally로 이동
        }

        // 'attempted' 상태 및 'ocrResultIdForToast'는 더 이상 사용하지 않습니다.
        // localStorage.setItem('ocrAnalysisState', 'attempted'); 
        // localStorage.setItem('ocrResultIdForToast', productId); 

        const resultData = responseData.result;
        let isValidResponse = false;
        let hasMeaningfulIngredientAnalysis = false;
        let hasMeaningfulNutritionAnalysis = false;
        let isExplicitlyInvalidSummary = false; // 명시적 실패 summary 플래그

        if (resultData) {
          const ia = resultData.ingredientAnalysis;
          const na = resultData.nutritionAnalysis;

          console.log("[Debug] Ingredient Analysis for validation:", ia);
          console.log("[Debug] Nutrition Analysis for validation:", na);

          const knownNegativeSummaries = [
            "정보가 없어", "분석이 불가능합니다", "제공되지 않은 제품입니다", "분석할 수 없습니다",
            "인식할 수 없습니다",
            "전자제품", "비식품", // 부정 키워드 추가
            "성분이 아닌", "영양 정보가 없는" // 스크린샷의 메시지 기반 추가
          ];

          // Ingredient Analysis Summary 검사
          if (ia && typeof ia.summary === 'string' && ia.summary.trim() !== "") {
            const lowerCaseSummary = ia.summary.toLowerCase();
            if (knownNegativeSummaries.some(keyword => lowerCaseSummary.includes(keyword))) {
              isExplicitlyInvalidSummary = true; // 명시적 실패
              console.log("[Debug Validation] Ingredient Analysis summary indicates explicit failure:", ia.summary);
            } else if (Array.isArray(ia.ingredientTree) && ia.ingredientTree.length > 0) {
              hasMeaningfulIngredientAnalysis = true;
            }
          }

          // Nutrition Analysis Summary 및 데이터 검사
          if (na) {
            if (typeof na.summary === 'string' && na.summary.trim() !== "") {
              const lowerCaseSummary = na.summary.toLowerCase();
              if (knownNegativeSummaries.some(keyword => lowerCaseSummary.includes(keyword))) {
                isExplicitlyInvalidSummary = true; // 명시적 실패
                console.log("[Debug Validation] Nutrition Analysis summary indicates explicit failure:", na.summary);
              }
            }

            if (!isExplicitlyInvalidSummary) {
              let hasActualNutritionData = false;
              if (na.nutrition) {
                const nut = na.nutrition;
                if (
                  (nut.Kcal !== undefined && nut.Kcal !== null && nut.Kcal > 0) ||
                  (nut.carbohydrate && typeof nut.carbohydrate.gram === 'number' && nut.carbohydrate.gram >= 0) ||
                  (nut.protein && typeof nut.protein.gram === 'number' && nut.protein.gram >= 0) ||
                  (nut.fat && typeof nut.fat.gram === 'number' && nut.fat.gram >= 0)
                ) {
                  hasActualNutritionData = true;
                }
              }

              let isSummaryMeaningful = false;
              if (typeof na.summary === 'string' && na.summary.trim() !== "") {
                // na.summary가 존재하고, 부정 키워드를 포함하지 않을 때만 isSummaryMeaningful을 true로 설정
                if (!knownNegativeSummaries.some(keyword => na.summary!.toLowerCase().includes(keyword))) {
                  isSummaryMeaningful = true;
                }
              }

              if (hasActualNutritionData || isSummaryMeaningful) {
                hasMeaningfulNutritionAnalysis = true;
              }
            }
          }

          if (!isExplicitlyInvalidSummary && (hasMeaningfulIngredientAnalysis || hasMeaningfulNutritionAnalysis)) {
            isValidResponse = true;
          }
        }

        console.log("[Debug] 최종 응답 유효성 검사 결과:", {
          isValidResponse: isValidResponse,
          isExplicitlyInvalidSummary: isExplicitlyInvalidSummary,
          hasMeaningfulIngredientAnalysis: hasMeaningfulIngredientAnalysis,
          hasMeaningfulNutritionAnalysis: hasMeaningfulNutritionAnalysis,
          productId: productId
        });

        if (!isValidResponse) {
          console.warn("OCR 분석 결과, 유효하지 않은 이미지로 판단됨 (내용 부족). productId:", productId, "응답 데이터:", responseData);
          setError("이미지 인식에 실패했습니다.\n내용이 잘 보이도록 다시 촬영해주세요.");

          // currentProductDataKey 관련 로직 제거 또는 주석 처리
          // try {
          //   localStorage.removeItem(currentProductDataKey); 
          //   console.log(`[LocalStorage Cleanup] 키 '${currentProductDataKey}'의 데이터를 삭제했습니다.`);
          // } catch (storageErr) {
          //   console.warn("[LocalStorage Cleanup] 실패:", storageErr);
          // }
          console.warn("[ProcessAndNavigate] OCR response NOT VALID. Setting localStorage to ERROR."); // 추가된 로그
          localStorage.setItem('ocrAnalysisState', 'error');
          localStorage.setItem('ocrAnalysisMessage', '이미지 분석에 실패하여 재촬영이 필요합니다.');
          localStorage.removeItem('ocrResultId');

          // BroadcastChannel로 상태 변경 알림 (에러)
          const errorChannel = new BroadcastChannel('ocr_status_channel');
          errorChannel.postMessage({
            status: 'error',
            message: '이미지 분석에 실패하여 재촬영이 필요합니다.',
            resultId: null
          });
          errorChannel.close();

          return; // finally로 이동
        }

        // 유효한 응답일 경우, 홈 화면 토스트를 위해 최종 상태 업데이트
        console.log("[ProcessAndNavigate] OCR response VALID. Setting localStorage to COMPLETED."); // 추가된 로그 5
        localStorage.setItem('ocrAnalysisState', 'completed');
        localStorage.setItem('ocrAnalysisMessage', '성분 분석이 완료되었습니다! 결과를 확인하세요.');
        localStorage.setItem('ocrResultId', productId);
        // localStorage.removeItem('ocrResultIdForToast'); // 이미 제거됨

        // BroadcastChannel로 상태 변경 알림
        const channel = new BroadcastChannel('ocr_status_channel');
        channel.postMessage({
          status: 'completed',
          message: '성분 분석이 완료되었습니다! 결과를 확인하세요.',
          resultId: productId
        });
        channel.close();

        console.log("OCR 분석 결과 유효함, /report로 이동. productId:", productId);
        const navigatedHome = localStorage.getItem('ocrUserNavigatedHome');
        if (navigatedHome !== 'true') {
          router.push(`/report/${productId}`);
        }
        // 성공 시에도 finally 블록을 타도록 return
        return;
      } else { // productId가 없는 경우 (success: true, data: {...} 이지만 productId가 null/undefined)
        console.warn("API 응답에 productId가 없습니다. 응답 데이터:", responseData);
        const errorMessage = "제품을 특정할 수 있는 정보를 찾지 못했습니다. 사진을 확인 후 다시 시도해주세요.";
        setError(errorMessage);
        console.warn("[ProcessAndNavigate] ProductId is MISSING in API response. Setting localStorage to ERROR."); // 추가된 로그
        localStorage.setItem('ocrAnalysisState', 'error');
        localStorage.setItem('ocrAnalysisMessage', errorMessage);
        localStorage.removeItem('ocrResultId');

        // BroadcastChannel로 상태 변경 알림 (에러)
        const errorChannel = new BroadcastChannel('ocr_status_channel');
        errorChannel.postMessage({
          status: 'error',
          message: errorMessage,
          resultId: null
        });
        errorChannel.close();

        return; // finally로 이동
      }

    } catch (err: unknown) {
      console.error("[ProcessAndNavigate] CATCH block entered. Error:", err); // 추가된 로그 6
      let errorMessage = "이미지 처리 중 알 수 없는 오류가 발생했습니다.";

      if (typeof err === 'object' && err !== null) {
        if ('response' in err) {
          const axiosError = err as { response?: { data?: { message?: string }, status?: number } };
          console.error('OCR API 서버 오류 응답:', axiosError.response?.data);
          errorMessage = axiosError.response?.data?.message || `서버 응답 오류: ${axiosError.response?.status ?? '알 수 없음'}`;
        } else if ('request' in err) {
          console.error('OCR API 응답 없음:', (err as { request?: unknown }).request);
          errorMessage = "서버에서 응답이 없습니다. 네트워크 연결을 확인해주세요.";
        } else if ('message' in err && typeof (err as { message: unknown }).message === 'string') {
          errorMessage = (err as Error).message;
        }
      } else if (typeof err === 'string') {
        errorMessage = err;
      }

      setError(errorMessage);
      // catch 블록에서도 localStorage 상태 업데이트
      localStorage.setItem('ocrAnalysisState', 'error');
      localStorage.setItem('ocrAnalysisMessage', errorMessage);
      localStorage.removeItem('ocrResultId');
      console.log("[ProcessAndNavigate] CATCH block - localStorage set to ERROR. Message:", errorMessage); // 추가된 로그 7

      // BroadcastChannel로 상태 변경 알림 (에러)
      const errorChannel = new BroadcastChannel('ocr_status_channel');
      errorChannel.postMessage({
        status: 'error',
        message: errorMessage,
        resultId: null
      });
      errorChannel.close();

      return; // finally로 이동
    } finally {
      // 모든 경우 (성공, 실패, 에러)에 대해 setIsProcessing(false)가 호출되도록 함
      setIsProcessing(false);

      // 카메라 페이지 자체의 UI 복구 로직은 여기서 직접 처리하기보다,
      // error 상태를 감지하는 useEffect나 사용자의 "다시 시도" 액션을 통해 처리하는 것이 좋습니다.
      // localStorage 상태는 이미 error 또는 completed로 잘 설정되어 홈 화면 토스트는 정상 동작할 것입니다.

      // 예시: 사용자가 홈으로 가지 않았고, 현재 에러 상태라면 추가 UI 업데이트 가능
      // const currentOcrState = localStorage.getItem('ocrAnalysisState');
      // const navigatedHome = localStorage.getItem('ocrUserNavigatedHome');
      // if (currentOcrState === 'error' && navigatedHome !== 'true' && !error) {
      //   // setError가 비동기이므로, 이 시점에 error 상태가 아직 반영 안됐을 수 있음.
      //   // 그래서 localStorage의 메시지를 기반으로 setError를 한번 더 호출하거나,
      //   // handleRetryAfterError와 유사한 로직으로 UI 초기화.
      //   // 여기서는 단순 로그만 남김.
      //   console.log("processAndNavigate finally: Error state detected, camera page UI might need reset if user is still here.");
      // }
      console.log("[ProcessAndNavigate] FINALLY block. setIsProcessing(false). Current ocrAnalysisState:", localStorage.getItem('ocrAnalysisState')); // 추가된 로그 8
    }
  };

  const handleCapture = async () => { // async로 변경
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;

      if (imageCaptureRef.current) {
        try {
          console.log("[Camera] Capturing photo using ImageCapture API...");
          // ImageCapture API를 사용하여 고화질 사진 촬영
          // photoSettings으로 해상도 등을 지정할 수 있으나, 기본값으로도 고화질을 기대할 수 있음
          // const photoSettings = { imageWidth: video.videoWidth * 2, imageHeight: video.videoHeight * 2 }; 
          // const blob = await imageCaptureRef.current.takePhoto(photoSettings);
          const blob = await imageCaptureRef.current.takePhoto();
          const imageDataUrl = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          });

          setPreviewImageSrc(imageDataUrl);
          setShowPreviewScreen(true);
          setIsGuideVisible(false);
          console.log("[Camera] Photo captured with ImageCapture API. Size:", blob.size, "Type:", blob.type);
          return; // ImageCapture 성공 시 여기서 종료
        } catch (captureError) {
          console.error("[Camera] Error using ImageCapture.takePhoto():", captureError);
          // ImageCapture 실패 시 Canvas fallback 사용
        }
      }

      // Fallback: Canvas를 사용한 캡처 (기존 방식)
      console.log("[Camera] Falling back to canvas capture.");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const context = canvas.getContext('2d');
      if (context) {
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        const imageDataUrl = canvas.toDataURL('image/jpeg', 0.9);

        setPreviewImageSrc(imageDataUrl);
        setShowPreviewScreen(true);
        setIsGuideVisible(false);
      }
    }
  };

  // 미리보기 화면 관련 핸들러
  const handleConfirmPhoto = () => {
    if (!previewImageSrc) return;

    if (currentPhotoStep === 'ingredient') {
      setIngredientPhoto(previewImageSrc);
      setCurrentPhotoStep('nutritionInfo');
      setIsGuideVisible(true); // 다음 단계 가이드 표시
    } else if (currentPhotoStep === 'nutritionInfo') {
      setNutritionPhoto(previewImageSrc);
      // processAndNavigate 호출 시, 확정된 영양정보 사진 전달
      processAndNavigate(previewImageSrc);
    }
    setPreviewImageSrc(null);
    setShowPreviewScreen(false);
  };

  const handleRetakePhoto = () => {
    setPreviewImageSrc(null);
    setShowPreviewScreen(false);
    setIsGuideVisible(true); // 현재 단계 가이드 다시 표시
    // 앨범에서 선택한 경우 input 값 초기화 (선택 사항)
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    // 줌 값 초기화는 여기서 하지 않음. 사용자가 설정한 줌 유지.
    // 필요하다면 setCurrentZoom(zoomCapabilities?.min ?? 1); 등으로 초기화
  };

  // 줌 변경 핸들러
  const handleZoomChange = async (direction: 'in' | 'out') => {
    if (!stream || !zoomCapabilities) return;

    const videoTrack = stream.getVideoTracks()[0];
    if (!videoTrack) return;

    let newZoom = currentZoom;
    const step = zoomCapabilities.step || 0.1; // step이 없으면 0.1로 가정

    if (direction === 'in') {
      newZoom = Math.min(currentZoom + step, zoomCapabilities.max ?? 10);
    } else {
      newZoom = Math.max(currentZoom - step, zoomCapabilities.min ?? 1);
    }

    // 소수점 한자리로 반올림 (부동소수점 오류 방지)
    newZoom = parseFloat(newZoom.toFixed(1));


    try {
      await videoTrack.applyConstraints({ advanced: [{ zoom: newZoom }] });
      setCurrentZoom(newZoom);
      console.log("[Camera] Zoom applied:", newZoom);
    } catch (err) {
      console.error("[Camera] Error applying zoom constraint:", err);
      // 에러 발생 시 이전 줌 값으로 복원 시도 또는 사용자에게 알림
      // const settings = videoTrack.getSettings();
      // if (settings.zoom) setCurrentZoom(settings.zoom);
    }
  };

  // "다시 시도" 버튼 핸들러
  const handleRetryAfterError = () => {
    // 현재 스트림 중지 (handleRetryAfterError 내에서 명시적으로 처리)
    if (videoRef.current && videoRef.current.srcObject) {
      stopMediaStream(videoRef.current.srcObject as MediaStream);
      videoRef.current.srcObject = null;
    } else if (stream) { // videoRef에 없지만 state에 남아있을 경우
      stopMediaStream(stream);
    }
    setStream(null); // 스트림 상태 초기화
    if (imageCaptureRef.current) { // ImageCapture 참조도 초기화
      imageCaptureRef.current = null;
    }
    setZoomCapabilities(null); // 줌 기능 상태 초기화
    setCurrentZoom(1); // 현재 줌 상태 초기화

    setError(null);
    setIsProcessing(false);
    setCurrentPhotoStep('ingredient');
    setIngredientPhoto(null);
    setNutritionPhoto(null);
    setPreviewImageSrc(null);
    setShowPreviewScreen(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }

    getCameraStream(); // 새로운 스트림 요청
    showGuideTemporarily(); // 가이드 다시 표시
  };

  return (
    <div
      ref={cameraPageContainerRef}
      className="flex flex-col w-full bg-black text-white relative overflow-hidden"
    >
      {/* 상단 바: X 버튼, 촬영 가이드 버튼 - 에러 없을 때만 표시 */}
      {!isProcessing && !error && (
        <div className="h-16 flex justify-between items-center p-4 z-10">
          <button className="p-2" onClick={handleCloseClick}>
            <X size={28} weight="bold" />
          </button>
          {/* 줌 컨트롤 UI (zoomCapabilities가 있을 때만 표시) */}
          {zoomCapabilities && (
            <div className="flex items-center text-white bg-black bg-opacity-50 p-1 rounded">
              <button
                onClick={() => handleZoomChange('out')}
                disabled={currentZoom <= (zoomCapabilities.min ?? 1)}
                className="px-2 py-1 text-lg disabled:opacity-50"
              >
                -
              </button>
              <span className="px-2 text-sm">{currentZoom.toFixed(1)}x</span>
              <button
                onClick={() => handleZoomChange('in')}
                disabled={currentZoom >= (zoomCapabilities.max ?? 10)}
                className="px-2 py-1 text-lg disabled:opacity-50"
              >
                +
              </button>
            </div>
          )}
          <button onClick={handleShowGuide} className="text-sm font-semibold px-3 py-1.5 rounded bg-black bg-opacity-40">
            촬영 가이드
          </button>
        </div>
      )}

      <div className="flex-grow relative overflow-hidden">
        {!isProcessing && (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="absolute inset-0 w-full h-full object-cover"
          />
        )}

        {isGuideVisible && !isProcessing && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/75 z-20 p-8 text-center">
            {currentPhotoStep === 'ingredient' ? (
              <ListBullets size={48} weight="bold" className="mb-6 text-[var(--color-maincolor)]" />
            ) : (
              <ChartBar size={48} weight="bold" className="mb-6 text-[var(--color-maincolor)]" />
            )}
            <p className="text-xl mb-4 whitespace-pre-line font-bold">
              {guideMessages[currentPhotoStep].title}
            </p>
            <p className="text-lg mb-4 whitespace-pre-line font-semibold">
              {currentPhotoStep === 'nutritionInfo' ?
                (() => {
                  const text = guideMessages.nutritionInfo.main;
                  const phraseToBold = "빠짐없이 나오도록";
                  if (text.includes(phraseToBold)) {
                    const parts = text.split(phraseToBold);
                    return (
                      <>
                        {parts[0]}
                        <strong>{phraseToBold}</strong>
                        {parts[1]}
                      </>
                    );
                  }
                  return text; // 혹시 문구가 바뀌어 phraseToBold가 없는 경우 원래 텍스트 반환
                })() :
                guideMessages[currentPhotoStep].main
              }
            </p>

            {Array.isArray(guideMessages[currentPhotoStep].sub) ? (
              <div className="mt-6 flex flex-col items-center w-full max-w-xs px-4">
                <div className="flex items-center mb-2">
                  <Lightbulb size={20} weight="bold" className="mr-2 text-yellow-400" />
                  <p className="text-sm font-semibold text-yellow-400">TIP</p>
                </div>
                <ul className="list-disc list-inside text-sm space-y-1">
                  {(guideMessages[currentPhotoStep].sub as string[]).map((tip, index) => (
                    <li key={index}>{tip}</li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="mt-6 text-sm mb-6 whitespace-pre-line">
                {guideMessages[currentPhotoStep].sub as string}
              </p>
            )}

            <button
              onClick={() => {
                console.log("'준비됐어요!' 버튼 클릭됨, isGuideVisible 이전 값:", isGuideVisible);
                setIsGuideVisible(false);
                console.log("isGuideVisible 다음 값으로 설정 시도: false");
              }}
              className="mt-8 px-4 py-2 bg-[var(--color-maincolor)] hover:bg-[var(--color-maincolor-100)] rounded text-white"
            >
              준비됐어요!
            </button>
          </div>
        )}

        {/* 미리보기 화면 UI */}
        {showPreviewScreen && previewImageSrc && (
          <div className="absolute inset-0 z-30 flex flex-col bg-black">
            {/* <img src={previewImageSrc} alt="촬영된 이미지 미리보기" className="flex-grow object-contain" /> */}
            <div className="relative flex-grow">
              <Image src={previewImageSrc} alt="촬영된 이미지 미리보기" layout="fill" objectFit="contain" />
            </div>
            <div className="grid grid-cols-10 items-center h-28 px-4 py-4 bg-black bg-opacity-80 gap-x-2 sm:gap-x-4">
              <button
                onClick={handleRetakePhoto}
                className="col-span-3 flex flex-col items-center text-white p-2 rounded-lg hover:bg-gray-700 transition-colors"
              >
                <ArrowCounterClockwise size={32} weight="bold" />
                <span className="mt-1 text-xs">다시 찍기</span>
              </button>
              <button
                onClick={handleConfirmPhoto}
                className="col-span-7 flex flex-col items-center text-white p-2 rounded-lg bg-[var(--color-maincolor)] hover:bg-[var(--color-maincolor-100)] transition-colors"
              >
                {currentPhotoStep === 'ingredient' ? (
                  <ArrowRight size={32} weight="bold" />
                ) : (
                  <Check size={32} weight="bold" />
                )}
                <span className="mt-1 text-xs">
                  {currentPhotoStep === 'ingredient' ? "다음 단계" : "분석 시작"}
                </span>
              </button>
            </div>
          </div>
        )}

        {isProcessing && <OcrProcessingScreen />}

        {error && (
          <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black bg-opacity-90 p-8 text-white">
            <Image
              src="/assets/quiz/sugar_X.png"
              alt="Error Character"
              width={180} // 이미지 크기는 디자인에 맞게 조절
              height={180} // 이미지 크기는 디자인에 맞게 조절
              className="mb-6 opacity-90"
            />
            <p className="mb-8 text-center text-lg font-semibold whitespace-pre-line">
              {error}
            </p>
            <button
              onClick={handleRetryAfterError}
              className="rounded-lg bg-[var(--color-maincolor)] px-10 py-3 text-base font-bold text-white hover:bg-[var(--color-maincolor-100)] active:scale-95 transition-all duration-150 ease-in-out shadow-lg"
            >
              다시 시도
            </button>
          </div>
        )}
      </div>

      {/* 하단 컨트롤 바: 앨범, 촬영 버튼 등 - isProcessing이 false이고, error가 없을 때만 표시 */}
      {!isProcessing && !error && (
        <div className="h-28 flex justify-between items-center px-8 py-4 z-10">
          <button className="p-2" onClick={handleAlbumClick}>
            <ImageIcon size={32} />
          </button>
          <button
            className="w-16 h-16 rounded-full border-4 border-white bg-transparent flex items-center justify-center active:bg-white/20"
            onClick={handleCapture}
            disabled={isProcessing} // 이 disabled는 isProcessing이 true일 때 적용되므로, 부모가 숨겨지면 의미가 없어지지만, 일단 유지
          >
            <div className="w-12 h-12 rounded-full bg-white"></div>
          </button>
          <div className="w-[48px]"></div>
        </div>
      )}

      <input
        type="file"
        accept="image/*"
        capture="environment"
        ref={fileInputRef}
        onChange={handleFileChange}
        className="hidden"
        disabled={isProcessing} // 처리 중일 때 파일 입력 비활성화
      />
      {/* 캡처용 숨겨진 캔버스 */}
      <canvas ref={canvasRef} className="hidden"></canvas>
    </div>
  );
}
