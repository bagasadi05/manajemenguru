import React from 'react';
import { UserCircleIcon, CheckCircleIcon, PencilIcon, TrendingUpIcon } from '@/components/Icons';

const sectionStyles: { [key: string]: { color: string; borderColor: string; } } = {
    'Evaluasi Umum': { color: 'text-blue-500', borderColor: 'border-blue-500' },
    'Kekuatan': { color: 'text-green-500', borderColor: 'border-green-500' },
    'Fokus Pengembangan': { color: 'text-yellow-500', borderColor: 'border-yellow-500' },
    'Rekomendasi': { color: 'text-purple-500', borderColor: 'border-purple-500' },
};

export const AiSummaryDisplay: React.FC<{ summary: any }> = ({ summary }) => {
    if (!summary || typeof summary !== 'object') return null;

    const sections = [
        { title: 'Evaluasi Umum', content: summary.general_evaluation, icon: UserCircleIcon },
        { title: 'Kekuatan', content: summary.strengths, icon: CheckCircleIcon },
        { title: 'Fokus Pengembangan', content: summary.development_focus, icon: PencilIcon },
        { title: 'Rekomendasi', content: summary.recommendations, icon: TrendingUpIcon },
    ].filter(section => section.content);

    return (
        <div className="space-y-6">
            {sections.map(({ title, content, icon: Icon }) => {
                const style = sectionStyles[title];
                return (
                    <div key={title} className={`p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl border-l-4 ${style.borderColor}`}>
                        <h3 className={`flex items-center gap-3 text-lg font-bold text-gray-900 dark:text-gray-100 mb-2 ${style.color}`}>
                            <Icon className="w-6 h-6" />
                            <span>{title}</span>
                        </h3>
                        <p className="pl-10 text-gray-700 dark:text-gray-300 text-justify">{content}</p>
                    </div>
                );
            })}
        </div>
    );
};
