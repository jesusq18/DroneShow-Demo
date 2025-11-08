import { GoogleGenAI, Modality } from "@google/genai";

const API_KEY = process.env.API_KEY;
if (!API_KEY) {
    throw new Error("API_KEY environment variable not set");
}
const ai = new GoogleGenAI({ apiKey: API_KEY });

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

export const generateVideo = async (base64ImageData: string, mimeType: string): Promise<string> => {
    // A new instance is created here to ensure it uses the most up-to-date API key
    // selected by the user in the AI Studio key selector dialog.
    const videoAI = new GoogleGenAI({ apiKey: process.env.API_KEY });
    try {
        let operation = await videoAI.models.generateVideos({
            model: 'veo-3.1-fast-generate-preview',
            prompt: 'Animate this drone show, making the lights twinkle and move smoothly across the sky, creating a magical and dynamic visual.',
            image: {
                imageBytes: base64ImageData,
                mimeType: mimeType,
            },
            config: {
                numberOfVideos: 1,
                resolution: '720p',
                aspectRatio: '16:9'
            }
        });

        while (!operation.done) {
            await new Promise(resolve => setTimeout(resolve, 10000));
            operation = await videoAI.operations.getVideosOperation({ operation: operation });
        }

        const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
        if (!downloadLink) {
            throw new Error("Video generation completed, but no download link was found.");
        }
        return downloadLink;

    } catch (error) {
        console.error("Error generating video:", error);
        throw error; // Re-throw to be handled by the UI component
    }
};