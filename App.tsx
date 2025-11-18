import React, { useState, useCallback, useEffect } from 'react';
import { FormData, EventType, ClientRecord, ImageVersion, MusicStyle } from './types';
import { EVENT_TYPES } from './constants';
import { describeImage, generateImage, editImage, generateVideo } from './services/geminiService';
import DroneIcon from './components/icons/DroneIcon';
import Loader from './components/Loader';
import Toast, { ToastType } from './components/Toast';
import Login from './components/Login';

const initialFormData: FormData = {
  clientName: '',
  eventType: EventType.Corporativo,
  location: '',
  countryCity: '',
  droneCount: '100',
  elements: '',
  notes: '',
  musicStyle: 'Cinematic',
  hasTransition: false,
  transitionElements: '',
  transitionDescription: '',
};

const MUSIC_STYLES: MusicStyle[] = ['Cinematic', 'Rock', 'Electronic', 'Classical', 'Pop', 'Jazz', 'Ambient'];

const fileToBase64 = (file: File): Promise<{ mimeType: string; data: string }> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const result = reader.result as string;
      const mimeType = result.split(',')[0].split(':')[1].split(';')[0];
      const data = result.split(',')[1];
      resolve({ mimeType, data });
    };
    reader.onerror = (error) => reject(error);
  });
};

const blobToBase64 = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = (error) => reject(error);
    reader.readAsDataURL(blob);
  });
};

const buildDataUrl = (base64: string, mimeType: string) => `data:${mimeType};base64,${base64}`;

const buildFirstSceneDescription = (data: FormData): string => {
  const base = `Escena inicial con aproximadamente ${data.droneCount} drones LED formando ${data.elements || 'la composición solicitada'} sobre ${data.location || 'el lugar indicado'} en ${data.countryCity || 'la ciudad del evento'}.`;
  const tone = 'Las luces son sobrias, controladas y realistas, sin efectos fantasiosos.';
  const transition = data.hasTransition && data.transitionDescription
    ? `La transición solicitada por el cliente consiste en: ${data.transitionDescription}.`
    : '';
  return [base, tone, transition].filter(Boolean).join(' ');
};

const buildFileSlug = (value?: string, fallback = 'drone-show') => {
  const base = (value || fallback).trim().toLowerCase();
  const slug = base.replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '');
  return slug || fallback;
};

