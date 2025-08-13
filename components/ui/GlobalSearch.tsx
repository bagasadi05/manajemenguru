import React, { useState, useEffect, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { SearchIcon, UserIcon, UsersIcon, CalendarIcon } from '../Icons';
import * as db from '@/services/databaseService';

const GlobalSearch: React.FC = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [searchTerm, setSearchTerm] = useState('');
    const [isOpen, setIsOpen] = useState(false);

    const { data, isLoading } = useQuery({
        queryKey: ['globalSearchData', user?.id],
        queryFn: () => {
            if (!user) return { students: [], classes: [], schedules: [] };
            return db.getGlobalSearchData(user.id);
        },
        enabled: !!user && isOpen, // Only fetch when the search is open
    });

    // ... rest of component
    
    return (
        <div className="relative">
            {/* ... JSX ... */}
        </div>
    );
};

export default GlobalSearch;
