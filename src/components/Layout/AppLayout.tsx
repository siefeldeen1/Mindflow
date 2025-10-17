import React, { useCallback, useEffect, useRef, useState } from "react";
import { Canvas } from "@/components/Canvas/Canvas";
import { Toolbar } from "@/components/Toolbar/Toolbar";
import { StatusBar } from "@/components/StatusBar/StatusBar";
import { PropertyPanel } from "@/components/PropertyPanel/PropertyPanel";
import { useThemeStore } from "@/store/useThemeStore";
import { useDocumentStore } from "@/store/useDocumentStore";
import { useCanvasStore } from "@/store/useCanvasStore";
import { Button } from "@/components/ui/button";
import { Plus, X, Folder, Search, Sliders, Sun, Moon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useAuthStore } from "@/store/useAuthStore";
import { AuthDialog } from "@/components/Auth/AuthDialog";
import debounce from "lodash.debounce";
import { useSearchParams } from "react-router-dom";
import { CanvasState } from '@/types';

export const AppLayout: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const propertyPanelRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 100, height: 500 });
  const { isDark, toggleTheme } = useThemeStore();
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
  const { isAuthenticated,isLoading: authLoading } = useAuthStore();
  const { loadCanvas, clear, selectedNodes, showPropertyPanel, setShowPropertyPanel } = useCanvasStore();
  const [editingTabId, setEditingTabId] = useState<string | null>(null);
  const [tabName, setTabName] = useState<string>("");
  const [showTabsModal, setShowTabsModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [screenType, setScreenType] = useState<1 | 2>(2);
const [readOnly, setReadOnly] = useState<boolean>(false); // New state for read-only mode
  const [shareNotification, setShareNotification] = useState<string | null>(null); // For share mode feedback
  const [searchParams, setSearchParams] = useSearchParams();
  const [sharedCanvasState, setSharedCanvasState] = useState<CanvasState | null>(null);
  
useEffect(() => {
  const encryptedId = searchParams.get('share');
  if (encryptedId) {
    const fetchSharedJson = async () => {
      try {
        const response = await fetch(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000'}/api/share/${encryptedId}`);
        if (!response.ok) {
          throw new Error('Failed to fetch shared JSON');
        }
        const { json } = await response.json();
        const parsed = JSON.parse(json);
        // Validate and construct CanvasState
        const validatedState: CanvasState = {
          nodes: Array.isArray(parsed.nodes) ? parsed.nodes : [],
          edges: Array.isArray(parsed.edges) ? parsed.edges : [],
          viewport: parsed.viewport || { x: 0, y: 0, scale: 1 },
          selectedNodes: [],
          selectedEdges: [],
          tool: 'select', // Force select tool for read-only
          isConnecting: false,
          connectionSource: null,
          history: [],
          historyIndex: -1,
          isDragging: false,
          isPanning: false,
          selectionBox: null,
        };
        setSharedCanvasState(validatedState);
        setReadOnly(true);
        setShareNotification('Viewing shared document (read-only)');
      } catch (error) {
        console.error('Error loading shared JSON:', error);
        setShareNotification('Failed to load shared document');
        setSharedCanvasState(null);
        setReadOnly(false);
      }
    };
    fetchSharedJson();
  } else {
    setSharedCanvasState(null);
    setReadOnly(false);
    setShareNotification(null);
  }
}, [searchParams]);
  // Debug showPropertyPanel state changes
  useEffect(() => {
    console.log('showPropertyPanel changed:', showPropertyPanel);
  }, [showPropertyPanel]);

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
    window.addEventListener("resize", updateDimensions);
    return () => window.removeEventListener("resize", updateDimensions);
  }, []);


