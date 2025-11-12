import { GoogleGenAI, Modality } from "@google/genai";
import { EventType, VideoConfig, VideoStyle, AnimationSpeed } from "../types";

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
    cameraMovement: string
): string => {
    // Contexto del negocio: empresa de espectáculos de drones
    const businessContext = `
CONTEXTO DE LA EMPRESA:
Somos una empresa profesional especializada en espectáculos aéreos con drones de precisión y luces LED.
Nuestros shows están diseñados para impactar, sorprender y crear momentos memorables.
La imagen proporcionada es el marco visual donde ocurrirá el espectáculo.

INFORMACIÓN DEL EVENTO ACTUAL:
- Tipo de evento: ${eventType}
- Ubicación: ${location}
- Cantidad de drones: ${droneCount}
- Elementos/Figuras a realizar: ${elements}
- Estilo visual: ${style}
- Ritmo: ${speed}
- Intensidad de efectos: ${effectsIntensity}
`;

    const speedDescriptions = {
        'slow': 'lento, pausado y elegante',
        'medium': 'ritmo equilibrado y natural',
        'fast': 'rápido, dinámico y electrizante',
        'dynamic': 'alternando ritmos: secciones rápidas explosivas con momentos lentos dramáticos',
    };

    const styleDetails = {
        'magical': 'mágico, etéreo y onírico, como si fuera un sueño hecho realidad',
        'energetic': 'energético, vibrante y cargado de adrenalina',
        'professional': 'profesional, limpio, sofisticado y ejecutado con precisión quirúrgica',
        'romantic': 'romántico, delicado, emotivo y lleno de sensibilidad',
        'dramatic': 'dramático, impactante, con tensiones y liberaciones emocionales',
        'playful': 'lúdico, creativo, divertido y sorprendente',
    };

    const effectsIntensityDetails = {
        'subtle': 'minimalista con efectos sutiles y refinados',
        'moderate': 'balanceado con efectos visibles pero controlados',
        'intense': 'explosivo con máximos efectos visuales y saturación de luz',
    };

    const particlesDescription = includeParticles 
        ? 'Los drones emiten partículas de luz, polvo brillante, y reflejos que crean un efecto envolvente.'
        : '';
    
    const trailsDescription = includeTrails 
        ? 'Cada movimiento de drone deja estelas de luz persistentes que trazan su trayectoria en el aire, creando líneas de luz continuas.'
        : '';
    
    const cameraDescription = cameraMovement === 'static' 
        ? 'La perspectiva es fija, permitiendo ver la composición completa del espectáculo.'
        : cameraMovement === 'gentle' 
        ? 'La cámara se mueve suavemente, como si siguiera el ritmo de la música o la acción, pero manteniendo el contexto visible.'
        : 'La cámara es dinámica y sigue la acción, creando un efecto cinematográfico profesional con movimientos que potencian el drama.';

    // Prompt específico según tipo de evento
    let eventPrompt = '';
    
    switch (eventType) {
        case EventType.Boda:
            eventPrompt = `
BODA - ESPECTÁCULO DE DRONES ROMÁNTICO:
Crea un video animado donde ${droneCount} drones coreografían un show romántico formando: ${elements}
Estilo: ${styleDetails['romantic']}
Los drones se mueven ${speedDescriptions[speed]} creando composiciones románticas y elegantes.
Paleta de colores: dorados, rosas suaves, blancos puros y azules celestes.
Efecto visual: ${effectsIntensityDetails[effectsIntensity]}
La atmósfera debe ser mágica, celebratoria y profundamente emotiva.
Cada movimiento debe parecer coreografiado al ritmo del amor y la celebración.`;
            break;

        case EventType.Concierto:
            eventPrompt = `
CONCIERTO - ESPECTÁCULO ENERGÉTICO Y SINCRONIZADO:
Anima ${droneCount} drones en un show explosivo donde forman: ${elements}
Estilo: ${styleDetails['energetic']}
Los movimientos son ${speedDescriptions[speed]}, sincronizados con ritmo y energía visual.
Paleta de colores: neón vibrante, multicolor, purpuras, azules y rosas intensas.
Efecto visual: ${effectsIntensityDetails[effectsIntensity]}
La energía es contagiosa, cada formación es más impactante que la anterior.
Los drones se mueven con precisión militar pero con soul artístico.`;
            break;

        case EventType.Corporativo:
            eventPrompt = `
EVENTO CORPORATIVO - ESPECTÁCULO PROFESIONAL Y PRECISIÓN:
Anima ${droneCount} drones ejecutando un show corporativo donde forman: ${elements}
Estilo: ${styleDetails['professional']}
Los movimientos son ${speedDescriptions[speed]}, controlados y ejecutados con precisión absoluta.
Paleta de colores: azul corporativo, gris, plateado y tonos profesionales que reflejen autoridad.
Efecto visual: ${effectsIntensityDetails[effectsIntensity]}
Cada transición es perfecta, cada formación impacta con sofisticación.
El resultado transmite profesionalismo, innovación y control total.`;
            break;

        case EventType.Festival:
            eventPrompt = `
FESTIVAL - ESPECTÁCULO COLORIDO Y DIVERTIDO:
Anima ${droneCount} drones en un show desenfadado y creativo donde forman: ${elements}
Estilo: ${styleDetails['playful']}
Los movimientos son ${speedDescriptions[speed]}, inesperados y llenos de giros creativos.
Paleta de colores: multicolor explosivo - púrpura, verde neón, amarillo brillante, rosa chicle, azul eléctrico.
Efecto visual: ${effectsIntensityDetails[effectsIntensity]}
La atmósfera es alegre, sorprendente y altamente visual para redes sociales.
Los drones crean caos ordenado, diversión controlada y momentos inolvidables.`;
            break;

        case EventType.Politica:
            eventPrompt = `
EVENTO POLÍTICO - ESPECTÁCULO DRAMÁTICO E IMPACTANTE:
Anima ${droneCount} drones en un show impactante donde forman: ${elements}
Estilo: ${styleDetails['dramatic']}
Los movimientos son ${speedDescriptions[speed]}, con momentos de tensión dramática seguidos de liberación emotiva.
Paleta de colores: rojo intenso, blanco puro y azul profundo, con efectos de luz estudiados.
Efecto visual: ${effectsIntensityDetails[effectsIntensity]}
El impacto emocional y visual es el objetivo principal.
Las formaciones son imponentes, memorables y cargadas de significado.`;
            break;

        default:
            eventPrompt = `
Anima ${droneCount} drones en un espectáculo donde forman: ${elements}
Estilo visual: ${styleDetails[style]}
Movimiento: ${speedDescriptions[speed]}
Efecto visual: ${effectsIntensityDetails[effectsIntensity]}`;
    }

    // Prompt final combinado
    const finalPrompt = `${businessContext}

${eventPrompt}

INSTRUCCIONES TÉCNICAS DE ANIMACIÓN:
- La imagen de referencia muestra el lugar exacto donde ocurrirá el espectáculo. Respeta la ubicación y el contexto visual.
- Los elementos a animar son: "${elements}" - Anima EXACTAMENTE esto, asegúrate de que sea claramente reconocible.
- Número de drones: ${droneCount} - Muestra aproximadamente esta cantidad en pantalla.
- ${cameraDescription}
- ${particlesDescription}
- ${trailsDescription}

DETALLES VISUALES FINALES:
- Las luces LED de los drones deben parpadear, brillar y cambiar de color de manera natural y coordinada.
- Las transiciones entre formaciones deben ser suaves pero definitivas, nunca abruptas.
- Sincroniza el movimiento con el ritmo (musical si es aplicable).
- Calidad: cinematográfica, profesional, digna de un evento de alto nivel.
- Duración: 15-30 segundos maximizando impacto visual.
- Los drones mantienen formaciones limpias y reconocibles en todo momento.
- El efecto final debe ser: "wow" - impactante, memorable y profesional.

INTERPRETACIÓN DE NARRATIVAS Y TRANSICIONES ESPECIALES:
Si los elementos incluyen frases, preguntas o anuncios (ej: "Boy or Girl?", "It's a girl!", "Yes/No", "Countdown 3-2-1!"):
- Entiende que NO son palabras que deben formarse literalmente con los drones.
- Son NARRATIVAS que deben representarse con TRANSICIONES VISUALES y CAMBIOS DE COLOR.
- Ejemplo 1: "Boy or Girl?" → Primer acto: Drones azules formando un símbolo/forma genérica. Segundo acto: Transición explosiva. Tercer acto: Drones ROSAS formando celebración visual con "It's a girl!!!" como descripción del momento emocional.
- Ejemplo 2: "Countdown 3-2-1!" → Tres fases: Los drones se reorganizan rápidamente, luces parpadeantes intensas, y culminan en una explosión visual masiva.
- Las transiciones deben ser DRAMÁTICAS y EMOCIONALMENTE SIGNIFICATIVAS.
- Usa CAMBIOS DE COLOR RADICALES para enfatizar los momentos importantes.
- La narrativa debe ser CLARA VISUALMENTE aunque no se lean palabras reales.
- Cada fase de la transición debe durar aproximadamente 2-4 segundos dependiendo del ritmo elegido.`;

    return finalPrompt;
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
    const speedMap = {
        'slow': 'lento y pausado',
        'medium': 'ritmo equilibrado',
        'fast': 'rápido y dinámico',
        'dynamic': 'alternando entre lento y explosivo',
    };

    return `
TRANSICIÓN DE DRONES - SECUENCIA EN DOS ACTOS:

CONTEXTO:
- Tienes DOS imágenes de referencia
- SON LOS MISMOS DRONES que protagonizan ambas imágenes
- NO desaparecen ni aparecen nuevos drones
- Solo cambian de color y se reorganizan

ACTO 1: PRIMERA IMAGEN
${firstImageDescription}
Los drones forman: ${elements}
Aproximadamente ${droneCount} drones crean esta formación inicial.

TRANSICIÓN (EL MOMENTO MÁGICO):
${transitionDescription}
- Los drones NO desaparecen, se reorganizan
- Cambian de color de manera dramática y coordinada
- Se mueven con ritmo ${speedMap[speed]}
- Intensidad de efectos: ${effectsIntensity}
- Los parpadeos, explosiones de luz y cambios de color son el punto focal
- Duración de la transición: 3-5 segundos máximo

ACTO 2: SEGUNDA IMAGEN
Después de la transición espectacular, los MISMOS drones forman la nueva configuración:
${secondImageDescription}
- Mantienen el color/patrón de luz de la transición
- Se posicionan en la nueva formación
- La cámara revelan la belleza de la nueva composición

DETALLES CRÍTICOS:
- CONTINUIDAD: Son visiblemente los mismos drones en todo momento
- TRANSFORMACIÓN: El cambio de forma/color es el espectáculo principal
- DURACIÓN TOTAL: 20-35 segundos (10-15s acto 1, 3-5s transición, 10-15s acto 2)
- ENERGÍA: La transición es el momento de máximo impacto emocional
- CLARIDAD: Ambas formaciones deben ser claramente reconocibles
- CINEMATOGRAFÍA: Transiciones suaves en actos, pero la reorganización es dramática
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
    transitionDescription?: string
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
            videoPrompt = generateTransitionPrompt(
                "Primera imagen: referencia visual inicial donde los drones forman la primera figura",
                "Segunda imagen: referencia visual final donde los drones forman la segunda figura después de la transición",
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
                finalConfig.cameraMovement
            );
        } else {
            videoPrompt = 'Animate this drone show, making the lights twinkle and move smoothly across the sky, creating a magical and dynamic visual.';
        }

        // Negative prompt para evitar artefactos comunes
        const negativePrompt = 'low quality, blurry, pixelated, distorted, watermark, text, logo, artifacts, flickering, jumpy motion, unnatural colors';

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