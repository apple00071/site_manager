'use client';

import { useState, useEffect, useMemo, use, useRef } from 'react';
import { Inter } from 'next/font/google';
import { supabase } from '@/lib/supabase';
import { 
  FiImage, FiFileText, FiMessageSquare, FiUser, 
  FiClock, FiCheckCircle, FiMaximize2, 
  FiDownload, FiInfo,
  FiSend, FiCamera, FiMic, FiX, FiPlay, FiPause,
  FiLogOut, FiChevronLeft, FiChevronRight
} from 'react-icons/fi';
import { DesignViewer } from '@/components/projects/DesignViewer';
import { useToast } from '@/components/ui/Toast';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';

const inter = Inter({ 
  subsets: ['latin'],
  variable: '--font-inter',
});

// Voice Note Player Helper Component
function VoiceNotePlayer({ src }: { src: string }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  const togglePlay = async () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) { audio.pause(); setIsPlaying(false); } 
    else { try { await audio.play(); setIsPlaying(true); } catch (e) { console.error(e); } }
  };

  return (
    <div className="inline-flex items-center gap-3 rounded-full bg-gray-100 border border-gray-200 px-3 py-1.5 transition-all hover:bg-white">
      <button onClick={togglePlay} className="w-7 h-7 rounded-full bg-yellow-500 text-white flex items-center justify-center transition-transform active:scale-90">
        {isPlaying ? <FiPause size={12} /> : <FiPlay size={12} className="ml-0.5" />}
      </button>
      <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Voice Note</span>
      <audio ref={audioRef} src={src} className="hidden" onEnded={() => setIsPlaying(false)} onPause={() => setIsPlaying(false)} />
    </div>
  );
}

const formatDate = (date: string) => {
  if (!date) return '-';
  return new Date(date).toLocaleDateString('en-GB', { 
    day: '2-digit', 
    month: 'short', 
    year: 'numeric' 
  });
};

const getInitials = (name: string) => {
  if (!name) return 'U';
  return name.split(' ').map(word => word[0]).join('').toUpperCase().slice(0, 2);
};

