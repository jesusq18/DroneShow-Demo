import React, { useState, useCallback, useEffect } from 'react';
import { FormData, EventType, ClientRecord, ImageVersion } from './types';
import { EVENT_TYPES } from './constants';
import { describeImage, generateImage, editImage, generateVideo } from './services/geminiService';
import DroneIcon from './components/icons/DroneIcon';
import Loader from './components/Loader';
import Toast, { ToastType } from './components/Toast';

const initialFormData: FormData = {
  clientName: '',
  eventType: EventType.Corporativo,
  location: '',
  countryCity: '',
  droneCount: '100',
  elements: '',
  notes: '',
  hasTransition: false,
  transitionDescription: '',
};

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

const App: React.FC = () => {
  const [formData, setFormData] = useState<FormData>(initialFormData);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageFileName, setImageFileName] = useState<string>('Subir imagen del lugar (opcional)');
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  
  // Segunda imagen para transiciones
  const [secondImageFile, setSecondImageFile] = useState<File | null>(null);
  const [secondImageFileName, setSecondImageFileName] = useState<string>('Segunda imagen para transición (opcional)');
  const [secondImagePreviewUrl, setSecondImagePreviewUrl] = useState<string | null>(null);
  
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [loadingMessage, setLoadingMessage] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  
  const [generatedImageData, setGeneratedImageData] = useState<{ url: string; base64: string; mimeType: string; } | null>(null);
  const [generatedVideoUrl, setGeneratedVideoUrl] = useState<string | null>(null);
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
      
      setLoadingMessage('Construyendo el show de drones...');
      let prompt = `Fotografía hiperrealista y profesional de un SHOW NOCTURNO DE DRONES para un evento ${formData.eventType.toLowerCase()} en ${formData.location}, ${formData.countryCity}. 

El show debe formar las siguientes figuras en el cielo: ${formData.elements}. Se utilizan aproximadamente ${formData.droneCount} drones con luces LED de colores vibrantes.`;
      
      if (imageDescription) {
        prompt += ` El entorno del evento se describe así (usar como referencia visual): ${imageDescription}.`;
      } else {
        prompt += ` Muestra el entorno natural o urbano del lugar de forma creíble.`;
      }
      
      if (formData.notes) {
        prompt += ` Detalles adicionales del cliente: ${formData.notes}.`;
      }
      
      prompt += ' La imagen debe tener la calidad de una cámara profesional, con las luces de los drones perfectamente definidas, estelas de luz sutiles y reflejos realistas en superficies cercanas si las hubiera (como agua o edificios). La atmósfera debe ser mágica e impactante. Capturada en horario nocturno con iluminación profesional.';
      
      const generatedImageBase64 = await generateImage(prompt);
      const imageUrl = `data:image/jpeg;base64,${generatedImageBase64}`;
      setGeneratedImageData({ url: imageUrl, base64: generatedImageBase64, mimeType: 'image/jpeg' });

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

    try {
        // Preparar datos de transición si existen
        let secondImageData: { base64: string; mimeType: string } | null = null;
        
        if (formData.hasTransition && secondImageFile) {
            setLoadingMessage('Procesando segunda imagen para transición...');
            const { mimeType, data } = await fileToBase64(secondImageFile);
            secondImageData = { base64: data, mimeType };
        }

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
            formData.transitionDescription
        );
        setLoadingMessage('Descargando video generado...');
        const apiKey = import.meta.env.VITE_API_KEY || (window as any).__GEMINI_API_KEY__;
        const response = await fetch(`${downloadLink}&key=${apiKey}`);
        if (!response.ok) throw new Error(`Error al descargar el video: ${response.statusText}`);
        const videoBlob = await response.blob();
        const videoUrl = URL.createObjectURL(videoBlob);
        setGeneratedVideoUrl(videoUrl);
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
    };
    setClients(prevClients => {
        const updatedClients = [...prevClients, newClient];
        try {
            localStorage.setItem('droneShowClients', JSON.stringify(updatedClients));
            showToast("Proyecto guardado correctamente 💾", "success");
        } catch (e) {
            console.error("Failed to save client to localStorage", e);
            setError("No se pudo guardar el proyecto. El almacenamiento local puede estar lleno.");
            showToast("No se pudo guardar el proyecto. El almacenamiento local puede estar lleno.", "error");
        }
        return updatedClients;
    });
    setIsProjectSaved(true);
  }, [formData, generatedImageData, showToast]);
  
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
    setGeneratedVideoUrl(null);
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
    hasTransition: "Agregar Transición",
    transitionDescription: "Descripción de la Transición",
  };

  return (
    <main className="min-h-screen w-full bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white flex flex-col items-center p-4 sm:p-6 lg:p-8 font-sans overflow-hidden">
      {/* Animated Background Elements */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        {/* Starfield Effect - Reducido para mejor performance */}
        <div className="absolute inset-0">
          {[...Array(20)].map((_, i) => (
            <div
              key={i}
              className="absolute rounded-full bg-cyan-400/20 animate-pulse"
              style={{
                width: Math.random() * 2 + 1 + 'px',
                height: Math.random() * 2 + 1 + 'px',
                left: Math.random() * 100 + '%',
                top: Math.random() * 100 + '%',
                animationDelay: Math.random() * 3 + 's',
                animationDuration: Math.random() * 4 + 3 + 's',
                willChange: 'opacity',
              }}
            />
          ))}
        </div>
        
        {/* Floating Orbs - Optimizado */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl animate-float-slow will-change-transform"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl animate-float-slow will-change-transform" style={{ animationDelay: '2s' }}></div>
      </div>

      {isLoading && <Loader message={loadingMessage} />}
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      
      <div className="w-full max-w-5xl mx-auto relative z-10">
        <header className="text-center mb-8 relative">
            <div className="flex items-center justify-center gap-3 mb-4">
                <div className="relative">
                  <DroneIcon className="w-12 h-12 text-cyan-400 animate-spin-slow" />
                  <div className="absolute inset-0 bg-cyan-400/20 blur-lg rounded-full"></div>
                </div>
                <h1 className="text-5xl sm:text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 via-blue-400 to-cyan-300 animate-pulse-glow">
                    DroneShow Visualizer
                </h1>
                <div className="relative">
                  <DroneIcon className="w-12 h-12 text-blue-400 animate-spin-slow" style={{ animationDelay: '0.5s' }} />
                  <div className="absolute inset-0 bg-blue-400/20 blur-lg rounded-full"></div>
                </div>
            </div>
          <p className="text-slate-400 mt-2 text-sm tracking-widest uppercase font-semibold">Versión Demo Interna</p>
          <div className="absolute top-0 right-0 sm:right-4">
            <button onClick={() => setView(v => v === 'form' ? 'list' : 'form')} className="bg-gradient-to-r from-slate-700 to-slate-600 hover:from-slate-600 hover:to-slate-500 text-white font-bold py-2 px-4 rounded-xl transition-all duration-300 transform hover:scale-110 hover:shadow-lg hover:shadow-cyan-500/50 text-sm flex items-center gap-2 backdrop-blur-sm border border-slate-600/50">
                {view === 'form' ? `📁 Ver Proyectos (${clients.length})` : '✨ Crear Nuevo'}
            </button>
          </div>
        </header>

        {error && (
            <div className="bg-red-900/50 border border-red-700 text-red-300 p-4 rounded-lg mb-6 text-center">
                <p className="font-bold">Error</p>
                <p>{error.split('[')[0]}</p>
                {error.includes("selecciona una clave API") && (
                    <>
                    <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" rel="noopener noreferrer" className="text-cyan-400 underline hover:text-cyan-300">Consulta la documentación de facturación</a>
                    <button onClick={openApiKeySelector} className="mt-3 bg-cyan-600 hover:bg-cyan-500 text-white font-bold py-2 px-4 rounded-lg transition">
                        Seleccionar Clave API
                    </button>
                    </>
                )}
            </div>
        )}

        {view === 'list' && (
           <div className="bg-gradient-to-br from-slate-800/40 to-slate-900/40 backdrop-blur-xl border border-slate-700/50 rounded-2xl shadow-2xl shadow-cyan-500/10 p-6 sm:p-10">
            <h2 className="text-4xl font-black text-center mb-2 text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 via-blue-400 to-cyan-300">Proyectos Guardados</h2>
            <p className="text-center text-slate-400 mb-8 text-sm">Tu galería de visualizaciones de drones</p>
            
            {clients.length === 0 ? (
                <div className="text-center py-16">
                  <svg className="w-32 h-32 mx-auto text-slate-600 mb-6 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                  </svg>
                  <p className="text-slate-400 text-xl font-semibold mb-2">No hay proyectos guardados todavía.</p>
                  <p className="text-slate-500 text-sm">Crea tu primer proyecto para verlo aquí 🚀</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {clients.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).map((client, index) => {
                      const getEventBadgeColor = (eventType: EventType) => {
                        switch(eventType) {
                          case EventType.Boda: return 'bg-pink-500/20 text-pink-300 border-pink-500/50';
                          case EventType.Festival: return 'bg-purple-500/20 text-purple-300 border-purple-500/50';
                          case EventType.Corporativo: return 'bg-blue-500/20 text-blue-300 border-blue-500/50';
                          case EventType.Concierto: return 'bg-red-500/20 text-red-300 border-red-500/50';
                          case EventType.Politica: return 'bg-green-500/20 text-green-300 border-green-500/50';
                          default: return 'bg-slate-500/20 text-slate-300 border-slate-500/50';
                        }
                      };

                      const getEventIcon = (eventType: EventType) => {
                        switch(eventType) {
                          case EventType.Boda: return '💍';
                          case EventType.Festival: return '🎪';
                          case EventType.Corporativo: return '🏢';
                          case EventType.Concierto: return '🎵';
                          case EventType.Politica: return '🗳️';
                          default: return '📋';
                        }
                      };

                      return (
                        <div
                          key={client.id}
                          onClick={() => setSelectedClient(client)}
                          className="group relative bg-gradient-to-br from-slate-800/50 to-slate-900/50 rounded-2xl overflow-hidden border border-slate-700/50 hover:border-cyan-500/50 transition-all duration-300 cursor-pointer transform hover:-translate-y-3 hover:shadow-2xl hover:shadow-cyan-500/30 animate-fade-in-up backdrop-blur-sm"
                          style={{ animationDelay: `${index * 100}ms` }}
                        >
                            {/* Gradient overlay on hover */}
                            <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"></div>
                            
                            <div className="relative">
                              <img src={client.generatedImageUrl} alt={`Visualización para ${client.formData.clientName}`} className="w-full h-48 object-cover group-hover:scale-110 transition-transform duration-300" />
                              <div className="absolute top-3 right-3 z-10">
                                <span className={`px-3 py-1 rounded-full text-xs font-bold border backdrop-blur-lg ${getEventBadgeColor(client.formData.eventType)}`}>
                                  {getEventIcon(client.formData.eventType)} {client.formData.eventType}
                                </span>
                              </div>
                            </div>
                            
                            <div className="p-5 relative z-5">
                                <h3 className="text-lg font-bold truncate text-white mb-2 group-hover:text-cyan-300 transition">{client.formData.clientName || 'Cliente sin nombre'}</h3>
                                <div className="flex items-center gap-2 text-sm text-slate-400 mb-3">
                                  <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                                  </svg>
                                  <span className="truncate">{client.formData.countryCity}</span>
                                </div>
                                
                                {/* Divider */}
                                <div className="h-px bg-gradient-to-r from-slate-700/50 to-transparent mb-3"></div>
                                
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-1 text-xs text-cyan-400 font-semibold">
                                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                      <path d="M10 2a.75.75 0 01.75.75v1.5a.75.75 0 01-1.5 0v-1.5A.75.75 0 0110 2zM10 15a.75.75 0 01.75.75v1.5a.75.75 0 01-1.5 0v-1.5A.75.75 0 0110 15zM10 7a3 3 0 100 6 3 3 0 000-6zM15.657 5.404a.75.75 0 10-1.06-1.06l-1.061 1.06a.75.75 0 001.06 1.06l1.06-1.06zM6.464 14.596a.75.75 0 10-1.06-1.06l-1.06 1.06a.75.75 0 001.06 1.06l1.06-1.06z" />
                                    </svg>
                                    <span>{client.formData.droneCount} drones</span>
                                  </div>
                                  <p className="text-xs text-slate-500 font-medium">{new Date(client.createdAt).toLocaleDateString('es-ES', { month: 'short', day: 'numeric', year: 'numeric' })}</p>
                                </div>
                            </div>
                        </div>
                      );
                    })}
                </div>
            )}

            <style dangerouslySetInnerHTML={{ __html: `
              @keyframes fade-in-up {
                from {
                  opacity: 0;
                  transform: translateY(20px);
                }
                to {
                  opacity: 1;
                  transform: translateY(0);
                }
              }
              .animate-fade-in-up {
                animation: fade-in-up 0.6s ease-out forwards;
                opacity: 0;
                will-change: transform, opacity;
              }
            `}} />
            </div>
        )}

        {view === 'form' && !generatedImageData && (
            <form onSubmit={handleSubmit} className="bg-gradient-to-br from-slate-800/40 to-slate-900/40 backdrop-blur-xl border border-slate-700/50 rounded-2xl shadow-2xl shadow-cyan-500/10 p-6 sm:p-10 space-y-8">
              {/* Cliente Section */}
              <div className="space-y-4">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-r from-cyan-400 to-blue-500 flex items-center justify-center">
                    <span className="text-white font-bold text-sm">👤</span>
                  </div>
                  <h3 className="text-lg font-bold text-cyan-300 uppercase tracking-wider">Información del Cliente</h3>
                  <div className="flex-grow h-px bg-gradient-to-r from-cyan-400/30 to-transparent"></div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-800/30 p-6 rounded-xl border border-slate-700/30 hover:border-slate-700/60 transition">
                  <div>
                    <label htmlFor="clientName" className="block text-sm font-semibold text-slate-300 mb-2">Nombre del cliente</label>
                    <input type="text" id="clientName" name="clientName" value={formData.clientName} onChange={handleInputChange} required className="w-full bg-slate-700/50 border border-slate-600/50 rounded-lg p-3 focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none transition backdrop-blur-sm hover:border-slate-600 text-white placeholder-slate-500" />
                  </div>
                  <div>
                    <label htmlFor="countryCity" className="block text-sm font-semibold text-slate-300 mb-2">País / Ciudad</label>
                    <input type="text" id="countryCity" name="countryCity" value={formData.countryCity} onChange={handleInputChange} required placeholder="Ej: Madrid, España" className="w-full bg-slate-700/50 border border-slate-600/50 rounded-lg p-3 focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none transition backdrop-blur-sm hover:border-slate-600 text-white placeholder-slate-500" />
                  </div>
                </div>
              </div>

              {/* Event Section */}
              <div className="space-y-4">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-r from-purple-400 to-pink-500 flex items-center justify-center">
                    <span className="text-white font-bold text-sm">🎪</span>
                  </div>
                  <h3 className="text-lg font-bold text-purple-300 uppercase tracking-wider">Detalles del Evento</h3>
                  <div className="flex-grow h-px bg-gradient-to-r from-purple-400/30 to-transparent"></div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-800/30 p-6 rounded-xl border border-slate-700/30 hover:border-slate-700/60 transition">
                  <div>
                    <label htmlFor="eventType" className="block text-sm font-semibold text-slate-300 mb-2">Tipo de evento</label>
                    <select id="eventType" name="eventType" value={formData.eventType} onChange={handleInputChange} className="w-full bg-slate-700/50 border border-slate-600/50 rounded-lg p-3 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none transition backdrop-blur-sm hover:border-slate-600 text-white">
                      {EVENT_TYPES.map(type => <option key={type.value} value={type.value}>{type.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="location" className="block text-sm font-semibold text-slate-300 mb-2">Ubicación del evento</label>
                    <input type="text" id="location" name="location" value={formData.location} onChange={handleInputChange} required placeholder="Ej: Playa de Cancún" className="w-full bg-slate-700/50 border border-slate-600/50 rounded-lg p-3 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none transition backdrop-blur-sm hover:border-slate-600 text-white placeholder-slate-500" />
                  </div>
                </div>
              </div>

              {/* Show Design Section */}
              <div className="space-y-4">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-r from-green-400 to-emerald-500 flex items-center justify-center">
                    <span className="text-white font-bold text-sm">🎨</span>
                  </div>
                  <h3 className="text-lg font-bold text-green-300 uppercase tracking-wider">Diseño del Show</h3>
                  <div className="flex-grow h-px bg-gradient-to-r from-green-400/30 to-transparent"></div>
                </div>
                <div className="space-y-4 bg-slate-800/30 p-6 rounded-xl border border-slate-700/30 hover:border-slate-700/60 transition">
                  <div>
                    <label htmlFor="droneCount" className="block text-sm font-semibold text-slate-300 mb-2">Cantidad estimada de drones</label>
                    <input type="number" id="droneCount" name="droneCount" value={formData.droneCount} onChange={handleInputChange} required min="50" step="10" className="w-full bg-slate-700/50 border border-slate-600/50 rounded-lg p-3 focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none transition backdrop-blur-sm hover:border-slate-600 text-white placeholder-slate-500" />
                  </div>
                  <div>
                    <label htmlFor="elements" className="block text-sm font-semibold text-slate-300 mb-2">Elementos o figuras deseadas</label>
                    <textarea id="elements" name="elements" value={formData.elements} onChange={handleInputChange} required rows={3} placeholder="Ej: Logo de la marca, un corazón, fuegos artificiales" className="w-full bg-slate-700/50 border border-slate-600/50 rounded-lg p-3 focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none transition backdrop-blur-sm hover:border-slate-600 text-white placeholder-slate-500"></textarea>
                  </div>
                </div>
              </div>

              {/* Notes Section */}
              <div className="space-y-4">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-r from-orange-400 to-red-500 flex items-center justify-center">
                    <span className="text-white font-bold text-sm">📝</span>
                  </div>
                  <h3 className="text-lg font-bold text-orange-300 uppercase tracking-wider">Notas Adicionales</h3>
                  <div className="flex-grow h-px bg-gradient-to-r from-orange-400/30 to-transparent"></div>
                </div>
                <div className="bg-slate-800/30 p-6 rounded-xl border border-slate-700/30 hover:border-slate-700/60 transition">
                  <textarea id="notes" name="notes" value={formData.notes} onChange={handleInputChange} rows={2} placeholder="Detalles adicionales del cliente..." className="w-full bg-slate-700/50 border border-slate-600/50 rounded-lg p-3 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition backdrop-blur-sm hover:border-slate-600 text-white placeholder-slate-500"></textarea>
                </div>
              </div>

              {/* Image Section */}
              <div className="space-y-4">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-r from-indigo-400 to-violet-500 flex items-center justify-center">
                    <span className="text-white font-bold text-sm">🖼️</span>
                  </div>
                  <h3 className="text-lg font-bold text-indigo-300 uppercase tracking-wider">Imagen de Referencia</h3>
                  <div className="flex-grow h-px bg-gradient-to-r from-indigo-400/30 to-transparent"></div>
                </div>
                <div className="bg-slate-800/30 p-6 rounded-xl border border-slate-700/30 hover:border-slate-700/60 transition">
                  {!imagePreviewUrl ? (
                    <label htmlFor="imageFile" className="w-full cursor-pointer bg-gradient-to-br from-slate-700/30 to-slate-800/30 border-2 border-dashed border-slate-600/50 rounded-xl p-8 flex flex-col items-center justify-center hover:bg-slate-700/50 hover:border-indigo-500/50 transition-all duration-300">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-indigo-400 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                      <span className="text-indigo-400 font-semibold mb-1">Arrastra o haz clic para subir</span>
                      <span className="text-sm text-slate-400 truncate max-w-full">{imageFileName}</span>
                    </label>
                  ) : (
                    <div className="relative group">
                      <div className="border-2 border-indigo-500 rounded-xl overflow-hidden bg-slate-900 shadow-2xl shadow-indigo-500/30">
                        <img src={imagePreviewUrl} alt="Vista previa" className="w-full h-48 object-cover" />
                      </div>
                      <div className="absolute inset-0 bg-slate-900/70 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3 rounded-xl">
                        <label htmlFor="imageFile" className="bg-indigo-600 hover:bg-indigo-500 text-white p-3 rounded-full cursor-pointer transition transform hover:scale-110 shadow-lg">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                            <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                          </svg>
                        </label>
                        <button type="button" onClick={handleRemoveImage} className="bg-red-600 hover:bg-red-500 text-white p-3 rounded-full transition transform hover:scale-110 shadow-lg">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                          </svg>
                        </button>
                      </div>
                      <p className="mt-2 text-sm text-indigo-400 truncate font-semibold">{imageFileName}</p>
                    </div>
                  )}
                  <input type="file" id="imageFile" accept=".jpg,.jpeg,.png" onChange={handleFileChange} className="hidden" />
                </div>
              </div>

              {/* Transiciones Section */}
              <div className="space-y-4">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-r from-cyan-400 to-blue-500 flex items-center justify-center">
                    <span className="text-white font-bold text-sm">🔄</span>
                  </div>
                  <h3 className="text-lg font-bold text-cyan-300 uppercase tracking-wider">Transiciones de Drones (Opcional)</h3>
                  <div className="flex-grow h-px bg-gradient-to-r from-cyan-400/30 to-transparent"></div>
                </div>
                <div className="bg-slate-800/30 p-6 rounded-xl border border-slate-700/30 hover:border-slate-700/60 transition">
                  <div className="mb-4">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={formData.hasTransition || false}
                        onChange={(e) => setFormData(prev => ({ ...prev, hasTransition: e.target.checked }))}
                        className="w-5 h-5 rounded bg-slate-700/50 border border-slate-600 checked:bg-cyan-500 cursor-pointer"
                      />
                      <span className="text-slate-300 font-semibold">Agregar transición de drones (los mismos drones cambian de color y forman una segunda figura)</span>
                    </label>
                  </div>

                  {formData.hasTransition && (
                    <div className="space-y-4 pt-4 border-t border-slate-700">
                      <p className="text-sm text-slate-400">Los drones de la primera figura cambiarán de color y se reorganizarán para formar la segunda figura.</p>
                      
                      <div>
                        <label htmlFor="transitionDescription" className="block text-sm font-semibold text-slate-300 mb-2">Describe la transición (ej: "De azul a rosa con explosión de luces")</label>
                        <textarea 
                          id="transitionDescription" 
                          name="transitionDescription" 
                          value={formData.transitionDescription || ''} 
                          onChange={handleInputChange} 
                          rows={2} 
                          placeholder="Ej: Los drones azules explotan en todas direcciones, parpadean, y regresan formando un corazón en rosa pálido"
                          className="w-full bg-slate-700/50 border border-slate-600/50 rounded-lg p-3 focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none transition backdrop-blur-sm hover:border-slate-600 text-white placeholder-slate-500"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-semibold text-slate-300 mb-3">Segunda imagen (lo que verán después de la transición)</label>
                        {!secondImagePreviewUrl ? (
                          <label htmlFor="secondImageFile" className="w-full cursor-pointer bg-gradient-to-br from-slate-700/30 to-slate-800/30 border-2 border-dashed border-slate-600/50 rounded-xl p-6 flex flex-col items-center justify-center hover:bg-slate-700/50 hover:border-cyan-500/50 transition-all duration-300">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-cyan-400 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                            <span className="text-cyan-400 font-semibold mb-1 text-sm">Arrastra o haz clic para subir</span>
                            <span className="text-xs text-slate-400 truncate max-w-full">{secondImageFileName}</span>
                          </label>
                        ) : (
                          <div className="relative group">
                            <div className="border-2 border-cyan-500 rounded-xl overflow-hidden bg-slate-900 shadow-2xl shadow-cyan-500/30">
                              <img src={secondImagePreviewUrl} alt="Segunda imagen preview" className="w-full h-40 object-cover" />
                            </div>
                            <div className="absolute inset-0 bg-slate-900/70 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3 rounded-xl">
                              <label htmlFor="secondImageFile" className="bg-cyan-600 hover:bg-cyan-500 text-white p-2 rounded-full cursor-pointer transition transform hover:scale-110 shadow-lg">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                  <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                                </svg>
                              </label>
                              <button type="button" onClick={handleRemoveSecondImage} className="bg-red-600 hover:bg-red-500 text-white p-2 rounded-full transition transform hover:scale-110 shadow-lg">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                  <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                                </svg>
                              </button>
                            </div>
                            <p className="mt-2 text-xs text-cyan-400 truncate font-semibold">{secondImageFileName}</p>
                          </div>
                        )}
                        <input type="file" id="secondImageFile" accept=".jpg,.jpeg,.png" onChange={handleSecondImageChange} className="hidden" />
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Submit Button */}
              <button type="submit" disabled={isLoading} className="w-full bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-black py-4 px-6 rounded-xl text-lg transition-all duration-300 ease-in-out transform hover:scale-105 hover:shadow-2xl hover:shadow-cyan-500/50 disabled:bg-slate-600 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:hover:shadow-none uppercase tracking-wider">
                ✨ Generar Visual del Show
              </button>

              <style dangerouslySetInnerHTML={{ __html: `
                @keyframes float-slow {
                  0%, 100% { transform: translateY(0px) scale(1); }
                  50% { transform: translateY(-20px) scale(1.02); }
                }
                @keyframes spin-slow {
                  from { transform: rotate(0deg); }
                  to { transform: rotate(360deg); }
                }
                @keyframes pulse-glow {
                  0%, 100% { text-shadow: 0 0 15px rgba(34, 211, 238, 0.5); }
                  50% { text-shadow: 0 0 30px rgba(34, 211, 238, 0.7); }
                }
                .animate-float-slow {
                  animation: float-slow 6s ease-in-out infinite;
                }
                .animate-spin-slow {
                  animation: spin-slow 8s linear infinite;
                }
                .animate-pulse-glow {
                  animation: pulse-glow 3s ease-in-out infinite;
                }
              `}} />
            </form>
        )}
        
        {view === 'form' && generatedImageData && (
            <div className={`bg-gradient-to-br from-slate-800/40 to-slate-900/40 backdrop-blur-xl border border-slate-700/50 rounded-2xl shadow-2xl shadow-cyan-500/10 p-6 sm:p-10 transition-all duration-1000 ${showReveal ? 'opacity-100 scale-100' : 'opacity-0 scale-95'}`}>
                <h2 className="text-3xl font-black text-center mb-8 text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 via-blue-400 to-cyan-300">✨ Visualización Generada</h2>
                
                <div className="mb-8">
                  <div className="relative group">
                    {/* Cinema frame effect - exterior */}
                    <div className="absolute -inset-1 bg-gradient-to-r from-cyan-600 via-blue-600 to-cyan-600 rounded-2xl blur opacity-75 group-hover:opacity-100 transition duration-300"></div>
                    
                    {/* Cinema frame - border */}
                    <div className="absolute -inset-0.5 bg-gradient-to-r from-slate-900 to-slate-800 rounded-2xl"></div>
                    
                    {/* Main content */}
                    <div className="relative bg-black rounded-xl overflow-hidden shadow-2xl">
                        {/* Gradient overlay for light effect */}
                        <div className="absolute inset-0 bg-gradient-to-t from-slate-900/30 via-transparent to-slate-900/20 pointer-events-none z-20"></div>
                        
                        {generatedVideoUrl ? (
                            <video src={generatedVideoUrl} controls autoPlay loop className="w-full h-auto object-contain aspect-video" />
                        ) : (
                            <img src={generatedImageData.url} alt="Drone show visualization" className={`w-full h-auto object-contain transition-all duration-1000 ${showReveal ? 'blur-0 drop-shadow-2xl' : 'blur-xl'}`}/>
                        )}
                        
                        {/* Shine effect */}
                        {showReveal && (
                          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-shimmer pointer-events-none"></div>
                        )}
                    </div>
                  </div>
                </div>

                {/* Action Buttons Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                    <button onClick={handleGenerateVideoClick} disabled={isLoading || !!generatedVideoUrl} className="relative group bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white font-bold py-3 px-4 rounded-xl transition-all disabled:bg-slate-600 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm transform hover:scale-110 hover:shadow-lg hover:shadow-blue-500/50 disabled:hover:scale-100 disabled:hover:shadow-none uppercase tracking-wider">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M2 6a2 2 0 012-2h6a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6zM14.553 7.106A1 1 0 0014 8v4a1 1 0 001.553.832l3-2a1 1 0 000-1.664l-3-2z" /></svg>
                        <span className="hidden sm:inline">{generatedVideoUrl ? 'Video ✓' : 'Video'}</span>
                    </button>
                    <button onClick={() => handleDownload(generatedImageData.url, 'drone-show.jpeg')} disabled={isLoading} className="relative group bg-gradient-to-r from-teal-600 to-emerald-500 hover:from-teal-500 hover:to-emerald-400 text-white font-bold py-3 px-4 rounded-xl transition-all disabled:bg-slate-600 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm transform hover:scale-110 hover:shadow-lg hover:shadow-teal-500/50 disabled:hover:scale-100 disabled:hover:shadow-none uppercase tracking-wider">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                        <span className="hidden sm:inline">Imagen</span>
                    </button>
                    {generatedVideoUrl ? (
                        <button onClick={() => handleDownload(generatedVideoUrl, 'drone-show.mp4')} disabled={isLoading} className="relative group bg-gradient-to-r from-teal-600 to-emerald-500 hover:from-teal-500 hover:to-emerald-400 text-white font-bold py-3 px-4 rounded-xl transition-all disabled:bg-slate-600 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm transform hover:scale-110 hover:shadow-lg hover:shadow-teal-500/50 disabled:hover:scale-100 disabled:hover:shadow-none uppercase tracking-wider">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                          <span className="hidden sm:inline">Video</span>
                        </button>
                    ) : <div className="hidden md:block"></div>}
                     <button onClick={handleSaveProject} disabled={isLoading || isProjectSaved} className="relative group bg-gradient-to-r from-green-600 to-emerald-500 hover:from-green-500 hover:to-emerald-400 text-white font-bold py-3 px-4 rounded-xl transition-all disabled:bg-slate-600 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm transform hover:scale-110 hover:shadow-lg hover:shadow-green-500/50 disabled:hover:scale-100 disabled:hover:shadow-none uppercase tracking-wider">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" /></svg>
                        <span className="hidden sm:inline">{isProjectSaved ? 'Guardado ✓' : 'Guardar'}</span>
                    </button>
                </div>

                {!generatedVideoUrl && (
                  <form onSubmit={handleEditSubmit} className="space-y-4 mb-8 bg-slate-800/30 p-6 rounded-xl border border-slate-700/30">
                      <label htmlFor="editPrompt" className="block text-sm font-semibold text-slate-300">¿Quieres hacer un cambio? Describe tu edición:</label>
                      <div className="flex flex-col sm:flex-row gap-4">
                        <input type="text" id="editPrompt" value={editPrompt} onChange={(e) => setEditPrompt(e.target.value)} placeholder="Ej: Añade un filtro retro, cambia las luces a tonos rojos" className="flex-grow w-full bg-slate-700/50 border border-slate-600/50 rounded-lg p-3 focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none transition backdrop-blur-sm hover:border-slate-600 text-white placeholder-slate-500"/>
                        <button type="submit" disabled={isLoading || !editPrompt} className="bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold py-3 px-6 rounded-lg transition-all duration-300 transform hover:scale-105 hover:shadow-lg hover:shadow-cyan-500/50 disabled:bg-slate-600 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:hover:shadow-none uppercase tracking-wider">
                          Editar ✨
                        </button>
                      </div>
                  </form>
                )}

                {/* Galería de Ediciones */}
                {imageVersions.length > 1 && (
                  <div className="mb-8 bg-slate-800/30 p-6 rounded-xl border border-slate-700/30">
                    <h3 className="text-lg font-bold text-slate-300 mb-4 flex items-center gap-2">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-cyan-400" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" />
                      </svg>
                      Historial de Ediciones ({imageVersions.length})
                    </h3>
                    <div className="flex items-center gap-4">
                      <button
                        onClick={goToPreviousVersion}
                        disabled={currentVersionIndex <= 0}
                        className="bg-slate-700/50 hover:bg-slate-700 disabled:bg-slate-800 disabled:cursor-not-allowed text-white p-2 rounded-lg transition flex items-center justify-center"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      </button>
                      
                      <div className="flex-grow overflow-x-auto scrollbar-hide">
                        <div className="flex gap-2 pb-2">
                          {imageVersions.map((version, index) => (
                            <button
                              key={version.id}
                              onClick={() => goToVersion(index)}
                              className={`flex-shrink-0 h-16 w-24 rounded-lg overflow-hidden border-2 transition transform hover:scale-105 ${
                                index === currentVersionIndex
                                  ? 'border-cyan-400 shadow-lg shadow-cyan-500/50'
                                  : 'border-slate-600 hover:border-slate-500'
                              }`}
                            >
                              <img src={version.url} alt={`Version ${index + 1}`} className="w-full h-full object-cover" />
                              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent px-1 py-1 text-xs text-white text-center">
                                {version.isOriginal ? 'Original' : `V${index}`}
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>

                      <button
                        onClick={goToNextVersion}
                        disabled={currentVersionIndex >= imageVersions.length - 1}
                        className="bg-slate-700/50 hover:bg-slate-700 disabled:bg-slate-800 disabled:cursor-not-allowed text-white p-2 rounded-lg transition flex items-center justify-center"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                        </svg>
                      </button>
                    </div>
                    <p className="text-xs text-slate-400 mt-3 text-center">
                      Versión {currentVersionIndex + 1} de {imageVersions.length} {imageVersions[currentVersionIndex]?.editPrompt ? `• "${imageVersions[currentVersionIndex].editPrompt}"` : ''}
                    </p>
                  </div>
                )}

                <button onClick={handleReset} className="w-full bg-gradient-to-r from-slate-700 to-slate-600 hover:from-slate-600 hover:to-slate-500 text-white font-bold py-4 px-6 rounded-xl transition-all duration-300 transform hover:scale-105 hover:shadow-lg hover:shadow-slate-500/50 uppercase tracking-wider">
                    ↻ Empezar de Nuevo
                </button>

                <style dangerouslySetInnerHTML={{ __html: `
                  @keyframes shimmer {
                    0% { transform: translateX(-100%); }
                    100% { transform: translateX(100%); }
                  }
                  .animate-shimmer {
                    animation: shimmer 2s ease-in-out;
                    will-change: transform;
                  }
                `}} />
            </div>
        )}
      </div>

      {selectedClient && (
        <div className="fixed inset-0 bg-slate-900 bg-opacity-80 flex items-center justify-center z-50 backdrop-blur-sm p-4" onClick={() => setSelectedClient(null)}>
            <div className="bg-slate-800 border border-slate-700 rounded-xl shadow-lg w-full max-w-4xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                <div className="p-6 sm:p-8">
                    <div className="flex justify-between items-start mb-4">
                        <h2 className="text-2xl font-bold text-cyan-400">Detalles del Proyecto</h2>
                        <button onClick={() => setSelectedClient(null)} className="text-slate-400 hover:text-white p-1 rounded-full"><svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
                    </div>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        <div>
                            <h3 className="text-xl font-semibold mb-4 text-white">Visualización</h3>
                            <img src={selectedClient.generatedImageUrl} alt="Visualización generada" className="rounded-lg border border-slate-600 w-full" />
                        </div>
                        <div>
                            <h3 className="text-xl font-semibold mb-4 text-white">Información</h3>
                            <div className="space-y-4 text-slate-300">
                                {Object.entries(selectedClient.formData).map(([key, value]) => (
                                    <div key={key}>
                                        <p className="text-sm font-medium text-slate-400">{fieldLabels[key as keyof FormData]}</p>
                                        <p className="text-base text-white whitespace-pre-wrap">{String(value) || 'N/A'}</p>
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
        <div className="fixed inset-0 bg-slate-900 bg-opacity-90 flex items-center justify-center z-50 backdrop-blur-sm p-4" onClick={() => setShowVideoConfirmModal(false)}>
            <div className="bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700 rounded-2xl shadow-2xl shadow-blue-500/20 w-full max-w-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
                <div className="p-8">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="relative">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-blue-400 animate-spin-slow" viewBox="0 0 20 20" fill="currentColor">
                            <path d="M2 6a2 2 0 012-2h6a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6zM14.553 7.106A1 1 0 0014 8v4a1 1 0 001.553.832l3-2a1 1 0 000-1.664l-3-2z" />
                          </svg>
                        </div>
                        <h2 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-300 to-cyan-300">¿Generar Video?</h2>
                    </div>
                    
                    <p className="text-slate-300 mb-6">La generación de video puede tardar varios minutos. Verifica que la imagen actual sea la que deseas animar.</p>
                    
                    {/* Preview de la imagen */}
                    <div className="mb-6">
                      <p className="text-sm font-semibold text-slate-400 mb-3">Vista previa de la imagen a animar:</p>
                      <div className="relative group rounded-xl overflow-hidden border-2 border-slate-700 hover:border-cyan-400/50 transition">
                        <img src={generatedImageData.url} alt="Vista previa para video" className="w-full h-auto object-contain bg-black" />
                        <div className="absolute inset-0 bg-gradient-to-t from-slate-900/50 via-transparent to-transparent pointer-events-none"></div>
                      </div>
                    </div>

                    {/* Información de versión */}
                    {imageVersions.length > 1 && (
                      <div className="mb-6 bg-slate-700/30 p-4 rounded-lg border border-slate-600/50">
                        <p className="text-xs font-semibold text-slate-400 mb-2">VERSIÓN ACTUAL</p>
                        <p className="text-white font-semibold">
                          {imageVersions[currentVersionIndex]?.isOriginal ? 'Imagen Original' : `Edición ${currentVersionIndex}`}
                        </p>
                        {imageVersions[currentVersionIndex]?.editPrompt && (
                          <p className="text-sm text-slate-300 mt-2 italic">"{imageVersions[currentVersionIndex]?.editPrompt}"</p>
                        )}
                      </div>
                    )}

                    {/* Botones de acción */}
                    <div className="flex gap-4">
                      <button
                        onClick={() => setShowVideoConfirmModal(false)}
                        className="flex-1 bg-gradient-to-r from-slate-700 to-slate-600 hover:from-slate-600 hover:to-slate-500 text-white font-bold py-3 px-6 rounded-lg transition-all duration-300 transform hover:scale-105 uppercase tracking-wider"
                      >
                        ← Volver
                      </button>
                      <button
                        onClick={handleConfirmVideoGeneration}
                        disabled={isLoading}
                        className="flex-1 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white font-bold py-3 px-6 rounded-lg transition-all duration-300 transform hover:scale-105 disabled:bg-slate-600 disabled:cursor-not-allowed disabled:hover:scale-100 shadow-lg shadow-blue-500/50 hover:shadow-blue-500/70 uppercase tracking-wider flex items-center justify-center gap-2"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                          <path d="M2 6a2 2 0 012-2h6a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6zM14.553 7.106A1 1 0 0014 8v4a1 1 0 001.553.832l3-2a1 1 0 000-1.664l-3-2z" />
                        </svg>
                        Generar Video
                      </button>
                    </div>
                </div>
            </div>
        </div>
      )}

      <style dangerouslySetInnerHTML={{ __html: `
        /* Global Dark Mode Refinements */
        body {
          background: linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%);
          background-attachment: fixed;
        }

        /* Optimized transitions - use transform for better performance */
        button, input, textarea, select, .group {
          transition: transform 0.2s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        }

        /* Input focus effects */
        input:focus, textarea:focus, select:focus {
          box-shadow: 0 0 0 3px rgba(34, 211, 238, 0.1), inset 0 0 0 2px rgba(34, 211, 238, 0.2);
        }

        /* Scrollbar styling */
        ::-webkit-scrollbar {
          width: 10px;
          height: 10px;
        }

        ::-webkit-scrollbar-track {
          background: rgba(15, 23, 42, 0.5);
          border-radius: 5px;
        }

        ::-webkit-scrollbar-thumb {
          background: linear-gradient(180deg, rgba(34, 211, 238, 0.6), rgba(59, 130, 246, 0.6));
          border-radius: 5px;
          will-change: transform;
        }

        ::-webkit-scrollbar-thumb:hover {
          background: linear-gradient(180deg, rgba(34, 211, 238, 0.8), rgba(59, 130, 246, 0.8));
        }

        /* Button glow effect - optimized */
        button:not(:disabled):hover {
          box-shadow: 0 0 15px currentColor;
          transform: translateY(-2px);
        }

        /* Card hover effect */
        .group:hover {
          box-shadow: 0 15px 20px -5px rgba(34, 211, 238, 0.15);
          transform: translateY(-8px);
        }

        /* Backdrop blur support */
        .backdrop-blur-xl {
          backdrop-filter: blur(20px) brightness(1.02);
        }

        /* Animation optimizations */
        @keyframes float-slow {
          0%, 100% { transform: translateY(0px) scale(1); }
          50% { transform: translateY(-20px) scale(1.02); }
        }
        
        @keyframes spin-slow {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        
        @keyframes pulse-glow {
          0%, 100% { text-shadow: 0 0 15px rgba(34, 211, 238, 0.5); }
          50% { text-shadow: 0 0 30px rgba(34, 211, 238, 0.7); }
        }
        
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        
        @keyframes fade-in-up {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .animate-float-slow {
          animation: float-slow 6s ease-in-out infinite;
          will-change: transform;
        }
        
        .animate-spin-slow {
          animation: spin-slow 8s linear infinite;
          will-change: transform;
        }
        
        .animate-pulse-glow {
          animation: pulse-glow 3s ease-in-out infinite;
        }
        
        .animate-shimmer {
          animation: shimmer 2s ease-in-out;
        }
        
        .animate-fade-in-up {
          animation: fade-in-up 0.6s ease-out forwards;
          opacity: 0;
        }
        
        /* GPU acceleration hints */
        .group, button, .animate-float-slow {
          transform: translateZ(0);
          backface-visibility: hidden;
          perspective: 1000px;
        }

        /* Reduce paint operations */
        img {
          will-change: auto;
          contain: layout style paint;
        }
      `}} />
    </main>
  );
};

export default App;
