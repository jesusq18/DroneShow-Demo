import { GoogleGenAI, Modality } from "@google/genai";
import { EventType, VideoConfig, VideoStyle, AnimationSpeed, MusicStyle } from "../types";

// Usar API key del archivo .env.local para inicialización por defecto
// En la app, se usa AI Studio para seleccionar la clave interactivamente
const DEFAULT_API_KEY = import.meta.env.VITE_API_KEY || '';

// Función auxiliar para obtener la instancia de AI con la clave correcta
const getAIInstance = () => {
    // Intentar usar la clave de AI Studio si está disponible
    const apiKey = (window as any).__GEMINI_API_KEY__ || DEFAULT_API_KEY;
    
    if (!apiKey) {
        console.warn('No API key found. Please configure VITE_API_KEY or use AI Studio key selector.');
    }
    
    return new GoogleGenAI({ apiKey });
};

let ai = getAIInstance();

export const describeImage = async (base64Data: string, mimeType: string): Promise<string> => {
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: {
                parts: [
                    {
                        inlineData: {
                            mimeType: mimeType,
                            data: base64Data,
                        },
                    },
                    {
                        text: 'Describe esta imagen de una ubicación para un evento en detalle, enfocándote en el ambiente, la hora del día, y los elementos geográficos o arquitectónicos clave. Esta descripción se usará para generar una imagen de un show de drones en este lugar.',
                    },
                ],
            },
        });
        return response.text;
    } catch (error) {
        console.error("Error describing image:", error);
        throw new Error("Failed to analyze the uploaded image.");
    }
};

/**
 * Genera un prompt contextual basado en el tipo de evento y configuración
 */
