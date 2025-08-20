// A simple queueing system for offline mutations using localStorage.

const QUEUE_KEY = 'supabase-offline-queue';

export type QueuedMutation = {
    id: string; // timestamp + random
    table: string;
    operation: 'upsert' | 'insert' | 'update' | 'delete';
    payload: any;
    onConflict?: string; // For upsert
};

/**
 * Retrieves the mutation queue from localStorage.
 * @returns {QueuedMutation[]} An array of queued mutations.
 */
export const getQueue = (): QueuedMutation[] => {
    try {
        const queue = localStorage.getItem(QUEUE_KEY);
        return queue ? JSON.parse(queue) : [];
    } catch (e) {
        console.error("Failed to read offline queue from localStorage", e);
        // Clear corrupted queue
        localStorage.removeItem(QUEUE_KEY);
        return [];
    }
};

/**
 * Adds a new mutation to the queue.
 * @param {Omit<QueuedMutation, 'id'>} mutation - The mutation to add.
 */
export const addToQueue = (mutation: Omit<QueuedMutation, 'id'>) => {
    const queue = getQueue();
    const newMutation: QueuedMutation = {
        ...mutation,
        id: `${Date.now()}-${Math.random()}`,
    };
    queue.push(newMutation);
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
    // Dispatch a storage event so other open tabs/components can update their UI
    window.dispatchEvent(new Event('storage'));
};

/**
 * Clears the entire mutation queue from localStorage.
 */
export const clearQueue = () => {
    localStorage.removeItem(QUEUE_KEY);
    window.dispatchEvent(new Event('storage'));
};
