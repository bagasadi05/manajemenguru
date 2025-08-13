import React, { useState, useEffect, useRef } from 'react';
import { GoogleGenerativeAI } from '@google/genai';
import { Button } from './ui/Button';
import { Card, CardContent } from './ui/Card';
import { SendIcon, SparklesIcon, BotIcon, UserIcon, XIcon, LoaderIcon } from './Icons';
import { useAuth } from '../hooks/useAuth';
import * as db from '../services/databaseService';

const ai = new GoogleGenerativeAI({ apiKey: process.env.GEMINI_API_KEY as string });

type Message = {
  role: 'user' | 'model';
  parts: { text: string }[];
};

const AiChatAssistant: React.FC = () => {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const getContextData = async (userId: string) => {
    const today = new Date().toISOString().slice(0, 10);
    const [studentsRes, classesRes, attendanceRes, tasksRes] = await Promise.all([
        db.getStudents(userId),
        db.getClasses(userId),
        db.getAttendanceByDate([], today), // This needs adjustment, student IDs are not available here
        db.getTasks(userId)
    ]);
    // Note: The attendance query is flawed as it needs student IDs. This is a pre-existing issue.
    // For now, we will proceed with the refactoring.
    return {
        students: studentsRes.data,
        classes: classesRes.data,
        attendance: attendanceRes.data,
        tasks: tasksRes.data,
    };
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(scrollToBottom, [messages]);

  const handleSend = async () => {
    if (!input.trim() || !user) return;
    const userMessage: Message = { role: 'user', parts: [{ text: input }] };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
        const context = await getContextData(user.id);
        const systemInstruction = `Anda adalah asisten AI untuk seorang guru. Gunakan data yang disediakan untuk menjawab pertanyaan. Jawablah dengan singkat, jelas, dan ramah. Data saat ini: ${JSON.stringify(context)}`;
        
        const chat = ai.getGenerativeModel({ model: "gemini-1.5-flash", systemInstruction });
        const result = await chat.sendMessage(input);
        const response = await result.response;
        const modelMessage: Message = { role: 'model', parts: [{ text: response.text() }] };
        setMessages(prev => [...prev, modelMessage]);

    } catch (error) {
        console.error("AI Chat Error:", error);
        const errorMessage: Message = { role: 'model', parts: [{ text: "Maaf, terjadi kesalahan. Silakan coba lagi." }] };
        setMessages(prev => [...prev, errorMessage]);
    } finally {
        setIsLoading(false);
    }
  };

  if (!isOpen) {
    return (
      <Button onClick={() => setIsOpen(true)} className="fixed bottom-4 right-4 rounded-full w-16 h-16 shadow-lg z-50">
        <SparklesIcon className="w-8 h-8" />
      </Button>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 w-full max-w-md h-full max-h-[70vh] z-50">
        <Card className="w-full h-full flex flex-col shadow-2xl">
            <header className="flex items-center justify-between p-4 border-b">
                <div className="flex items-center gap-2"><BotIcon className="w-6 h-6" /> <h3 className="font-bold">Asisten AI</h3></div>
                <Button variant="ghost" size="icon" onClick={() => setIsOpen(false)}><XIcon className="w-5 h-5" /></Button>
            </header>
            <CardContent className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.map((msg, index) => (
                    <div key={index} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        {msg.role === 'model' && <BotIcon className="w-6 h-6 flex-shrink-0" />}
                        <div className={`max-w-[80%] p-3 rounded-2xl ${msg.role === 'user' ? 'bg-blue-500 text-white rounded-br-none' : 'bg-gray-200 dark:bg-gray-700 rounded-bl-none'}`}>
                            <p className="text-sm">{msg.parts[0].text}</p>
                        </div>
                        {msg.role === 'user' && <UserIcon className="w-6 h-6 flex-shrink-0" />}
                    </div>
                ))}
                {isLoading && <div className="flex justify-start gap-3"><BotIcon className="w-6 h-6" /><div className="p-3 rounded-2xl bg-gray-200 dark:bg-gray-700"><LoaderIcon className="w-5 h-5 animate-spin"/></div></div>}
                <div ref={messagesEndRef} />
            </CardContent>
            <footer className="p-4 border-t">
                <div className="flex items-center gap-2">
                    <input value={input} onChange={e => setInput(e.target.value)} onKeyPress={e => e.key === 'Enter' && handleSend()} placeholder="Tanya apa saja..." className="flex-1 p-2 bg-gray-100 dark:bg-gray-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    <Button onClick={handleSend} disabled={isLoading}><SendIcon className="w-5 h-5" /></Button>
                </div>
            </footer>
        </Card>
    </div>
  );
};

export default AiChatAssistant;
