
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Chat } from '@google/genai';
import { ChatMessage, ChatSession } from '../types';
import useLocalStorage from '../hooks/useLocalStorage';
import { createChat, sendMessageToChat, generateImage, editImage } from '../services/geminiService';
import { getBlob, setBlob } from '../services/dbService';
import { v4 as uuidv4 } from 'uuid';
import { Send, Loader2, Paperclip, Search, PlusCircle, Trash2, Download, Edit3, X, MessageSquare, Sparkles } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import Lightbox from '../Lightbox';
import { GenerateContentResponse } from '@google/genai';

const PromptLab: React.FC = () => {
    const [sessions, setSessions] = useLocalStorage<ChatSession[]>('chatSessions', []);
    const [activeSessionId, setActiveSessionId] = useLocalStorage<string | null>('activeChatSessionId', null);
    const [chat, setChat] = useState<Chat | null>(null);
    const [userInput, setUserInput] = useState('');
    const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
    const [editingSessionName, setEditingSessionName] = useState('');
    const [isDragging, setIsDragging] = useState(false);
    const [inputMode, setInputMode] = useState<'chat' | 'image'>('chat');
    const [aspectRatio, setAspectRatio] = useState('1:1');
    const [generatedImageUrls, setGeneratedImageUrls] = useState<Record<string, string>>({});
    const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const dropzoneRef = useRef<HTMLDivElement>(null);

    const activeSession = sessions.find(s => s.id === activeSessionId);

    useEffect(() => {
        if (sessions.length === 0) {
            createNewSession();
        } else if (!activeSessionId || !sessions.find(s => s.id === activeSessionId)) {
            setActiveSessionId(sessions[0]?.id || null);
        }
    }, [sessions, activeSessionId]);

    useEffect(() => {
        if (activeSession) {
            setChat(createChat());
        }
    }, [activeSessionId]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [activeSession?.messages, isLoading]);

    useEffect(() => {
        const loadGeneratedImages = async () => {
            if (!activeSession?.messages) return;

            const newUrls: Record<string, string> = {};
            for (const msg of activeSession.messages) {
                if (msg.generatedImageId) {
                    try {
                        const blob = await getBlob(msg.generatedImageId);
                        if (blob) {
                            newUrls[msg.generatedImageId] = URL.createObjectURL(blob);
                        }
                    } catch (e) {
                        console.error(`Error loading generated image ${msg.generatedImageId}`, e);
                    }
                }
            }
            setGeneratedImageUrls(prev => ({ ...prev, ...newUrls }));
        };

        loadGeneratedImages();

        // Cleanup function
        return () => {
            Object.values(generatedImageUrls).forEach(URL.revokeObjectURL);
        };
    }, [activeSession?.messages]);


    const createNewSession = () => {
        const now = new Date();
        const year = now.getFullYear();
        const month = (now.getMonth() + 1).toString().padStart(2, '0');
        const day = now.getDate().toString().padStart(2, '0');
        const dateString = `${year}${month}${day}`;
        const timeString = now.toLocaleTimeString();

        const newSession: ChatSession = {
            id: uuidv4(),
            name: `${dateString} ${timeString}`,
            messages: [],
        };
        setSessions(prev => [newSession, ...(Array.isArray(prev) ? prev : [])].slice(0, 25));
        setActiveSessionId(newSession.id);
    };

    const deleteSession = (id: string) => {
        setSessions(prev => prev.filter(s => s.id !== id));
        if (activeSessionId === id) {
            setActiveSessionId(sessions.length > 1 ? sessions.find(s => s.id !== id)!.id : null);
        }
    };

    const handleRenameSession = (id: string) => {
        setSessions(prev => prev.map(s => s.id === id ? { ...s, name: editingSessionName } : s));
        setEditingSessionId(null);
        setEditingSessionName('');
    };

    const updateSessionMessages = (newMessages: ChatMessage[]) => {
        setSessions(prev => prev.map(s => s.id === activeSessionId ? { ...s, messages: newMessages } : s));
    };

    const fileToBase64 = (file: File): Promise<string> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => resolve((reader.result as string).split(',')[1]);
            reader.onerror = error => reject(error);
        });
    };

    const handleFileChange = (files: FileList | null) => {
        if (files) {
            setAttachedFiles(prev => [...prev, ...Array.from(files)].slice(0, 10));
        }
    };

    const removeFile = (indexToRemove: number) => {
        setAttachedFiles(prev => prev.filter((_, index) => index !== indexToRemove));
    };

    const handlePaste = useCallback((event: ClipboardEvent) => {
        const items = event.clipboardData?.items;
        if (items) {
            const files = Array.from(items)
                .filter(item => item.kind === 'file' && item.type.startsWith('image/'))
                .map(item => item.getAsFile()!)
                .filter(file => file !== null);
            if (files.length > 0) {
                event.preventDefault();
                setAttachedFiles(prev => [...prev, ...files].slice(0, 10));
            }
        }
    }, []);

    const handleDrop = useCallback((event: DragEvent) => {
        event.preventDefault();
        event.stopPropagation();
        setIsDragging(false);
        if (event.dataTransfer?.files) {
            handleFileChange(event.dataTransfer.files);
        }
    }, []);

    const handleDragOver = useCallback((event: DragEvent) => {
        event.preventDefault();
        event.stopPropagation();
        setIsDragging(true);
    }, []);

    const handleDragLeave = useCallback((event: DragEvent) => {
        event.preventDefault();
        event.stopPropagation();
        setIsDragging(false);
    }, []);

    useEffect(() => {
        const dropzone = dropzoneRef.current;
        window.addEventListener('paste', handlePaste);
        dropzone?.addEventListener('dragenter', handleDragOver);
        dropzone?.addEventListener('dragover', handleDragOver);
        dropzone?.addEventListener('dragleave', handleDragLeave);
        dropzone?.addEventListener('drop', handleDrop);

        return () => {
            window.removeEventListener('paste', handlePaste);
            dropzone?.removeEventListener('dragenter', handleDragOver);
            dropzone?.removeEventListener('dragover', handleDragOver);
            dropzone?.removeEventListener('dragleave', handleDragLeave);
            dropzone?.removeEventListener('drop', handleDrop);
        };
    }, [handlePaste, handleDrop, handleDragOver, handleDragLeave]);

    const handleSendMessage = async () => {
        if (!activeSession || (userInput.trim() === '' && attachedFiles.length === 0)) return;
        setIsLoading(true);

        const currentInput = userInput;
        const currentFiles = attachedFiles;
        setUserInput('');
        setAttachedFiles([]);

        const userMessage: ChatMessage = {
            role: 'user',
            text: currentInput,
            imageUrls: currentFiles.map(f => URL.createObjectURL(f))
        };
        const updatedMessages = [...activeSession.messages, userMessage];
        updateSessionMessages(updatedMessages);

        try {
            if (inputMode === 'image') {
                await handleImageRequest(currentInput, currentFiles, updatedMessages);
            } else {
                await handleChatRequest(currentInput, currentFiles, updatedMessages);
            }
        } catch (error) {
            console.error(error);
            const errorMessage: ChatMessage = { role: 'model', text: `An error occurred: ${error instanceof Error ? error.message : 'Unknown error'}` };
            updateSessionMessages([...updatedMessages, errorMessage]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleImageRequest = async (prompt: string, files: File[], currentMessages: ChatMessage[]) => {
        let response: GenerateContentResponse;

        try {
            if (files.length > 0) { // Edit/Reference Request
                const imageFile = files[0];
                const base64Data = await fileToBase64(imageFile);
                const imagePart = { inlineData: { data: base64Data, mimeType: imageFile.type } };
                response = await editImage(prompt, imagePart, { aspectRatio });
            } else { // Generation Request
                response = await generateImage(prompt, { aspectRatio });
            }

            const imagePartData = response.candidates?.[0]?.content?.parts?.find(p => p.inlineData)?.inlineData;

            if (!imagePartData?.data) {
                const blockReason = response.candidates?.[0]?.safetyRatings?.find(r => r.blocked)?.category;
                const errorText = blockReason
                    ? `이미지 생성이 안전 정책에 의해 차단되었습니다. (이유: ${blockReason})`
                    : "API에서 이미지를 반환하지 않았습니다. 프롬프트를 수정해보세요.";
                throw new Error(errorText);
            }

            const imageBlob = await fetch(`data:${imagePartData.mimeType};base64,${imagePartData.data}`).then(res => res.blob());
            const imageId = uuidv4();
            await setBlob(imageId, imageBlob);

            const newUrl = URL.createObjectURL(imageBlob);
            setGeneratedImageUrls(prev => {
                const updated = { ...prev, [imageId]: newUrl };
                // Clean up old revoked URLs if any
                if (prev[imageId]) URL.revokeObjectURL(prev[imageId]);
                return updated;
            });

            const modelMessage: ChatMessage = { role: 'model', text: "요청하신 이미지입니다.", generatedImageId: imageId };
            updateSessionMessages([...currentMessages, modelMessage]);

        } catch (e) {
            const errorMessage: ChatMessage = { role: 'model', text: `이미지 생성 중 오류가 발생했습니다: ${e instanceof Error ? e.message : 'Unknown error'}` };
            updateSessionMessages([...currentMessages, errorMessage]);
        }
    };

    const handleChatRequest = async (prompt: string, files: File[], currentMessages: ChatMessage[]) => {
        if (!chat) return;

        const requestParts: Array<{ text: string } | { inlineData: { data: string, mimeType: string } }> = [{ text: prompt }];
        const imageParts = await Promise.all(files.map(async file => ({
            inlineData: { data: await fileToBase64(file), mimeType: file.type }
        })));
        requestParts.push(...imageParts);

        try {
            const response = await sendMessageToChat(chat, requestParts);

            const sources = Array.isArray(response.candidates?.[0]?.groundingMetadata?.groundingChunks)
                ? response.candidates[0].groundingMetadata.groundingChunks.map((chunk: any) => ({
                    title: chunk.web?.title || chunk.web?.uri || 'Source',
                    uri: chunk.web?.uri
                })).filter((s: any) => s.uri)
                : [];

            const modelMessage: ChatMessage = { role: 'model', text: response.text, sources };
            updateSessionMessages([...currentMessages, modelMessage]);

        } catch (e) {
            const errorMessage: ChatMessage = { role: 'model', text: `죄송합니다. 오류가 발생했습니다: ${e instanceof Error ? e.message : 'Unknown error'}` };
            updateSessionMessages([...currentMessages, errorMessage]);
        }
    };

    const downloadChat = () => {
        if (!activeSession) return;
        const content = activeSession.messages.map(msg => {
            let messageContent = `${msg.role.toUpperCase()}:\n${msg.text}`;
            if (msg.generatedImageId) messageContent += `\n[Generated Image: ${msg.generatedImageId}]`;
            return messageContent;
        }).join('\n\n');
        const blob = new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${activeSession.name}.txt`;
        a.click();
        URL.revokeObjectURL(url);
    };

    return (
        <div className="flex h-full bg-black/20" ref={dropzoneRef}>
            {isDragging && <div className="absolute inset-0 bg-black/50 border-4 border-dashed border-purple-500 rounded-2xl z-20 flex items-center justify-center"><p className="text-2xl font-bold">여기에 파일을 드롭하세요 / Drop files here</p></div>}
            <div className="w-64 bg-black/40 p-3 border-r border-white/10 flex flex-col">
                <button onClick={createNewSession} className="w-full bg-purple-600/80 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded-lg mb-3 flex items-center justify-center transition-all">
                    <PlusCircle size={18} className="mr-2" /> 새 대화 / New Chat
                </button>
                <div className="flex-grow overflow-y-auto -mr-1 pr-1 space-y-1">
                    {Array.isArray(sessions) && sessions.map(session => (
                        <div key={session.id} onClick={() => setActiveSessionId(session.id)}
                            className={`group p-2 rounded-md cursor-pointer flex justify-between items-center ${activeSessionId === session.id ? 'bg-purple-600/50' : 'hover:bg-white/10'}`}>
                            {editingSessionId === session.id ? (
                                <input type="text" value={editingSessionName} onChange={e => setEditingSessionName(e.target.value)} onBlur={() => handleRenameSession(session.id)} onKeyDown={e => { if (e.key === 'Enter') handleRenameSession(session.id) }} autoFocus className="bg-transparent w-full focus:outline-none" />
                            ) : (
                                <span className="truncate text-sm">{session.name}</span>
                            )}
                            <div className="flex items-center">
                                <button onClick={(e) => { e.stopPropagation(); setEditingSessionId(session.id); setEditingSessionName(session.name); }} className="text-gray-400 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity mr-2"><Edit3 size={14} /></button>
                                <button onClick={(e) => { e.stopPropagation(); deleteSession(session.id); }} className="text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 size={14} /></button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
            <div className="flex-1 flex flex-col p-4 bg-gray-800/30 overflow-hidden">
                {activeSession && (
                    <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-3">
                        <h2 className="text-lg font-semibold text-gray-200 truncate">{activeSession.name}</h2>
                        <button onClick={downloadChat} className="p-2 rounded-full hover:bg-gray-700 text-gray-400 transition-colors" title="Download chat"><Download size={18} /></button>
                    </div>
                )}
                <div className="flex-1 overflow-y-auto pr-2 -mr-2 space-y-4 mb-3">
                    {activeSession?.messages.map((msg, index) => (
                        <div key={index} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                            <div className={`p-3 rounded-xl max-w-2xl w-fit ${msg.role === 'user' ? 'bg-purple-800' : 'bg-gray-700'} overflow-hidden`}>
                                {msg.imageUrls && msg.imageUrls.length > 0 && (
                                    <div className="mb-2 flex gap-2 flex-wrap">
                                        {msg.imageUrls.map((url, i) => (
                                            <img
                                                key={i}
                                                src={url}
                                                alt={`attached ${i + 1}`}
                                                className="max-h-24 rounded-md object-cover cursor-pointer"
                                                onClick={() => setLightboxUrl(url)}
                                            />
                                        ))}
                                    </div>
                                )}
                                {msg.text && (
                                    <div className="prose prose-invert prose-sm max-w-none break-words">
                                        <ReactMarkdown
                                            components={{
                                                pre: ({ node, ...props }) => (
                                                    <div className="not-prose bg-black/30 p-3 rounded-lg my-2 overflow-hidden">
                                                        <pre {...props} className="whitespace-pre-wrap break-words font-mono text-sm" />
                                                    </div>
                                                ),
                                                code: ({ node, ...props }) => (
                                                    <code {...props} className="whitespace-pre-wrap break-words font-mono" />
                                                )
                                            }}
                                        >
                                            {msg.text}
                                        </ReactMarkdown>
                                    </div>
                                )}
                                {msg.generatedImageId && generatedImageUrls[msg.generatedImageId] && (
                                    <div className="mt-2">
                                        <img
                                            src={generatedImageUrls[msg.generatedImageId]}
                                            alt="Generated"
                                            className="max-h-64 rounded-md cursor-pointer"
                                            onClick={() => setLightboxUrl(generatedImageUrls[msg.generatedImageId])}
                                        />
                                    </div>
                                )}
                                {msg.sources && msg.sources.length > 0 && (
                                    <div className="mt-2 pt-2 border-t border-white/20">
                                        <h4 className="text-xs font-semibold text-gray-400 mb-1">Sources:</h4>
                                        <div className="flex flex-wrap gap-2">
                                            {msg.sources.map((source, i) => (
                                                <a key={i} href={source.uri} target="_blank" rel="noopener noreferrer" className="text-xs bg-gray-600 hover:bg-gray-500 px-2 py-1 rounded-full transition-colors">
                                                    {source.title}
                                                </a>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                    {isLoading && (
                        <div className="flex justify-start">
                            <div className="p-3 rounded-xl max-w-2xl w-fit bg-gray-700">
                                <Loader2 className="animate-spin" />
                            </div>
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>
                <div className="mt-auto pt-3 border-t border-white/10">
                    {attachedFiles.length > 0 && (
                        <div className="mb-2 flex flex-wrap gap-2">
                            {attachedFiles.map((file, index) => (
                                <div key={index} className="relative">
                                    <img src={URL.createObjectURL(file)} alt={file.name} className="h-16 w-16 object-cover rounded-md" />
                                    <button onClick={() => removeFile(index)} className="absolute top-0 right-0 -mt-1 -mr-1 bg-red-500 text-white rounded-full p-0.5"><X size={12} /></button>
                                </div>
                            ))}
                        </div>
                    )}
                    <div className="relative">
                        <textarea
                            value={userInput}
                            onChange={e => setUserInput(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(); } }}
                            placeholder={inputMode === 'chat' ? '메시지를 입력하거나 파일을 첨부하세요...' : '이미지 생성을 위한 프롬프트를 입력하세요...'}
                            rows={Math.min(5, (userInput.match(/\n/g) || []).length + 1)}
                            className="w-full bg-gray-700/80 p-3 pr-28 rounded-lg border border-gray-600 focus:ring-purple-500 focus:border-purple-500 transition-all resize-none"
                        />
                        <div className="absolute bottom-2 right-2 flex items-center gap-1">
                            <label className="p-2 rounded-full hover:bg-gray-600 text-gray-400 cursor-pointer">
                                <Paperclip size={18} />
                                <input type="file" multiple onChange={e => handleFileChange(e.target.files)} className="hidden" />
                            </label>
                            <button onClick={handleSendMessage} disabled={isLoading} className="bg-purple-600 hover:bg-purple-700 text-white p-2 rounded-full disabled:bg-gray-500">
                                {isLoading ? <Loader2 className="animate-spin" size={18} /> : <Send size={18} />}
                            </button>
                        </div>
                    </div>
                    <div className="flex items-center justify-between mt-2 text-sm">
                        <div className="flex items-center bg-gray-800 p-1 rounded-lg">
                            <button onClick={() => setInputMode('chat')} className={`px-3 py-1 rounded-md ${inputMode === 'chat' ? 'bg-purple-600' : ''}`}><MessageSquare size={14} className="inline mr-1" /> 채팅</button>
                            <button onClick={() => setInputMode('image')} className={`px-3 py-1 rounded-md ${inputMode === 'image' ? 'bg-purple-600' : ''}`}><Sparkles size={14} className="inline mr-1" /> 이미지</button>
                        </div>
                        {inputMode === 'image' && (
                            <div className="flex items-center gap-2">
                                <label className="text-gray-400">비율:</label>
                                <select value={aspectRatio} onChange={e => setAspectRatio(e.target.value)} className="bg-gray-800 p-1 rounded-md border border-gray-700">
                                    <option value="1:1">1:1</option>
                                    <option value="16:9">16:9</option>
                                    <option value="9:16">9:16</option>
                                    <option value="4:3">4:3</option>
                                    <option value="3:4">3:4</option>
                                </select>
                            </div>
                        )}
                    </div>
                </div>
            </div>
            {lightboxUrl && <Lightbox imageUrl={lightboxUrl} onClose={() => setLightboxUrl(null)} />}
        </div>
    );
};

export default PromptLab;
