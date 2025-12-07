'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch';
import { FiZoomIn, FiZoomOut, FiMaximize2, FiMessageCircle, FiX, FiCheck, FiDownload, FiPrinter, FiXCircle, FiCheckCircle } from 'react-icons/fi';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { useToast } from '@/components/ui/Toast';
import { useAuth } from '@/contexts/AuthContext';
import dynamic from 'next/dynamic';

// Dynamically import PdfViewer (only on client side)
const PdfViewer = dynamic(() => import('./PdfViewer').then(mod => mod.PdfViewer), {
    ssr: false,
    loading: () => (
        <div className="flex items-center justify-center h-full bg-gray-100">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-yellow-500"></div>
        </div>
    ),
});

type DesignComment = {
    id: string;
    comment: string;
    x_percent: number | null;
    y_percent: number | null;
    zoom_level: number | null;
    page_number: number;
    is_resolved: boolean;
    created_at: string;
    linked_task_id: string | null;
    user: {
        id: string;
        full_name: string;
        email: string;
    };
};

type DesignViewerProps = {
    designId: string;
    fileUrl: string;
    fileName: string;
    fileType: string;
    versionNumber?: number;
    comments?: DesignComment[];
    onCommentAdded?: () => void;
    onClose?: () => void;
    readOnly?: boolean;
    approvalStatus?: 'pending' | 'approved' | 'rejected' | 'needs_changes';
    onApprovalChange?: (status: 'approved' | 'rejected') => void;
};