export default function SecureProjectPortal({ params }: { params: Promise<{ id: string }> }) {
  const { id: projectId } = use(params);
  const { user, signOut, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const { showToast } = useToast();
  
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'gallery' | 'designs' | 'timeline'>('gallery');
  const [selectedDesign, setSelectedDesign] = useState<any>(null);
  const [lightboxData, setLightboxData] = useState<{ photos: string[], index: number } | null>(null);
  
  // Messaging & Media States
  const [messageInput, setMessageInput] = useState('');
  const [isPosting, setIsPosting] = useState(false);
  const [uploadedPhotos, setUploadedPhotos] = useState<string[]>([]);
  const [uploadingPhotos, setUploadingPhotos] = useState(false);
  
  // Recording States
  const [isRecording, setIsRecording] = useState(false);
  const [audioPreviewUrl, setAudioPreviewUrl] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioBlobRef = useRef<Blob | null>(null);

  useEffect(() => {
    if (!authLoading && !user) router.push('/portal/login');
    if (user) fetchProjectData();
  }, [projectId, user, authLoading]);

  // Keyboard Navigation Support
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!lightboxData) return;
      if (e.key === 'ArrowRight') setLightboxData(prev => prev ? { ...prev, index: (prev.index + 1) % prev.photos.length } : null);
      if (e.key === 'ArrowLeft') setLightboxData(prev => prev ? { ...prev, index: (prev.index - 1 + prev.photos.length) % prev.photos.length } : null);
      if (e.key === 'Escape') setLightboxData(null);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [lightboxData]);

  const fetchProjectData = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/portal/project/${projectId}`);
      if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || 'Access denied');
      }
      const json = await res.json();
      setData(json);
    } catch (err: any) {
      showToast('error', err.message);
      if (err.message.includes('Forbidden')) router.push('/portal/login');
    } finally {
      setLoading(false);
    }
  };

  // --- Photo Upload Logic ---
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploadingPhotos(true);
    try {
      const uploadPromises = Array.from(files).map(async (file, i) => {
        const fileExt = file.name.split('.').pop();
        const fileName = `portal/${projectId}/${Date.now()}_${i}.${fileExt}`;
        const { error } = await supabase.storage.from('project-update-photos').upload(fileName, file);
        if (error) return null;
        const { data: { publicUrl } } = supabase.storage.from('project-update-photos').getPublicUrl(fileName);
        return publicUrl;
      });
      const urls = await Promise.all(uploadPromises);
      const successful = urls.filter((url): url is string => url !== null);
      setUploadedPhotos(prev => [...prev, ...successful]);
    } finally { setUploadingPhotos(false); e.target.value = ''; }
  };

  // --- Voice Recording Logic ---
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];
      recorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      recorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        audioBlobRef.current = blob;
        setAudioPreviewUrl(URL.createObjectURL(blob));
        stream.getTracks().forEach(track => track.stop());
      };
      recorder.start();
      setIsRecording(true);
    } catch (err) { showToast('error', 'Microphone access denied'); }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const handlePostMessage = async () => {
    const hasContent = messageInput.trim() || uploadedPhotos.length > 0 || audioBlobRef.current;
    if (!hasContent || isPosting) return;
    
    setIsPosting(true);
    let audioUrl = null;
    try {
      if (audioBlobRef.current) {
        const fileName = `portal/${projectId}/voice_${Date.now()}.webm`;
        const { error } = await supabase.storage.from('project-update-voices').upload(fileName, audioBlobRef.current);
        if (!error) {
            const { data: { publicUrl } } = supabase.storage.from('project-update-voices').getPublicUrl(fileName);
            audioUrl = publicUrl;
        }
      }

      const res = await fetch(`/api/public/project/secure/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
            message: messageInput,
            photos: uploadedPhotos,
            audio_url: audioUrl
        })
      });

      if (res.ok) {
        showToast('success', 'Message sent to the team');
        setMessageInput('');
        setUploadedPhotos([]);
        setAudioPreviewUrl(null);
        audioBlobRef.current = null;
        fetchProjectData();
      } else {
        const err = await res.json();
        showToast('error', err.error || 'Failed to send message');
      }
    } finally { setIsPosting(false); }
  };
  
  // Navigation Helper
  const allGalleryPhotos = useMemo(() => {
    if (!data?.photos) return [];
    return data.photos.flatMap((u: any) => u.photos);
  }, [data?.photos]);

  const handleDesignAction = async (designId: string, action: 'approved' | 'rejected' | 'needs_changes', comments?: string) => {
    try {
      const res = await fetch(`/api/portal/project/${projectId}/designs/${designId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, comments })
      });
      if (res.ok) {
        showToast('success', `Design ${action.toUpperCase()} successfully`);
        fetchProjectData();
        setSelectedDesign(null);
      }
    } catch (err) { showToast('error', 'Operation failed'); }
  };

  const groupedDesigns = useMemo(() => {
    const groups: Record<string, any[]> = {};
    (data?.designs || []).forEach((d: any) => {
      const cat = d.category || 'Uncategorized';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(d);
    });
    return groups;
  }, [data?.designs]);

  const getStatusBadge = (status: string) => {
    const common = "text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-tighter";
    if (status === 'approved') return <span className={`bg-green-100 text-green-700 ${common}`}>Approved</span>;
    if (status === 'needs_changes') return <span className={`bg-amber-100 text-amber-700 ${common}`}>Changes Requested</span>;
    if (status === 'rejected') return <span className={`bg-red-50 text-red-600 ${common}`}>Rejected</span>;
    return <span className={`bg-gray-100 text-gray-500 ${common}`}>Pending</span>;
  };

  const getGroupLabel = (date: string) => {
      const today = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long' });
      const yesterdayDate = new Date();
      yesterdayDate.setDate(yesterdayDate.getDate() - 1);
      const yesterday = yesterdayDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'long' });
      
      if (date === today) return 'Today';
      if (date === yesterday) return 'Yesterday';
      return date;
  };

  if (loading || authLoading) return <div className="min-h-screen bg-[#fafaf8] flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-yellow-500"></div></div>;
  if (!data?.project) return <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6"><FiInfo size={32} className="text-red-500 mb-4"/><h1 className="text-lg font-bold">Project Unreachable</h1><button onClick={() => router.push('/portal/login')} className="mt-4 text-yellow-600 font-bold">Back to Login</button></div>;

  const { project, photos, siteEngineer, designer } = data;

  return (
    <div className={`min-h-screen bg-[#fafaf8] ${inter.className}`}>
      {/* Top Notification Bar */}
      <div className="bg-yellow-500 py-2.5 px-6 border-b border-yellow-600 shadow-sm relative z-50">
        <div className="text-[10px] font-bold text-white uppercase tracking-[0.25em] text-center">
          Apple Interiors <span className="text-white/60 mx-2">|</span> Client Portal
        </div>
      </div>

      <header className="bg-white border-b border-gray-200">
        <div className="w-full px-6 py-6 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-6">
            <div className="w-12 h-12 bg-white rounded-xl shadow-sm border border-gray-100 flex items-center justify-center overflow-hidden">
                <img 
                    src="/New-logo.png" 
                    alt="Apple Interiors" 
                    className="h-9 w-auto object-contain" 
                    loading="eager"
                    onError={(e) => {
                        (e.target as HTMLImageElement).style.opacity = '0';
                        (e.target as HTMLImageElement).parentElement!.classList.add('bg-yellow-500');
                        (e.target as HTMLImageElement).parentElement!.innerHTML = '<span class="text-white font-black text-lg">A</span>';
                    }}
                />
            </div>
            <div className="w-px h-8 bg-gray-100 hidden md:block" />
            <h1 className="text-xl font-semibold text-gray-900 tracking-tight leading-none">{project.title}</h1>
          </div>
          <div className="flex flex-wrap items-center gap-8">
            {[designer, siteEngineer].map((person, idx) => person && (
              <div key={idx} className="flex items-center gap-3">
                <div className="w-8 h-8 bg-gray-100 text-gray-500 rounded-full flex items-center justify-center border border-gray-200"><FiUser size={14} /></div>
                <div><div className="text-[9px] font-bold uppercase tracking-[0.1em] text-gray-400 mb-0.5">{idx === 0 ? 'Designer' : 'Site Engineer'}</div><div className="text-[11px] font-bold text-gray-700">{person.full_name}</div></div>
              </div>
            ))}
            
            <div className="w-px h-8 bg-gray-200 hidden md:block" />
            
            <button 
              onClick={async () => {
                await signOut();
                router.push('/login');
              }}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-yellow-500 text-white hover:bg-yellow-600 transition-colors text-[10px] font-bold uppercase tracking-wider shadow-sm"
            >
              <FiLogOut size={14} />
              <span>Sign Out</span>
            </button>
          </div>
        </div>

        <div className="w-full px-6">
          <div className="flex gap-2">
            {[ { id: 'gallery', label: 'Gallery', icon: FiImage }, { id: 'designs', label: 'Designs', icon: FiFileText }, { id: 'timeline', label: 'Timeline', icon: FiMessageSquare }].map((tab) => (
              <button 
                key={tab.id} 
                onClick={() => setActiveTab(tab.id as any)} 
                className={`flex items-center gap-2 px-6 py-3 text-[11px] font-bold uppercase tracking-[0.1em] transition-all rounded-t-lg ${activeTab === tab.id ? 'bg-yellow-500 text-white border-b-2 border-yellow-600' : 'text-gray-500 hover:text-gray-900 hover:bg-yellow-50/50'}`}
              >
                <tab.icon size={14} />
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="w-full px-6 py-8">
        {activeTab === 'gallery' && (
          <div className="animate-in fade-in duration-500">
            {photos.length > 0 ? (
              <div className="columns-2 md:columns-3 lg:columns-4 xl:columns-5 gap-4 space-y-4">
                {photos.map((u: any) => u.photos.map((url: string, i: number) => (
                  <div 
                    key={`${u.id}-${i}`} 
                    className="group relative bg-white rounded-xl overflow-hidden mb-4 transition-all border border-gray-200 cursor-zoom-in"
                    onClick={() => setLightboxData({ photos: allGalleryPhotos, index: allGalleryPhotos.indexOf(url) })}
                  >
                    <img src={url} className="w-full object-cover" />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-6"><div className="text-[9px] font-bold uppercase tracking-[0.2em] text-white/80 mb-1">{new Date(u.update_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'long' })}</div><div className="text-sm text-white font-bold tracking-tight line-clamp-1">{u.description}</div></div>
                  </div>
                )))}
              </div>
            ) : <div className="py-20 text-center bg-white rounded-xl border border-gray-200"><FiImage className="w-12 h-12 text-gray-200 mx-auto mb-4"/><h3 className="text-lg font-bold">No Photos Yet</h3></div>}
          </div>
        )}

        {activeTab === 'designs' && (
          <div className="animate-in slide-in-from-bottom-5 duration-500">
            {Object.keys(groupedDesigns).length > 0 ? (
                <div className="space-y-12">
                  {Object.entries(groupedDesigns).map(([cat, items]: any) => (
                    <div key={cat}>
                        <div className="flex items-center gap-4 mb-6">
                            <h3 className="text-lg font-semibold text-gray-900">{cat}</h3>
                            <div className="h-px flex-1 bg-gray-100" />
                        </div>
                        
                        {/* 🖥️ Desktop View: Boutique Strip-Table (MD+) */}
                        <div className="hidden md:block overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-gray-50/50 border-b border-gray-100">
                                        <th className="px-8 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">Asset Name</th>
                                        <th className="px-6 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">Uploaded</th>
                                        <th className="px-6 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-center text-gray-400">Version</th>
                                        <th className="px-6 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-center text-gray-400">Status</th>
                                        <th className="px-8 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-right text-gray-400">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                    {items.map((d: any) => (
                                        <tr key={d.id} className="group hover:bg-gray-50/80 transition-colors">
                                            <td className="px-8 py-5">
                                                <div className="flex items-center gap-3">
                                                    <div className="p-2 bg-yellow-50 rounded-lg text-yellow-600">
                                                        <FiFileText size={18}/>
                                                    </div>
                                                    <span className="text-sm font-bold text-gray-800 line-clamp-1 truncate max-w-[300px]" title={d.file_name}>
                                                        {d.file_name}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-5 text-xs font-semibold text-gray-400">
                                                {formatDate(d.created_at)}
                                            </td>
                                            <td className="px-6 py-5 text-center">
                                                <span className="text-[10px] font-black text-gray-400 bg-gray-50 px-2 py-1 rounded">V{d.version_number}</span>
                                            </td>
                                            <td className="px-6 py-5 text-center">
                                                {getStatusBadge(d.approval_status)}
                                            </td>
                                            <td className="px-8 py-5">
                                                <div className="flex items-center justify-end gap-2">
                                                    <button onClick={() => setSelectedDesign(d)} className="p-2 text-gray-400 hover:text-yellow-600 hover:bg-white border border-transparent hover:border-gray-100 rounded-lg transition-all"><FiMaximize2 size={16}/></button>
                                                    {d.file_url && <a href={d.file_url} target="_blank" download className="p-2 text-gray-400 hover:text-yellow-600 hover:bg-white border border-transparent hover:border-gray-100 rounded-lg transition-all"><FiDownload size={16}/></a>}
                                                    {d.approval_status === 'pending' && <button onClick={()=>handleDesignAction(d.id, 'approved')} className="ml-2 px-4 py-1.5 bg-yellow-500 text-white text-[10px] font-black uppercase tracking-widest rounded-lg shadow-sm hover:bg-yellow-600 active:scale-95 transition-all">Approve</button>}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* 📱 Mobile View: Premium Card List (<MD) */}
                        <div className="md:hidden space-y-4">
                            {items.map((d: any) => (
                                <div key={d.id} className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm space-y-4">
                                    <div className="flex items-start gap-4">
                                        <div className="p-3 bg-yellow-50 rounded-xl text-yellow-600 flex-shrink-0">
                                            <FiFileText size={20}/>
                                        </div>
                                        <div className="min-w-0">
                                            <h4 className="text-sm font-bold text-gray-800 line-clamp-2 leading-snug mb-1">{d.file_name}</h4>
                                            <div className="flex items-center gap-2 text-[10px] font-bold text-gray-300 uppercase tracking-widest">
                                                <FiClock size={10}/>
                                                {formatDate(d.created_at)}
                                            </div>
                                        </div>
                                    </div>
                                    
                                    <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-50">
                                        <div className="space-y-1">
                                            <div className="text-[9px] font-black text-gray-300 uppercase tracking-widest">Version</div>
                                            <div className="text-xs font-black text-gray-400">V{d.version_number}</div>
                                        </div>
                                        <div className="space-y-1">
                                            <div className="text-[9px] font-black text-gray-300 uppercase tracking-widest">Status</div>
                                            <div>{getStatusBadge(d.approval_status)}</div>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2 pt-2">
                                        <button onClick={() => setSelectedDesign(d)} className="flex-1 flex items-center justify-center gap-2 py-3 bg-gray-50 text-gray-400 rounded-xl text-[10px] font-black uppercase tracking-widest active:bg-gray-100 transition-colors">
                                            <FiMaximize2 size={14}/>
                                            View
                                        </button>
                                        {d.file_url && (
                                            <a href={d.file_url} target="_blank" download className="flex-1 flex items-center justify-center gap-2 py-3 bg-gray-50 text-gray-400 rounded-xl text-[10px] font-black uppercase tracking-widest active:bg-gray-100 transition-colors">
                                                <FiDownload size={14}/>
                                                Download
                                            </a>
                                        )}
                                        {d.approval_status === 'pending' && (
                                            <button onClick={()=>handleDesignAction(d.id, 'approved')} className="flex-[1.5] py-3 bg-yellow-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-md shadow-yellow-500/20 active:scale-95 transition-all">
                                                Approve
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                  ))}
                </div>
            ) : <div className="py-20 text-center bg-white rounded-xl border border-gray-200"><FiFileText className="w-12 h-12 text-gray-200 mx-auto mb-4"/><h3 className="text-lg font-bold">No Designs Yet</h3></div>}
          </div>
        )}

        {activeTab === 'timeline' && (
          <div className="w-full animate-in slide-in-from-right-5 duration-500">
            <div className="mb-8 bg-white border border-gray-200 p-6 rounded-xl shadow-sm">
              <textarea value={messageInput} onChange={(e) => setMessageInput(e.target.value)} placeholder="Type a message or share an update..." className="w-full bg-gray-50 border border-gray-100 rounded-lg p-4 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-500/10 focus:bg-white transition-all min-h-[100px] resize-none leading-relaxed" />
              
              {(uploadedPhotos.length > 0 || audioPreviewUrl) && (
                <div className="mt-4 flex flex-wrap gap-2 animate-in fade-in slide-in-from-top-2">
                  {uploadedPhotos.map((url, i) => (
                    <div key={i} className="relative w-12 h-12 rounded-lg overflow-hidden border border-gray-200">
                      <img src={url} className="w-full h-full object-cover" />
                      <button onClick={() => setUploadedPhotos(prev => prev.filter((_, idx) => idx !== i))} className="absolute top-0.5 right-0.5 w-4 h-4 bg-black/60 text-white rounded-full flex items-center justify-center"><FiX size={8}/></button>
                    </div>
                  ))}
                  {audioPreviewUrl && (
                    <div className="relative flex items-center gap-2 bg-yellow-50 border border-yellow-100 px-3 py-1.5 rounded-lg">
                      <FiMic size={14} className="text-yellow-600"/>
                      <span className="text-[9px] font-bold text-yellow-700 uppercase tracking-widest">Voice Note</span>
                      <button onClick={() => setAudioPreviewUrl(null)} className="ml-1 text-gray-400 hover:text-red-500"><FiX size={12}/></button>
                    </div>
                  )}
                </div>
              )}

              <div className="flex items-center justify-between mt-4">
                <div className="flex items-center gap-2">
                  <label className="p-2 text-gray-400 hover:text-yellow-600 hover:bg-gray-50 rounded-lg transition-all cursor-pointer"><FiCamera size={18}/><input type="file" multiple accept="image/*" onChange={handlePhotoUpload} className="hidden" /></label>
                  <button onClick={isRecording ? stopRecording : startRecording} className={`p-2 rounded-lg transition-all flex items-center gap-2 ${isRecording ? 'bg-red-50 text-red-500' : 'text-gray-400 hover:text-yellow-600 hover:bg-gray-50'}`}><FiMic size={18}/> {isRecording && <span className="text-[9px] font-bold uppercase">Rec</span>}</button>
                </div>
                <button onClick={handlePostMessage} disabled={isPosting || (!messageInput.trim() && uploadedPhotos.length === 0 && !audioBlobRef.current)} className="px-6 py-2 bg-yellow-500 text-white rounded-lg text-xs font-bold uppercase tracking-widest transition-all hover:bg-yellow-600 disabled:opacity-50 flex items-center gap-2"><FiSend size={12} /> Send</button>
              </div>
            </div>

            {data?.updates?.length > 0 ? (
                <div className="space-y-12">{Object.entries((()=>{
                    const groups:any = {};
                    data.updates.forEach((u:any)=>{const d = new Date(u.update_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'long' }); if(!groups[d]) groups[d]=[]; groups[d].push(u);});
                    return groups;
                })()).map(([date, items]:any) => (
                    <div key={date} className="space-y-4">
                        <h3 className="text-lg font-semibold text-gray-900 mb-4">{getGroupLabel(date)}</h3>
                        {items.map((u:any) => {
                            const isClient = u.user_id === user?.id;
                            const displayName = u.sender_name || (u.author?.full_name) || (isClient ? project.customer_name : 'Team Member');
                            return (
                                <div key={u.id} className="bg-white border border-gray-200 p-4 rounded-xl shadow-sm">
                                    <div className="flex items-start gap-4">
                                        <div className={`w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center text-sm font-bold ${isClient ? 'bg-yellow-500 text-white' : 'bg-gray-100 text-gray-500'}`}>{getInitials(displayName)}</div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center justify-between mb-0.5"><span className="text-sm font-bold text-gray-900">{displayName}</span><span className="text-[10px] font-bold text-gray-300">{new Date(u.created_at || u.update_date).toLocaleTimeString('en-US', {hour:'2-digit', minute:'2-digit'})}</span></div>
                                            <div className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap mb-3">{u.description}</div>
                                            {u.audio_url && <div className="mb-3"><VoiceNotePlayer src={u.audio_url} /></div>}
                                            {u.photos?.length > 0 && (
                                                <div className="grid grid-cols-5 sm:grid-cols-8 md:grid-cols-10 lg:grid-cols-12 gap-2 mt-4">
                                                    {u.photos.map((p:string, i:number)=>(
                                                        <div 
                                                            key={i} 
                                                            className="aspect-square rounded-lg overflow-hidden border border-gray-100 shadow-sm transition-transform hover:scale-105 cursor-zoom-in"
                                                            onClick={() => setLightboxData({ photos: u.photos, index: i })}
                                                        >
                                                            <img src={p} className="w-full h-full object-cover" />
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ))}</div>
            ) : <div className="py-20 text-center bg-white rounded-xl border border-gray-200 shadow-sm"><FiClock className="w-12 h-12 text-gray-200 mx-auto mb-4"/><h3 className="text-lg font-bold">Timeline Beginning</h3></div>}
          </div>
        )}
      </main>

      {selectedDesign && (
        <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm">
          <DesignViewer 
            designId={selectedDesign.id} 
            fileUrl={selectedDesign.file_url} 
            fileName={selectedDesign.file_name} 
            fileType={selectedDesign.file_type} 
            versionNumber={selectedDesign.version_number} 
            approvalStatus={selectedDesign.approval_status}
            comments={(selectedDesign as any).comments || []}
            onCommentAdded={fetchProjectData}
            isPublic={true} 
            publicToken="secure" 
            onClose={() => setSelectedDesign(null)} 
            onApprovalChange={(s) => handleDesignAction(selectedDesign.id, s)} 
          />
        </div>
      )}

      {lightboxData && (
        <div 
          className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-300"
          onClick={() => setLightboxData(null)}
        >
          {/* Close button */}
          <button 
            className="absolute top-6 right-6 p-3 text-white/60 hover:text-white transition-all bg-white/5 hover:bg-white/10 rounded-full z-[110]"
            onClick={(e) => { e.stopPropagation(); setLightboxData(null); }}
          >
            <FiX size={24} />
          </button>

          {/* Prev button */}
          {lightboxData.photos.length > 1 && (
            <button 
              className="absolute left-6 top-1/2 -translate-y-1/2 p-4 text-white/60 hover:text-white transition-all bg-white/5 hover:bg-white/10 rounded-full z-[110]"
              onClick={(e) => { 
                e.stopPropagation(); 
                setLightboxData(prev => prev ? { ...prev, index: (prev.index - 1 + prev.photos.length) % prev.photos.length } : null);
              }}
            >
              <FiChevronLeft size={32} />
            </button>
          )}

          {/* Next button */}
          {lightboxData.photos.length > 1 && (
            <button 
              className="absolute right-6 top-1/2 -translate-y-1/2 p-4 text-white/60 hover:text-white transition-all bg-white/5 hover:bg-white/10 rounded-full z-[110]"
              onClick={(e) => { 
                e.stopPropagation(); 
                setLightboxData(prev => prev ? { ...prev, index: (prev.index + 1) % prev.photos.length } : null);
              }}
            >
              <FiChevronRight size={32} />
            </button>
          )}

          <div className="relative max-w-7xl max-h-[90vh] shadow-2xl rounded-2xl overflow-hidden border border-white/10 animate-in zoom-in-95 duration-300">
            <img 
              src={lightboxData.photos[lightboxData.index]} 
              alt="Site Photo" 
              className="max-w-full max-h-[90vh] object-contain select-none"
              onClick={(e) => e.stopPropagation()}
              draggable={false}
            />
            
            {/* Counter */}
            {lightboxData.photos.length > 1 && (
              <div className="absolute bottom-6 left-1/2 -translate-x-1/2 px-4 py-2 bg-black/50 backdrop-blur-md rounded-full text-white/90 text-[10px] font-bold tracking-[0.2em] border border-white/10 select-none">
                {lightboxData.index + 1} / {lightboxData.photos.length}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
