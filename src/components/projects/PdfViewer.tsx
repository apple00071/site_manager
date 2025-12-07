'use client';

import { useState, useRef, useCallback } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { FiChevronLeft, FiChevronRight, FiZoomIn, FiZoomOut, FiMaximize2 } from 'react-icons/fi';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

// Configure worker
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

type PinComment = {
    id: string;
    x_percent: number | null;
    y_percent: number | null;
    page_number: number;
    is_resolved: boolean;
    user: {
        full_name: string;
    };
};

type PdfViewerProps = {
    fileUrl: string;
    comments?: PinComment[];
    isAddingPin: boolean;
    pendingPin: { x: number; y: number; page: number } | null;
    onPinClick?: (pin: { x: number; y: number; page: number }) => void;
    onCommentClick?: (commentId: string) => void;
    activeCommentId?: string | null;
    currentPage: number;
    onPageChange: (page: number) => void;
};

export function PdfViewer({
    fileUrl,
    comments = [],
    isAddingPin,
    pendingPin,
    onPinClick,
    onCommentClick,
    activeCommentId,
    currentPage,
    onPageChange,
}: PdfViewerProps) {
    const [numPages, setNumPages] = useState<number>(0);
    const [scale, setScale] = useState(1);
    const [loading, setLoading] = useState(true);
    const pageRef = useRef<HTMLDivElement>(null);

    const onDocumentLoadSuccess = useCallback(({ numPages }: { numPages: number }) => {
        setNumPages(numPages);
        setLoading(false);
    }, []);

    const handlePageClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
        if (!isAddingPin || !pageRef.current) return;

        const rect = pageRef.current.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * 100;
        const y = ((e.clientY - rect.top) / rect.height) * 100;

        onPinClick?.({ x, y, page: currentPage });
    }, [isAddingPin, currentPage, onPinClick]);

    const goToPage = useCallback((page: number) => {
        if (page >= 1 && page <= numPages) {
            onPageChange(page);
        }
    }, [numPages, onPageChange]);

    const zoomIn = () => setScale(prev => Math.min(prev + 0.25, 3));
    const zoomOut = () => setScale(prev => Math.max(prev - 0.25, 0.5));
    const resetZoom = () => setScale(1);

    // Filter comments for current page
    const pageComments = comments.filter(c =>
        c.page_number === currentPage && c.x_percent !== null && c.y_percent !== null
    );

    // Render pin markers for current page
    const renderPins = () => {
        return pageComments.map((comment, index) => (
            <div
                key={comment.id}
                className={`absolute w-6 h-6 -translate-x-1/2 -translate-y-1/2 cursor-pointer transition-transform hover:scale-110 ${activeCommentId === comment.id ? 'z-30' : 'z-20'
                    }`}
                style={{
                    left: `${comment.x_percent}%`,
                    top: `${comment.y_percent}%`,
                }}
                onClick={(e) => {
                    e.stopPropagation();
                    onCommentClick?.(comment.id);
                }}
            >
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shadow-md border-2 ${comment.is_resolved
                    ? 'bg-green-500 border-green-300 text-white'
                    : activeCommentId === comment.id
                        ? 'bg-yellow-400 border-yellow-300 text-gray-900 ring-2 ring-yellow-200'
                        : 'bg-yellow-500 border-white text-gray-900'
                    }`}>
                    {index + 1}
                </div>
            </div>
        ));
    };

    // Render pending pin
    const renderPendingPin = () => {
        if (!pendingPin || pendingPin.page !== currentPage) return null;
        return (
            <div
                className="absolute w-8 h-8 -translate-x-1/2 -translate-y-1/2 animate-pulse pointer-events-none z-30"
                style={{
                    left: `${pendingPin.x}%`,
                    top: `${pendingPin.y}%`,
                }}
            >
                <div className="w-8 h-8 rounded-full bg-yellow-500 border-2 border-white shadow-lg flex items-center justify-center">
                    <span className="text-gray-900 font-bold text-sm">+</span>
                </div>
            </div>
        );
    };

    return (
        <div className="flex flex-col h-full bg-gray-800">
            {/* PDF Controls */}
            <div className="flex items-center justify-between px-4 py-2 bg-gray-700 border-b border-gray-600">
                {/* Page Navigation */}
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => goToPage(currentPage - 1)}
                        disabled={currentPage <= 1}
                        className="p-1.5 text-gray-300 hover:text-white hover:bg-gray-600 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <FiChevronLeft className="w-5 h-5" />
                    </button>
                    <span className="text-white text-sm font-medium min-w-[80px] text-center">
                        {currentPage} / {numPages || '?'}
                    </span>
                    <button
                        onClick={() => goToPage(currentPage + 1)}
                        disabled={currentPage >= numPages}
                        className="p-1.5 text-gray-300 hover:text-white hover:bg-gray-600 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <FiChevronRight className="w-5 h-5" />
                    </button>
                </div>

                {/* Zoom Controls */}
                <div className="flex items-center gap-1 bg-gray-600 rounded-lg px-2 py-1">
                    <button onClick={zoomOut} className="p-1 text-gray-300 hover:text-white">
                        <FiZoomOut className="w-4 h-4" />
                    </button>
                    <span className="text-white text-sm font-medium min-w-[50px] text-center">
                        {Math.round(scale * 100)}%
                    </span>
                    <button onClick={zoomIn} className="p-1 text-gray-300 hover:text-white">
                        <FiZoomIn className="w-4 h-4" />
                    </button>
                    <button onClick={resetZoom} className="p-1 text-gray-300 hover:text-white ml-1">
                        <FiMaximize2 className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* PDF Content */}
            <div className="flex-1 overflow-auto bg-gray-100 flex items-start justify-center p-4">
                {loading && (
                    <div className="flex items-center justify-center h-full">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-yellow-500"></div>
                    </div>
                )}
                <Document
                    file={fileUrl}
                    onLoadSuccess={onDocumentLoadSuccess}
                    loading={null}
                    className="shadow-lg"
                >
                    <div
                        ref={pageRef}
                        className="relative"
                        onClick={handlePageClick}
                        style={{ cursor: isAddingPin ? 'crosshair' : 'default' }}
                    >
                        <Page
                            pageNumber={currentPage}
                            scale={scale}
                            renderTextLayer={false}
                            renderAnnotationLayer={true}
                        />
                        {/* Pin overlay - positioned relative to page */}
                        <div className="absolute inset-0 pointer-events-none">
                            <div className="pointer-events-auto">
                                {renderPins()}
                                {renderPendingPin()}
                            </div>
                        </div>
                    </div>
                </Document>
            </div>
        </div>
    );
}

export default PdfViewer;