const App: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [formData, setFormData] = useState<FormData>(initialFormData);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageFileName, setImageFileName] = useState<string>('Subir imagen del lugar (opcional)');
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  
  // Segunda imagen para transiciones
  const [secondImageFile, setSecondImageFile] = useState<File | null>(null);
  const [secondImageFileName, setSecondImageFileName] = useState<string>('Segunda imagen para transición (opcional)');
  const [secondImagePreviewUrl, setSecondImagePreviewUrl] = useState<string | null>(null);
  const [generatedSecondImageData, setGeneratedSecondImageData] = useState<{ url: string; base64: string; mimeType: string; } | null>(null);
  
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [loadingMessage, setLoadingMessage] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  
  const [generatedImageData, setGeneratedImageData] = useState<{ url: string; base64: string; mimeType: string; } | null>(null);
  const [generatedVideoData, setGeneratedVideoData] = useState<{ url: string; base64: string; mimeType: string } | null>(null);
  const [editPrompt, setEditPrompt] = useState<string>('');
  const [showReveal, setShowReveal] = useState<boolean>(false);
  const [imageVersions, setImageVersions] = useState<ImageVersion[]>([]);
  const [currentVersionIndex, setCurrentVersionIndex] = useState<number>(-1);
  const [showVideoConfirmModal, setShowVideoConfirmModal] = useState<boolean>(false);

  const [view, setView] = useState<'form' | 'list'>('form');
  const [clients, setClients] = useState<ClientRecord[]>([]);
  const [selectedClient, setSelectedClient] = useState<ClientRecord | null>(null);
  const [isProjectSaved, setIsProjectSaved] = useState<boolean>(false);

  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);

  const showToast = useCallback((message: string, type: ToastType) => {
    setToast({ message, type });
  }, []);

  useEffect(() => {
    try {
        const savedClients = localStorage.getItem('droneShowClients');
        if (savedClients) {
            setClients(JSON.parse(savedClients));
        }
    } catch (e) {
        console.error("Failed to load clients from localStorage", e);
        setError("No se pudieron cargar los proyectos guardados.");
    }
  }, []);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  }, []);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 4 * 1024 * 1024) { // 4MB limit
        showToast("El archivo es demasiado grande. El límite es 4MB.", "error");
        return;
      }
      setImageFile(file);
      setImageFileName(file.name);

      // Create preview URL
      const previewUrl = URL.createObjectURL(file);
      setImagePreviewUrl(previewUrl);
      showToast("Imagen cargada correctamente ✨", "success");
    }
  }, [showToast]);

  const handleRemoveImage = useCallback(() => {
    setImageFile(null);
    setImageFileName('Subir imagen del lugar (opcional)');
    if (imagePreviewUrl) {
      URL.revokeObjectURL(imagePreviewUrl);
      setImagePreviewUrl(null);
    }
  }, [imagePreviewUrl]);

  const handleSecondImageChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 4 * 1024 * 1024) { // 4MB limit
        showToast("El archivo es demasiado grande. El límite es 4MB.", "error");
        return;
      }
      setSecondImageFile(file);
      setSecondImageFileName(file.name);

      // Create preview URL
      const previewUrl = URL.createObjectURL(file);
      setSecondImagePreviewUrl(previewUrl);
      showToast("Segunda imagen cargada correctamente ✨", "success");
    }
  }, [showToast]);

  const handleRemoveSecondImage = useCallback(() => {
    setSecondImageFile(null);
    setSecondImageFileName('Segunda imagen para transición (opcional)');
    if (secondImagePreviewUrl) {
      URL.revokeObjectURL(secondImagePreviewUrl);
      setSecondImagePreviewUrl(null);
    }
  }, [secondImagePreviewUrl]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setLoadingMessage('Generando visualización...');
    setIsLoading(true);

    try {
      let imageDescription = '';
      if (imageFile) {
        setLoadingMessage('Analizando imagen de referencia...');
        const { mimeType, data } = await fileToBase64(imageFile);
        imageDescription = await describeImage(data, mimeType);
      }
      
      setLoadingMessage('Construyendo el show de drones (Escena 1)...');
      
      // Helper para construir prompts consistentes
      const buildPrompt = (elements: string) => {
        let p = `Fotografía nocturna profesional de un espectáculo de drones (Drone Show) en ${formData.location}, ${formData.countryCity}.

ELEMENTOS VISIBLES EN EL CIELO:
Los drones forman EXCLUSIVAMENTE estas figuras con luces LED: ${elements}.
Asegúrate de que las figuras sean claras, legibles y estén formadas por puntos de luz individuales.

ESTILO:
- Fotografía de larga exposición pero nítida.
- Los drones son puntos de luz brillantes.
- NO incluir elementos extraños, ni nubes de colores, ni humo.
- Solo el cielo nocturno y las figuras de drones solicitadas.
- Si es una boda, usar colores dorados, blancos y rojos.
`;
        if (imageDescription) {
          p += `\nCONTEXTO DEL ENTORNO: ${imageDescription}`;
        } else {
          p += `\nCONTEXTO: Muestra el entorno natural o urbano del lugar de forma creíble.`;
        }
        
        if (formData.notes) {
          p += `\nNOTAS ADICIONALES: ${formData.notes}.`;
        }

        p += `\n\nIMPORTANTE: No inventar figuras adicionales. Solo dibujar lo solicitado.`;
        return p;
      };

      // 1. Generar Primera Imagen
      const prompt1 = buildPrompt(formData.elements);
      const generatedImageBase64 = await generateImage(prompt1);
      const imageUrl = `data:image/jpeg;base64,${generatedImageBase64}`;
      setGeneratedImageData({ url: imageUrl, base64: generatedImageBase64, mimeType: 'image/jpeg' });

      // 2. Generar Segunda Imagen (si aplica)
      if (formData.hasTransition && formData.transitionElements) {
        setLoadingMessage('Generando escena final de la transición (manteniendo fondo)...');
        
        // Usamos editImage para modificar SOLO los drones sobre la imagen original
        // Esto garantiza que el fondo, iluminación y ángulo sean idénticos
        const editPrompt = `Change the drone formation in the sky to form: ${formData.transitionElements}. Keep the background, lighting, and camera angle EXACTLY the same. Only the drones change position to form the new shape.`;
        
        const { base64: generatedImageBase64_2, mimeType: mimeType_2 } = await editImage(generatedImageBase64, 'image/jpeg', editPrompt);
        
        const imageUrl2 = `data:${mimeType_2};base64,${generatedImageBase64_2}`;
        setGeneratedSecondImageData({ url: imageUrl2, base64: generatedImageBase64_2, mimeType: mimeType_2 });
      } else {
        setGeneratedSecondImageData(null);
      }

      // Agregar versión original al historial
      const initialVersion: ImageVersion = {
        id: new Date().toISOString() + '0',
        url: imageUrl,
        base64: generatedImageBase64,
        mimeType: 'image/jpeg',
        createdAt: new Date().toISOString(),
        isOriginal: true,
      };
      setImageVersions([initialVersion]);
      setCurrentVersionIndex(0);

      // Trigger reveal animation
      setTimeout(() => setShowReveal(true), 100);
      showToast("¡Visualización generada exitosamente! 🎉", "success");

    } catch (err) {
      const e = err as Error;
      setError(e.message || 'Ocurrió un error inesperado.');
      showToast(e.message || 'Ocurrió un error inesperado.', "error");
    } finally {
      setIsLoading(false);
      setLoadingMessage('');
    }
  };
  
  const handleEditSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editPrompt || !generatedImageData) return;
    
    setError(null);
    setLoadingMessage('Aplicando edición a la imagen...');
    setIsLoading(true);
    
    try {
        const { base64: newBase64, mimeType: newMimeType } = await editImage(generatedImageData.base64, generatedImageData.mimeType, editPrompt);
        const newUrl = `data:${newMimeType};base64,${newBase64}`;
        setGeneratedImageData({ url: newUrl, base64: newBase64, mimeType: newMimeType });
        
        // Agregar nueva versión al historial
        const newVersion: ImageVersion = {
          id: new Date().toISOString() + Math.random(),
          url: newUrl,
          base64: newBase64,
          mimeType: newMimeType,
          editPrompt: editPrompt,
          createdAt: new Date().toISOString(),
          isOriginal: false,
        };
        setImageVersions([...imageVersions, newVersion]);
        setCurrentVersionIndex(imageVersions.length);
        
        setEditPrompt('');
        showToast("Imagen editada correctamente ✨", "success");
    } catch (err) {
      const e = err as Error;
      setError(e.message || 'Ocurrió un error inesperado durante la edición.');
      showToast(e.message || 'Ocurrió un error inesperado durante la edición.', "error");
    } finally {
        setIsLoading(false);
        setLoadingMessage('');
    }
  };

  const openApiKeySelector = async () => {
    await (window as any).aistudio?.openSelectKey();
    setError(null);
  };

  const goToPreviousVersion = () => {
    if (currentVersionIndex > 0) {
      const newIndex = currentVersionIndex - 1;
      setCurrentVersionIndex(newIndex);
      const version = imageVersions[newIndex];
      setGeneratedImageData({ url: version.url, base64: version.base64, mimeType: version.mimeType });
    }
  };

  const goToNextVersion = () => {
    if (currentVersionIndex < imageVersions.length - 1) {
      const newIndex = currentVersionIndex + 1;
      setCurrentVersionIndex(newIndex);
      const version = imageVersions[newIndex];
      setGeneratedImageData({ url: version.url, base64: version.base64, mimeType: version.mimeType });
    }
  };

  const goToVersion = (index: number) => {
    if (index >= 0 && index < imageVersions.length) {
      setCurrentVersionIndex(index);
      const version = imageVersions[index];
      setGeneratedImageData({ url: version.url, base64: version.base64, mimeType: version.mimeType });
    }
  };

  const handleGenerateVideoClick = () => {
    setShowVideoConfirmModal(true);
  };

  const handleConfirmVideoGeneration = async () => {
    setShowVideoConfirmModal(false);
    await handleGenerateVideo();
  };
  
  const handleGenerateVideo = async () => {
    if (!generatedImageData) return;

    // Verificar que tenemos una clave API disponible
    const apiKey = import.meta.env.VITE_API_KEY || (window as any).__GEMINI_API_KEY__;
    if (!apiKey) {
        setError("Por favor, configura una clave API. La generación de video puede incurrir en costos. Asegúrate de que VITE_API_KEY esté en .env.local o selecciona una clave en Google AI Studio.");
        return;
    }

    setError(null);
    setLoadingMessage('Generando video... Esto puede tardar varios minutos.');
    setIsLoading(true);
    if (generatedVideoData?.url) {
      URL.revokeObjectURL(generatedVideoData.url);
    }
    setGeneratedVideoData(null);

    try {
      // Preparar datos de transición si existen
      let secondImageData: { base64: string; mimeType: string } | null = null;
      let secondImageDescription = '';
      let firstSceneDescription = '';
        
      if (formData.hasTransition) {
        firstSceneDescription = buildFirstSceneDescription(formData);
      }

      // Prioridad: 1. Imagen generada por AI, 2. Imagen subida por usuario
      if (formData.hasTransition) {
        if (generatedSecondImageData) {
           secondImageData = { base64: generatedSecondImageData.base64, mimeType: generatedSecondImageData.mimeType };
           // No necesitamos describir la imagen generada si ya tenemos el prompt, pero para consistencia:
           secondImageDescription = `Escena final con drones formando: ${formData.transitionElements}`;
        } else if (secondImageFile) {
          setLoadingMessage('Procesando segunda imagen para transición...');
          const { mimeType, data } = await fileToBase64(secondImageFile);
          secondImageData = { base64: data, mimeType };
          setLoadingMessage('Analizando la segunda escena de transición...');
          try {
            secondImageDescription = await describeImage(data, mimeType);
          } catch (analysisError) {
            console.warn('No se pudo describir la segunda imagen', analysisError);
          }
        }
      }

      const sceneDescriptions = formData.hasTransition
        ? {
          first: firstSceneDescription,
          second: secondImageDescription,
        }
        : undefined;

      // Pasar datos contextuales para mejorar el prompt del video
      const downloadLink = await generateVideo(
        generatedImageData.base64, 
        generatedImageData.mimeType,
        formData.eventType,
        formData.elements,
        formData.location,
        formData.droneCount,
        undefined, // videoConfig
        secondImageData,
        formData.transitionDescription,
        sceneDescriptions,
        formData.musicStyle
      );
        setLoadingMessage('Descargando video generado...');
        const apiKey = import.meta.env.VITE_API_KEY || (window as any).__GEMINI_API_KEY__;
        const response = await fetch(`${downloadLink}&key=${apiKey}`);
        if (!response.ok) throw new Error(`Error al descargar el video: ${response.statusText}`);
        const videoBlob = await response.blob();
      const videoUrl = URL.createObjectURL(videoBlob);
      const videoBase64 = await blobToBase64(videoBlob);
      const mimeType = videoBlob.type || 'video/mp4';
      setGeneratedVideoData({ url: videoUrl, base64: videoBase64, mimeType });
        showToast("¡Video generado exitosamente! 🎬", "success");
    } catch (err: any) {
        let errorMessage = 'Ocurrió un error inesperado durante la generación del video.';
        if (err.message?.includes("Requested entity was not found")) {
            errorMessage = "La clave API no es válida o no tiene los permisos necesarios. Por favor, selecciona una clave diferente y vuelve a intentarlo.";
        } else if (err.message) {
            errorMessage = err.message;
        }
        setError(errorMessage);
    } finally {
        setIsLoading(false);
        setLoadingMessage('');
    }
  };

  const handleDownload = (url: string, filename: string) => {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    if(url.startsWith('blob:')){
      URL.revokeObjectURL(url);
    }
  };

  const handleSaveProject = useCallback(() => {
    if (!generatedImageData) return;
    const newClient: ClientRecord = {
      id: new Date().toISOString() + Math.random(),
      createdAt: new Date().toISOString(),
      formData: { ...formData },
      generatedImageUrl: generatedImageData.url,
      generatedVideoBase64: generatedVideoData?.base64,
      generatedVideoMimeType: generatedVideoData?.mimeType,
    };
    setClients(prevClients => {
        const updatedClients = [...prevClients, newClient];
        try {
            localStorage.setItem('droneShowClients', JSON.stringify(updatedClients));
            showToast("Proyecto guardado correctamente 💾", "success");
        } catch (e: any) {
            // Si falla por espacio (QuotaExceededError), intentamos guardar sin el video
            if (e.name === 'QuotaExceededError' || e.code === 22 || e.code === 1014) {
                console.warn("LocalStorage lleno, guardando sin video...");
                
                // Crear versión ligera sin el video pesado para localStorage
                const clientWithoutVideo = { 
                  ...newClient, 
                  generatedVideoBase64: undefined, 
                  generatedVideoMimeType: undefined 
                };
                
                // Reemplazar el último elemento con la versión ligera solo para guardar
                const clientsForStorage = [...prevClients, clientWithoutVideo];
                
                try {
                    localStorage.setItem('droneShowClients', JSON.stringify(clientsForStorage));
                    showToast("Guardado (sin video por límite de espacio) 💾", "warning");
                } catch (retryError) {
                    console.error("No se pudo guardar ni siquiera la versión ligera", retryError);
                    showToast("Memoria llena: Borra proyectos antiguos", "error");
                }
            } else {
                console.error("Failed to save client to localStorage", e);
                setError("No se pudo guardar el proyecto.");
                showToast("Error al guardar proyecto", "error");
            }
        }
        // Siempre actualizamos el estado con el cliente completo para que funcione en la sesión actual
        return updatedClients;
    });
    setIsProjectSaved(true);
  }, [formData, generatedImageData, generatedVideoData, showToast]);
  
  const handleReset = () => {
    setFormData(initialFormData);
    setImageFile(null);
    setImageFileName('Subir imagen del lugar (opcional)');
    if (imagePreviewUrl) {
      URL.revokeObjectURL(imagePreviewUrl);
      setImagePreviewUrl(null);
    }
    // Limpiar segunda imagen
    setSecondImageFile(null);
    setSecondImageFileName('Segunda imagen para transición (opcional)');
    if (secondImagePreviewUrl) {
      URL.revokeObjectURL(secondImagePreviewUrl);
      setSecondImagePreviewUrl(null);
    }
    setGeneratedImageData(null);
    setGeneratedSecondImageData(null);
    if (generatedVideoData?.url) {
      URL.revokeObjectURL(generatedVideoData.url);
    }
    setGeneratedVideoData(null);
    setError(null);
    setIsProjectSaved(false);
    setShowReveal(false);
    setImageVersions([]);
    setCurrentVersionIndex(-1);
    setShowVideoConfirmModal(false);
  };

  const fieldLabels: Record<keyof FormData, string> = {
    clientName: "Nombre del Cliente",
    eventType: "Tipo de Evento",
    location: "Ubicación del Evento",
    countryCity: "País / Ciudad",
    droneCount: "Cantidad de Drones",
    elements: "Figuras Deseadas",
    notes: "Notas Adicionales",
    musicStyle: "Estilo Musical",
    hasTransition: "Agregar Transición",
    transitionDescription: "Descripción de la Transición",
    transitionElements: "Figuras Finales (Transición)",
  };

  if (!isAuthenticated) {
    return <Login onLogin={() => setIsAuthenticated(true)} />;
  }

  return (
    <main className="min-h-screen w-full bg-neutral-950 text-neutral-200 flex flex-col items-center p-4 sm:p-6 lg:p-8 font-sans overflow-x-hidden">
      {/* Background Gradient */}
      <div className="fixed inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-neutral-900 via-neutral-950 to-neutral-950"></div>

      {isLoading && <Loader message={loadingMessage} />}
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      
      <div className="w-full max-w-5xl mx-auto relative z-10">
        <header className="flex flex-col md:flex-row items-center justify-between mb-10 border-b border-neutral-800 pb-6">
            <div className="flex items-center gap-4 mb-4 md:mb-0">
                <div className="bg-neutral-800 p-2 rounded-lg border border-neutral-700">
                  <DroneIcon className="w-8 h-8 text-orange-500" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-white tracking-tight">
                      DroneShow Demo <span className="text-neutral-400 font-normal">by Radar <span className="text-orange-500">Crew</span></span>
                  </h1>
                  <p className="text-orange-500 text-xs uppercase tracking-widest font-medium mt-0.5">Professional Suite</p>
                </div>
            </div>
          
            <button onClick={() => setView(v => v === 'form' ? 'list' : 'form')} className="bg-neutral-800 hover:bg-neutral-700 text-neutral-200 hover:text-white font-medium py-2 px-4 rounded-lg transition-colors duration-200 text-sm flex items-center gap-2 border border-neutral-700">
                {view === 'form' ? (
                  <>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
                    Ver Proyectos ({clients.length})
                  </>
                ) : (
                  <>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                    Crear Nuevo
                  </>
                )}
            </button>
        </header>

        {error && (
            <div className="bg-red-900/50 border border-red-700 text-red-300 p-4 rounded-lg mb-6 text-center">
                <p className="font-bold">Error</p>
                <p>{error.split('[')[0]}</p>
                {error.includes("selecciona una clave API") && (
                    <>
                    <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" rel="noopener noreferrer" className="text-orange-400 underline hover:text-orange-300">Consulta la documentación de facturación</a>
                    <button onClick={openApiKeySelector} className="mt-3 bg-orange-600 hover:bg-orange-500 text-white font-bold py-2 px-4 rounded-lg transition">
                        Seleccionar Clave API
                    </button>
                    </>
                )}
            </div>
        )}

        {view === 'list' && (
           <div className="bg-neutral-900 border border-neutral-800 rounded-xl shadow-sm p-6 sm:p-8">
            <div className="flex items-center justify-between mb-8 border-b border-neutral-800 pb-4">
              <h2 className="text-xl font-bold text-white">Proyectos Guardados</h2>
              <span className="text-xs font-medium text-neutral-500 uppercase tracking-wider">Galería</span>
            </div>
            
            {clients.length === 0 ? (
                <div className="text-center py-16 border-2 border-dashed border-neutral-800 rounded-lg">
                  <svg className="w-16 h-16 mx-auto text-neutral-700 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                  </svg>
                  <p className="text-neutral-400 text-lg font-medium mb-1">No hay proyectos guardados</p>
                  <p className="text-neutral-600 text-sm">Crea tu primer proyecto para verlo aquí</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {clients.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).map((client, index) => {
                      const getEventBadgeColor = (eventType: EventType) => {
                        switch(eventType) {
                          case EventType.Boda: return 'bg-pink-900/30 text-pink-400 border-pink-800/50';
                          case EventType.Festival: return 'bg-purple-900/30 text-purple-400 border-purple-800/50';
                          case EventType.Corporativo: return 'bg-blue-900/30 text-blue-400 border-blue-800/50';
                          case EventType.Concierto: return 'bg-red-900/30 text-red-400 border-red-800/50';
                          case EventType.Politica: return 'bg-green-900/30 text-green-400 border-green-800/50';
                          default: return 'bg-neutral-800 text-neutral-400 border-neutral-700';
                        }
                      };

                      const clientSlug = buildFileSlug(client.formData.clientName);

                      return (
                        <div
                          key={client.id}
                          onClick={() => setSelectedClient(client)}
                          className="group relative bg-neutral-950 rounded-lg overflow-hidden border border-neutral-800 hover:border-neutral-600 transition-all duration-200 cursor-pointer shadow-sm hover:shadow-md"
                        >
                            <div className="relative aspect-video bg-neutral-900">
                              <img src={client.generatedImageUrl} alt={`Visualización para ${client.formData.clientName}`} className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity" />
                              <div className="absolute top-3 right-3 z-10">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold border uppercase tracking-wide ${getEventBadgeColor(client.formData.eventType)}`}>
                                  {client.formData.eventType}
                                </span>
                              </div>
                            </div>
                            
                            <div className="p-4">
                                <h3 className="text-base font-bold truncate text-white mb-1 group-hover:text-orange-400 transition-colors">{client.formData.clientName || 'Cliente sin nombre'}</h3>
                                <div className="flex items-center gap-2 text-xs text-neutral-500 mb-3">
                                  <span className="truncate">{client.formData.countryCity}</span>
                                  <span>•</span>
                                  <span>{new Date(client.createdAt).toLocaleDateString('es-ES', { month: 'short', day: 'numeric' })}</span>
                                </div>
                                
                                <div className="flex items-center justify-between pt-3 border-t border-neutral-800">
                                  <div className="flex items-center gap-1 text-xs text-neutral-400 font-medium">
                                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                      <path d="M10 2a.75.75 0 01.75.75v1.5a.75.75 0 01-1.5 0v-1.5A.75.75 0 0110 2zM10 15a.75.75 0 01.75.75v1.5a.75.75 0 01-1.5 0v-1.5A.75.75 0 0110 15zM10 7a3 3 0 100 6 3 3 0 000-6zM15.657 5.404a.75.75 0 10-1.06-1.06l-1.061 1.06a.75.75 0 001.06 1.06l1.06-1.06zM6.464 14.596a.75.75 0 10-1.06-1.06l-1.06 1.06a.75.75 0 001.06 1.06l1.06-1.06z" />
                                    </svg>
                                    <span>{client.formData.droneCount} drones</span>
                                  </div>
                                  
                                  <div className="flex gap-2">
                                    <button
                                        onClick={(e) => {
                                        e.stopPropagation();
                                        handleDownload(client.generatedImageUrl, `${clientSlug}-visual.jpeg`);
                                        }}
                                        className="text-neutral-500 hover:text-white transition-colors"
                                        title="Descargar Imagen"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                                    </button>
                                  </div>
                                </div>
                            </div>
                        </div>
                      );
                    })}
                </div>
            )}
            </div>
        )}

        {view === 'form' && !generatedImageData && (
            <form onSubmit={handleSubmit} className="bg-neutral-900 border border-neutral-800 rounded-xl shadow-sm p-6 sm:p-8 space-y-8">
              {/* Cliente Section */}
              <div className="space-y-4">
                <div className="flex items-center gap-3 mb-4 border-b border-neutral-800 pb-2">
                  <h3 className="text-sm font-bold text-neutral-400 uppercase tracking-wider">Información del Cliente</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label htmlFor="clientName" className="block text-sm font-medium text-neutral-300 mb-1.5">Nombre del cliente</label>
                    <input type="text" id="clientName" name="clientName" value={formData.clientName} onChange={handleInputChange} required className="w-full bg-neutral-950 border border-neutral-700 rounded-md p-2.5 focus:ring-1 focus:ring-orange-500 focus:border-orange-500 outline-none transition text-white placeholder-neutral-600 text-sm" />
                  </div>
                  <div>
                    <label htmlFor="countryCity" className="block text-sm font-medium text-neutral-300 mb-1.5">País / Ciudad</label>
                    <input type="text" id="countryCity" name="countryCity" value={formData.countryCity} onChange={handleInputChange} required placeholder="Ej: Madrid, España" className="w-full bg-neutral-950 border border-neutral-700 rounded-md p-2.5 focus:ring-1 focus:ring-orange-500 focus:border-orange-500 outline-none transition text-white placeholder-neutral-600 text-sm" />
                  </div>
                </div>
              </div>

              {/* Event Section */}
              <div className="space-y-4">
                <div className="flex items-center gap-3 mb-4 border-b border-neutral-800 pb-2">
                  <h3 className="text-sm font-bold text-neutral-400 uppercase tracking-wider">Detalles del Evento</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label htmlFor="eventType" className="block text-sm font-medium text-neutral-300 mb-1.5">Tipo de evento</label>
                    <select id="eventType" name="eventType" value={formData.eventType} onChange={handleInputChange} className="w-full bg-neutral-950 border border-neutral-700 rounded-md p-2.5 focus:ring-1 focus:ring-orange-500 focus:border-orange-500 outline-none transition text-white text-sm">
                      {EVENT_TYPES.map(type => <option key={type.value} value={type.value}>{type.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="location" className="block text-sm font-medium text-neutral-300 mb-1.5">Ubicación del evento</label>
                    <input type="text" id="location" name="location" value={formData.location} onChange={handleInputChange} required placeholder="Ej: Playa de Cancún" className="w-full bg-neutral-950 border border-neutral-700 rounded-md p-2.5 focus:ring-1 focus:ring-orange-500 focus:border-orange-500 outline-none transition text-white placeholder-neutral-600 text-sm" />
                  </div>
                </div>
              </div>

              {/* Show Design Section */}
              <div className="space-y-4">
                <div className="flex items-center gap-3 mb-4 border-b border-neutral-800 pb-2">
                  <h3 className="text-sm font-bold text-neutral-400 uppercase tracking-wider">Diseño del Show</h3>
                </div>
                <div className="space-y-4">
                  <div>
                    <label htmlFor="droneCount" className="block text-sm font-medium text-neutral-300 mb-1.5">Cantidad estimada de drones</label>
                    <input type="number" id="droneCount" name="droneCount" value={formData.droneCount} onChange={handleInputChange} required min="50" step="10" className="w-full bg-neutral-950 border border-neutral-700 rounded-md p-2.5 focus:ring-1 focus:ring-orange-500 focus:border-orange-500 outline-none transition text-white placeholder-neutral-600 text-sm" />
                  </div>
                  <div>
                    <label htmlFor="elements" className="block text-sm font-medium text-neutral-300 mb-1.5">Concepto Creativo / Figuras</label>
                    <textarea id="elements" name="elements" value={formData.elements} onChange={handleInputChange} required rows={3} placeholder="Ej: Logo de la marca, un corazón, una constelación minimalista" className="w-full bg-neutral-950 border border-neutral-700 rounded-md p-2.5 focus:ring-1 focus:ring-orange-500 focus:border-orange-500 outline-none transition text-white placeholder-neutral-600 text-sm"></textarea>
                  </div>
                  <div>
                    <label htmlFor="musicStyle" className="block text-sm font-medium text-neutral-300 mb-1.5">Estilo Musical</label>
                    <select id="musicStyle" name="musicStyle" value={formData.musicStyle} onChange={handleInputChange} className="w-full bg-neutral-950 border border-neutral-700 rounded-md p-2.5 focus:ring-1 focus:ring-orange-500 focus:border-orange-500 outline-none transition text-white text-sm">
                      {MUSIC_STYLES.map(style => <option key={style} value={style}>{style}</option>)}
                    </select>
                  </div>
                </div>
              </div>

              {/* Notes Section */}
              <div className="space-y-4">
                <div className="flex items-center gap-3 mb-4 border-b border-neutral-800 pb-2">
                  <h3 className="text-sm font-bold text-neutral-400 uppercase tracking-wider">Notas Adicionales</h3>
                </div>
                <div>
                  <textarea id="notes" name="notes" value={formData.notes} onChange={handleInputChange} rows={2} placeholder="Detalles adicionales del cliente..." className="w-full bg-neutral-950 border border-neutral-700 rounded-md p-2.5 focus:ring-1 focus:ring-orange-500 focus:border-orange-500 outline-none transition text-white placeholder-neutral-600 text-sm"></textarea>
                </div>
              </div>

              {/* Image Section */}
              <div className="space-y-4">
                <div className="flex items-center gap-3 mb-4 border-b border-neutral-800 pb-2">
                  <h3 className="text-sm font-bold text-neutral-400 uppercase tracking-wider">Imagen de Referencia</h3>
                </div>
                <div>
                  {!imagePreviewUrl ? (
                    <label htmlFor="imageFile" className="w-full cursor-pointer bg-neutral-950 border border-dashed border-neutral-700 rounded-lg p-8 flex flex-col items-center justify-center hover:bg-neutral-900 hover:border-neutral-500 transition-all duration-200">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-neutral-500 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                      <span className="text-neutral-400 font-medium text-sm mb-1">Arrastra o haz clic para subir</span>
                      <span className="text-xs text-neutral-600 truncate max-w-full">{imageFileName}</span>
                    </label>
                  ) : (
                    <div className="relative group">
                      <div className="border border-neutral-700 rounded-lg overflow-hidden bg-neutral-950">
                        <img src={imagePreviewUrl} alt="Vista previa" className="w-full h-48 object-cover opacity-80 group-hover:opacity-100 transition-opacity" />
                      </div>
                      <div className="absolute inset-0 bg-neutral-900/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3 rounded-lg">
                        <label htmlFor="imageFile" className="bg-white text-neutral-900 p-2 rounded-full cursor-pointer hover:bg-neutral-200 transition shadow-sm">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                            <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                          </svg>
                        </label>
                        <button type="button" onClick={handleRemoveImage} className="bg-red-500 text-white p-2 rounded-full hover:bg-red-600 transition shadow-sm">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                          </svg>
                        </button>
                      </div>
                      <p className="mt-2 text-xs text-neutral-400 truncate font-medium">{imageFileName}</p>
                    </div>
                  )}
                  <input type="file" id="imageFile" accept=".jpg,.jpeg,.png" onChange={handleFileChange} className="hidden" />
                </div>
              </div>

              {/* Transiciones Section */}
              <div className="space-y-4">
                <div className="flex items-center gap-3 mb-4 border-b border-neutral-800 pb-2">
                  <h3 className="text-sm font-bold text-neutral-400 uppercase tracking-wider">Transiciones (Opcional)</h3>
                </div>
                <div className="bg-neutral-950 border border-neutral-800 rounded-lg p-4">
                  <div className="mb-4">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={formData.hasTransition || false}
                        onChange={(e) => setFormData(prev => ({ ...prev, hasTransition: e.target.checked }))}
                        className="w-4 h-4 rounded bg-neutral-800 border border-neutral-600 checked:bg-orange-600 cursor-pointer"
                      />
                      <span className="text-neutral-300 text-sm font-medium">Agregar transición de drones</span>
                    </label>
                  </div>

                  {formData.hasTransition && (
                    <div className="space-y-4 pt-4 border-t border-neutral-800">
                      {/* Info box con recomendaciones */}
                      <div className="bg-neutral-900 border border-neutral-800 rounded-md p-3">
                        <div className="flex items-start gap-3">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-orange-500 flex-shrink-0 mt-0.5" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                          </svg>
                          <div>
                            <p className="text-neutral-300 font-medium text-xs mb-1">Guía de Transición</p>
                            <p className="text-neutral-400 text-xs">Describe el movimiento y cambio de color. Los drones siempre serán visibles.</p>
                          </div>
                        </div>
                      </div>
                      
                      <div>
                        <label htmlFor="transitionDescription" className="block text-sm font-medium text-neutral-300 mb-1.5">
                          Descripción de la transición
                        </label>
                        <textarea 
                          id="transitionDescription" 
                          name="transitionDescription" 
                          value={formData.transitionDescription || ''} 
                          onChange={handleInputChange} 
                          rows={2} 
                          placeholder="Ej: Los drones cambian de azul a rosa y se reorganizan formando un corazón"
                          className="w-full bg-neutral-900 border border-neutral-700 rounded-md p-2.5 focus:ring-1 focus:ring-orange-500 focus:border-orange-500 outline-none transition text-white placeholder-neutral-600 text-sm"
                        />
                      </div>

                      <div>
                        <label htmlFor="transitionElements" className="block text-sm font-medium text-neutral-300 mb-1.5">
                          Figuras Finales (Generar con AI)
                        </label>
                        <textarea 
                          id="transitionElements" 
                          name="transitionElements" 
                          value={formData.transitionElements || ''} 
                          onChange={handleInputChange} 
                          rows={2} 
                          placeholder="Ej: Un corazón rojo latiendo, o las iniciales A & B"
                          className="w-full bg-neutral-900 border border-neutral-700 rounded-md p-2.5 focus:ring-1 focus:ring-orange-500 focus:border-orange-500 outline-none transition text-white placeholder-neutral-600 text-sm"
                        />
                      </div>

                      <div className="relative py-2">
                        <div className="absolute inset-0 flex items-center" aria-hidden="true">
                          <div className="w-full border-t border-neutral-800"></div>
                        </div>
                        <div className="relative flex justify-center">
                          <span className="px-2 bg-neutral-950 text-xs text-neutral-500">O subir imagen propia</span>
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-neutral-300 mb-2">Segunda imagen (Referencia manual)</label>
                        {!secondImagePreviewUrl ? (
                          <label htmlFor="secondImageFile" className="w-full cursor-pointer bg-neutral-900 border border-dashed border-neutral-700 rounded-lg p-4 flex flex-col items-center justify-center hover:bg-neutral-800 hover:border-neutral-500 transition-all duration-200">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-neutral-500 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                            <span className="text-neutral-400 font-medium text-xs">Subir imagen</span>
                          </label>
                        ) : (
                          <div className="relative group">
                            <div className="border border-neutral-700 rounded-lg overflow-hidden bg-neutral-950">
                              <img src={secondImagePreviewUrl} alt="Segunda imagen preview" className="w-full h-32 object-cover opacity-80 group-hover:opacity-100 transition-opacity" />
                            </div>
                            <div className="absolute inset-0 bg-neutral-900/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3 rounded-lg">
                              <button type="button" onClick={handleRemoveSecondImage} className="bg-red-500 text-white p-1.5 rounded-full hover:bg-red-600 transition shadow-sm">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                                  <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                                </svg>
                              </button>
                            </div>
                          </div>
                        )}
                        <input type="file" id="secondImageFile" accept=".jpg,.jpeg,.png" onChange={handleSecondImageChange} className="hidden" />
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Submit Button */}
              <button type="submit" disabled={isLoading} className="w-full bg-orange-600 hover:bg-orange-500 text-white font-semibold py-3 px-6 rounded-lg text-base transition-colors duration-200 disabled:bg-neutral-700 disabled:cursor-not-allowed shadow-sm">
                Generar Visualización
              </button>

              <style dangerouslySetInnerHTML={{ __html: `
                /* Removed custom animations for cleaner look */
              `}} />
            </form>
        )}
        
        {view === 'form' && generatedImageData && (
            <div className={`bg-neutral-900 border border-neutral-800 rounded-xl shadow-sm p-6 sm:p-8 transition-all duration-500 ${showReveal ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
                <div className="flex items-center justify-between mb-6 border-b border-neutral-800 pb-4">
                  <h2 className="text-xl font-bold text-white">Visualización Generada</h2>
                  <span className="text-xs font-medium text-neutral-500 uppercase tracking-wider">Preview</span>
                </div>
                
                <div className="mb-8">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="relative rounded-lg overflow-hidden bg-black border border-neutral-800 shadow-lg">
                        <div className="absolute top-2 left-2 z-10 bg-black/50 backdrop-blur px-2 py-1 rounded text-xs font-bold text-white">Inicio</div>
                        {generatedVideoData ? (
                          <video src={generatedVideoData.url} controls autoPlay loop className="w-full h-auto object-contain aspect-video" />
                        ) : (
                            <img src={generatedImageData.url} alt="Drone show visualization" className={`w-full h-auto object-contain transition-all duration-1000 ${showReveal ? 'blur-0' : 'blur-sm'}`}/>
                        )}
                    </div>
                    
                    {generatedSecondImageData && !generatedVideoData && (
                      <div className="relative rounded-lg overflow-hidden bg-black border border-neutral-800 shadow-lg">
                          <div className="absolute top-2 left-2 z-10 bg-black/50 backdrop-blur px-2 py-1 rounded text-xs font-bold text-white">Final (Transición)</div>
                          <img src={generatedSecondImageData.url} alt="Drone show transition end" className={`w-full h-auto object-contain transition-all duration-1000 ${showReveal ? 'blur-0' : 'blur-sm'}`}/>
                      </div>
                    )}
                  </div>
                </div>

                {/* Action Buttons Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                    <button onClick={handleGenerateVideoClick} disabled={isLoading || !!generatedVideoData} className="flex items-center justify-center gap-2 bg-neutral-800 hover:bg-neutral-700 text-white font-medium py-2.5 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed border border-neutral-700 text-sm">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path d="M2 6a2 2 0 012-2h6a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6zM14.553 7.106A1 1 0 0014 8v4a1 1 0 001.553.832l3-2a1 1 0 000-1.664l-3-2z" /></svg>
                      <span>{generatedVideoData ? 'Video Listo' : 'Generar Video'}</span>
                    </button>
                    <button onClick={() => handleDownload(generatedImageData.url, `${buildFileSlug(formData.clientName)}-visual.jpeg`)} disabled={isLoading} className="flex items-center justify-center gap-2 bg-neutral-800 hover:bg-neutral-700 text-white font-medium py-2.5 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed border border-neutral-700 text-sm">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                        <span>Descargar Imagen</span>
                    </button>
                    {generatedVideoData ? (
                        <button onClick={() => handleDownload(buildDataUrl(generatedVideoData.base64, generatedVideoData.mimeType), `${buildFileSlug(formData.clientName)}-show.mp4`)} disabled={isLoading} className="flex items-center justify-center gap-2 bg-neutral-800 hover:bg-neutral-700 text-white font-medium py-2.5 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed border border-neutral-700 text-sm">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                          <span>Descargar Video</span>
                        </button>
                    ) : <div className="hidden md:block"></div>}
                     <button onClick={handleSaveProject} disabled={isLoading || isProjectSaved} className="flex items-center justify-center gap-2 bg-orange-600 hover:bg-orange-500 text-white font-medium py-2.5 px-4 rounded-lg transition-colors disabled:bg-neutral-700 disabled:cursor-not-allowed text-sm shadow-sm">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" /></svg>
                        <span>{isProjectSaved ? 'Guardado' : 'Guardar Proyecto'}</span>
                    </button>
                </div>

                {!generatedVideoData && (
                  <form onSubmit={handleEditSubmit} className="space-y-4 mb-8 bg-neutral-950 p-6 rounded-lg border border-neutral-800">
                      <label htmlFor="editPrompt" className="block text-sm font-medium text-neutral-300">Edición rápida (AI)</label>
                      <div className="flex flex-col sm:flex-row gap-3">
                        <input type="text" id="editPrompt" value={editPrompt} onChange={(e) => setEditPrompt(e.target.value)} placeholder="Ej: Añade un filtro retro, cambia las luces a tonos rojos" className="flex-grow w-full bg-neutral-900 border border-neutral-700 rounded-md p-2.5 focus:ring-1 focus:ring-orange-500 focus:border-orange-500 outline-none transition text-white placeholder-neutral-600 text-sm"/>
                        <button type="submit" disabled={isLoading || !editPrompt} className="bg-neutral-800 hover:bg-neutral-700 text-white font-medium py-2.5 px-6 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed border border-neutral-700 text-sm">
                          Aplicar
                        </button>
                      </div>
                  </form>
                )}

                {/* Galería de Ediciones */}
                {imageVersions.length > 1 && (
                  <div className="mb-8 bg-neutral-950 p-6 rounded-lg border border-neutral-800">
                    <h3 className="text-sm font-bold text-neutral-400 mb-4 flex items-center gap-2 uppercase tracking-wider">
                      Historial de Versiones
                    </h3>
                    <div className="flex items-center gap-4">
                      <button
                        onClick={goToPreviousVersion}
                        disabled={currentVersionIndex <= 0}
                        className="bg-neutral-800 hover:bg-neutral-700 disabled:opacity-50 text-white p-2 rounded-md transition border border-neutral-700"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      </button>
                      
                      <div className="flex-grow overflow-x-auto scrollbar-hide">
                        <div className="flex gap-2 pb-2">
                          {imageVersions.map((version, index) => (
                            <button
                              key={version.id}
                              onClick={() => goToVersion(index)}
                              className={`flex-shrink-0 h-16 w-24 rounded-md overflow-hidden border-2 transition-all ${
                                index === currentVersionIndex
                                  ? 'border-orange-500 ring-1 ring-orange-500/50'
                                  : 'border-neutral-700 hover:border-neutral-500'
                              }`}
                            >
                              <img src={version.url} alt={`Version ${index + 1}`} className="w-full h-full object-cover" />
                            </button>
                          ))}
                        </div>
                      </div>

                      <button
                        onClick={goToNextVersion}
                        disabled={currentVersionIndex >= imageVersions.length - 1}
                        className="bg-neutral-800 hover:bg-neutral-700 disabled:opacity-50 text-white p-2 rounded-md transition border border-neutral-700"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                        </svg>
                      </button>
                    </div>
                    <p className="text-xs text-neutral-500 mt-2 text-center font-mono">
                      {currentVersionIndex === 0 ? 'Original' : `Edición ${currentVersionIndex}`}
                    </p>
                  </div>
                )}

                <button onClick={handleReset} className="w-full bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white font-medium py-3 px-6 rounded-lg transition-colors border border-neutral-700 text-sm">
                    Comenzar Nuevo Proyecto
                </button>
            </div>
        )}
      </div>

      {selectedClient && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 backdrop-blur-sm p-4" onClick={() => setSelectedClient(null)}>
            <div className="bg-neutral-900 border border-neutral-800 rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                <div className="p-6 sm:p-8">
                    <div className="flex justify-between items-start mb-6 border-b border-neutral-800 pb-4">
                        <div>
                          <h2 className="text-xl font-bold text-white">Detalles del Proyecto</h2>
                          <p className="text-sm text-neutral-500 mt-1">ID: {selectedClient.id.slice(0, 8)}...</p>
                        </div>
                        <button onClick={() => setSelectedClient(null)} className="text-neutral-400 hover:text-white p-2 rounded-full hover:bg-neutral-800 transition-colors">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                    </div>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        <div>
                            <h3 className="text-sm font-bold text-neutral-400 uppercase tracking-wider mb-4">Visualización</h3>
                            <div className="rounded-lg overflow-hidden border border-neutral-800 bg-black">
                              <img src={selectedClient.generatedImageUrl} alt="Visualización generada" className="w-full h-auto" />
                            </div>
                            {selectedClient.generatedVideoBase64 && selectedClient.generatedVideoMimeType && (
                              <div className="mt-4 rounded-lg overflow-hidden border border-neutral-800 bg-black">
                                <video
                                  src={buildDataUrl(selectedClient.generatedVideoBase64, selectedClient.generatedVideoMimeType)}
                                  controls
                                  className="w-full h-auto"
                                />
                              </div>
                            )}
                            <div className="mt-6 flex flex-wrap gap-3">
                              <button
                                onClick={() => handleDownload(
                                  selectedClient.generatedImageUrl,
                                  `${buildFileSlug(selectedClient.formData.clientName)}-visual.jpeg`
                                )}
                                className="flex-1 bg-neutral-800 hover:bg-neutral-700 text-white font-medium py-2.5 px-4 rounded-lg text-sm transition border border-neutral-700"
                              >
                                Descargar imagen
                              </button>
                              {selectedClient.generatedVideoBase64 && selectedClient.generatedVideoMimeType && (
                                <button
                                  onClick={() => handleDownload(
                                    buildDataUrl(selectedClient.generatedVideoBase64, selectedClient.generatedVideoMimeType),
                                    `${buildFileSlug(selectedClient.formData.clientName)}-show.mp4`
                                  )}
                                  className="flex-1 bg-neutral-800 hover:bg-neutral-700 text-white font-medium py-2.5 px-4 rounded-lg text-sm transition border border-neutral-700"
                                >
                                  Descargar video
                                </button>
                              )}
                            </div>
                        </div>
                        <div>
                            <h3 className="text-sm font-bold text-neutral-400 uppercase tracking-wider mb-4">Información</h3>
                            <div className="space-y-6">
                                {Object.entries(selectedClient.formData).map(([key, value]) => (
                                    <div key={key} className="border-b border-neutral-800 pb-4 last:border-0">
                                        <p className="text-xs font-medium text-neutral-500 uppercase mb-1">{fieldLabels[key as keyof FormData]}</p>
                                        <p className="text-sm text-neutral-200 whitespace-pre-wrap leading-relaxed">{String(value) || 'N/A'}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
      )}

      {/* Modal de Confirmación de Generación de Video */}
      {showVideoConfirmModal && generatedImageData && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 backdrop-blur-sm p-4" onClick={() => setShowVideoConfirmModal(false)}>
            <div className="bg-neutral-900 border border-neutral-800 rounded-xl shadow-2xl w-full max-w-xl overflow-hidden" onClick={e => e.stopPropagation()}>
                <div className="p-8">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="bg-neutral-800 p-2 rounded-lg">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-orange-500" viewBox="0 0 20 20" fill="currentColor">
                            <path d="M2 6a2 2 0 012-2h6a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6zM14.553 7.106A1 1 0 0014 8v4a1 1 0 001.553.832l3-2a1 1 0 000-1.664l-3-2z" />
                          </svg>
                        </div>
                        <h2 className="text-xl font-bold text-white">Generar Video</h2>
                    </div>
                    
                    <p className="text-neutral-400 text-sm mb-6 leading-relaxed">
                      La generación de video es un proceso intensivo que puede tardar varios minutos. 
                      Se utilizará la imagen actual como base para la animación.
                    </p>
                    
                    {/* Preview de la imagen */}
                    <div className="mb-6">
                      <p className="text-xs font-bold text-neutral-500 uppercase tracking-wider mb-2">Vista previa</p>
                      <div className="relative rounded-lg overflow-hidden border border-neutral-700 bg-black">
                        <img src={generatedImageData.url} alt="Vista previa para video" className="w-full h-48 object-contain" />
                      </div>
                    </div>

                    {/* Información de versión */}
                    {imageVersions.length > 1 && (
                      <div className="mb-6 bg-neutral-950 p-3 rounded border border-neutral-800 flex items-center justify-between">
                        <span className="text-xs font-medium text-neutral-400">Versión seleccionada</span>
                        <span className="text-xs font-bold text-white bg-neutral-800 px-2 py-1 rounded">
                          {imageVersions[currentVersionIndex]?.isOriginal ? 'Original' : `Edición ${currentVersionIndex}`}
                        </span>
                      </div>
                    )}

                    {/* Botones de acción */}
                    <div className="flex gap-3 pt-2">
                      <button
                        onClick={() => setShowVideoConfirmModal(false)}
                        className="flex-1 bg-neutral-800 hover:bg-neutral-700 text-white font-medium py-2.5 px-4 rounded-lg transition-colors border border-neutral-700 text-sm"
                      >
                        Cancelar
                      </button>
                      <button
                        onClick={handleConfirmVideoGeneration}
                        disabled={isLoading}
                        className="flex-1 bg-orange-600 hover:bg-orange-500 text-white font-medium py-2.5 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm text-sm flex items-center justify-center gap-2"
                      >
                        Confirmar y Generar
                      </button>
                    </div>
                </div>
            </div>
        </div>
      )}

      <style dangerouslySetInnerHTML={{ __html: `
        /* Global Dark Mode Refinements */
        body {
          background-color: #0a0a0a; /* neutral-950 */
        }

        /* Input focus effects */
        input:focus, textarea:focus, select:focus {
          box-shadow: 0 0 0 2px rgba(249, 115, 22, 0.2); /* orange-500/20 */
        }

        /* Scrollbar styling */
        ::-webkit-scrollbar {
          width: 8px;
          height: 8px;
        }

        ::-webkit-scrollbar-track {
          background: #171717; /* neutral-900 */
        }

        ::-webkit-scrollbar-thumb {
          background: #404040; /* neutral-700 */
          border-radius: 4px;
        }

        ::-webkit-scrollbar-thumb:hover {
          background: #525252; /* neutral-600 */
        }
      `}} />
    </main>
  );
};

export default App;
