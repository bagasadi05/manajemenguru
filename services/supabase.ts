
import { createClient } from '@supabase/supabase-js';
import type { Database } from './database.types'; // This will be generated from your Supabase schema

// Read credentials from Vite environment variables. Ensure these values are set
// in your `.env` file (e.g. VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY) and are
// not committed to version control.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;


// The generic type `Database` will be generated from your Supabase schema
// to provide full type-safety for your database operations.
export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey);

/**
 * Note on Offline Sync:
 * A robust offline strategy with Supabase might involve:
 * 1. Using a state management library like React Query or Zustand with a persistence layer (e.g., persist middleware with localStorage or IndexedDB).
 * 2. When offline, mutations (adds, updates, deletes) are queued locally.
 * 3. A service worker or a listener for the 'online' event detects when the connection is restored.
 * 4. The queue of mutations is then processed and sent to Supabase.
 * 5. Data is fetched from Supabase upon re-connecting to ensure local state is fresh.
 * This setup is advanced and beyond the scope of this single file generation.
 */