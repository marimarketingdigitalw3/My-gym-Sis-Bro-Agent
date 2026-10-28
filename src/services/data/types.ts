// Contrato de la capa de datos. La UI solo conoce esta interfaz.
import type { ChatMessageRow, TableName, Tables } from "@/types/db";

export type Row<K extends TableName> = Tables[K];

export interface QueryOptions<T> {
  eq?: Partial<T>;
  gte?: Partial<Record<keyof T, string | number>>;
  lte?: Partial<Record<keyof T, string | number>>;
  in?: { column: keyof T; values: (string | number)[] };
  order?: { column: keyof T; ascending?: boolean };
  limit?: number;
}

export interface AuthUser {
  id: string;
  email: string;
}

export interface SignUpResult {
  needsEmailVerification: boolean;
}

export interface AuthService {
  getUser(): Promise<AuthUser | null>;
  onChange(cb: (user: AuthUser | null, event: string) => void): () => void;
  signUp(email: string, password: string, displayName: string): Promise<SignUpResult>;
  signIn(email: string, password: string): Promise<void>;
  signOut(): Promise<void>;
  requestPasswordReset(email: string): Promise<string>;
  updatePassword(newPassword: string): Promise<void>;
}

export interface CoachResponse {
  conversationId: string;
  message: ChatMessageRow;
  source: ChatMessageRow["source"];
  notice: string | null;
}

export class DataError extends Error {
  constructor(message: string, readonly code?: string, readonly status?: number) {
    super(message);
  }
}

export interface DataClient {
  readonly mode: "supabase" | "local";
  readonly auth: AuthService;
  select<K extends TableName>(table: K, opts?: QueryOptions<Row<K>>): Promise<Row<K>[]>;
  insert<K extends TableName>(table: K, rows: Partial<Row<K>>[]): Promise<Row<K>[]>;
  upsert<K extends TableName>(table: K, rows: Partial<Row<K>>[], onConflict: (keyof Row<K>)[]): Promise<Row<K>[]>;
  update<K extends TableName>(table: K, match: Partial<Row<K>>, patch: Partial<Row<K>>): Promise<Row<K>[]>;
  remove<K extends TableName>(table: K, match: Partial<Row<K>>): Promise<void>;
  uploadPhoto(path: string, file: File): Promise<void>;
  photoUrl(path: string): Promise<string>;
  removePhotos(paths: string[]): Promise<void>;
  sendCoachMessage(conversationId: string | null, message: string): Promise<CoachResponse>;
  deleteAccount(): Promise<void>;
}

/** Tablas cuya clave es el propio usuario (no llevan columna id). */
export const SINGLETON_TABLES = new Set<TableName>([
  "profiles", "user_settings", "onboarding_responses", "nutrition_preferences", "cycle_settings",
]);

/** Tablas que se borran al pedir "borrar mis datos" (se conserva la cuenta). */
export const PERSONAL_TABLES: TableName[] = [
  "chat_messages", "chat_conversations", "exercise_sets", "workout_sessions", "workout_exercises", "workout_plans",
  "meal_logs", "meal_plans", "water_logs", "progress_photos", "progress_measurements", "recovery_logs", "cycle_logs",
  "cycle_settings", "fitness_goals", "nutrition_preferences", "onboarding_responses",
];
