
import { createClient } from '@supabase/supabase-js';
import type { Database } from './database.types'; // This will be generated from your Supabase schema
import { GoogleGenAI } from '@google/genai';

// --- IMPORTANT ---
// The credentials below have been provided to make the application runnable.
// In a production environment, you should use environment variables
// (e.g., process.env.SUPABASE_URL) to keep your credentials secure.
const supabaseUrl = 'https://fddvcyqbfqydvsfujcxd.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZkZHZjeXFiZnF5ZHZzZnVqY3hkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI4ODQ0MzAsImV4cCI6MjA2ODQ2MDQzMH0.kSKbnUaWaJmPjdz9TGxWbZZ8dcamVupdkeozWQct9i4';


// The generic type `Database` will be generated from your Supabase schema
// to provide full type-safety for your database operations.
export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey);

// Centralized Google GenAI Client
export const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

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