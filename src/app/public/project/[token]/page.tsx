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
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-500 mx-auto"></div>
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

    const { project, photos, reports } = data;

    return (
        <div className="min-h-screen bg-gray-50 pb-12">
            {/* Header Area - Full Width with Status */}
            <div className="bg-white border-b border-gray-100 pt-6 pb-5 px-4 sm:px-6 sticky top-0 z-10 shadow-sm">
                <div className="max-w-6xl mx-auto">
                    <div className="flex items-center gap-2 text-amber-500 font-bold text-[10px] uppercase tracking-widest mb-1">
                        <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></div>
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

            <div className="max-w-6xl mx-auto px-4 sm:px-6 mt-6 space-y-6">

                {/* Contact Info - Compact Project Team */}
                {(project.assigned_employee || data.siteEngineer) && (
                    <div className="bg-white px-4 py-3 rounded-2xl shadow-sm border border-gray-100">
                        <div className="text-[10px] font-bold text-gray-400 uppercase mb-2">Project Team</div>
                        <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-6">
                            {/* Designer */}
                            {project.assigned_employee && (
                                <div className="flex items-center gap-2">
                                    <div className="w-8 h-8 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center font-bold text-sm flex-shrink-0">
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
                <section>
                    <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                        <FiImage className="text-amber-500" /> Recent Site Photos
                    </h2>
                    {photos.length > 0 ? (
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                            {photos.slice(0, 9).map((url: string, idx: number) => (
                                <button
                                    key={idx}
                                    onClick={() => {
                                        setCurrentImageIndex(idx);
                                        setIsImageModalOpen(true);
                                    }}
                                    className="aspect-square bg-gray-200 rounded-2xl overflow-hidden shadow-sm hover:opacity-90 transition-opacity border border-gray-100"
                                >
                                    <img src={url} alt="Site update" className="w-full h-full object-cover" />
                                </button>
                            ))}
                        </div>
                    ) : (
                        <div className="bg-white p-8 rounded-3xl border border-dashed border-gray-200 text-center text-gray-400">
                            No photos uploaded yet.
                        </div>
                    )}
                </section>

                {/* Progress Reports */}
                <section>
                    <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                        <FiFileText className="text-amber-500" /> Progress Reports
                    </h2>
                    <div className="space-y-3">
                        {reports.length > 0 ? (
                            reports.map((report: any) => (
                                <div key={report.id} className="bg-white p-4 rounded-2xl shadow-sm border border-gray-50 flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 bg-amber-50 text-amber-500 rounded-xl flex items-center justify-center">
                                            <FiCalendar className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <div className="text-sm font-bold text-gray-900">
                                                {new Date(report.report_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
                                            </div>
                                            <div className="text-[10px] text-gray-400 font-medium line-clamp-1 max-w-[150px] sm:max-w-none">
                                                {report.summary || 'Summary report...'}
                                            </div>
                                        </div>
                                    </div>
                                    <a
                                        href={report.pdf_url}
                                        target="_blank"
                                        className="p-2 text-amber-600 hover:bg-amber-50 rounded-lg transition-colors flex items-center gap-1 text-xs font-bold"
                                    >
                                        <FiDownload className="w-4 h-4" />
                                        <span className="hidden sm:inline">PDF</span>
                                    </a>
                                </div>
                            ))
                        ) : (
                            <div className="bg-white p-8 rounded-3xl border border-dashed border-gray-200 text-center text-gray-400">
                                No reports shared yet.
                            </div>
                        )}
                    </div>
                </section>

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
