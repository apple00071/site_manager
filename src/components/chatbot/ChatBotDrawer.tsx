'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  FiMessageSquare, FiSend, FiX, FiRefreshCw,
  FiHelpCircle, FiAlertCircle, FiClock
} from 'react-icons/fi';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface ChatBotDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

// Simple and Clean Markdown Formatter (safe for React 19, matching system UI/UX)
function formatMarkdown(text: string): React.ReactNode[] {
  if (!text) return [];
  
  const lines = text.split('\n');
  const elements: React.ReactNode[] = [];
  
  let inList = false;
  let listItems: string[] = [];
  let inTable = false;
  let tableRows: string[][] = [];
  let tableHeaders: string[] = [];
  let inCode = false;
  let codeLines: string[] = [];

  const flushList = (key: string) => {
    if (listItems.length > 0) {
      elements.push(
        <ul key={`ul-${key}`} className="list-disc pl-5 mb-3 text-sm space-y-1 text-gray-700">
          {listItems.map((item, i) => (
            <li key={`li-${key}-${i}`} className="leading-relaxed">
              {parseInlineFormatting(item)}
            </li>
          ))}
        </ul>
      );
      listItems = [];
      inList = false;
    }
  };

  const flushTable = (key: string) => {
    if (tableRows.length > 0 || tableHeaders.length > 0) {
      elements.push(
        <div key={`table-wrapper-${key}`} className="overflow-x-auto my-3 border border-gray-200 rounded-lg">
          <table className="min-w-full divide-y divide-gray-200 text-xs text-left">
            <thead className="bg-gray-50 text-gray-700 font-bold uppercase">
              <tr>
                {tableHeaders.map((h, idx) => (
                  <th key={`th-${key}-${idx}`} className="px-3 py-2 border-b border-gray-200 font-semibold bg-gray-50">{h.trim()}</th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100 text-gray-600">
              {tableRows.map((row, rIdx) => (
                <tr key={`tr-${key}-${rIdx}`} className="hover:bg-gray-50/50">
                  {row.map((cell, cIdx) => (
                    <td key={`td-${key}-${rIdx}-${cIdx}`} className="px-3 py-2 whitespace-normal">{parseInlineFormatting(cell)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      tableRows = [];
      tableHeaders = [];
      inTable = false;
    }
  };

  const flushCode = (key: string) => {
    if (codeLines.length > 0) {
      elements.push(
        <pre key={`code-${key}`} className="bg-gray-55 text-gray-800 rounded-lg p-3 text-xs font-mono my-2 overflow-x-auto border border-gray-200">
          <code>{codeLines.join('\n')}</code>
        </pre>
      );
      codeLines = [];
      inCode = false;
    }
  };

  const parseInlineFormatting = (inlineText: string): React.ReactNode => {
    const codeParts = inlineText.split(/(`.*?`)/g);
    return codeParts.map((cPart, cIdx) => {
      if (cPart.startsWith('`') && cPart.endsWith('`')) {
        return (
          <code key={`code-${cIdx}`} className="bg-gray-100 text-rose-600 px-1 rounded font-mono text-xs">
            {cPart.slice(1, -1)}
          </code>
        );
      }
      
      const linkParts = cPart.split(/(\[.*?\]\(.*?\))/g);
      return linkParts.map((lPart, lIdx) => {
        if (lPart.startsWith('[') && lPart.includes('](') && lPart.endsWith(')')) {
          const closeBracketIdx = lPart.indexOf('](');
          const linkText = lPart.slice(1, closeBracketIdx);
          const linkUrl = lPart.slice(closeBracketIdx + 2, -1);
          return (
            <a
              key={`link-${lIdx}`}
              href={linkUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-yellow-650 hover:text-yellow-750 hover:underline font-semibold break-all"
            >
              {linkText}
            </a>
          );
        }

        const boldParts = lPart.split(/(\*\*.*?\*\*)/g);
        return boldParts.map((part, i) => {
          if (part.startsWith('**') && part.endsWith('**')) {
            return (
              <strong key={i} className="font-bold text-gray-900">
                {part.slice(2, -2)}
              </strong>
            );
          }
          
          const italicParts = part.split(/(\*.*?\*)/g);
          return italicParts.map((subPart, j) => {
            if (subPart.startsWith('*') && subPart.endsWith('*')) {
              const cleanedText = subPart.slice(1, -1).replace(/^"|"$/g, '');
              return (
                <span key={`${i}-${j}`} className="italic text-gray-800">
                  "{cleanedText}"
                </span>
              );
            }
            return subPart;
          });
        });
      });
    });
  };

  for (let idx = 0; idx < lines.length; idx++) {
    const line = lines[idx].trim();
    const key = `${idx}-${Date.now()}`;

    // Code block check
    if (line.startsWith('```')) {
      if (inCode) {
        flushCode(key);
      } else {
        flushList(key);
        flushTable(key);
        inCode = true;
      }
      continue;
    }

    if (inCode) {
      codeLines.push(lines[idx]);
      continue;
    }

    // Table parser
    if (line.startsWith('|')) {
      flushList(key);
      const cells = line.split('|').map(c => c.trim()).filter((_, i, arr) => i > 0 && i < arr.length - 1);
      
      const isSeparator = cells.every(c => c.match(/^:?-+:?$/));
      if (isSeparator) {
        continue;
      }

      if (!inTable) {
        inTable = true;
        tableHeaders = cells;
      } else {
        tableRows.push(cells);
      }
      continue;
    } else {
      if (inTable) {
        flushTable(key);
      }
    }

    // List item parser
    if (line.startsWith('- ') || line.startsWith('* ')) {
      inList = true;
      listItems.push(line.substring(2));
      continue;
    } else {
      if (inList) {
        flushList(key);
      }
    }

    // Headers
    if (line.startsWith('### ')) {
      elements.push(<h4 key={key} className="text-xs font-bold text-gray-500 uppercase mt-4 mb-1">{parseInlineFormatting(line.substring(4))}</h4>);
      continue;
    }
    if (line.startsWith('## ')) {
      elements.push(<h3 key={key} className="text-sm font-bold text-gray-900 mt-4 mb-2 border-b border-gray-100 pb-0.5">{parseInlineFormatting(line.substring(3))}</h3>);
      continue;
    }
    if (line.startsWith('# ')) {
      elements.push(<h2 key={key} className="text-base font-bold text-gray-900 mt-5 mb-3">{parseInlineFormatting(line.substring(2))}</h2>);
      continue;
    }

    // Plain text block
    if (line !== '') {
      elements.push(<p key={key} className="text-sm text-gray-700 leading-relaxed mb-2">{parseInlineFormatting(line)}</p>);
    } else {
      elements.push(<div key={key} className="h-1.5" />);
    }
  }

  // Final flush
  flushList('final');
  flushTable('final');
  flushCode('final');

  return elements;
}

export default function ChatBotDrawer({ isOpen, onClose }: ChatBotDrawerProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [errorStatus, setErrorStatus] = useState<{ type: string; title: string; message: string } | null>(null);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Suggested Prompts
  const suggestionChips = [
    { label: 'My Projects', prompt: 'What projects are assigned to me in the system?' },
    { label: 'Pending Tasks', prompt: 'List all of my pending or in-progress tasks, grouped by project.' },
    { label: 'Active Snags', prompt: 'Are there any active or unresolved snags reported on projects I work on?' },
    { label: 'Team Directory', prompt: 'Summarize the team members in the system and their roles/designations.' }
  ];

  // 1. Initial greeting
  useEffect(() => {
    if (!isOpen) return;

    const stored = localStorage.getItem('apple_site_chat_history');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setMessages(parsed.map((m: any) => ({
            ...m,
            timestamp: new Date(m.timestamp)
          })));
          return;
        }
      } catch { }
    }

    const greeting: Message = {
      id: 'greeting-1',
      role: 'assistant',
      content: `Hello! I am your AI Assistant. 

I can help you query your projects, tasks, team directory, and snags in real-time.

Feel free to ask questions like:
- *"What projects are in-progress?"*
- *"Show all tasks assigned to John"*
- *"List open snags"*

Select a suggestion below or type a query to get started!`,
      timestamp: new Date()
    };
    setMessages([greeting]);
  }, [isOpen]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const saveHistory = (updatedMessages: Message[]) => {
    localStorage.setItem('apple_site_chat_history', JSON.stringify(updatedMessages));
  };

  const handleSendMessage = async (text: string) => {
    if (!text.trim() || isTyping) return;

    const userMsg: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: new Date()
    };

    const newMessagesList = [...messages, userMsg];
    setMessages(newMessagesList);
    saveHistory(newMessagesList);
    setInputMessage('');
    setIsTyping(true);
    setErrorStatus(null);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: newMessagesList.map(m => ({
            role: m.role,
            content: m.content
          }))
        })
      });

      if (res.ok) {
        const data = await res.json();
        const botMsg: Message = {
          id: `bot-${Date.now()}`,
          role: 'assistant',
          content: data.response,
          timestamp: new Date()
        };
        const updatedList = [...newMessagesList, botMsg];
        setMessages(updatedList);
        saveHistory(updatedList);
      } else {
        const errData = await res.json();
        console.error('Chat API error response:', errData);
        setErrorStatus({
          type: 'api_error',
          title: errData.error || 'Connection Failed',
          message: errData.message || 'There was an error communicating with the AI server. Please make sure ANTHROPIC_API_KEY is configured in your .env.local file.'
        });
      }
    } catch (err) {
      console.error('Error sending message:', err);
      setErrorStatus({
        type: 'network_error',
        title: 'Connection Offline',
        message: 'Could not connect to the API. Please ensure your dev server is running.'
      });
    } finally {
      setIsTyping(false);
    }
  };

  const handleClearHistory = () => {
    if (window.confirm('Are you sure you want to clear your chat history?')) {
      localStorage.removeItem('apple_site_chat_history');
      const greeting: Message = {
        id: `greeting-${Date.now()}`,
        role: 'assistant',
        content: `Chat history cleared. How can I help you today?`,
        timestamp: new Date()
      };
      setMessages([greeting]);
      setErrorStatus(null);
    }
  };

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-[100] transition-opacity duration-300 animate-fade-in"
          onClick={onClose}
        />
      )}

      {/* Slide-out Drawer */}
      <div
        className={`
          fixed inset-y-0 right-0 w-full md:w-[540px] bg-white shadow-2xl z-[101] flex flex-col
          transition-transform duration-300 ease-in-out h-[100dvh] overflow-hidden
          ${isOpen ? 'translate-x-0' : 'translate-x-full'}
        `}
      >
        {/* Header bar - exact match to NotepadDrawer */}
        <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-yellow-500 text-white flex items-center justify-center">
              <FiMessageSquare className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-gray-900">AI Assistant</h2>
              <p className="text-[10px] font-semibold text-gray-400">
                Cloud database synced
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleClearHistory}
              className="p-1.5 hover:bg-gray-200 rounded-lg text-gray-400 hover:text-gray-700 transition-colors"
              title="Clear Conversation"
            >
              <FiRefreshCw className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 hover:bg-gray-200 rounded-lg text-gray-400 hover:text-gray-700 transition-colors"
              aria-label="Close assistant"
            >
              <FiX className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Message Panel Area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-white">
          {messages.map((msg) => {
            const isUser = msg.role === 'user';
            return (
              <div
                key={msg.id}
                className={`flex gap-3 max-w-[85%] ${isUser ? 'ml-auto flex-row-reverse' : 'mr-auto'}`}
              >
                {/* Small Clean Circle Icon */}
                <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 shadow-2xs font-bold text-xs ${
                  isUser ? 'bg-gray-700 text-white' : 'bg-yellow-500 text-white'
                }`}>
                  {isUser ? 'U' : <FiMessageSquare className="w-3.5 h-3.5" />}
                </div>

                {/* Message Bubble - Clean white and light gray */}
                <div className="flex flex-col gap-1">
                  <div className={`
                    p-3.5 rounded-2xl text-sm border
                    ${isUser 
                      ? 'bg-gray-100 border-transparent text-gray-800 rounded-tr-none' 
                      : 'bg-white border-gray-200 text-gray-800 rounded-tl-none'
                    }
                  `}>
                    {isUser ? (
                      <p className="whitespace-pre-wrap">{msg.content}</p>
                    ) : (
                      formatMarkdown(msg.content)
                    )}
                  </div>
                  
                  <span className={`text-[9px] text-gray-400 px-1 flex items-center gap-1 ${isUser ? 'justify-end' : 'justify-start'}`}>
                    <FiClock className="w-2.5 h-2.5" />
                    {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>
            );
          })}

          {/* Typing Indicator */}
          {isTyping && (
            <div className="flex gap-3 max-w-[85%] mr-auto">
              <div className="w-7 h-7 rounded-full bg-yellow-500 text-white flex items-center justify-center shrink-0">
                <FiMessageSquare className="w-3.5 h-3.5" />
              </div>
              <div className="flex flex-col gap-1">
                <div className="bg-white border border-gray-200 px-4 py-2.5 rounded-2xl rounded-tl-none shadow-2xs flex items-center gap-1">
                  <div className="w-1.5 h-1.5 bg-yellow-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="w-1.5 h-1.5 bg-yellow-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="w-1.5 h-1.5 bg-yellow-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}

          {/* API Setup / Network Error Panel */}
          {errorStatus && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex gap-2.5 text-red-800 select-none">
              <FiAlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-500" />
              <div className="flex-1 space-y-1">
                <h3 className="text-xs font-bold uppercase">{errorStatus.title}</h3>
                <p className="text-xs text-red-700 leading-relaxed">
                  {errorStatus.message}
                </p>
                {errorStatus.type === 'api_error' && (
                  <div className="mt-2 text-[10px] font-mono bg-red-100/50 p-2 rounded">
                    Add keys to .env.local:<br />
                    <code className="text-red-900 font-bold select-all">ANTHROPIC_API_KEY=your_key</code>
                  </div>
                )}
              </div>
            </div>
          )}

          <div ref={chatEndRef} />
        </div>

        {/* Suggestion Chips & Prompt Input */}
        <div className="p-3 bg-white border-t border-gray-200 shrink-0">
          
          {/* Suggestions Chips Slider */}
          <div className="flex gap-2 overflow-x-auto pb-2 mb-1.5 no-scrollbar select-none">
            {suggestionChips.map((chip, idx) => (
              <button
                key={idx}
                onClick={() => handleSendMessage(chip.prompt)}
                disabled={isTyping}
                className="shrink-0 px-3 py-1.5 bg-white hover:bg-gray-50 border border-gray-200 rounded-full text-xs text-gray-650 transition-colors cursor-pointer disabled:opacity-50 disabled:pointer-events-none"
              >
                {chip.label}
              </button>
            ))}
          </div>

          {/* Input container - exact match to Notepad/Search input fields */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage(inputMessage);
            }}
            className="flex items-center gap-2"
          >
            <input
              type="text"
              placeholder="Ask a question about projects, tasks, or snags..."
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              disabled={isTyping}
              className="flex-1 text-sm px-3.5 py-2.5 bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-yellow-500 focus:border-yellow-500 text-gray-800 placeholder-gray-400 font-medium"
            />
            <button
              type="submit"
              disabled={!inputMessage.trim() || isTyping}
              className="p-2.5 bg-yellow-500 hover:bg-yellow-600 disabled:bg-gray-200 text-white disabled:text-gray-400 rounded-lg transition-colors flex items-center justify-center cursor-pointer"
            >
              <FiSend className="w-4 h-4 font-bold" />
            </button>
          </form>
        </div>
      </div>
    </>
  );
}