useEffect(() => {
  if (!sharedCanvasState && activeDocumentId) {
    const activeDoc = documents.find((doc) => doc.id === activeDocumentId);
    if (activeDoc) {
      loadCanvas(activeDoc.state);
    } else {
      clear();
    }
  }
}, [activeDocumentId, documents, loadCanvas, clear, sharedCanvasState]);
  // Prevent navigation if any document has unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (unsavedChanges.length > 0) {
        e.preventDefault();
        e.returnValue =
          "You have unsaved changes in one or more mind maps. Are you sure you want to leave and discard these changes?";
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [unsavedChanges]);

  // Handle click outside to close property panel
  useEffect(() => {
   const handleClickOutside = (event: MouseEvent) => {
  if (
    showPropertyPanel &&
    propertyPanelRef.current &&
    !propertyPanelRef.current.contains(event.target as Node) &&
    !containerRef.current?.contains(event.target as Node)
  ) {
    setShowPropertyPanel(false);
  }
};

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showPropertyPanel, setShowPropertyPanel]);

  // Close property panel when no nodes are selected
  useEffect(() => {
    if (selectedNodes.length !== 1 && showPropertyPanel) {
      setShowPropertyPanel(false);
    }
  }, [selectedNodes, showPropertyPanel, setShowPropertyPanel]);

  // Start editing a tab's name on double-click
  const startEditingTab = (id: string, name: string) => {
    setEditingTabId(id);
    setTabName(name);
  };


  
  const exitShareMode = () => {
    setSearchParams({}); // This triggers the sharing useEffect's 'else' (reset only)
    setReadOnly(false);
    setShareNotification(null);
    // UPDATED: Defer loadCanvas to next tick to let searchParams update and avoid raceclear();
    setTimeout(() => {
      if (activeDocumentId && isAuthenticated) { // Guard with auth
        const activeDoc = documents.find((doc) => doc.id === activeDocumentId);
        if (activeDoc) {
          loadCanvas(activeDoc.state);
        } else {
          clear();
        }
      }
    }, 0);
  };

  // Rename a tab and clear editing state
  const handleRename = (id: string) => {
    if (tabName.trim()) {
      renameDocument(id, tabName.trim());
    }
    setEditingTabId(null);
  };