const generateEventContextualPrompt = (
    eventType: EventType,
    elements: string,
    location: string,
    droneCount: string,
    style: VideoStyle,
    speed: AnimationSpeed,
    effectsIntensity: string,
    includeParticles: boolean,
    includeTrails: boolean,
    cameraMovement: string
): string => {
    const speedMap = {
        'slow': 'lento y fluido, cada movimiento deliberado',
        'medium': 'rítmico y equilibrado',
        'fast': 'dinámico y energético, con movimientos rápidos',
        'dynamic': 'muy dinámico, alternando entre secciones rápidas y lentas',
    };

    const styleDescriptions = {
        'magical': 'mágico y onírico, con sensación de fantasía y maravilla',
        'energetic': 'energético y emocionante, con vitalidad pura',
        'professional': 'profesional y sofisticado, elegante y controlado',
        'romantic': 'romántico y delicado, emotivo y sensible',
        'dramatic': 'dramático e impactante, con momentos de tensión y liberación',
        'playful': 'divertido y juguetón, con movimientos creativos y desenfadados',
    };

    const effectsMap = {
        'subtle': 'efectos muy sutiles y refinados',
        'moderate': 'efectos moderados y visibles',
        'intense': 'efectos visuales intensos y llamativos',
    };

    const particlesText = includeParticles ? 'Incluye partículas de luz, polvo brillante y reflejos.' : '';
    const trailsText = includeTrails ? 'Los drones dejan estelas de luz brillante en su trayectoria.' : '';
    const cameraText = cameraMovement === 'static' ? 'Mantén la cámara estática.' : cameraMovement === 'gentle' ? 'La cámara se mueve suavemente.' : 'La cámara se mueve de manera dinámica siguiendo la acción.';

    let eventSpecificPrompt = '';

    switch (eventType) {
        case EventType.Boda:
            eventSpecificPrompt = `Este es un show de drones para una BODA. El ambiente debe ser ${styleDescriptions['romantic']}. 
            Anima los drones formando corazones, anillos, y figuras románticas (${elements}). 
            Los movimientos deben ser ${speedMap['slow']}, con transiciones suaves y elegantes. 
            La iluminación debe incluir tonos dorados, rosa pálido y blanco puro. 
            Crea una atmósfera de celebración romántica con elegancia absoluta.`;
            break;

        case EventType.Concierto:
            eventSpecificPrompt = `Este es un show de drones para un CONCIERTO. El ambiente debe ser ${styleDescriptions['energetic']}.
            Los drones deben formar (${elements}) mientras se sincronizan con ritmo musical.
            Los movimientos son ${speedMap[speed]}, con cambios dinámicos de forma y luz.
            Incluye sincronización rítmica, explosiones de luz y efectos visuales impactantes.
            Aproximadamente ${droneCount} drones crean patrones complejos en ${location}.
            La energía es contagiosa y el impacto visual es máximo.`;
            break;

        case EventType.Corporativo:
            eventSpecificPrompt = `Este es un show de drones para un EVENTO CORPORATIVO. El ambiente debe ser ${styleDescriptions['professional']}.
            Los drones animan el logo y elementos de marca (${elements}) de manera limpia y profesional.
            Los movimientos son ${speedMap['medium']}, precisos y controlados, reflejando profesionalismo.
            La iluminación mantiene los colores corporativos con tonos azul, gris y plateado.
            En ${location}, aproximadamente ${droneCount} drones ejecutan transiciones perfectas.
            El efecto final es impactante pero manteniendo sofisticación.`;
            break;

        case EventType.Festival:
            eventSpecificPrompt = `Este es un show de drones para un FESTIVAL. El ambiente debe ser ${styleDescriptions['playful']}.
            Los drones crean figuras divertidas y creativas (${elements}) sobre ${location}.
            Los movimientos son ${speedMap['dynamic']}, con giros inesperados y cambios coloridos constantes.
            Utiliza una paleta multicolor vibrante: púrpura, verde neón, amarillo, rosa y azul.
            Con ${droneCount} drones, crea una experiencia visualmente abrumadora y alegre.
            El efecto es divertido, sorprendente y altamente instagram-worthy.`;
            break;

        case EventType.Politica:
            eventSpecificPrompt = `Este es un show de drones para un EVENTO POLÍTICO. El ambiente debe ser ${styleDescriptions['dramatic']}.
            Los drones animan símbolos, banderas y elementos (${elements}) de manera impactante.
            Los movimientos son ${speedMap['medium']}, con momentos de tensión dramática y liberación de energía.
            La iluminación utiliza rojo, blanco y azul con efectos de luz muy estudiados.
            En ${location}, ${droneCount} drones crean formaciones imponentes y memorables.
            El impacto emocional y político es el objetivo principal.`;
            break;

        default:
            eventSpecificPrompt = `Anima este show de drones de forma ${styleDescriptions[style]}.
            Los drones crean formas de (${elements}) en movimiento ${speedMap[speed]}.
            En ${location}, aproximadamente ${droneCount} drones ejecutan la coreografía.
            El efecto visual es ${effectsMap[effectsIntensity]}.`;
    }

    // Construir prompt completo
    const completePrompt = `${eventSpecificPrompt}

INSTRUCCIONES DE ANIMACIÓN:
- Velocidad: ${speedMap[speed]}
- Intensidad de efectos: ${effectsMap[effectsIntensity]}
- ${particlesText}
- ${trailsText}
- ${cameraText}
- Las luces de los drones deben parpadear y brillar de manera natural.
- Las transiciones entre formaciones deben ser suaves pero definitivas.
- La música o ritmo (si aplica) debe verse sincronizado con el movimiento.
- El video debe ser cinematográfico y de calidad broadcast.
- Duración aproximada: 15-30 segundos con impacto máximo.`;

    return completePrompt;
};

/**
 * Determina el estilo de video óptimo basado en el tipo de evento
 */
const getDefaultStyleForEvent = (eventType: EventType): VideoStyle => {
    switch (eventType) {
        case EventType.Boda: return 'romantic';
        case EventType.Concierto: return 'energetic';
        case EventType.Corporativo: return 'professional';
        case EventType.Festival: return 'playful';
        case EventType.Politica: return 'dramatic';
        default: return 'magical';
    }
};

/**
 * Genera un prompt mejorado y contextual para la generación de videos de drones
 * Incluye contexto de negocio y análisis de la imagen de referencia
 */
