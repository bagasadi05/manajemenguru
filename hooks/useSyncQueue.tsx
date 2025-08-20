import { useState, useEffect, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useOfflineStatus } from './useOfflineStatus';
import { supabase } from '../services/supabase';
import { getQueue, clearQueue, QueuedMutation } from '../services/offlineQueue';
import { useToast } from './useToast';

export const useSyncQueue = () => {
    const queryClient = useQueryClient();
    const isOnline = useOfflineStatus();
    const toast = useToast();
    const [pendingCount, setPendingCount] = useState(getQueue().length);
    const [isSyncing, setIsSyncing] = useState(false);

    const updatePendingCount = useCallback(() => {
        setPendingCount(getQueue().length);
    }, []);
    
    // Listen for changes in localStorage to update count across components/tabs
    useEffect(() => {
        window.addEventListener('storage', updatePendingCount);
        return () => window.removeEventListener('storage', updatePendingCount);
    }, [updatePendingCount]);

    const processQueue = useCallback(async () => {
        if (!isOnline || isSyncing) return;

        const queue = getQueue();
        if (queue.length === 0) return;

        setIsSyncing(true);
        toast.info(`Menyinkronkan ${queue.length} perubahan offline...`);

        const promises = queue.map(async (mutation: QueuedMutation) => {
            const { table, operation, payload, onConflict } = mutation;
            let query = supabase.from(table);
            
            switch(operation) {
                case 'insert':
                    return (query as any).insert(payload);
                case 'update':
                    // Assume payload is an array for multiple updates or an object for single update
                    const updates = Array.isArray(payload) ? payload : [payload];
                    return Promise.all(updates.map(item => (query as any).update(item).eq('id', item.id)));
                case 'upsert':
                     return (query as any).upsert(payload, onConflict ? { onConflict } : {});
                case 'delete':
                     // Assume payload is an object with an id
                    return (query as any).delete().eq('id', payload.id);
                default:
                    console.error(`Unknown operation in queue: ${operation}`);
                    return Promise.reject(new Error(`Unknown operation: ${operation}`));
            }
        });

        try {
            const results = await Promise.all(promises);
            // Flatten results in case of multiple updates in a single operation
            const allResults = results.flat();
            const errors = allResults.filter(res => res && res.error);
            
            if (errors.length > 0) {
                 throw new Error(errors.map(e => e.error?.message).join(', '));
            }

            clearQueue();
            toast.success("Semua data offline berhasil disinkronkan!");
            // Invalidate all queries to refetch fresh data from the server
            await queryClient.invalidateQueries();

        } catch (error: any) {
            toast.error(`Gagal sinkronisasi: ${error.message}`);
            console.error("Sync failed:", error);
        } finally {
            setIsSyncing(false);
            updatePendingCount(); // Should update count to 0
        }
    }, [isOnline, isSyncing, queryClient, toast, updatePendingCount]);
    
    useEffect(() => {
        // When app comes online, process the queue
        if (isOnline) {
            processQueue();
        }
    }, [isOnline, processQueue]);

    return { pendingCount, isSyncing };
};
