
import { EventType } from './types';

export const EVENT_TYPES: { value: EventType; label: string }[] = [
  { value: EventType.Boda, label: "Boda" },
  { value: EventType.Festival, label: "Festival" },
  { value: EventType.Corporativo, label: "Evento corporativo" },
  { value: EventType.Concierto, label: "Concierto" },
  { value: EventType.Politica, label: "Campaña política" },
  { value: EventType.Otro, label: "Otro" },
];