const generateDroneShowVideoPrompt = (
    eventType: EventType,
    elements: string,
    location: string,
    droneCount: string,
    style: VideoStyle,
    speed: AnimationSpeed,
    effectsIntensity: string,
    includeParticles: boolean,
    includeTrails: boolean,
    cameraMovement: string,
    transitionDescription?: string,
    musicStyle?: MusicStyle
): string => {
    // Contexto simplificado
    const businessContext = `
CONTEXTO: Show de drones profesional con luces LED.
UBICACIÓN: ${location}
ELEMENTOS: ${elements}
CANTIDAD: ${droneCount} drones
`;

    const speedDescriptions = {
        'slow': 'lento y elegante',
        'medium': 'ritmo natural',
        'fast': 'rápido y dinámico',
        'dynamic': 'variable',
    };

    // Instrucción de audiencia obligatoria
    const audienceInstruction = `
AUDIENCIA (OBLIGATORIO):
- SIEMPRE incluir un grupo de personas en la parte inferior del video observando el show.
- Las personas deben verse de espaldas o perfil, mirando hacia el cielo con asombro.
- Esto es crucial para dar escala y realismo a la escena.
`;

    // Prompt simplificado sin lógica de eventos compleja
    const eventPrompt = `Show de drones formando ${elements}. Movimiento ${speedDescriptions[speed]}.`;

    const transitionNarrative = transitionDescription
    ? `TRANSICIÓN: Los drones se reorganizan para formar: ${transitionDescription}.`
    : `Los drones mantienen la formación o cambian suavemente.`;

    const musicInstruction = musicStyle 
    ? `RITMO: Los drones se mueven al ritmo de música estilo ${musicStyle}.` 
    : '';

    // Prompt final limpio
    return `${businessContext}

${eventPrompt}

${audienceInstruction}

${transitionNarrative}

${musicInstruction}

INSTRUCCIONES DE CALIDAD:
- Video fotorrealista y cinematográfico.
- SOLO drones LED (puntos de luz).
- NO humo, NO fuego, NO polvo, NO confeti, NO aviones.
- Imagen limpia y nítida.
- Las luces de los drones parpadean naturalmente.
`;
};

/**
 * Genera prompt especializado para transiciones de drones
 * Los mismos drones cambian de color y se reorganizan
 */
const generateTransitionPrompt = (
    firstImageDescription: string,
    secondImageDescription: string,
    transitionDescription: string,
    elements: string,
    droneCount: string,
    speed: AnimationSpeed,
    effectsIntensity: string
): string => {
    return `
TRANSICIÓN DE DRONES:

ESCENA 1: ${firstImageDescription}
ESCENA 2: ${secondImageDescription}
ACCIÓN: ${transitionDescription}

AUDIENCIA (OBLIGATORIO):
- Incluir personas observando el show desde abajo en todo momento.

INSTRUCCIONES:
- Video realista.
- Los mismos drones se reorganizan.
- NO humo, NO efectos mágicos.
- Movimiento ${speed}.
`;
};

export const generateImage = async (prompt: string): Promise<string> => {
    try {
        const response = await ai.models.generateImages({
            model: 'imagen-4.0-generate-001',
            prompt: prompt,
            config: {
                numberOfImages: 1,
                aspectRatio: '16:9',
                outputMimeType: 'image/jpeg',
            }
        });

        if (response.generatedImages && response.generatedImages.length > 0) {
            return response.generatedImages[0].image.imageBytes;
        } else {
            throw new Error("No image was generated.");
        }
    } catch (error) {
        console.error("Error generating image:", error);
        throw new Error("Failed to generate the drone show image.");
    }
};


export const editImage = async (base64Data: string, mimeType: string, prompt: string): Promise<{ base64: string, mimeType: string }> => {
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image',
            contents: {
                parts: [
                    {
                        inlineData: {
                            data: base64Data,
                            mimeType: mimeType,
                        },
                    },
                    {
                        text: prompt,
                    },
                ],
            },
            config: {
                responseModalities: [Modality.IMAGE],
            },
        });

        const imagePart = response.candidates?.[0]?.content?.parts?.find(part => part.inlineData);
        if (imagePart && imagePart.inlineData) {
            return {
                base64: imagePart.inlineData.data,
                mimeType: imagePart.inlineData.mimeType,
            };
        } else {
            throw new Error("No edited image was returned.");
        }
    } catch (error) {
        console.error("Error editing image:", error);
        throw new Error("Failed to edit the image.");
    }
};

