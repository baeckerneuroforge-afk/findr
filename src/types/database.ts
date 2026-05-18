// Auto-generate this file from your Supabase schema with:
//   pnpm dlx supabase gen types typescript --project-id <id> > src/types/database.ts
//
// Until then, this empty stub keeps the typed client compiling.

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: Record<string, never>;
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