export function DesignViewer({
    designId,
    fileUrl,
    fileName,
    fileType,
    versionNumber = 1,
    comments = [],
    onCommentAdded,
    onClose,
    readOnly = false,
    approvalStatus,
    onApprovalChange,
}: DesignViewerProps) {
    const { user } = useAuth();
    const { showToast } = useToast();
    const isAdmin = user?.role === 'admin';
    const containerRef = useRef<HTMLDivElement>(null);
    const [isMobile, setIsMobile] = useState(false);

    // Pin-drop state
    const [isAddingPin, setIsAddingPin] = useState(false);
    const [pendingPin, setPendingPin] = useState<{ x: number; y: number; page: number } | null>(null);
    const [commentText, setCommentText] = useState('');
    const [createTask, setCreateTask] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    // Current PDF page for multi-page documents
    const [currentPage, setCurrentPage] = useState(1);

    // Task assignment state
    const [taskAssignee, setTaskAssignee] = useState<string>('');
    const [taskDueDate, setTaskDueDate] = useState<string>('');
    const [users, setUsers] = useState<{ id: string; full_name: string }[]>([]);

    // Active comment
    const [activeCommentId, setActiveCommentId] = useState<string | null>(null);

    // Comments panel visibility (for mobile)
    const [showCommentsPanel, setShowCommentsPanel] = useState(!isMobile);

    // Fetch users for assignee dropdown
    useEffect(() => {
        const fetchUsers = async () => {
            try {
                const { supabase } = await import('@/lib/supabase');
                const { data } = await supabase
                    .from('users')
                    .select('id, full_name')
                    .order('full_name');
                if (data) {
                    setUsers(data);
                }
            } catch (error) {
                console.error('Failed to fetch users:', error);
            }
        };
        fetchUsers();
    }, []);

    useEffect(() => {
        const checkMobile = () => {
            const mobile = window.innerWidth < 768;
            setIsMobile(mobile);
            setShowCommentsPanel(!mobile);
        };
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    // Handle click on image/PDF to place pin
    const handleImageClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
        if (!isAddingPin || readOnly) return;

        const rect = e.currentTarget.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * 100;
        const y = ((e.clientY - rect.top) / rect.height) * 100;

        setPendingPin({ x, y, page: currentPage });
        setIsAddingPin(false);
    }, [isAddingPin, readOnly, currentPage]);

    // Submit comment with coordinates
    const handleSubmitComment = async () => {
        if (!commentText.trim()) return;

        setSubmitting(true);
        try {
            const response = await fetch('/api/design-comments', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    design_file_id: designId,
                    comment: commentText,
                    // Only send coordinates if pin was placed (undefined instead of null)
                    ...(pendingPin && {
                        x_percent: pendingPin.x,
                        y_percent: pendingPin.y,
                        // EXPLICT FALLBACK: Use pendingPin.page, or fallback to currentPage, or default to 1
                        page_number: pendingPin.page || currentPage || 1,
                    }),
                    create_task: createTask,
                    // Only send assignee if valid (not empty string)
                    ...(createTask && taskAssignee && { task_assignee_id: taskAssignee }),
                    // Only send due date if valid
                    ...(createTask && taskDueDate && { task_due_date: taskDueDate }),
                }),
            });

            if (!response.ok) {
                throw new Error('Failed to add comment');
            }

            showToast('success', 'Comment added');
            setCommentText('');
            setCreateTask(false);
            setTaskAssignee('');
            setTaskDueDate('');
            setPendingPin(null);
            onCommentAdded?.();
        } catch (error) {
            showToast('error', 'Failed to add comment');
        } finally {
            setSubmitting(false);
        }
    };

    // Render pin markers
    const renderPins = () => {
        return comments
            .filter(c => c.x_percent !== null && c.y_percent !== null)
            .map((comment) => (
                <div
                    key={comment.id}
                    className={`absolute w-6 h-6 -translate-x-1/2 -translate-y-1/2 cursor-pointer transition-transform hover:scale-125 ${comment.is_resolved ? 'opacity-50' : ''
                        }`}
                    style={{
                        left: `${comment.x_percent}%`,
                        top: `${comment.y_percent}%`,
                    }}
                    onClick={(e) => {
                        e.stopPropagation();
                        setActiveCommentId(activeCommentId === comment.id ? null : comment.id);
                    }}
                >
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-lg ${comment.is_resolved ? 'bg-gray-500' : 'bg-yellow-500'
                        }`}>
                        {comment.is_resolved ? <FiCheck className="w-3 h-3" /> : <FiMessageCircle className="w-3 h-3" />}
                    </div>

                    {/* Comment popup */}
                    {activeCommentId === comment.id && (
                        <div className="absolute left-8 top-0 z-50 w-64 bg-white rounded-lg shadow-xl border border-gray-200 p-3">
                            <div className="flex items-start justify-between mb-2">
                                <span className="text-xs font-medium text-gray-900">{comment.user.full_name}</span>
                                <button
                                    onClick={(e) => { e.stopPropagation(); setActiveCommentId(null); }}
                                    className="text-gray-400 hover:text-gray-600"
                                >
                                    <FiX className="w-4 h-4" />
                                </button>
                            </div>
                            <p className="text-sm text-gray-700">{comment.comment}</p>
                            {comment.linked_task_id && (
                                <div className="mt-2 text-xs text-yellow-600">
                                    📋 Task linked
                                </div>
                            )}
                        </div>
                    )}
                </div>
            ));
    };

    // Pending pin marker
    const renderPendingPin = () => {
        if (!pendingPin) return null;
        return (
            <div
                className="absolute w-8 h-8 -translate-x-1/2 -translate-y-1/2 animate-pulse pointer-events-none"
                style={{
                    left: `${pendingPin.x}%`,
                    top: `${pendingPin.y}%`,
                }}
            >
                <div className="w-8 h-8 rounded-full bg-yellow-500 border-2 border-white shadow-lg flex items-center justify-center">
                    <FiMessageCircle className="w-4 h-4 text-gray-900" />
                </div>
            </div>
        );
    };

    const isImage = fileType === 'image' || /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(fileName);

    return (
        <div className="flex flex-col h-full bg-gray-900">
            {/* Top Toolbar */}
            <div className="flex items-center justify-between px-2 md:px-4 py-2 bg-gray-800 border-b border-gray-700">
                <div className="flex items-center gap-2 md:gap-3 min-w-0">
                    <span className="px-2 py-0.5 bg-yellow-500 text-gray-900 text-xs font-bold rounded flex-shrink-0">
                        V{versionNumber}
                    </span>
                    <span className="text-white font-medium truncate max-w-[120px] md:max-w-[300px]">{fileName}</span>
                </div>

                <div className="flex items-center gap-1 md:gap-2">
                    {/* Approve/Reject buttons - Admin only, pending status */}
                    {isAdmin && approvalStatus === 'pending' && onApprovalChange && (
                        <>
                            <button
                                onClick={() => onApprovalChange('approved')}
                                className="flex items-center gap-1 md:gap-1.5 px-2 md:px-3 py-1.5 bg-yellow-500 hover:bg-yellow-600 text-gray-900 font-medium rounded-lg transition-colors"
                                title="Approve"
                            >
                                <FiCheckCircle className="w-4 h-4" />
                                <span className="hidden md:inline">Approve</span>
                            </button>
                            <button
                                onClick={() => onApprovalChange('rejected')}
                                className="flex items-center gap-1 md:gap-1.5 px-2 md:px-3 py-1.5 bg-gray-600 hover:bg-gray-500 text-white font-medium rounded-lg transition-colors"
                                title="Reject"
                            >
                                <FiXCircle className="w-4 h-4" />
                                <span className="hidden md:inline">Reject</span>
                            </button>
                            <div className="hidden md:block w-px h-6 bg-gray-600 mx-1" />
                        </>
                    )}

                    {/* Zoom controls for images */}
                    {isImage && (
                        <div className="flex items-center gap-1 bg-gray-700 rounded-lg px-2 py-1">
                            <span className="text-white text-sm">90%</span>
                        </div>
                    )}

                    {/* Download */}
                    <a
                        href={fileUrl}
                        download
                        className="p-2 text-gray-300 hover:text-white hover:bg-gray-700 rounded"
                    >
                        <FiDownload className="w-5 h-5" />
                    </a>

                    {/* Print */}
                    <button
                        onClick={() => window.print()}
                        className="p-2 text-gray-300 hover:text-white hover:bg-gray-700 rounded"
                    >
                        <FiPrinter className="w-5 h-5" />
                    </button>

                    {/* Toggle Comments Panel */}
                    <button
                        onClick={() => setShowCommentsPanel(!showCommentsPanel)}
                        className={`p-2 rounded ${showCommentsPanel ? 'bg-yellow-500 text-gray-900' : 'text-gray-300 hover:text-white hover:bg-gray-700'}`}
                    >
                        <FiMessageCircle className="w-5 h-5" />
                    </button>

                    {/* Close */}
                    {onClose && (
                        <button
                            onClick={onClose}
                            className="p-2 text-gray-300 hover:text-white hover:bg-gray-700 rounded"
                        >
                            <FiX className="w-5 h-5" />
                        </button>
                    )}
                </div>
            </div>

            {/* Main Content Area */}
            <div className="flex flex-1 overflow-hidden">
                {/* PDF/Image Viewer */}
                <div className="flex-1 relative bg-gray-100 overflow-auto">
                    {/* Pin mode indicator */}
                    {isAddingPin && (
                        <div className="absolute top-4 left-4 z-30 bg-yellow-500 text-gray-900 px-3 py-1 rounded-full text-sm font-medium">
                            Click to place pin
                        </div>
                    )}

                    {isImage ? (
                        // Image viewer with pan/zoom
                        <TransformWrapper
                            initialScale={1}
                            minScale={0.5}
                            maxScale={4}
                            centerOnInit
                        >
                            {({ zoomIn, zoomOut, resetTransform }) => (
                                <>
                                    <div className="absolute bottom-4 left-4 z-20 flex gap-1">
                                        <button onClick={() => zoomIn()} className="p-2 bg-white rounded-lg shadow-md hover:bg-gray-100">
                                            <FiZoomIn className="w-4 h-4" />
                                        </button>
                                        <button onClick={() => zoomOut()} className="p-2 bg-white rounded-lg shadow-md hover:bg-gray-100">
                                            <FiZoomOut className="w-4 h-4" />
                                        </button>
                                        <button onClick={() => resetTransform()} className="p-2 bg-white rounded-lg shadow-md hover:bg-gray-100">
                                            <FiMaximize2 className="w-4 h-4" />
                                        </button>
                                    </div>

                                    <TransformComponent wrapperStyle={{ width: '100%', height: '100%' }} contentStyle={{ width: '100%', height: '100%' }}>
                                        <div
                                            ref={containerRef}
                                            className="relative w-full h-full flex items-center justify-center p-8"
                                            onClick={handleImageClick}
                                            style={{ cursor: isAddingPin ? 'crosshair' : 'grab' }}
                                        >
                                            <img src={fileUrl} alt={fileName} className="max-w-full max-h-full object-contain shadow-lg" draggable={false} />
                                            {renderPins()}
                                            {renderPendingPin()}
                                        </div>
                                    </TransformComponent>
                                </>
                            )}
                        </TransformWrapper>
                    ) : (
                        // PDF viewer with custom react-pdf renderer
                        <PdfViewer
                            fileUrl={fileUrl}
                            comments={comments.map(c => ({
                                id: c.id,
                                x_percent: c.x_percent,
                                y_percent: c.y_percent,
                                page_number: c.page_number || 1,
                                is_resolved: c.is_resolved,
                                user: c.user,
                            }))}
                            isAddingPin={isAddingPin}
                            pendingPin={pendingPin}
                            onPinClick={(pin) => {
                                // FORCE page: Ensure we capture the page from the pin, or fallback to currentPage
                                setPendingPin({ ...pin, page: pin.page || currentPage });
                                setIsAddingPin(false);
                            }}
                            onCommentClick={(id) => setActiveCommentId(id)}
                            activeCommentId={activeCommentId}
                            currentPage={currentPage}
                            onPageChange={setCurrentPage}
                        />
                    )}
                </div>

                {/* Right Comments Panel */}
                {showCommentsPanel && (
                    <div className={`${isMobile ? 'fixed inset-0 z-40 w-full' : 'w-80 border-l'} bg-white border-gray-200 flex flex-col`}>
                        {/* Panel Header */}
                        <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
                            <span className="font-semibold text-gray-900">Comments</span>
                            <button onClick={() => setShowCommentsPanel(false)} className="text-gray-400 hover:text-gray-600">
                                <FiX className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Add New Comment */}
                        {!readOnly && (
                            <div className="p-4 border-b border-gray-200">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-sm font-medium text-gray-700">Add New Comment</span>
                                    {pendingPin && (
                                        <button onClick={() => setPendingPin(null)} className="text-gray-400 hover:text-gray-600">
                                            <FiX className="w-4 h-4" />
                                        </button>
                                    )}
                                </div>

                                {/* Pin button */}
                                <div className="flex gap-2 mb-3">
                                    <button
                                        onClick={() => setIsAddingPin(!isAddingPin)}
                                        className={`p-2 rounded border ${isAddingPin
                                            ? 'bg-yellow-500 text-gray-900 border-yellow-500'
                                            : 'border-gray-300 text-gray-600 hover:bg-gray-50'
                                            }`}
                                        title="Add pin comment"
                                    >
                                        📍
                                    </button>
                                    {pendingPin && (
                                        <span className="text-xs text-yellow-600 flex items-center">
                                            ✓ Pin placed at ({Math.round(pendingPin.x)}%, {Math.round(pendingPin.y)}%)
                                        </span>
                                    )}
                                </div>

                                <textarea
                                    value={commentText}
                                    onChange={(e) => setCommentText(e.target.value)}
                                    placeholder="Enter your comment..."
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent text-sm min-h-[80px] resize-none"
                                />

                                <label className="flex items-center gap-2 mt-3">
                                    <input
                                        type="checkbox"
                                        checked={createTask}
                                        onChange={(e) => setCreateTask(e.target.checked)}
                                        className="rounded border-gray-300 text-yellow-500 focus:ring-yellow-500"
                                    />
                                    <span className="text-sm text-gray-600">Assign as task</span>
                                </label>

                                {/* Task assignment fields - only show when createTask is checked */}
                                {createTask && (
                                    <div className="mt-3 space-y-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
                                        {/* Assignee dropdown */}
                                        <div>
                                            <label className="block text-xs font-medium text-gray-700 mb-1">
                                                Assignee
                                            </label>
                                            <select
                                                value={taskAssignee}
                                                onChange={(e) => setTaskAssignee(e.target.value)}
                                                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-yellow-500 focus:border-transparent bg-white"
                                            >
                                                <option value="">Select User</option>
                                                {users.map((u) => (
                                                    <option key={u.id} value={u.id}>
                                                        {u.full_name}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>

                                        {/* Due date picker */}
                                        <div>
                                            <label className="block text-xs font-medium text-gray-700 mb-1">
                                                Due Date
                                            </label>
                                            <input
                                                type="date"
                                                value={taskDueDate}
                                                onChange={(e) => setTaskDueDate(e.target.value)}
                                                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
                                            />
                                        </div>
                                    </div>
                                )}

                                <button
                                    onClick={handleSubmitComment}
                                    disabled={submitting || !commentText.trim()}
                                    className="mt-3 w-full py-2 bg-yellow-500 text-gray-900 font-medium rounded-lg hover:bg-yellow-600 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {submitting ? 'Submitting...' : 'Submit'}
                                </button>
                            </div>
                        )}

                        {/* Comments List */}
                        <div className="flex-1 overflow-y-auto p-4">
                            {comments.length === 0 ? (
                                <div className="text-center py-8">
                                    <FiMessageCircle className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                                    <p className="text-gray-500 text-sm">No Comments to show</p>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {comments.map((comment) => (
                                        <div
                                            key={comment.id}
                                            className={`p-3 rounded-lg border ${activeCommentId === comment.id
                                                ? 'border-yellow-500 bg-yellow-50'
                                                : 'border-gray-200 bg-gray-50'
                                                }`}
                                            onClick={() => setActiveCommentId(comment.id)}
                                        >
                                            <div className="flex items-center justify-between mb-1">
                                                <span className="text-sm font-medium text-gray-900">{comment.user.full_name}</span>
                                                {comment.x_percent !== null && (
                                                    <span className="text-xs text-gray-400">📍 Pinned</span>
                                                )}
                                            </div>
                                            <p className="text-sm text-gray-700">{comment.comment}</p>
                                            {comment.linked_task_id && (
                                                <div className="mt-2 text-xs text-yellow-600">📋 Task linked</div>
                                            )}
                                            {comment.is_resolved && (
                                                <div className="mt-2 text-xs text-gray-500">✓ Resolved</div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* Mobile Bottom Sheet for adding comments */}
            {isMobile && (
                <BottomSheet
                    isOpen={pendingPin !== null}
                    onClose={() => setPendingPin(null)}
                    title="Add Comment"
                >
                    <div className="space-y-4">
                        <textarea
                            value={commentText}
                            onChange={(e) => setCommentText(e.target.value)}
                            placeholder="Enter your comment..."
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 min-h-[100px]"
                        />
                        <label className="flex items-center gap-2">
                            <input
                                type="checkbox"
                                checked={createTask}
                                onChange={(e) => setCreateTask(e.target.checked)}
                                className="rounded border-gray-300"
                            />
                            <span className="text-sm text-gray-700">Create task from comment</span>
                        </label>
                        <button
                            onClick={handleSubmitComment}
                            disabled={submitting || !commentText.trim()}
                            className="w-full py-2 bg-yellow-500 text-gray-900 font-medium rounded-lg hover:bg-yellow-600 disabled:opacity-50"
                        >
                            {submitting ? 'Adding...' : 'Add Comment'}
                        </button>
                    </div>
                </BottomSheet>
            )}
        </div>
    );
}

export default DesignViewer;