const debouncedAddDocument = useCallback(() => {
  if ((debouncedAddDocument as any).isCooldown) return;

  if (!useAuthStore.getState().isAuthenticated) {
    const notification = document.createElement("div");
    notification.className =
      "fixed top-6 left-1/2 transform -translate-x-1/2 bg-primary text-primary-foreground px-6 py-3 rounded-lg shadow-lg z-50 animate-slide-down border border-primary/20";
    notification.textContent = "Please log in to create a new tab";
    document.body.appendChild(notification);
    setTimeout(() => {
      document.body.removeChild(notification);
    }, 3000);
    return;
  }

  addDocument();
  (debouncedAddDocument as any).isCooldown = true;
  setTimeout(() => ((debouncedAddDocument as any).isCooldown = false), 2000);
}, [addDocument]);

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
      <div className="h-screen flex items-center justify-center bg-background text-foreground transition-colors duration-300">
        <p className="text-lg font-medium">Loading documents...</p>
      </div>
    );
  }

  useEffect(() => {
    const checkScreen = () => {
      setScreenType(window.innerWidth >= 768 ? 1 : 2);
    };

    checkScreen();
    window.addEventListener("resize", checkScreen);
    return () => window.removeEventListener("resize", checkScreen);
  }, []);

  return (
    <div className="h-screen flex flex-col bg-background text-foreground transition-colors duration-300">
      <header className="shrink-0 bg-card shadow-md">
        <div className="px-6 py-4 flex items-center justify-between border-b border-border">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-primary/50 bg-clip-text text-transparent">
            Mind Map Editor
          </h1>
          <div className="flex items-center gap-2">
            {readOnly && (
              <Button
                variant="outline"
                size="sm"
                onClick={exitShareMode}
                className="flex items-center gap-2"
              >
                Exit Share Mode
              </Button>
            )}
            <AuthDialog />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                toggleTheme();
              }}
              className="w-9 h-9 p-0"
              title="Toggle Theme"
            >
              {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </Button>
          </div>
        </div>
        <div className="flex border-b border-border bg-muted/30 overflow-x-auto flex-nowrap whitespace-nowrap scrollbar-thin scrollbar-thumb-rounded scrollbar-thumb-gray-400 dark:scrollbar-thumb-gray-600 px-4 py-2">
          <div className="flex items-center gap-2 mr-3">
            <Button
  variant="outline"
  size="sm"
  className="flex items-center gap-2 hover:bg-primary/10 transition-colors duration-200 rounded-full"
  onClick={debouncedAddDocument}
  title="New Tab"
>
  <Plus className="w-5 h-5" />
  <span className="hidden sm:inline">New</span>
</Button>
            <Button
              variant="outline"
              size="sm"
              className="flex items-center gap-2 hover:bg-primary/10 transition-colors duration-200 rounded-full"
              onClick={() => setShowTabsModal(true)}
              title="View All Tabs"
            >
              <Folder className="w-5 h-5" />
              <span className="hidden sm:inline">Tabs</span>
            </Button>
          </div>
   {documents.map((doc) => (
  <div
    key={doc.id}
    className={`flex items-center gap-2 px-4 py-2 rounded-lg mr-2 min-w-0 transition-all duration-200 ${editingTabId === doc.id ? "w-32 max-w-32 min-w-32" : "w-28 max-w-28 min-w-28"} ${activeDocumentId === doc.id ? "bg-background border-l-4 border-primary shadow-sm" : "text-muted-foreground hover:bg-muted/80"}`}
    onDoubleClick={() => startEditingTab(doc.id, doc.name)}
  >
    {editingTabId === doc.id ? (
      <Input
        value={tabName}
        onChange={(e) => setTabName(e.target.value)}
        onBlur={() => handleRename(doc.id)}
        onKeyDown={(e) => {
          if (e.key === "Enter") handleRename(doc.id);
          if (e.key === "Escape") setEditingTabId(null);
        }}
        className="h-8 w-20 max-w-20 min-w-20 text-sm rounded-md border border-border focus:ring-2 focus:ring-primary overflow-hidden text-ellipsis whitespace-nowrap"
        autoFocus
        maxLength={20}
      />
    ) : (
      <div className="flex items-center gap-2 min-w-0">
        <span
          className="cursor-pointer font-medium text-sm hover:text-foreground transition-colors duration-150 max-w-[88px] overflow-hidden text-ellipsis whitespace-nowrap"
          onClick={() => setActiveDocument(doc.id)}
        >
          {doc.name}
        </span>
        {unsavedChanges.includes(doc.id) && (
          <span
            className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"
            title="Unsaved changes"
          ></span>
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
        className="p-0 h-6 w-6 hover:bg-red-100 dark:hover:bg-red-900/50 transition-colors duration-150 rounded-full"
        title="Close Tab"
      >
        <X className="w-4 h-4 text-muted-foreground hover:text-red-500" />
      </Button>
    )}
  </div>
))}
        </div>
        <div className="bg-background/95">
          <Toolbar activeDocumentId={activeDocumentId} setShowDeleteConfirm={setShowDeleteConfirm} setShowClearConfirm={setShowClearConfirm} readOnly={readOnly}/>
        </div>
      </header>
{shareNotification && (
        <div className="fixed top-4 left-1/2 transform -translate-x-1/2 bg-primary text-primary-foreground px-6 py-3 rounded-lg shadow-md z-50 animate-notification border border-primary/20">
          {shareNotification}
        </div>
      )}
      {showTabsModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 ">
          <div className="bg-card p-6 rounded-2xl shadow-2xl max-w-md w-full max-h-[80vh] overflow-y-auto ">
            <div className="flex justify-between items-center mb-5">
              <h2 className="text-xl font-semibold text-foreground">
                Manage Tabs
              </h2>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowTabsModal(false)}
                className="p-1 hover:bg-muted/80 transition-colors duration-150 rounded-full"
              >
                <X className="w-6 h-6 text-muted-foreground" />
              </Button>
            </div>
            <div className="mb-5">
              <div className="relative">
                <Search className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search tabs..."
                  className="pl-10 h-10 rounded-lg border border-border focus:ring-2 focus:ring-primary transition-all duration-150"
                />
              </div>
            </div>
            <div className="mb-5">
              <h3 className="font-medium text-lg mb-3 text-foreground">
                Open Tabs
              </h3>
              {filteredOpenTabs.length > 0 ? (
                <ul className="space-y-2">
                  {filteredOpenTabs.map((doc) => (
                    <li
                      key={doc.id}
                      className={`flex items-center justify-between p-3 rounded-lg hover:bg-muted/80 cursor-pointer transition-all duration-150 ${
                        activeDocumentId === doc.id
                          ? "bg-primary/10 border-l-4 border-primary"
                          : ""
                      }`}
                      onClick={() => {
                        setActiveDocument(doc.id);
                        setShowTabsModal(false);
                      }}
                    >
                      <span className="flex items-center gap-3 font-medium text-sm">
                        <Folder className="w-5 h-5 text-primary" />
                        {doc.name}{" "}
                        {activeDocumentId === doc.id ? "(Active)" : ""}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-muted-foreground text-sm">
                  No open tabs match your search
                </p>
              )}
            </div>
            <div className="mb-5">
              <h3 className="font-medium text-lg mb-3 text-foreground">
                Closed Tabs
              </h3>
              {filteredClosedTabs.length > 0 ? (
                <ul className="space-y-2">
                  {filteredClosedTabs.map((doc) => (
                    <li
                      key={doc.id}
                      className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/80 transition-all duration-150"
                    >
                      <span className="flex items-center gap-3 font-medium text-sm">
                        <Folder className="w-5 h-5 text-muted-foreground" />
                        {doc.name}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          reopenDocument(doc.id);
                          setShowTabsModal(false);
                        }}
                        className="text-sm hover:bg-primary/10 transition-colors duration-150 rounded-full"
                      >
                        Reopen
                      </Button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-muted-foreground text-sm">
                  No closed tabs match your search
                </p>
              )}
            </div>
            <Button
              variant="secondary"
              onClick={() => setShowTabsModal(false)}
              className="w-full rounded-lg hover:bg-muted/80 transition-colors duration-150"
            >
              Close
            </Button>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 ">
          <div className="bg-card p-6 rounded-2xl shadow-2xl max-w-sm w-full ">
            <h2 className="text-xl font-semibold mb-4 text-foreground">
              Confirm Delete
            </h2>
            <p className="mb-5 text-sm text-muted-foreground">
              Are you sure you want to permanently delete the tab "
              {documents.find((doc) => doc.id === showDeleteConfirm)?.name}"?
              This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <Button
                variant="secondary"
                onClick={() => {
                  setShowDeleteConfirm(null);
                }}
                className="rounded-lg hover:bg-muted/80 transition-colors duration-150"
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
                className="rounded-lg hover:bg-destructive/90 transition-colors duration-150"
              >
                Delete
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Clear Canvas Confirmation Modal */}
      {showClearConfirm && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 ">
          <div className="bg-card p-6 rounded-2xl shadow-2xl max-w-sm w-full ">
            <h2 className="text-xl font-semibold mb-4 text-foreground">
              Confirm Clear Canvas
            </h2>
            <p className="mb-5 text-sm text-muted-foreground">
              Are you sure you want to clear the canvas? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <Button
                variant="secondary"
                onClick={() => {
                  setShowClearConfirm(false);
                }}
                className="rounded-lg hover:bg-muted/80 transition-colors duration-150"
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => {
                  clear();
                  setShowClearConfirm(false);
                }}
                className="rounded-lg hover:bg-destructive/90 transition-colors duration-150"
              >
                Clear
              </Button>
            </div>
          </div>
        </div>
      )}

      {shareNotification && (
  <div className="fixed top-4 left-1/2 transform -translate-x-1/2 bg-primary text-primary-foreground px-6 py-3 rounded-lg shadow-md z-50 animate-notification border border-primary/20 flex items-center">
    {shareNotification}
    <Button
      variant="ghost"
      size="sm"
      onClick={() => setSearchParams({})}
      className="ml-4"
    >
      <X className="w-4 h-4" />
    </Button>
  </div>
)}
      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 flex flex-col">
          <div ref={containerRef} className="flex-1 relative bg-background">
            <Canvas width={dimensions.width} height={dimensions.height} readOnly={readOnly} canvasState={sharedCanvasState}/>
          </div>
          <div className="bg-card shadow-inner">
            <StatusBar />
          </div>
        </div>

        {showPropertyPanel && !readOnly && (
          <div
            ref={propertyPanelRef}
            className="fixed inset-y-0 right-0 w-80 z-50 bg-background shadow-lg transition-transform duration-300"
          >
            <div className="h-full overflow-y-auto">
              <PropertyPanel />
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowPropertyPanel(false)}
              className="absolute top-4 right-6"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        )}

        {selectedNodes.length === 1 && !showPropertyPanel && !readOnly && (
          <Button
            variant="default"
            size="sm"
            onClick={() => {
              console.log('Floating button clicked, opening property panel');
              setShowPropertyPanel(true);
            }}
            className="fixed bottom-8 right-6 z-40 rounded-full w-14 h-14 shadow-lg flex items-center justify-center bg-primary hover:bg-primary/90 transition-all duration-200 transform hover:scale-105"
            title="Toggle Properties"
          >
            <Sliders className="w-6 h-6" />
          </Button>
        )}
      </div>
 {authLoading && (
  <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
    <div className="bg-card p-6 rounded-lg shadow-lg flex flex-col items-center gap-4">
      <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      <p className="text-foreground font-medium">Loading...</p>
    </div>
  </div>
)}
    </div>
  );
};