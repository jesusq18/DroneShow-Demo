import React, { useState, useCallback, useEffect } from 'react';
import { FormData, EventType, ClientRecord } from './types';
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
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [loadingMessage, setLoadingMessage] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  
  const [generatedImageData, setGeneratedImageData] = useState<{ url: string; base64: string; mimeType: string; } | null>(null);
  const [generatedVideoUrl, setGeneratedVideoUrl] = useState<string | null>(null);
  const [editPrompt, setEditPrompt] = useState<string>('');
  const [showReveal, setShowReveal] = useState<boolean>(false);

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
      let prompt = `Fotografía hiperrealista y profesional de un show nocturno de drones con luces LED de colores vibrantes en ${formData.location}, ${formData.countryCity}. El show debe formar las siguientes figuras en el cielo: ${formData.elements}. Se utilizan aproximadamente ${formData.droneCount} drones.`;
      
      if (imageDescription) {
        prompt += ` El entorno del evento se describe así (usar como referencia visual): ${imageDescription}.`;
      } else {
        prompt += ` Muestra el entorno natural o urbano del lugar de forma creíble.`;
      }
      prompt += ' La imagen debe tener la calidad de una cámara profesional, con las luces de los drones perfectamente definidas, estelas de luz sutiles y reflejos realistas en superficies cercanas si las hubiera (como agua o edificios). La atmósfera debe ser mágica e impactante.';
      
      const generatedImageBase64 = await generateImage(prompt);
      const imageUrl = `data:image/jpeg;base64,${generatedImageBase64}`;
      setGeneratedImageData({ url: imageUrl, base64: generatedImageBase64, mimeType: 'image/jpeg' });

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
  
  const handleGenerateVideo = async () => {
    if (!generatedImageData) return;

    const hasKey = await (window as any).aistudio?.hasSelectedApiKey();
    if (!hasKey) {
        setError("Por favor, selecciona una clave API para generar videos. La generación de video puede incurrir en costos. [Consulta la documentación de facturación de Google AI](https://ai.google.dev/gemini-api/docs/billing).");
        return;
    }

    setError(null);
    setLoadingMessage('Generando video... Esto puede tardar varios minutos.');
    setIsLoading(true);

    try {
        const downloadLink = await generateVideo(generatedImageData.base64, generatedImageData.mimeType);
        setLoadingMessage('Descargando video generado...');
        const response = await fetch(`${downloadLink}&key=${process.env.API_KEY}`);
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
    setGeneratedImageData(null);
    setGeneratedVideoUrl(null);
    setError(null);
    setIsProjectSaved(false);
    setShowReveal(false);
  };

  const fieldLabels: Record<keyof FormData, string> = {
    clientName: "Nombre del Cliente",
    eventType: "Tipo de Evento",
    location: "Ubicación del Evento",
    countryCity: "País / Ciudad",
    droneCount: "Cantidad de Drones",
    elements: "Figuras Deseadas",
    notes: "Notas Adicionales",
  };

  return (
    <main className="min-h-screen w-full bg-slate-900 text-white flex flex-col items-center p-4 sm:p-6 lg:p-8 font-sans">
      {isLoading && <Loader message={loadingMessage} />}
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      
      <div className="w-full max-w-5xl mx-auto">
        <header className="text-center mb-8 relative">
            <div className="flex items-center justify-center gap-3">
                <DroneIcon className="w-10 h-10 text-cyan-400"/>
                <h1 className="text-4xl sm:text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500">
                    DroneShow Visualizer
                </h1>
            </div>
          <p className="text-slate-400 mt-2">Versión Demo Interna</p>
          <div className="absolute top-0 right-0 sm:right-4">
            <button onClick={() => setView(v => v === 'form' ? 'list' : 'form')} className="bg-slate-700 hover:bg-slate-600 text-white font-bold py-2 px-4 rounded-lg transition text-sm flex items-center gap-2">
                {view === 'form' ? `Ver Proyectos (${clients.length})` : 'Crear Nuevo'}
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
           <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-xl shadow-lg p-6 sm:p-8">
            <h2 className="text-3xl font-bold text-center mb-6 text-cyan-400">Proyectos Guardados</h2>
            {clients.length === 0 ? (
                <div className="text-center py-12">
                  <svg className="w-24 h-24 mx-auto text-slate-600 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                  </svg>
                  <p className="text-slate-400 text-lg">No hay proyectos guardados todavía.</p>
                  <p className="text-slate-500 text-sm mt-2">Crea tu primer proyecto para verlo aquí</p>
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
                          className="bg-slate-800 rounded-lg overflow-hidden border border-slate-700 hover:border-cyan-500 transition-all duration-300 cursor-pointer transform hover:-translate-y-2 shadow-lg hover:shadow-cyan-500/30 animate-fade-in-up"
                          style={{ animationDelay: `${index * 100}ms` }}
                        >
                            <div className="relative">
                              <img src={client.generatedImageUrl} alt={`Visualización para ${client.formData.clientName}`} className="w-full h-40 object-cover" />
                              <div className="absolute top-2 right-2">
                                <span className={`px-3 py-1 rounded-full text-xs font-semibold border backdrop-blur-sm ${getEventBadgeColor(client.formData.eventType)}`}>
                                  {getEventIcon(client.formData.eventType)} {client.formData.eventType}
                                </span>
                              </div>
                              {/* Gradient overlay */}
                              <div className="absolute inset-0 bg-gradient-to-t from-slate-900/60 to-transparent"></div>
                            </div>
                            <div className="p-4">
                                <h3 className="text-lg font-bold truncate text-white mb-1">{client.formData.clientName || 'Cliente sin nombre'}</h3>
                                <div className="flex items-center gap-2 text-sm text-slate-400 mb-2">
                                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                                  </svg>
                                  <span className="truncate">{client.formData.countryCity}</span>
                                </div>
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-1 text-xs text-cyan-400">
                                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                      <path d="M10 2a.75.75 0 01.75.75v1.5a.75.75 0 01-1.5 0v-1.5A.75.75 0 0110 2zM10 15a.75.75 0 01.75.75v1.5a.75.75 0 01-1.5 0v-1.5A.75.75 0 0110 15zM10 7a3 3 0 100 6 3 3 0 000-6zM15.657 5.404a.75.75 0 10-1.06-1.06l-1.061 1.06a.75.75 0 001.06 1.06l1.06-1.06zM6.464 14.596a.75.75 0 10-1.06-1.06l-1.06 1.06a.75.75 0 001.06 1.06l1.06-1.06zM18 10a.75.75 0 01-.75.75h-1.5a.75.75 0 010-1.5h1.5A.75.75 0 0118 10zM5 10a.75.75 0 01-.75.75h-1.5a.75.75 0 010-1.5h1.5A.75.75 0 015 10zM14.596 15.657a.75.75 0 001.06-1.06l-1.06-1.061a.75.75 0 10-1.06 1.06l1.06 1.06zM5.404 6.464a.75.75 0 001.06-1.06l-1.06-1.06a.75.75 0 10-1.061 1.06l1.06 1.06z" />
                                    </svg>
                                    <span>{client.formData.droneCount} drones</span>
                                  </div>
                                  <p className="text-xs text-slate-500">{new Date(client.createdAt).toLocaleDateString()}</p>
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
              }
            `}} />
            </div>
        )}

        {view === 'form' && !generatedImageData && (
            <form onSubmit={handleSubmit} className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-xl shadow-lg p-6 sm:p-8 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label htmlFor="clientName" className="block text-sm font-medium text-slate-300 mb-2">Nombre del cliente</label>
                  <input type="text" id="clientName" name="clientName" value={formData.clientName} onChange={handleInputChange} required className="w-full bg-slate-700 border border-slate-600 rounded-md p-3 focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none transition" />
                </div>
                <div>
                  <label htmlFor="eventType" className="block text-sm font-medium text-slate-300 mb-2">Tipo de evento</label>
                  <select id="eventType" name="eventType" value={formData.eventType} onChange={handleInputChange} className="w-full bg-slate-700 border border-slate-600 rounded-md p-3 focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none transition">
                    {EVENT_TYPES.map(type => <option key={type.value} value={type.value}>{type.label}</option>)}
                  </select>
                </div>
                <div>
                  <label htmlFor="location" className="block text-sm font-medium text-slate-300 mb-2">Ubicación del evento</label>
                  <input type="text" id="location" name="location" value={formData.location} onChange={handleInputChange} required placeholder="Ej: Playa de Cancún" className="w-full bg-slate-700 border border-slate-600 rounded-md p-3 focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none transition" />
                </div>
                 <div>
                  <label htmlFor="countryCity" className="block text-sm font-medium text-slate-300 mb-2">País / Ciudad</label>
                  <input type="text" id="countryCity" name="countryCity" value={formData.countryCity} onChange={handleInputChange} required placeholder="Ej: Madrid, España" className="w-full bg-slate-700 border border-slate-600 rounded-md p-3 focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none transition" />
                </div>
                <div className="md:col-span-2">
                  <label htmlFor="droneCount" className="block text-sm font-medium text-slate-300 mb-2">Cantidad estimada de drones</label>
                  <input type="number" id="droneCount" name="droneCount" value={formData.droneCount} onChange={handleInputChange} required min="50" step="10" className="w-full bg-slate-700 border border-slate-600 rounded-md p-3 focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none transition" />
                </div>
              </div>
              <div>
                <label htmlFor="elements" className="block text-sm font-medium text-slate-300 mb-2">Elementos o figuras deseadas</label>
                <textarea id="elements" name="elements" value={formData.elements} onChange={handleInputChange} required rows={3} placeholder="Ej: Logo de la marca, un corazón, fuegos artificiales" className="w-full bg-slate-700 border border-slate-600 rounded-md p-3 focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none transition"></textarea>
              </div>
              <div>
                <label htmlFor="notes" className="block text-sm font-medium text-slate-300 mb-2">Descripción libre / notas (opcional)</label>
                <textarea id="notes" name="notes" value={formData.notes} onChange={handleInputChange} rows={2} placeholder="Detalles adicionales del cliente..." className="w-full bg-slate-700 border border-slate-600 rounded-md p-3 focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none transition"></textarea>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Imagen de referencia del lugar</label>
                {!imagePreviewUrl ? (
                  <label htmlFor="imageFile" className="w-full cursor-pointer bg-slate-700 border-2 border-dashed border-slate-600 rounded-md p-4 flex flex-col items-center justify-center hover:bg-slate-600/50 hover:border-cyan-500 transition">
                    <span className="text-cyan-400"><svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg></span>
                    <span className="mt-2 text-sm text-slate-300 truncate max-w-full">{imageFileName}</span>
                  </label>
                ) : (
                  <div className="relative group">
                    <div className="border-2 border-cyan-500 rounded-lg overflow-hidden bg-slate-800 shadow-lg shadow-cyan-500/20">
                      <img src={imagePreviewUrl} alt="Vista previa" className="w-full h-48 object-cover" />
                    </div>
                    <div className="absolute inset-0 bg-slate-900/70 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                      <label htmlFor="imageFile" className="bg-cyan-600 hover:bg-cyan-500 text-white p-3 rounded-full cursor-pointer transition transform hover:scale-110">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                          <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                        </svg>
                      </label>
                      <button type="button" onClick={handleRemoveImage} className="bg-red-600 hover:bg-red-500 text-white p-3 rounded-full transition transform hover:scale-110">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                      </button>
                    </div>
                    <p className="mt-2 text-sm text-cyan-300 truncate">{imageFileName}</p>
                  </div>
                )}
                <input type="file" id="imageFile" accept=".jpg,.jpeg,.png" onChange={handleFileChange} className="hidden" />
              </div>
              <button type="submit" disabled={isLoading} className="w-full bg-cyan-600 hover:bg-cyan-500 text-white font-bold py-4 px-6 rounded-lg text-lg transition duration-300 ease-in-out transform hover:scale-105 disabled:bg-slate-600 disabled:cursor-not-allowed">
                Generar visual del show
              </button>
            </form>
        )}
        
        {view === 'form' && generatedImageData && (
            <div className={`bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-xl shadow-lg p-6 sm:p-8 transition-all duration-1000 ${showReveal ? 'opacity-100 scale-100' : 'opacity-0 scale-95'}`}>
                <h2 className="text-2xl font-bold text-center mb-4 text-cyan-400 animate-pulse">✨ Visualización Generada</h2>
                <div className="mb-6 border-2 border-cyan-700 rounded-lg overflow-hidden shadow-2xl bg-black relative group">
                    {/* Shimmer effect overlay */}
                    {showReveal && (
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-cyan-400/20 to-transparent animate-shimmer pointer-events-none z-10"></div>
                    )}
                    {generatedVideoUrl ? (
                        <video src={generatedVideoUrl} controls autoPlay loop className="w-full h-auto object-contain aspect-video" />
                    ) : (
                        <img src={generatedImageData.url} alt="Drone show visualization" className={`w-full h-auto object-contain transition-all duration-1000 ${showReveal ? 'blur-0' : 'blur-xl'}`}/>
                    )}
                </div>

                <style dangerouslySetInnerHTML={{ __html: `
                  @keyframes shimmer {
                    0% { transform: translateX(-100%); }
                    100% { transform: translateX(100%); }
                  }
                  .animate-shimmer {
                    animation: shimmer 2s ease-in-out;
                  }
                `}} />
                
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    <button onClick={handleGenerateVideo} disabled={isLoading || !!generatedVideoUrl} className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 px-4 rounded-lg transition disabled:bg-slate-600 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M2 6a2 2 0 012-2h6a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6zM14.553 7.106A1 1 0 0014 8v4a1 1 0 001.553.832l3-2a1 1 0 000-1.664l-3-2z" /></svg>
                        <span>{generatedVideoUrl ? 'Video Generado' : 'Generar Video'}</span>
                    </button>
                    <button onClick={() => handleDownload(generatedImageData.url, 'drone-show.jpeg')} disabled={isLoading} className="bg-teal-600 hover:bg-teal-500 text-white font-bold py-3 px-4 rounded-lg transition disabled:bg-slate-600 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                        <span>Imagen</span>
                    </button>
                    {generatedVideoUrl ? (
                        <button onClick={() => handleDownload(generatedVideoUrl, 'drone-show.mp4')} disabled={isLoading} className="bg-teal-600 hover:bg-teal-500 text-white font-bold py-3 px-4 rounded-lg transition disabled:bg-slate-600 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                          <span>Video</span>
                        </button>
                    ) : <div className="hidden md:block"></div>}
                     <button onClick={handleSaveProject} disabled={isLoading || isProjectSaved} className="bg-green-600 hover:bg-green-500 text-white font-bold py-3 px-4 rounded-lg transition disabled:bg-slate-600 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" /></svg>
                        <span>{isProjectSaved ? 'Guardado ✓' : 'Guardar'}</span>
                    </button>
                </div>

                {!generatedVideoUrl && (
                  <form onSubmit={handleEditSubmit} className="space-y-4 mb-6">
                      <label htmlFor="editPrompt" className="block text-sm font-medium text-slate-300">¿Quieres hacer un cambio? Describe tu edición:</label>
                      <div className="flex flex-col sm:flex-row gap-4">
                        <input type="text" id="editPrompt" value={editPrompt} onChange={(e) => setEditPrompt(e.target.value)} placeholder="Ej: Añade un filtro retro, cambia las luces a tonos rojos" className="flex-grow w-full bg-slate-700 border border-slate-600 rounded-md p-3 focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none transition"/>
                        <button type="submit" disabled={isLoading || !editPrompt} className="bg-cyan-600 hover:bg-cyan-500 text-white font-bold py-3 px-6 rounded-lg transition duration-300 ease-in-out transform hover:scale-105 disabled:bg-slate-600 disabled:cursor-not-allowed">
                          Editar Imagen
                        </button>
                      </div>
                  </form>
                )}

                <button onClick={handleReset} className="w-full bg-slate-600 hover:bg-slate-500 text-white font-bold py-3 px-6 rounded-lg transition duration-300">
                    Empezar de Nuevo
                </button>
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
    </main>
  );
};

export default App;
