'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { FiCalendar, FiMapPin, FiCheckCircle, FiClock, FiImage, FiFileText, FiDownload, FiPhone, FiUser } from 'react-icons/fi';
import { ImageModal } from '@/components/ui/ImageModal';

export default function PublicProjectPage() {
    const { token } = useParams();
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Tab State
    const [activeTab, setActiveTab] = useState<'photos' | 'designs' | 'reports'>('photos');

    // Image Modal State
    const [isImageModalOpen, setIsImageModalOpen] = useState(false);
    const [currentImageIndex, setCurrentImageIndex] = useState(0);

    useEffect(() => {
        fetchProjectData();
    }, [token]);

    const fetchProjectData = async () => {
        try {
            setLoading(true);
            const res = await fetch(`/api/public/project/${token}`);
            const result = await res.json();
            if (res.ok) {
                setData(result);
            } else {
                setError(result.error || 'Failed to load project details');
            }
        } catch (err) {
            setError('Connection error. Please try again later.');
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6 text-center">
                <div className="space-y-4">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-yellow-500 mx-auto"></div>
                    <p className="text-gray-500 font-medium">Loading your project summary...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6 text-center">
                <div className="bg-white p-8 rounded-3xl shadow-xl border border-gray-100 max-w-md w-full">
                    <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
                        <FiClock className="w-8 h-8" />
                    </div>
                    <h1 className="text-xl font-bold text-gray-900 mb-2">Access Issue</h1>
                    <p className="text-gray-500 mb-6">{error}</p>
                    <button onClick={() => window.location.reload()} className="btn-primary w-full">Try Again</button>
                </div>
            </div>
        );
    }

    const { project, photos, reports, designs } = data;

    return (
        <div className="min-h-screen bg-gray-50 pb-12">
            {/* Header Area - Full Width with Status */}
            <div className="bg-white border-b border-gray-100 pt-6 pb-5 px-4 sm:px-6 sticky top-0 z-10 shadow-sm">
                <div className="max-w-6xl mx-auto">
                    <div className="flex items-center gap-2 text-yellow-500 font-bold text-[10px] uppercase tracking-widest mb-1">
                        <div className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse"></div>
                        Live Project Update
                    </div>
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <div>
                            <h1 className="text-xl sm:text-2xl font-black text-gray-900">{project.title}</h1>
                            <p className="text-gray-500 text-xs sm:text-sm flex items-center gap-1 mt-0.5">
                                <FiMapPin className="text-gray-400" /> {project.apartment_name || project.address || 'Site Location'}
                            </p>
                        </div>
                        <div className="flex items-center gap-4 bg-gray-50 px-4 py-2 rounded-2xl">
                            <div>
                                <div className="text-[10px] font-bold text-gray-400 uppercase">Stage</div>
                                <div className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
                                    {project.status === 'pending' ? 'Design' :
                                        project.status === 'in_progress' ? 'Execution' :
                                            project.status === 'on_hold' ? 'On Hold' :
                                                project.status === 'completed' ? 'Completed' : project.status.replace('_', ' ')}
                                    {project.status === 'completed' && <FiCheckCircle className="text-green-500 w-4 h-4" />}
                                </div>
                            </div>
                            <div className="h-8 w-px bg-gray-200"></div>
                            <div>
                                <div className="text-[10px] font-bold text-gray-400 uppercase">Est. Completion</div>
                                <div className="text-sm font-medium text-gray-700">
                                    {new Date(project.estimated_completion_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Tabs Bar - Sticky Below Header */}
            <div className="bg-white border-b border-gray-100 sticky top-[80px] sm:top-[88px] z-10">
                <div className="max-w-6xl mx-auto px-4 sm:px-6">
                    <div className="flex gap-8">
                        {[
                            { id: 'photos', label: 'Site Photos', icon: FiImage },
                            { id: 'designs', label: 'Approved Designs', icon: FiCheckCircle },
                            { id: 'reports', label: 'Progress Reports', icon: FiFileText },
                        ].map((tab) => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id as any)}
                                className={`flex items-center gap-2 py-4 border-b-2 font-bold text-xs sm:text-sm transition-all relative ${
                                    activeTab === tab.id
                                        ? 'border-yellow-500 text-yellow-600'
                                        : 'border-transparent text-gray-400 hover:text-gray-600'
                                }`}
                            >
                                <tab.icon className="w-4 h-4" />
                                {tab.label}
                                {activeTab === tab.id && (
                                    <div className="absolute -bottom-[2px] left-0 right-0 h-[2px] bg-yellow-500 rounded-full shadow-[0_0_8px_rgba(234,179,8,0.5)]"></div>
                                )}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            <div className="max-w-6xl mx-auto px-4 sm:px-6 mt-6 space-y-6">

                {/* Contact Info - Compact Project Team */}
                {(project.assigned_employee || data.siteEngineer) && (
                    <div className="bg-white px-4 py-3 rounded-2xl shadow-sm border border-gray-100">
                        <div className="text-[10px] font-bold text-gray-400 uppercase mb-2">Project Team</div>
                        <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-6">
                            {/* Designer */}
                            {project.assigned_employee && (
                                <div className="flex items-center gap-2">
                                    <div className="w-8 h-8 rounded-full bg-yellow-100 text-yellow-600 flex items-center justify-center font-bold text-sm flex-shrink-0">
                                        {project.assigned_employee.full_name?.charAt(0) || 'D'}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <div className="text-sm font-semibold text-gray-900 leading-tight truncate">{project.assigned_employee.full_name}</div>
                                        <div className="text-[10px] text-gray-500">{project.assigned_employee.designation || 'Designer'}</div>
                                    </div>
                                    {project.assigned_employee.phone_number && (
                                        <a href={`tel:${project.assigned_employee.phone_number}`} className="p-1.5 bg-green-50 text-green-600 rounded-lg hover:bg-green-100 transition-colors flex-shrink-0">
                                            <FiPhone className="w-3.5 h-3.5" />
                                        </a>
                                    )}
                                </div>
                            )}

                            {/* Divider */}
                            {project.assigned_employee && data.siteEngineer && (
                                <div className="hidden sm:block h-6 w-px bg-gray-200"></div>
                            )}

                            {/* Site Engineer */}
                            {data.siteEngineer && (
                                <div className="flex items-center gap-2">
                                    <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-sm flex-shrink-0">
                                        {data.siteEngineer.full_name?.charAt(0) || 'S'}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <div className="text-sm font-semibold text-gray-900 leading-tight truncate">{data.siteEngineer.full_name}</div>
                                        <div className="text-[10px] text-gray-500">{data.siteEngineer.designation || 'Site Engineer'}</div>
                                    </div>
                                    {data.siteEngineer.phone_number && (
                                        <a href={`tel:${data.siteEngineer.phone_number}`} className="p-1.5 bg-green-50 text-green-600 rounded-lg hover:bg-green-100 transition-colors flex-shrink-0">
                                            <FiPhone className="w-3.5 h-3.5" />
                                        </a>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Latest Photos */}
                {activeTab === 'photos' && (
                    <section className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                                <FiImage className="text-yellow-500" /> Recent Site Photos
                            </h2>
                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{photos.length} Photos</span>
                        </div>
                        {photos.length > 0 ? (
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                                {photos.map((url: string, idx: number) => (
                                    <button
                                        key={idx}
                                        onClick={() => {
                                            setCurrentImageIndex(idx);
                                            setIsImageModalOpen(true);
                                        }}
                                        className="aspect-square bg-gray-200 rounded-2xl overflow-hidden shadow-sm hover:opacity-90 transition-all hover:scale-[1.02] border border-gray-100 group relative"
                                    >
                                        <img src={url} alt="Site update" className="w-full h-full object-cover" />
                                        <div className="absolute inset-0 bg-black/5 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                                    </button>
                                ))}
                            </div>
                        ) : (
                            <div className="bg-white p-12 rounded-3xl border border-dashed border-gray-200 text-center text-gray-400">
                                <FiImage className="w-12 h-12 mx-auto mb-3 opacity-20" />
                                <p className="font-medium text-sm">No photos uploaded yet.</p>
                            </div>
                        )}
                    </section>
                )}

                {/* Approved Designs */}
                {activeTab === 'designs' && (
                    <section className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                                <FiCheckCircle className="text-green-500" /> Final Approved Designs
                            </h2>
                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{designs?.length || 0} Designs</span>
                        </div>
                        {designs && designs.length > 0 ? (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                {designs.map((design: any) => (
                                    <div key={design.id} className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex flex-col gap-4 hover:shadow-md transition-shadow">
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="flex items-center gap-3">
                                                <div className="w-12 h-12 bg-green-50 text-green-600 rounded-xl flex items-center justify-center flex-shrink-0">
                                                    <FiImage className="w-6 h-6" />
                                                </div>
                                                <div className="min-w-0">
                                                    <div className="text-sm font-bold text-gray-900 leading-tight truncate">{design.file_name}</div>
                                                    <div className="flex items-center gap-2 mt-1">
                                                        <span className="text-[10px] font-bold text-yellow-600 bg-yellow-50 px-2 py-0.5 rounded-full uppercase tracking-wider">{design.category}</span>
                                                        <span className="text-[10px] text-gray-400 font-bold">VERSION {design.version_number}</span>
                                                    </div>
                                                </div>
                                            </div>
                                            <a
                                                href={design.file_url}
                                                target="_blank"
                                                className="px-3 py-1.5 bg-green-50 text-green-600 hover:bg-green-100 rounded-xl transition-colors flex items-center gap-1.5 text-xs font-bold"
                                            >
                                                <FiDownload className="w-4 h-4" />
                                                <span>View</span>
                                            </a>
                                        </div>
                                        
                                        {/* Design Preview if it's an image */}
                                        {design.file_type?.startsWith('image/') && (
                                            <div className="relative aspect-video bg-gray-50 rounded-2xl border border-gray-100 overflow-hidden group cursor-pointer" onClick={() => window.open(design.file_url, '_blank')}>
                                                <img 
                                                    src={design.file_url} 
                                                    alt={design.file_name} 
                                                    className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-700"
                                                />
                                                <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                                    <div className="bg-white/90 backdrop-blur-sm px-4 py-2 rounded-full text-xs font-bold shadow-xl transform translate-y-2 group-hover:translate-y-0 transition-transform">Click to View Full Size</div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="bg-white p-12 rounded-3xl border border-dashed border-gray-200 text-center text-gray-400">
                                <FiCheckCircle className="w-12 h-12 mx-auto mb-3 opacity-20" />
                                <p className="font-medium text-sm">No designs approved yet.</p>
                            </div>
                        )}
                    </section>
                )}

                {/* Progress Reports */}
                {activeTab === 'reports' && (
                    <section className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                                <FiFileText className="text-yellow-500" /> Progress Reports
                            </h2>
                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{reports.length} Reports</span>
                        </div>
                        <div className="grid grid-cols-1 gap-3">
                            {reports.length > 0 ? (
                                reports.map((report: any) => (
                                    <div key={report.id} className="bg-white p-4 rounded-2xl shadow-sm border border-gray-50 flex items-center justify-between group hover:border-yellow-200 transition-colors">
                                        <div className="flex items-center gap-4">
                                            <div className="w-12 h-12 bg-yellow-50 text-yellow-500 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                                                <FiCalendar className="w-6 h-6" />
                                            </div>
                                            <div>
                                                <div className="text-sm font-bold text-gray-900">
                                                    {new Date(report.report_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
                                                </div>
                                                <div className="text-[10px] text-gray-400 font-medium line-clamp-1 max-w-[200px] sm:max-w-none mt-0.5">
                                                    {report.summary || 'Weekly summary report and site update status.'}
                                                </div>
                                            </div>
                                        </div>
                                        <a
                                            href={report.pdf_url}
                                            target="_blank"
                                            className="px-4 py-2 bg-yellow-50 text-yellow-600 hover:bg-yellow-100 rounded-xl transition-colors flex items-center gap-2 text-xs font-bold"
                                        >
                                            <FiDownload className="w-4 h-4" />
                                            <span>PDF</span>
                                        </a>
                                    </div>
                                ))
                            ) : (
                                <div className="bg-white p-12 rounded-3xl border border-dashed border-gray-200 text-center text-gray-400">
                                    <FiFileText className="w-12 h-12 mx-auto mb-3 opacity-20" />
                                    <p className="font-medium text-sm">No reports shared yet.</p>
                                </div>
                            )}
                        </div>
                    </section>
                )}

                <footer className="text-center pt-8 opacity-30">
                    <div className="text-[10px] font-black tracking-widest text-gray-500 uppercase">Powered by Apple Interiors</div>
                </footer>
            </div>

            <ImageModal
                images={photos}
                currentIndex={currentImageIndex}
                isOpen={isImageModalOpen}
                onClose={() => setIsImageModalOpen(false)}
            />
        </div>
    );
}
