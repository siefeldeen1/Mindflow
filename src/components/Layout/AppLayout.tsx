// AppLayout.tsx
import React, { useEffect, useRef, useState } from 'react';
import { Canvas } from '@/components/Canvas/Canvas';
import { Toolbar } from '@/components/Toolbar/Toolbar';
import { StatusBar } from '@/components/StatusBar/StatusBar';
import { PropertyPanel } from '@/components/PropertyPanel/PropertyPanel';
import { useThemeStore } from '@/store/useThemeStore';
import { useDocumentStore } from '@/store/useDocumentStore';
import { useCanvasStore } from '@/store/useCanvasStore';
import { Button } from '@/components/ui/button';
import { Plus, X, Folder, Search, Sliders } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useAuthStore } from '@/store/useAuthStore';

export const AppLayout: React.FC = () => {
    const containerRef = useRef<HTMLDivElement>(null);
    const propertyPanelRef = useRef<HTMLDivElement>(null);
    const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
    const { isDark } = useThemeStore();
    const {
        documents,
        closedDocuments,
        activeDocumentId,
        setActiveDocument,
        addDocument,
        removeDocument,
        deleteDocument,
        deleteActiveDocument,
        reopenDocument,
        renameDocument,
        unsavedChanges,
    } = useDocumentStore();
    const { loadCanvas, clear } = useCanvasStore();
    const [editingTabId, setEditingTabId] = useState<string | null>(null);
    const [tabName, setTabName] = useState<string>('');
    const [showTabsModal, setShowTabsModal] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [showPropertyPanel, setShowPropertyPanel] = useState(false);

    // Update canvas dimensions on window resize
    useEffect(() => {
        const updateDimensions = () => {
            if (containerRef.current) {
                const rect = containerRef.current.getBoundingClientRect();
                setDimensions({
                    width: rect.width,
                    height: rect.height,
                });
            }
        };

        updateDimensions();
        window.addEventListener('resize', updateDimensions);
        return () => window.removeEventListener('resize', updateDimensions);
    }, []);

    // Load canvas state when active document changes
    useEffect(() => {
        
        if (activeDocumentId) {
            const activeDoc = documents.find((doc) => doc.id === activeDocumentId);
            if (activeDoc) {
                
                loadCanvas(activeDoc.state);
            } else {
                
                clear();
            }
        } else {
            
            clear();
        }
    }, [activeDocumentId, documents, loadCanvas, clear]);

    // Prevent navigation if any document has unsaved changes
    useEffect(() => {
        const handleBeforeUnload = (e: BeforeUnloadEvent) => {
            if (unsavedChanges.length > 0) {
                e.preventDefault();
                e.returnValue = 'You have unsaved changes in one or more mind maps. Are you sure you want to leave and discard these changes?';
            }
        };
        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, [unsavedChanges]);

    // Handle click outside to close property panel on mobile and tablet
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (
                showPropertyPanel &&
                propertyPanelRef.current &&
                !propertyPanelRef.current.contains(event.target as Node)
            ) {
                setShowPropertyPanel(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [showPropertyPanel]);

    // Start editing a tab's name on double-click
    const startEditingTab = (id: string, name: string) => {
        setEditingTabId(id);
        setTabName(name);
    };

    // Rename a tab and clear editing state
    const handleRename = (id: string) => {
        if (tabName.trim()) {
            renameDocument(id, tabName.trim());
        }
        setEditingTabId(null);
    };

    // Filter tabs for search
    const filteredOpenTabs = documents.filter((doc) =>
        doc.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
    const filteredClosedTabs = closedDocuments.filter((doc) =>
        doc.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    // Show loading state if no documents or active document
    if (!documents.length || !activeDocumentId) {
        return (
            <div className="h-screen flex items-center justify-center bg-background text-foreground">
                <p>Loading documents...</p>
            </div>
        );
    }

    return (
        <div className="h-screen flex flex-col bg-background text-foreground">
            <header className="shrink-0">
                <div className="border-b border-border px-6 py-3 flex justify-between items-center">
                    <h1 className="text-xl font-semibold bg-gradient-primary bg-clip-text text-transparent site-title">
                        Mind Map Editor
                    </h1>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                                if (!useAuthStore.getState().isAuthenticated) {
                                    const notification = document.createElement('div');
                                    notification.className = 'fixed top-4 left-1/2 transform -translate-x-1/2 bg-primary text-primary-foreground px-6 py-3 rounded-lg shadow-md z-50 animate-notification border border-primary/20';
                                    notification.textContent = 'Please log in to create a new tab';
                                    document.body.appendChild(notification);
                                    setTimeout(() => {
                                        document.body.removeChild(notification);
                                    }, 3000);
                                    return;
                                }
                                addDocument();
                            }}
                            title="New Tab"
                        >
                            <Plus className="w-4 h-4" />
                        </Button>
                        <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => setShowDeleteConfirm(activeDocumentId)}
                            title="Delete Current Tab"
                            disabled={documents.length <= 1}
                        >
                            Delete Tab
                        </Button>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setShowTabsModal(true)}
                            title="View All Tabs"
                        >
                            <Folder className="w-4 h-4" />
                        </Button>
                    </div>
                </div>
                <div className="flex border-b border-border bg-muted overflow-x-auto flex-nowrap whitespace-nowrap">
                    {documents.map((doc) => (
                        <div
                            key={doc.id}
                            className={`px-4 py-2 flex items-center gap-2 ${
                                activeDocumentId === doc.id
                                    ? 'bg-background border-t-2 border-primary'
                                    : 'text-muted-foreground'
                            }`}
                            onDoubleClick={() => startEditingTab(doc.id, doc.name)}
                        >
                            {editingTabId === doc.id ? (
                                <Input
                                    value={tabName}
                                    onChange={(e) => setTabName(e.target.value)}
                                    onBlur={() => handleRename(doc.id)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') handleRename(doc.id);
                                        if (e.key === 'Escape') setEditingTabId(null);
                                    }}
                                    className="h-6 w-24"
                                    autoFocus
                                />
                            ) : (
                                <div className="flex items-center gap-2">
                                    <span
                                        className="cursor-pointer"
                                        onClick={() => setActiveDocument(doc.id)}
                                    >
                                        {doc.name}
                                    </span>
                                    {unsavedChanges.includes(doc.id) && (
                                        <span className="w-2 h-2 bg-blue-500 rounded-full" title="Unsaved changes"></span>
                                    )}
                                </div>
                            )}
                            {documents.length > 1 && (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        removeDocument(doc.id);
                                    }}
                                    className="p-0 h-6 w-6"
                                    title="Close Tab"
                                >
                                    <X className="w-4 h-4" />
                                </Button>
                            )}
                        </div>
                    ))}
                </div>
                <Toolbar activeDocumentId={activeDocumentId} />
            </header>

            {/* View All Tabs Modal */}
            {showTabsModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-card p-6 rounded-lg shadow-xl max-w-lg w-full max-h-[80vh] overflow-y-auto">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-xl font-semibold">All Tabs</h2>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setShowTabsModal(false)}
                                className="p-1"
                            >
                                <X className="w-5 h-5" />
                            </Button>
                        </div>
                        <div className="mb-4">
                            <div className="relative">
                                <Search className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" />
                                <Input
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder="Search tabs..."
                                    className="pl-10"
                                />
                            </div>
                        </div>
                        <div className="mb-6">
                            <h3 className="font-medium text-lg mb-2">Open Tabs</h3>
                            {filteredOpenTabs.length > 0 ? (
                                <ul className="space-y-2">
                                    {filteredOpenTabs.map((doc) => (
                                        <li
                                            key={doc.id}
                                            className={`flex items-center justify-between p-2 rounded-md hover:bg-muted cursor-pointer ${
                                                activeDocumentId === doc.id ? 'bg-primary/10' : ''
                                            }`}
                                            onClick={() => {
                                                setActiveDocument(doc.id);
                                                setShowTabsModal(false);
                                            }}
                                        >
                                            <span className="flex items-center gap-2">
                                                <Folder className="w-4 h-4 text-primary" />
                                                {doc.name} {activeDocumentId === doc.id ? '(Active)' : ''}
                                            </span>
                                        </li>
                                    ))}
                                </ul>
                            ) : (
                                <p className="text-muted-foreground">No open tabs match your search</p>
                            )}
                        </div>
                        <div className="mb-6">
                            <h3 className="font-medium text-lg mb-2">Closed Tabs</h3>
                            {filteredClosedTabs.length > 0 ? (
                                <ul className="space-y-2">
                                    {filteredClosedTabs.map((doc) => (
                                        <li
                                            key={doc.id}
                                            className="flex items-center justify-between p-2 rounded-md hover:bg-muted"
                                        >
                                            <span className="flex items-center gap-2">
                                                <Folder className="w-4 h-4 text-muted-foreground" />
                                                {doc.name}
                                            </span>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => {
                                                    reopenDocument(doc.id);
                                                    setShowTabsModal(false);
                                                }}
                                            >
                                                Reopen
                                            </Button>
                                        </li>
                                    ))}
                                </ul>
                            ) : (
                                <p className="text-muted-foreground">No closed tabs match your search</p>
                            )}
                        </div>
                        <Button
                            variant="secondary"
                            onClick={() => setShowTabsModal(false)}
                            className="w-full"
                        >
                            Close
                        </Button>
                    </div>
                </div>
            )}

            {/* Delete Confirmation Modal */}
            {showDeleteConfirm && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-card p-6 rounded-lg shadow-xl max-w-sm w-full">
                        <h2 className="text-lg font-semibold mb-4">Confirm Delete</h2>
                        <p className="mb-4">
                            Are you sure you want to permanently delete the tab "
                            {documents.find((doc) => doc.id === showDeleteConfirm)?.name}"? This action cannot be undone.
                        </p>
                        <div className="flex justify-end gap-2">
                            <Button
                                variant="secondary"
                                onClick={() => {
                                    
                                    setShowDeleteConfirm(null);
                                }}
                            >
                                Cancel
                            </Button>
                            <Button
                                variant="destructive"
                                onClick={() => {
                                    
                                    if (showDeleteConfirm === activeDocumentId) {
                                        deleteActiveDocument();
                                    } else {
                                        deleteDocument(showDeleteConfirm);
                                    }
                                    setShowDeleteConfirm(null);
                                }}
                            >
                                Delete
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            <div className="flex-1 flex overflow-hidden">
                <div className="flex-1 flex flex-col">
                    <div ref={containerRef} className="flex-1 relative">
                        <Canvas width={dimensions.width} height={dimensions.height} />
                    </div>
                    <StatusBar />
                </div>

                <div
                    ref={propertyPanelRef}
                    className={`shrink-0 border-l border-border overflow-hidden property-panel-container ${
                        showPropertyPanel ? 'block fixed inset-y-0 right-0 w-80 z-50 bg-background shadow-lg property-panel-mobile' : 'hidden md:block'
                    }`}
                >
                    <div className="h-full overflow-y-auto">
                        <PropertyPanel />
                    </div>
                    {showPropertyPanel && (
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setShowPropertyPanel(false)}
                            className="absolute top-2 right-2 md:hidden"
                        >
                            <X className="w-4 h-4" />
                        </Button>
                    )}
                </div>
            </div>

            <Button
                variant="default"
                size="sm"
                onClick={() => setShowPropertyPanel(true)}
                className="fixed bottom-4 right-4 z-40 rounded-full w-12 h-12 shadow-lg flex items-center justify-center lg:hidden"
                title="Open Properties"
            >
                <Sliders className="w-6 h-6" />
            </Button>
        </div>
    );
};