'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch';
import { FiZoomIn, FiZoomOut, FiMaximize2, FiMessageCircle, FiX, FiCheck } from 'react-icons/fi';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { useToast } from '@/components/ui/Toast';
import { useAuth } from '@/contexts/AuthContext';

type DesignComment = {
    id: string;
    comment: string;
    x_percent: number | null;
    y_percent: number | null;
    zoom_level: number | null;
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
    comments?: DesignComment[];
    onCommentAdded?: () => void;
    readOnly?: boolean;
};

export function DesignViewer({
    designId,
    fileUrl,
    fileName,
    fileType,
    comments = [],
    onCommentAdded,
    readOnly = false,
}: DesignViewerProps) {
    const { user } = useAuth();
    const { showToast } = useToast();
    const containerRef = useRef<HTMLDivElement>(null);
    const [isMobile, setIsMobile] = useState(false);

    // Pin-drop state
    const [isAddingPin, setIsAddingPin] = useState(false);
    const [pendingPin, setPendingPin] = useState<{ x: number; y: number } | null>(null);
    const [showCommentSheet, setShowCommentSheet] = useState(false);
    const [commentText, setCommentText] = useState('');
    const [createTask, setCreateTask] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    // Active comment
    const [activeCommentId, setActiveCommentId] = useState<string | null>(null);

    useEffect(() => {
        const checkMobile = () => setIsMobile(window.innerWidth < 768);
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    // Handle click on image to place pin
    const handleImageClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
        if (!isAddingPin || readOnly) return;

        const rect = e.currentTarget.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * 100;
        const y = ((e.clientY - rect.top) / rect.height) * 100;

        setPendingPin({ x, y });
        setShowCommentSheet(true);
        setIsAddingPin(false);
    }, [isAddingPin, readOnly]);

    // Submit comment with coordinates
    const handleSubmitComment = async () => {
        if (!commentText.trim() || !pendingPin) return;

        setSubmitting(true);
        try {
            const response = await fetch('/api/design-comments', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    design_file_id: designId,
                    comment: commentText,
                    x_percent: pendingPin.x,
                    y_percent: pendingPin.y,
                    create_task: createTask,
                }),
            });

            if (!response.ok) {
                throw new Error('Failed to add comment');
            }

            showToast('success', 'Comment added');
            setCommentText('');
            setCreateTask(false);
            setPendingPin(null);
            setShowCommentSheet(false);
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
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-lg ${comment.is_resolved ? 'bg-green-500' : 'bg-yellow-500'
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
                                <div className="mt-2 text-xs text-blue-600">
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
                className="absolute w-8 h-8 -translate-x-1/2 -translate-y-1/2 animate-pulse"
                style={{
                    left: `${pendingPin.x}%`,
                    top: `${pendingPin.y}%`,
                }}
            >
                <div className="w-8 h-8 rounded-full bg-yellow-500 border-2 border-white shadow-lg flex items-center justify-center">
                    <FiMessageCircle className="w-4 h-4 text-white" />
                </div>
            </div>
        );
    };

    const isImage = fileType === 'image' || /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(fileName);

    return (
        <div className="relative w-full h-full bg-gray-100 rounded-lg overflow-hidden">
            {/* Toolbar */}
            <div className="absolute top-2 right-2 z-20 flex gap-2">
                {!readOnly && (
                    <button
                        onClick={() => setIsAddingPin(!isAddingPin)}
                        className={`p-2 rounded-lg shadow-md transition-colors ${isAddingPin ? 'bg-yellow-500 text-white' : 'bg-white text-gray-700 hover:bg-gray-100'
                            }`}
                        title="Add pin comment"
                    >
                        <FiMessageCircle className="w-5 h-5" />
                    </button>
                )}
            </div>

            {/* Pin mode indicator */}
            {isAddingPin && (
                <div className="absolute top-2 left-2 z-20 bg-yellow-500 text-white px-3 py-1 rounded-full text-sm font-medium">
                    Click to place pin
                </div>
            )}

            {/* Image viewer with pan/zoom */}
            {isImage ? (
                <TransformWrapper
                    initialScale={1}
                    minScale={0.5}
                    maxScale={4}
                    centerOnInit
                >
                    {({ zoomIn, zoomOut, resetTransform }) => (
                        <>
                            {/* Zoom controls */}
                            <div className="absolute bottom-2 right-2 z-20 flex gap-1">
                                <button
                                    onClick={() => zoomIn()}
                                    className="p-2 bg-white rounded-lg shadow-md hover:bg-gray-100"
                                >
                                    <FiZoomIn className="w-4 h-4" />
                                </button>
                                <button
                                    onClick={() => zoomOut()}
                                    className="p-2 bg-white rounded-lg shadow-md hover:bg-gray-100"
                                >
                                    <FiZoomOut className="w-4 h-4" />
                                </button>
                                <button
                                    onClick={() => resetTransform()}
                                    className="p-2 bg-white rounded-lg shadow-md hover:bg-gray-100"
                                >
                                    <FiMaximize2 className="w-4 h-4" />
                                </button>
                            </div>

                            <TransformComponent
                                wrapperStyle={{ width: '100%', height: '100%' }}
                                contentStyle={{ width: '100%', height: '100%' }}
                            >
                                <div
                                    ref={containerRef}
                                    className="relative w-full h-full flex items-center justify-center"
                                    onClick={handleImageClick}
                                    style={{ cursor: isAddingPin ? 'crosshair' : 'grab' }}
                                >
                                    <img
                                        src={fileUrl}
                                        alt={fileName}
                                        className="max-w-full max-h-full object-contain"
                                        draggable={false}
                                    />
                                    {renderPins()}
                                    {renderPendingPin()}
                                </div>
                            </TransformComponent>
                        </>
                    )}
                </TransformWrapper>
            ) : (
                // PDF or other file type - show iframe or link
                <div className="w-full h-full flex items-center justify-center">
                    <a
                        href={fileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-4 py-2 bg-yellow-500 text-gray-900 rounded-lg hover:bg-yellow-600"
                    >
                        Open {fileName}
                    </a>
                </div>
            )}

            {/* Mobile Comment Sheet */}
            <BottomSheet
                isOpen={showCommentSheet && isMobile}
                onClose={() => {
                    setShowCommentSheet(false);
                    setPendingPin(null);
                }}
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

            {/* Desktop Comment Panel */}
            {showCommentSheet && !isMobile && (
                <div className="absolute bottom-4 left-4 z-30 w-80 bg-white rounded-lg shadow-xl border border-gray-200 p-4">
                    <div className="flex items-center justify-between mb-3">
                        <h4 className="font-medium text-gray-900">Add Comment</h4>
                        <button
                            onClick={() => {
                                setShowCommentSheet(false);
                                setPendingPin(null);
                            }}
                            className="text-gray-400 hover:text-gray-600"
                        >
                            <FiX className="w-5 h-5" />
                        </button>
                    </div>
                    <textarea
                        value={commentText}
                        onChange={(e) => setCommentText(e.target.value)}
                        placeholder="Enter your comment..."
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 min-h-[80px] mb-3"
                    />
                    <label className="flex items-center gap-2 mb-3">
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
            )}
        </div>
    );
}

export default DesignViewer;
