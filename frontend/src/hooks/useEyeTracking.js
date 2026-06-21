import { useEffect, useState, useRef, useCallback } from 'react';
import { FaceLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";

export function useEyeTracking(isActive) {
  const [gazeData, setGazeData] = useState({ x: 0, y: 0 });
  const [isLoaded, setIsLoaded] = useState(false);
  
  const landmarkerRef = useRef(null);
  const videoRef = useRef(null);
  const requestRef = useRef(null);
  const isActiveRef = useRef(isActive);
  const isLoopRunningRef = useRef(false);

  // Modèle de calibration
  const calibrationData = useRef([]);
  const regressionModel = useRef({ ax: 1, bx: 0, ay: 1, by: 0 });

  const getIrisRelativePosition = (landmarks) => {
    const leftEyeInner = landmarks[133];
    const leftEyeOuter = landmarks[33];
    const leftIris = landmarks[468];
    
    if (!leftEyeInner || !leftEyeOuter || !leftIris) return { x: 0.5, y: 0.5 };
    
    const dx = leftEyeOuter.x - leftEyeInner.x;
    const dy = leftEyeOuter.y - leftEyeInner.y;
    const eyeWidth = Math.sqrt(dx*dx + dy*dy);
    
    const relativeX = (leftIris.x - leftEyeInner.x) / dx;
    const relativeY = (leftIris.y - leftEyeInner.y) / eyeWidth;
    
    return { x: relativeX, y: relativeY };
  };

  const predict = () => {
    if (!landmarkerRef.current || !videoRef.current || !isActiveRef.current || videoRef.current.readyState < 2) {
      isLoopRunningRef.current = false;
      return;
    }

    const startTimeMs = performance.now();
    
    try {
      const results = landmarkerRef.current.detectForVideo(videoRef.current, startTimeMs);

      if (results.faceLandmarks && results.faceLandmarks.length > 0) {
        const landmarks = results.faceLandmarks[0];
        const irisPos = getIrisRelativePosition(landmarks);

        const screenX = irisPos.x * regressionModel.current.ax + regressionModel.current.bx;
        const screenY = irisPos.y * regressionModel.current.ay + regressionModel.current.by;

        const dot = document.getElementById('custom-gaze-dot');
        if (dot) {
          dot.style.transform = `translate3d(${screenX}px, ${screenY}px, 0)`;
          dot.style.display = 'block';
        }

        if (Math.floor(startTimeMs) % 100 < 20) {
           setGazeData({ x: screenX, y: screenY });
        }

        if (results.faceBlendshapes && results.faceBlendshapes[0]) {
          const blendshapes = results.faceBlendshapes[0].categories;
          const blinkL = blendshapes.find(c => c.categoryName === "eyeBlinkLeft")?.score || 0;
          const blinkR = blendshapes.find(c => c.categoryName === "eyeBlinkRight")?.score || 0;
          
          if (blinkL > 0.5 && blinkR > 0.5) {
             window.dispatchEvent(new CustomEvent('eye-blink'));
          }
        }
      }
    } catch (e) {
      console.error("Erreur pendant la prédiction:", e);
    }

    if (isActiveRef.current) {
      requestRef.current = requestAnimationFrame(predict);
      isLoopRunningRef.current = true;
    } else {
      isLoopRunningRef.current = false;
    }
  };

  const startLoop = () => {
    if (isLoopRunningRef.current) return;
    if (requestRef.current) cancelAnimationFrame(requestRef.current);
    isLoopRunningRef.current = true;
    requestRef.current = requestAnimationFrame(predict);
  };

  // Sync isActive with a ref to use in the animation loop without closure issues
  useEffect(() => {
    isActiveRef.current = isActive;
    if (isActive && isLoaded && videoRef.current && videoRef.current.readyState >= 2) {
      console.log("🔄 Réactivation de la boucle de prédiction");
      startLoop();
    } else if (!isActive) {
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
        requestRef.current = null;
      }
      isLoopRunningRef.current = false;
    }
  }, [isActive, isLoaded]);

  // Initialisation de MediaPipe
  useEffect(() => {
    async function setupMediaPipe() {
      try {
        console.log("📥 Initialisation de MediaPipe Landmarker...");
        const filesetResolver = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
        );

        const modelConfig = {
          baseOptions: {
            modelAssetPath: `https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task`,
          },
          outputFaceBlendshapes: true,
          runningMode: "VIDEO",
          numFaces: 1,
        };

        const landmarker = await FaceLandmarker.createFromOptions(filesetResolver, {
          ...modelConfig,
          baseOptions: { ...modelConfig.baseOptions, delegate: "CPU" },
        });
        console.log("🖥️ MediaPipe initialisé avec CPU");

        landmarkerRef.current = landmarker;
        setIsLoaded(true);
        console.log("✅ MediaPipe prêt");
      } catch (error) {
        console.error("❌ Erreur MediaPipe:", error);
      }
    }
    setupMediaPipe();

    return () => {
      if (landmarkerRef.current) landmarkerRef.current.close();
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, []);

  // Gestion de la Webcam
  useEffect(() => {
    if (!isActive || !isLoaded) return;

    let currentStream = null;

    async function startCamera() {
      console.log("🎥 Demande d'accès à la webcam...");
      
      try {
        const video = document.createElement('video');
        video.autoplay = true;
        video.playsInline = true;
        
        currentStream = await navigator.mediaDevices.getUserMedia({
          video: { width: 640, height: 480 }
        });
        
        video.srcObject = currentStream;
        videoRef.current = video;
        
        video.onloadedmetadata = () => {
          console.log("📺 Flux vidéo reçu et prêt");
          video.play().then(() => {
            console.log("▶️ Lecture vidéo démarrée");
            startLoop();
          }).catch(e => console.error("Erreur lecture vidéo:", e));
        };
      } catch (err) {
        console.error("❌ Impossible d'accéder à la webcam:", err);
        alert("Erreur webcam : Vérifiez les permissions de votre navigateur.");
      }
    }

    startCamera();

    return () => {
      console.log("🛑 Arrêt de la webcam");
      if (currentStream) {
        currentStream.getTracks().forEach(track => track.stop());
      }
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
        requestRef.current = null;
      }
      isLoopRunningRef.current = false;
    };
  }, [isActive, isLoaded]);

  // Fonction pour ajouter un point de calibration
  const calibratePoint = useCallback((screenX, screenY) => {
    if (!landmarkerRef.current || !videoRef.current || videoRef.current.readyState < 2) return;
    
    const results = landmarkerRef.current.detectForVideo(videoRef.current, performance.now());
    if (results.faceLandmarks && results.faceLandmarks.length > 0) {
      const irisPos = getIrisRelativePosition(results.faceLandmarks[0]);
      calibrationData.current.push({ iris: irisPos, screen: { x: screenX, y: screenY } });
      
      // Si on a assez de points, on recalcule la régression (besoin de min 2 points pour linéaire simple)
      if (calibrationData.current.length >= 5) {
        updateRegressionModel();
      }
    }
  }, []);

  const updateRegressionModel = () => {
    const data = calibrationData.current;
    const n = data.length;
    
    // Calcul simple par moindres carrés pour X et Y
    const sumX = data.reduce((s, p) => s + p.iris.x, 0);
    const sumY = data.reduce((s, p) => s + p.iris.y, 0);
    const sumSX = data.reduce((s, p) => s + p.screen.x, 0);
    const sumSY = data.reduce((s, p) => s + p.screen.y, 0);
    const sumXX = data.reduce((s, p) => s + p.iris.x * p.iris.x, 0);
    const sumYY = data.reduce((s, p) => s + p.iris.y * p.iris.y, 0);
    const sumX_SX = data.reduce((s, p) => s + p.iris.x * p.screen.x, 0);
    const sumY_SY = data.reduce((s, p) => s + p.iris.y * p.screen.y, 0);

    const ax = (n * sumX_SX - sumX * sumSX) / (n * sumXX - sumX * sumX);
    const bx = (sumSX - ax * sumX) / n;
    
    const ay = (n * sumY_SY - sumY * sumSY) / (n * sumYY - sumY * sumY);
    const by = (sumSY - ay * sumY) / n;

    regressionModel.current = { ax, bx, ay, by };
    console.log("🎯 Modèle de calibration mis à jour :", regressionModel.current);
  };

  return { gazeData, isLoaded, calibratePoint };
}
