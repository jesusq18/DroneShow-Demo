export enum EventType {
  Boda = "Boda",
  Festival = "Festival",
  Corporativo = "Evento corporativo",
  Concierto = "Concierto",
  Politica = "Campaña política",
  Otro = "Otro",
}

export interface FormData {
  clientName: string;
  eventType: EventType;
  location: string;
  countryCity: string;
  droneCount: string;
  elements: string;
  notes: string;
}

export interface ClientRecord {
  id: string;
  createdAt: string;
  formData: FormData;
  generatedImageUrl: string;
}