export const generateVideo = async (
    base64ImageData: string, 
    mimeType: string,
    eventType?: EventType,
    elements?: string,
    location?: string,
    droneCount?: string,
    videoConfig?: VideoConfig,
    secondImageData?: { base64: string; mimeType: string } | null,
    transitionDescription?: string,
    sceneDescriptions?: { first?: string; second?: string },
    musicStyle?: MusicStyle
): Promise<string> => {
    // Usar la instancia de AI con la clave correcta (ya sea de .env o AI Studio)
    const videoAI = getAIInstance();
    
    try {
        // Usar configuración por defecto si no se proporciona
        const finalConfig: VideoConfig = videoConfig || {
            style: eventType ? getDefaultStyleForEvent(eventType) : 'magical',
            speed: 'dynamic',
            effectsIntensity: 'moderate',
            includeParticles: true,
            includeTrails: true,
            cameraMovement: 'gentle',
            durationSeconds: 8, // Máxima calidad: 8 segundos
            resolution: '720p', // 720p para mejor balance velocidad/calidad
            aspectRatio: '16:9', // Estándar cinematográfico
        };

        // Generar prompt mejorado con contexto de negocio
        let videoPrompt = '';
        
        // Si hay transición, usar prompt especializado
        if (secondImageData && transitionDescription) {
            const firstScene = sceneDescriptions?.first || 'Describe con precisión la escena inicial usando la primera imagen proporcionada.';
            const secondScene = sceneDescriptions?.second || 'Describe detalladamente la escena final usando la segunda imagen proporcionada.';
            videoPrompt = generateTransitionPrompt(
                firstScene,
                secondScene,
                transitionDescription,
                elements || "",
                droneCount || "100",
                finalConfig.speed,
                finalConfig.effectsIntensity
            );
            console.log(`🎬 Transición de drones detectada - dos imágenes serán procesadas`);
        } else if (eventType && elements && location && droneCount) {
            videoPrompt = generateDroneShowVideoPrompt(
                eventType,
                elements,
                location,
                droneCount,
                finalConfig.style,
                finalConfig.speed,
                finalConfig.effectsIntensity,
                finalConfig.includeParticles,
                finalConfig.includeTrails,
                finalConfig.cameraMovement,
                transitionDescription,
                musicStyle
            );
        } else {
            videoPrompt = 'Animate this drone show. Include people watching from below. No smoke, no fire, just LED drones.';
        }

        // Negative prompt para evitar artefactos comunes y elementos no deseados
        const negativePrompt = 'low quality, blurry, pixelated, distorted, watermark, text, logo, artifacts, flickering, jumpy motion, unnatural colors, fireworks, pyrotechnics, explosions, laser beams, spotlights, strobes, stage lights, external lighting, smoke, fog, fire, airplanes, airplane, aircraft, jet, jets, helicopter, helicopters, plane, powder, magic powder, fairy dust, glitter, confetti, colored smoke, fast motion, sped up, timelapse, rapid movements, jerky motion, accelerated video';

        // Preparar request - si hay segunda imagen para transición, incluirla
        const generateVideoRequest: any = {
            model: 'veo-3.1-fast-generate-preview',
            prompt: videoPrompt,
            image: {
                imageBytes: base64ImageData,
                mimeType: mimeType,
            },
            config: {
                numberOfVideos: 1,
                durationSeconds: (secondImageData ? 10 : finalConfig.durationSeconds) || 8, // Más tiempo para transiciones
                resolution: finalConfig.resolution || '720p',
                aspectRatio: finalConfig.aspectRatio || '16:9',
                negativePrompt: negativePrompt,
            }
        };

        // Si hay segunda imagen, incluirla en el request (si la API lo soporta)
        // Nota: La API de Veo podría no soportar múltiples imágenes directamente
        // En ese caso, el prompt incluirá la descripción visual

        let operation = await videoAI.models.generateVideos(generateVideoRequest);

        console.log(`🎬 Video generation started with veo-3.1-fast-generate-preview`);
        console.log(`   Duration: ${finalConfig.durationSeconds}s | Resolution: ${finalConfig.resolution} | Aspect: ${finalConfig.aspectRatio}`);

        let attempts = 0;
        const maxAttempts = 180; // 30 minutos máximo (180 * 10 segundos)

        while (!operation.done && attempts < maxAttempts) {
            attempts++;
            console.log(`⏳ Checking video status... (attempt ${attempts}/${maxAttempts})`);
            await new Promise(resolve => setTimeout(resolve, 10000));
            operation = await videoAI.operations.getVideosOperation({ operation: operation });
        }

        if (attempts >= maxAttempts) {
            throw new Error("Video generation timeout - took too long to complete.");
        }

        console.log(`✅ Operation completed. Response:`, JSON.stringify(operation.response, null, 2));

        // Buscar el video en la respuesta - verificar la estructura exacta
        let downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
        
        if (!downloadLink) {
            console.error("Response structure:", JSON.stringify(operation.response, null, 2));
            console.error("Generated videos:", JSON.stringify(operation.response?.generatedVideos, null, 2));
            throw new Error("Video generation completed, but no download link was found in the response.");
        }
        
        console.log(`✅ Video generation completed successfully`);
        return downloadLink;

    } catch (error) {
        console.error("Error generating video:", error);
        throw error; // Re-throw to be handled by the UI component
    }
};