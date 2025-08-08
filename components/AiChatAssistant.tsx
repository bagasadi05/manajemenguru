
import React, { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { GoogleGenAI, Chat } from '@google/genai';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../services/supabase';
import { Modal } from './ui/Modal';
import { Input } from './ui/Input';
import { Button } from './ui/Button';
import { BrainCircuitIcon, SparklesIcon, UsersIcon } from './Icons';

interface AiChatAssistantProps {
    isOpen: boolean;
    setIsOpen: (isOpen: boolean) => void;
}

type Message = {
    role: 'user' | 'model';
    text: string;
};

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const fetchAppContextData = async (userId: string) => {
    const today = new Date().toISOString().split('T')[0];
    const [students, classes, attendance, tasks] = await Promise.all([
        supabase.from('students').select('id, name, class_id').eq('user_id', userId),
        supabase.from('classes').select('id, name').eq('user_id', userId),
        supabase.from('attendance').select('status, students(name)').eq('user_id', userId).eq('date', today),
        supabase.from('tasks').select('title, status, due_date').eq('user_id', userId)
    ]);
    return {
        students: students.data,
        classes: classes.data,
        attendance: attendance.data,
        tasks: tasks.data
    };
};

export const AiChatAssistant: React.FC<AiChatAssistantProps> = ({ isOpen, setIsOpen }) => {
    const { user } = useAuth();
    const [chat, setChat] = useState<Chat | null>(null);
    const [history, setHistory] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    
    const { data: contextData } = useQuery({
        queryKey: ['aiContextData', user?.id],
        queryFn: () => fetchAppContextData(user!.id),
        enabled: !!user && isOpen,
        staleTime: 5 * 60 * 1000,
    });

    useEffect(() => {
        if (isOpen) {
            const systemInstruction = `Anda adalah "Asisten Cerdas", sebuah AI yang ramah dan sangat membantu untuk guru. Tugas Anda adalah menjawab pertanyaan guru tentang data mereka seakurat mungkin. Anda akan diberikan data dalam format JSON sebagai konteks. Gunakan data ini untuk menjawab pertanyaan. Jika Anda bisa memberikan jawaban langsung (seperti daftar nama), lakukan itu. Jika pertanyaannya kompleks, berikan ringkasan dan sarankan guru untuk melihat halaman terkait. Selalu sapa dengan ramah dan jaga nada percakapan yang positif. Jawab dalam Bahasa Indonesia.`;
            const newChat = ai.chats.create({
                model: 'gemini-2.5-flash',
                config: { systemInstruction },
            });
            setChat(newChat);
            setHistory([{ role: 'model', text: 'Halo Guru! Ada yang bisa saya bantu hari ini? Anda bisa bertanya tentang siswa, absensi hari ini, atau tugas Anda.' }]);
        } else {
            setHistory([]);
            setInput('');
        }
    }, [isOpen]);
    
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [history]);
    
    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim() || !chat || isLoading) return;
        
        const userMessage: Message = { role: 'user', text: input };
        setHistory(prev => [...prev, userMessage]);
        setInput('');
        setIsLoading(true);
        
        const contextPrompt = `
            KONTEKS DATA (saat ini): ${JSON.stringify(contextData)}
            
            PERTANYAAN PENGGUNA: ${input}
        `;

        try {
            const response = await chat.sendMessage({ message: contextPrompt });
            const modelMessage: Message = { role: 'model', text: response.text };
            setHistory(prev => [...prev, modelMessage]);
        } catch (error) {
            console.error("AI Assistant Error:", error);
            const errorMessage: Message = { role: 'model', text: 'Maaf, terjadi sedikit gangguan. Bisakah Anda mencoba lagi?' };
            setHistory(prev => [...prev, errorMessage]);
        } finally {
            setIsLoading(false);
        }
    };
    
    return (
        <Modal isOpen={isOpen} onClose={() => setIsOpen(false)} title="Asisten Cerdas" icon={<BrainCircuitIcon className="h-5 w-5"/>}>
            <div className="flex flex-col h-[60vh]">
                <div ref={messagesEndRef} className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                    {history.map((msg, index) => (
                        <div key={index} className={`flex items-start gap-3 ${msg.role === 'user' ? 'justify-end' : ''}`}>
                            {msg.role === 'model' && (
                                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-white">
                                    <SparklesIcon className="w-5 h-5" />
                                </div>
                            )}
                            <div className={`max-w-xs md:max-w-md p-3 rounded-2xl text-sm ${
                                msg.role === 'user'
                                ? 'bg-blue-500 text-white rounded-br-none'
                                : 'bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-bl-none border border-gray-200 dark:border-gray-600'
                            }`}>
                                <p>{msg.text}</p>
                            </div>
                             {msg.role === 'user' && (
                                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-600 flex items-center justify-center text-gray-500 dark:text-gray-300">
                                    <UsersIcon className="w-5 h-5" />
                                </div>
                            )}
                        </div>
                    ))}
                    {isLoading && (
                         <div className="flex items-start gap-3">
                            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-white">
                                <SparklesIcon className="w-5 h-5" />
                            </div>
                            <div className="max-w-xs md:max-w-md p-3 rounded-2xl bg-white dark:bg-gray-700 rounded-bl-none border border-gray-200 dark:border-gray-600">
                                <div className="flex items-center space-x-1">
                                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-pulse-fast"></div>
                                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-pulse-fast animation-delay-200"></div>
                                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-pulse-fast animation-delay-400"></div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
                <form onSubmit={handleSendMessage} className="mt-4 flex gap-2">
                    <Input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder="Ketik pertanyaan Anda..."
                        disabled={isLoading}
                        className="flex-1"
                    />
                    <Button type="submit" disabled={isLoading || !input.trim()}>
                        {isLoading ? '...' : 'Kirim'}
                    </Button>
                </form>
            </div>
        </Modal>
    );
};

export default AiChatAssistant;
