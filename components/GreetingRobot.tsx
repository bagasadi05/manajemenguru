
import React, { useState, useEffect } from 'react';

const RobotIcon = () => (
    <svg width="180" height="180" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
        <defs>
            {/* Gradient baru untuk kepala, selaras dengan tema ungu/indigo */}
            <radialGradient id="grad1" cx="50%" cy="50%" r="50%" fx="50%" fy="50%">
                <stop offset="0%" style={{stopColor: '#a855f7', stopOpacity:1}} /> {/* purple-500 */}
                <stop offset="100%" style={{stopColor: '#6366F1', stopOpacity:1}} /> {/* indigo-500 */}
            </radialGradient>
            
            {/* Gradient baru untuk badan, menggunakan warna ungu dan indigo yang lebih kaya */}
            <linearGradient id="grad2" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" style={{stopColor: '#9333ea', stopOpacity:1}} /> {/* purple-600 */}
                <stop offset="100%" style={{stopColor: '#3730a3', stopOpacity:1}} /> {/* indigo-800 */}
            </linearGradient>

            <filter id="head-shadow" x="-50%" y="-50%" width="200%" height="200%">
                <feDropShadow dx="0" dy="4" stdDeviation="5" floodColor="#3730a3" floodOpacity="0.4" />
            </filter>
            
            <style>
                {`
                .eye-blink {
                    animation: eye-blink 3s infinite ease-in-out;
                    transform-origin: center;
                }
                @keyframes eye-blink {
                    0%, 90%, 100% { transform: scaleY(1); }
                    95% { transform: scaleY(0.1); }
                }
                .antenna-glow {
                    animation: antenna-glow 2s infinite alternate;
                }
                @keyframes antenna-glow {
                    from { fill: '#d946ef'; } /* fuchsia-500 */
                    to { fill: '#f0abfc'; } /* fuchsia-400 */
                }
                `}
            </style>
        </defs>
        
        {/* Neck */}
        <rect x="90" y="95" width="20" height="15" fill="#7c3aed" /> {/* violet-600 */}
        
        {/* Body */}
        <path d="M50 110 H150 A20 20 0 0 1 170 130 V170 A20 20 0 0 1 150 190 H50 A20 20 0 0 1 30 170 V130 A20 20 0 0 1 50 110 Z" fill="url(#grad2)" stroke="#312e81" strokeWidth="2" /> {/* indigo-900 */}
        
        {/* Screen on body */}
        <rect x="65" y="125" width="70" height="40" rx="10" fill="#111827" /> {/* gray-900 */}
        <text x="100" y="150" fontFamily="monospace" fontSize="14" fill="#a5b4fc" textAnchor="middle">
            Hi, Guru!
        </text>

        {/* Head */}
        <circle cx="100" cy="70" r="50" fill="url(#grad1)" stroke="#4338ca" strokeWidth="2" filter="url(#head-shadow)" /> {/* indigo-700 */}
        
        {/* Visor */}
        <path d="M60,65 Q100,50 140,65 L140,85 Q100,100 60,85 Z" fill="#111827" opacity="0.8" /> {/* gray-900 */}
        
        {/* Eye lights inside visor - changed to cyan */}
        <circle cx="80" cy="75" r="8" fill="#22d3ee" className="eye-blink" style={{animationDelay: '0.2s'}}/> {/* cyan-400 */}
        <circle cx="120" cy="75" r="8" fill="#22d3ee" className="eye-blink" />
        
        {/* Antenna */}
        <line x1="100" y1="20" x2="100" y2="0" stroke="#7c3aed" strokeWidth="4" /> {/* violet-600 */}
        <circle cx="100" cy="0" r="8" className="antenna-glow" />
    </svg>
);


interface GreetingRobotProps {
    userName: string;
    onAnimationEnd: () => void;
}

const GreetingRobot: React.FC<GreetingRobotProps> = ({ userName, onAnimationEnd }) => {
    const [phase, setPhase] = useState<'entering' | 'greeting' | 'leaving'>('entering');
    const [showBubble, setShowBubble] = useState(false);

    useEffect(() => {
        const enterTimer = setTimeout(() => {
            setPhase('greeting');
            setShowBubble(true);
        }, 1200);

        const greetTimer = setTimeout(() => {
            setShowBubble(false);
        }, 4700); 

        const leaveTimer = setTimeout(() => {
            setPhase('leaving');
        }, 5000); 

        const endTimer = setTimeout(() => {
            onAnimationEnd();
        }, 6200); 

        return () => {
            clearTimeout(enterTimer);
            clearTimeout(greetTimer);
            clearTimeout(leaveTimer);
            clearTimeout(endTimer);
        };
    }, [onAnimationEnd]);

    const containerClasses = `fixed top-0 left-1/2 -translate-x-1/2 z-50 flex flex-col items-center transition-transform transform-gpu`;
    
    const phaseClasses = {
        entering: 'animate-slide-down',
        greeting: 'animate-float',
        leaving: 'animate-slide-up'
    }

    return (
        <div className={`${containerClasses} ${phaseClasses[phase]}`}>
            <div className="relative">
                <RobotIcon />
            </div>
            {showBubble && (
                <div className="relative mt-[-20px] p-4 bg-white dark:bg-gray-800 rounded-xl shadow-lg animate-fade-in text-center border border-gray-200 dark:border-gray-700">
                    <p className="font-semibold text-lg text-gray-800 dark:text-gray-100">Selamat Datang, {userName}!</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Siap untuk mengajar hari ini?</p>
                    <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-white dark:bg-gray-800 transform rotate-45 border-t border-l border-gray-200 dark:border-gray-700"></div>
                </div>
            )}
        </div>
    );
};

export default GreetingRobot;
