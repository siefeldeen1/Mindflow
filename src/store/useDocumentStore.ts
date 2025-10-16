import { debounce } from 'lodash';
// useDocumentStore.ts
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { v4 as uuidv4 } from 'uuid';
import { Document, CanvasState } from '@/types';
import { useAuthStore } from '@/store/useAuthStore';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';

// Session storage helper functions
const SESSION_STORAGE_KEY = 'temp-document';
const UNAUTHORIZED_STORAGE_KEY = 'unauthorized-document';
const SESSION_EXPIRY_DAYS = 2;

const saveTempDocumentToSession = (document: Document) => {
    const expiry = Date.now() + SESSION_EXPIRY_DAYS * 24 * 60 * 60 * 1000; // 2 days in milliseconds
    const data = {
        document,
        expiry,
    };
    sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(data));
};

const loadTempDocumentFromSession = (): Document | null => {
    const data = sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (!data) return null;
    try {
        const parsed = JSON.parse(data);
        if (Date.now() > parsed.expiry) {
            sessionStorage.removeItem(SESSION_STORAGE_KEY);
            return null;
        }
        return parsed.document;
    } catch (error) {
        console.error('Failed to parse session storage document:', error);
        return null;
    }
};

const saveUnauthorizedDocument = (document: Document) => {
    const expiry = Date.now() + SESSION_EXPIRY_DAYS * 24 * 60 * 60 * 1000;
    const data = {
        document,
        expiry,
    };
    localStorage.setItem(UNAUTHORIZED_STORAGE_KEY, JSON.stringify(data));
};

const loadUnauthorizedDocument = (): Document | null => {
    const data = localStorage.getItem(UNAUTHORIZED_STORAGE_KEY);
    if (!data) return null;
    try {
        const parsed = JSON.parse(data);
        if (Date.now() > parsed.expiry) {
            localStorage.removeItem(UNAUTHORIZED_STORAGE_KEY);
            return null;
        }
        return parsed.document;
    } catch (error) {
        console.error('Failed to parse unauthorized document:', error);
        return null;
    }
};

interface DocumentStore {
    documents: Document[];
    closedDocuments: Document[];
    activeDocumentId: string | null;
    unsavedChanges: string[];
    lastSavedState: { [key: string]: { nodes: any[]; edges: any[] } };
    addDocument: () => Promise<void>;
    removeDocument: (id: string) => void;
    deleteDocument: (id: string) => Promise<void>;
    deleteActiveDocument: () => Promise<void>;
    reopenDocument: (id: string) => void;
    renameDocument: (id: string, name: string) => void;
    setActiveDocument: (id: string) => void;
    markUnsaved: (id: string) => void;
    markSaved: (id: string, nodes: any[], edges: any[]) => void;
    clearUnsavedChanges: () => void;
    saveDocument: (id: string, state: CanvasState) => Promise<void>;
    loadDocuments: () => Promise<void>;
    reset: () => void;
    updateDocumentState: (id: string, state: Partial<CanvasState>) => void;
    syncUnauthorizedDocument: () => Promise<void>;
    isAutoSaving: boolean;
}

export const useDocumentStore = create<DocumentStore>()(
    persist(
        (set, get) => {
            const fetchWithAuth = async (url: string, options: RequestInit = {}): Promise<any> => {
                const token = useAuthStore.getState().token;
                const headers = {
                    ...options.headers,
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                };

                const response = await fetch(url, { ...options, headers });

                if (response.status === 401) {
                    let errorData;
                    try {
                        errorData = await response.json();
                    } catch {
                        errorData = { error: 'Unauthorized' };
                    }
                    if (errorData.error === 'Token expired') {
                        useAuthStore.getState().logout();
                        // Refresh the frontend by reloading the page
                        window.location.reload();
                    }
                    throw new Error(errorData.error || 'Unauthorized');
                }

                if (!response.ok) {
                    let errorData;
                    try {
                        errorData = await response.json();
                    } catch {
                        errorData = { error: 'Request failed' };
                    }
                    throw new Error(errorData.error || 'Request failed');
                }

                return response.json();
            };
            const fetchDocument = async (id: string): Promise<Document | null> => {
                try {
                    console.log(`Fetching document ID: ${id}`);
                    const document = await fetchWithAuth(`${API_BASE_URL}/api/documents/${id}`, { method: 'GET' });
                    return document;
                } catch (error: any) {
                    console.error(`Error fetching document ${id}:`, error.message);
                    if (error.message.includes('Document not found') || error.message.includes('404')) {
                        console.warn(`Document ${id} not found, clearing stale storage`);
                        sessionStorage.removeItem(SESSION_STORAGE_KEY);
                        localStorage.removeItem(UNAUTHORIZED_STORAGE_KEY);
                        get().reset();
                    }
                    return null;
                }
            };
            const initialDocId = uuidv4();
            let defaultDocument: Document = {
                id: initialDocId,
                name: 'Page 1',
                state: {
                    nodes: [],
                    edges: [],
                    selectedNodes: [],
                    selectedEdges: [],
                    viewport: { x: 0, y: 0, scale: 1 },
                    tool: 'select',
                    isConnecting: false,
                    connectionSource: null,
                    history: [],
                    historyIndex: -1,
                    isDragging: false,
                    isPanning: false,
                    selectionBox: null,
                },
            };
            const debouncedAutoSave = debounce((id: string) => { // Added debounced autosave function to batch saves
                const state = get();
                set({ isAutoSaving: true }); // Set autosaving state to show icon
                if (!useAuthStore.getState().isAuthenticated) {
                    const doc = state.documents.find((d) => d.id === id);
                    if (doc) {
                        saveTempDocumentToSession(doc); // Save to session storage for unauthenticated users
                        saveUnauthorizedDocument(doc); // Save to local storage for unauthenticated users
                        const newNodes = doc.state.nodes || [];
                        const newEdges = doc.state.edges || [];
                        set({
                            unsavedChanges: state.unsavedChanges.filter((docId) => docId !== id),
                            lastSavedState: {
                                ...state.lastSavedState,
                                [id]: {
                                    nodes: JSON.parse(JSON.stringify(newNodes)),
                                    edges: JSON.parse(JSON.stringify(newEdges)),
                                },
                            },
                            isAutoSaving: false, // Reset autosaving state after save
                        });
                    } else {
                        set({ isAutoSaving: false }); // Reset if no document found
                    }
                } else {
                    const fullState = state.documents.find((d) => d.id === id)?.state;
                    if (fullState) {
                        state.saveDocument(id, fullState).catch((error) => {
                            console.error('Auto-save failed:', error);
                            set({ isAutoSaving: false }); // Reset on error
                        });
                    } else {
                        set({ isAutoSaving: false }); // Reset if no state found
                    }
                }
            }, 2000); // 2000ms debounce to batch changes
            // Load temp document from session storage or unauthorized document from local storage
            const tempDoc = loadTempDocumentFromSession();
            const unauthorizedDoc = loadUnauthorizedDocument();
            if (unauthorizedDoc) {
                defaultDocument = unauthorizedDoc;
            } else if (tempDoc) {
                defaultDocument = tempDoc;
            }

            return {
                documents: [defaultDocument],
                closedDocuments: [],
                activeDocumentId: defaultDocument.id,
                unsavedChanges: tempDoc || unauthorizedDoc ? [defaultDocument.id] : [],
                lastSavedState: { [defaultDocument.id]: { nodes: [], edges: [] } },
                isAutoSaving: false,

                addDocument: async () => {
                    const { isAuthenticated } = useAuthStore.getState();
                    if (!isAuthenticated) {

                        return;
                    }
                    const newDoc: Document = {
                        id: uuidv4(),
                        name: `Page ${get().documents.length + 1}`,
                        state: {
                            nodes: [],
                            edges: [],
                            selectedNodes: [],
                            selectedEdges: [],
                            viewport: { x: 0, y: 0, scale: 1 },
                            tool: 'select',
                            isConnecting: false,
                            connectionSource: null,
                            history: [],
                            historyIndex: -1,
                            isDragging: false,
                            isPanning: false,
                            selectionBox: null,
                        },
                    };
                    try {
                        const token = useAuthStore.getState().token;
                        if (!token) {
                            throw new Error('No authentication token found. Please log in.');
                        }
                        const response = await fetch(`${API_BASE_URL}/api/documents`, {
                            method: 'POST',
                            headers: {
                                'Authorization': `Bearer ${token}`,
                                'Content-Type': 'application/json',
                            },
                            body: JSON.stringify({
                                id: newDoc.id,
                                name: newDoc.name,
                                state: newDoc.state,
                            }),
                        });
                        if (!response.ok) {
                            const errorData = await response.json();
                            throw new Error(errorData.error || 'Failed to create document');
                        }
                        set((state) => ({
                            documents: [...state.documents, newDoc],
                            activeDocumentId: newDoc.id,
                            lastSavedState: {
                                ...state.lastSavedState,
                                [newDoc.id]: { nodes: [], edges: [] },
                            },
                        }));

                    } catch (error) {
                        console.error('Failed to create document:', error);
                        set((state) => ({
                            documents: [...state.documents, newDoc],
                            activeDocumentId: newDoc.id,
                            unsavedChanges: [...state.unsavedChanges, newDoc.id],
                            lastSavedState: {
                                ...state.lastSavedState,
                                [newDoc.id]: { nodes: [], edges: [] },
                            },
                        }));
                    }
                },

                removeDocument: (id: string) => {
                    const { documents, activeDocumentId, closedDocuments } = get();
                    if (documents.length <= 1) return;
                    const documentToClose = documents.find((doc) => doc.id === id);
                    if (!documentToClose) return;
                    set({
                        documents: documents.filter((doc) => doc.id !== id),
                        closedDocuments: [...closedDocuments, documentToClose],
                        activeDocumentId:
                            activeDocumentId === id ? documents[0].id : activeDocumentId,
                        unsavedChanges: get().unsavedChanges.filter((docId) => docId !== id),
                    });

                },

                deleteDocument: async (id: string) => {
                    const { documents, activeDocumentId } = get();
                    if (documents.length <= 1) return;
                    const documentExists = documents.find((doc) => doc.id === id);
                    if (!documentExists) return;
                    try {
                        const token = useAuthStore.getState().token;
                        if (!token) {
                            throw new Error('No authentication token found. Please log in.');
                        }
                        const checkResponse = await fetch(`${API_BASE_URL}/api/documents/${id}`, {
                            method: 'GET',
                            headers: {
                                'Authorization': `Bearer ${token}`,
                                'Content-Type': 'application/json',
                            },
                        });
                        if (checkResponse.ok) {
                            const deleteResponse = await fetch(`${API_BASE_URL}/api/documents/${id}`, {
                                method: 'DELETE',
                                headers: {
                                    'Authorization': `Bearer ${token}`,
                                    'Content-Type': 'application/json',
                                },
                            });
                            if (!deleteResponse.ok) {
                                const errorData = await deleteResponse.json();
                                throw new Error(errorData.error || 'Failed to delete document');
                            }
                        }
                        const newDocuments = documents.filter((doc) => doc.id !== id);
                        set({
                            documents: newDocuments,
                            activeDocumentId:
                                activeDocumentId === id ? newDocuments[0].id : activeDocumentId,
                            unsavedChanges: get().unsavedChanges.filter((docId) => docId !== id),
                            lastSavedState: Object.fromEntries(
                                Object.entries(get().lastSavedState).filter(([key]) => key !== id)
                            ),
                        });

                    } catch (error: any) {
                        if (error.message.includes('404') || error.message.includes('Document not found')) {
                            const newDocuments = documents.filter((doc) => doc.id !== id);
                            set({
                                documents: newDocuments,
                                activeDocumentId:
                                    activeDocumentId === id ? newDocuments[0].id : activeDocumentId,
                                unsavedChanges: get().unsavedChanges.filter((docId) => docId !== id),
                                lastSavedState: Object.fromEntries(
                                    Object.entries(get().lastSavedState).filter(([key]) => key !== id)
                                ),
                            });

                        } else {
                            console.error('Failed to delete document:', error);
                            throw error;
                        }
                    }
                },

                deleteActiveDocument: async () => {
                    const { activeDocumentId, documents } = get();
                    if (!activeDocumentId || documents.length <= 1) return;
                    try {
                        const token = useAuthStore.getState().token;
                        if (!token) {
                            throw new Error('No authentication token found. Please log in.');
                        }
                        const checkResponse = await fetch(`${API_BASE_URL}/api/documents/${activeDocumentId}`, {
                            method: 'GET',
                            headers: {
                                'Authorization': `Bearer ${token}`,
                                'Content-Type': 'application/json',
                            },
                        });
                        if (checkResponse.ok) {
                            const deleteResponse = await fetch(`${API_BASE_URL}/api/documents/${activeDocumentId}`, {
                                method: 'DELETE',
                                headers: {
                                    'Authorization': `Bearer ${token}`,
                                    'Content-Type': 'application/json',
                                },
                            });
                            if (!deleteResponse.ok) {
                                const errorData = await deleteResponse.json();
                                throw new Error(errorData.error || 'Failed to delete active document');
                            }
                        }
                        const newDocuments = documents.filter((doc) => doc.id !== activeDocumentId);
                        set({
                            documents: newDocuments,
                            activeDocumentId: newDocuments[0].id,
                            unsavedChanges: get().unsavedChanges.filter((docId) => docId !== activeDocumentId),
                            lastSavedState: Object.fromEntries(
                                Object.entries(get().lastSavedState).filter(([key]) => key !== activeDocumentId)
                            ),
                        });

                    } catch (error: any) {
                        if (error.message.includes('404') || error.message.includes('Document not found')) {
                            const newDocuments = documents.filter((doc) => doc.id !== activeDocumentId);
                            set({
                                documents: newDocuments,
                                activeDocumentId: newDocuments[0].id,
                                unsavedChanges: get().unsavedChanges.filter((docId) => docId !== activeDocumentId),
                                lastSavedState: Object.fromEntries(
                                    Object.entries(get().lastSavedState).filter(([key]) => key !== activeDocumentId)
                                ),
                            });

                        } else {
                            console.error('Failed to delete active document:', error);
                            throw error;
                        }
                    }
                },

                reopenDocument: (id: string) => {
                    const { closedDocuments, documents } = get();
                    const documentToReopen = closedDocuments.find((doc) => doc.id === id);
                    if (!documentToReopen) return;
                    set({
                        closedDocuments: closedDocuments.filter((doc) => doc.id !== id),
                        documents: [...documents, documentToReopen],
                        activeDocumentId: id,
                    });

                },

                renameDocument: (id: string, name: string) => {
                    set((state) => ({
                        documents: state.documents.map((doc) =>
                            doc.id === id ? { ...doc, name } : doc
                        ),
                    }));

                },
                setActiveDocument: async (id: string) => {
                    const state = get();
                    const { documents, syncUnauthorizedDocument } = state;

                    try {
                        // Step 1: Try to load unauthorized document safely
                        const unauthorizedDoc = typeof loadUnauthorizedDocument === 'function'
                            ? loadUnauthorizedDocument()
                            : null;

                        if (unauthorizedDoc && unauthorizedDoc.id === id) {
                            console.log(`Syncing unauthorized document ${id} before setting as active`);

                            if (typeof syncUnauthorizedDocument === 'function') {
                                await syncUnauthorizedDocument();
                            } else {
                                console.warn('syncUnauthorizedDocument is not defined — skipping sync');
                            }

                            // Re-fetch latest state after sync (to avoid stale references)
                            const updatedState = get();
                            if (updatedState.documents?.some(doc => doc.id === id)) {
                                set({ activeDocumentId: id });
                                return;
                            }
                        }

                        // Step 2: Handle case where document isn't in memory
                        const currentDocuments = get().documents;
                        if (!currentDocuments.some(doc => doc.id === id)) {
                            console.warn(`Document ID ${id} not found, attempting to fetch`);
                            const document = await fetchDocument(id);

                            if (!document) {
                                console.warn('Document not found, resetting to first document');
                                set({ activeDocumentId: currentDocuments[0]?.id || null });
                                return;
                            }

                            set({
                                documents: [...currentDocuments, document],
                                activeDocumentId: id,
                            });
                        } else {
                            // Step 3: Normal path — document already exists
                            set({ activeDocumentId: id });
                        }
                    } catch (error) {
                        console.error(`Error in setActiveDocument for ID ${id}:`, error);
                        // Optional: fail-safe fallback
                        const fallbackDocs = get().documents;
                        set({ activeDocumentId: fallbackDocs[0]?.id || null });
                    }
                },


                markUnsaved: (id: string) => {
                    set((state) => ({
                        unsavedChanges: state.unsavedChanges.includes(id) ? state.unsavedChanges : [...state.unsavedChanges, id],
                    }));

                },

                markSaved: (id: string, nodes: any[], edges: any[]) => {
                    set((state) => ({
                        unsavedChanges: state.unsavedChanges.filter((docId) => docId !== id),
                        lastSavedState: {
                            ...state.lastSavedState,
                            [id]: { nodes: JSON.parse(JSON.stringify(nodes)), edges: JSON.parse(JSON.stringify(edges)) },
                        },
                        isAutoSaving: false,
                    }));

                },

                clearUnsavedChanges: () => {
                    set({ unsavedChanges: [] });

                },

                saveDocument: async (id: string, state: CanvasState) => {
                    const { isAuthenticated } = useAuthStore.getState();
                    try {
                        set({ isAutoSaving: true }); // Set isAutoSaving to show Loader2 icon
                        if (!isAuthenticated) {
                            const doc = get().documents.find((d) => d.id === id);
                            if (doc) {
                                const validatedState: CanvasState = {
                                    nodes: Array.isArray(state.nodes) ? state.nodes : [],
                                    edges: Array.isArray(state.edges) ? state.edges : [],
                                    selectedNodes: Array.isArray(state.selectedNodes) ? state.selectedNodes : [],
                                    selectedEdges: Array.isArray(state.selectedEdges) ? state.selectedEdges : [],
                                    viewport: state.viewport || { x: 0, y: 0, scale: 1 },
                                    tool: state.tool || 'select',
                                    isConnecting: state.isConnecting || false,
                                    connectionSource: state.connectionSource || null,
                                    history: Array.isArray(state.history) ? state.history : [],
                                    historyIndex: state.historyIndex || -1,
                                    isDragging: state.isDragging || false,
                                    isPanning: state.isPanning || false,
                                    selectionBox: state.selectionBox || null,
                                };
                                const updatedDoc = { ...doc, state: validatedState };
                                saveTempDocumentToSession(updatedDoc); // Save to session storage for unauthenticated users
                                saveUnauthorizedDocument(updatedDoc); // Save to local storage for unauthenticated users
                                set((state) => ({
                                    documents: state.documents.map((d) => (d.id === id ? updatedDoc : d)),
                                    unsavedChanges: state.unsavedChanges.filter((docId) => docId !== id),
                                    lastSavedState: {
                                        ...state.lastSavedState,
                                        [id]: {
                                            nodes: JSON.parse(JSON.stringify(validatedState.nodes)),
                                            edges: JSON.parse(JSON.stringify(validatedState.edges)),
                                        },
                                    },
                                    isAutoSaving: false, // Reset after save
                                }));
                                return; // Exit after handling unauthenticated save
                            }
                            throw new Error('Document not found');
                        }
                        const token = useAuthStore.getState().token;
                        if (!token) {
                            throw new Error('No authentication token found. Please log in.');
                        }
                        const validatedState: CanvasState = {
                            nodes: Array.isArray(state.nodes) ? state.nodes : [],
                            edges: Array.isArray(state.edges) ? state.edges : [],
                            selectedNodes: Array.isArray(state.selectedNodes) ? state.selectedNodes : [],
                            selectedEdges: Array.isArray(state.selectedEdges) ? state.selectedEdges : [],
                            viewport: state.viewport || { x: 0, y: 0, scale: 1 },
                            tool: state.tool || 'select',
                            isConnecting: state.isConnecting || false,
                            connectionSource: state.connectionSource || null,
                            history: Array.isArray(state.history) ? state.history : [],
                            historyIndex: state.historyIndex || -1,
                            isDragging: state.isDragging || false,
                            isPanning: state.isPanning || false,
                            selectionBox: state.selectionBox || null,
                        };
                        const payload = {
                            id,
                            name: get().documents.find((doc) => doc.id === id)?.name || 'Untitled',
                            state: validatedState,
                        };

                        const checkResponse = await fetch(`${API_BASE_URL}/api/documents/${id}`, {
                            method: 'GET',
                            headers: {
                                'Authorization': `Bearer ${token}`,
                                'Content-Type': 'application/json',
                            },
                        });
                        let method = 'POST';
                        if (checkResponse.ok) {
                            method = 'PUT';
                        } else if (checkResponse.status !== 404) {
                            const errorData = await checkResponse.json();
                            throw new Error(errorData.error || 'Failed to check document existence');
                        }
                        const response = await fetch(`${API_BASE_URL}/api/documents`, {
                            method,
                            headers: {
                                'Authorization': `Bearer ${token}`,
                                'Content-Type': 'application/json',
                            },
                            body: JSON.stringify(payload),
                        });
                        if (!response.ok) {
                            const errorData = await response.json();
                            console.error('Backend error response:', errorData);
                            throw new Error(errorData.error || `Failed to save document: ${response.status}`);
                        }
                        await response.json();

                        set((state) => {
                            const updatedUnsaved = state.unsavedChanges.filter((docId) => docId !== id);
                            const newLastSaved = {
                                ...state.lastSavedState,
                                [id]: {
                                    nodes: JSON.parse(JSON.stringify(validatedState.nodes)),
                                    edges: JSON.parse(JSON.stringify(validatedState.edges)),
                                },
                            };
                            const currentDoc = state.documents.find((d) => d.id === id);
                            let finalUnsaved = updatedUnsaved;
                            if (currentDoc) {
                                const currentNodesStr = JSON.stringify(currentDoc.state.nodes);
                                const currentEdgesStr = JSON.stringify(currentDoc.state.edges);
                                const savedNodesStr = JSON.stringify(newLastSaved[id].nodes);
                                const savedEdgesStr = JSON.stringify(newLastSaved[id].edges);
                                const hasPendingChanges = currentNodesStr !== savedNodesStr || currentEdgesStr !== savedEdgesStr;
                                if (hasPendingChanges) {
                                    finalUnsaved = [...updatedUnsaved, id];
                                }
                            }
                            return {
                                unsavedChanges: finalUnsaved,
                                lastSavedState: newLastSaved,
                                isAutoSaving: false, // Reset after save
                            };
                        });
                    } catch (error: any) {
                        console.error('Failed to save document:', error.message, error.stack);
                        set({ isAutoSaving: false }); // Reset on error
                        throw new Error(`Failed to save document: ${error.message}`);
                    }
                },

                loadDocuments: async () => {
                    try {
                        await get().syncUnauthorizedDocument();
                        const token = useAuthStore.getState().token;
                        if (!token) {
                            console.warn('No authentication token found. Resetting to default document.');
                            get().reset();
                            return;
                        }
                        const response = await fetch(`${API_BASE_URL}/api/documents`, {
                            method: 'GET',
                            headers: {
                                'Authorization': `Bearer ${token}`,
                                'Content-Type': 'application/json',
                            },
                        });
                        if (!response.ok) {
                            const errorData = await response.json();
                            throw new Error(errorData.error || 'Failed to load documents');
                        }
                        const backendDocs = await response.json();
                        const sanitizedDocs: Document[] = backendDocs.map((doc: any) => ({
                            id: doc.id || uuidv4(),
                            name: doc.name || `Page ${backendDocs.length + 1}`,
                            state: {
                                nodes: Array.isArray(doc.state?.nodes) ? doc.state.nodes : [],
                                edges: Array.isArray(doc.state?.edges) ? doc.state.edges : [],
                                selectedNodes: Array.isArray(doc.state?.selectedNodes) ? doc.state.selectedNodes : [],
                                selectedEdges: Array.isArray(doc.state?.selectedEdges) ? doc.state.selectedEdges : [],
                                viewport: doc.state?.viewport || { x: 0, y: 0, scale: 1 },
                                tool: doc.state?.tool && ['select', 'line'].includes(doc.state.tool) ? doc.state.tool : 'select',
                                isConnecting: doc.state?.isConnecting || false,
                                connectionSource: doc.state?.connectionSource || null,
                                history: Array.isArray(doc.state?.history) ? doc.state.history : [],
                                historyIndex: doc.state?.historyIndex || -1,
                                isDragging: doc.state?.isDragging || false,
                                isPanning: doc.state?.isPanning || false,
                                selectionBox: doc.state?.selectionBox || null,
                            },
                        }));
                        const newLastSavedState = sanitizedDocs.reduce((acc, doc) => ({
                            ...acc,
                            [doc.id]: {
                                nodes: JSON.parse(JSON.stringify(doc.state.nodes)),
                                edges: JSON.parse(JSON.stringify(doc.state.edges)),
                            },
                        }), {});
                        if (sanitizedDocs.length > 0) {
                            set({
                                documents: sanitizedDocs,
                                activeDocumentId: sanitizedDocs[0].id,
                                unsavedChanges: [],
                                lastSavedState: newLastSavedState,
                                isAutoSaving: false,
                            });

                        } else {

                            get().reset();
                        }
                    } catch (error) {
                        console.error('Failed to load documents:', error);
                        get().reset();
                    }
                },

                reset: () => {
                    const newDocId = uuidv4();
                    const defaultDocument: Document = {
                        id: newDocId,
                        name: 'Page 1',
                        state: {
                            nodes: [],
                            edges: [],
                            selectedNodes: [],
                            selectedEdges: [],
                            viewport: { x: 0, y: 0, scale: 1 },
                            tool: 'select',
                            isConnecting: false,
                            connectionSource: null,
                            history: [],
                            historyIndex: -1,
                            isDragging: false,
                            isPanning: false,
                            selectionBox: null,
                        },
                    };
                    // Clear session storage and unauthorized storage on reset
                    sessionStorage.removeItem(SESSION_STORAGE_KEY);
                    localStorage.removeItem(UNAUTHORIZED_STORAGE_KEY);
                    set({
                        documents: [defaultDocument],
                        closedDocuments: [],
                        activeDocumentId: newDocId,
                        unsavedChanges: [],
                        lastSavedState: { [newDocId]: { nodes: [], edges: [] } },
                        isAutoSaving: false,
                    });

                },

                updateDocumentState: (id: string, state: Partial<CanvasState>) => {
                    set((store) => {
                        const updatedDocuments = store.documents.map((doc) =>
                            doc.id === id ? { ...doc, state: { ...doc.state, ...state } } : doc
                        );
                        // Save to session storage and unauthorized storage if not authenticated
                        if (!useAuthStore.getState().isAuthenticated) {
                            const activeDoc = updatedDocuments.find((doc) => doc.id === id);
                            if (activeDoc) {
                                saveTempDocumentToSession(activeDoc);
                                saveUnauthorizedDocument(activeDoc);
                            }
                            return {
                                documents: updatedDocuments,
                                isAutoSaving: false, // Add this line
                            };
                        }
                        // Trigger auto-save for authenticated users
                        const currentLastSaved = store.lastSavedState[id] || { nodes: [], edges: [] };
                        const newNodes = state.nodes ?? store.documents.find(doc => doc.id === id)?.state.nodes ?? [];
                        const newEdges = state.edges ?? store.documents.find(doc => doc.id === id)?.state.edges ?? [];
                        const nodesChanged = JSON.stringify(newNodes) !== JSON.stringify(currentLastSaved.nodes);
                        const edgesChanged = JSON.stringify(newEdges) !== JSON.stringify(currentLastSaved.edges);
                        const hasContentChanged = nodesChanged || edgesChanged;
                        const newUnsavedChanges = hasContentChanged && !store.unsavedChanges.includes(id)
                            ? [...store.unsavedChanges, id]
                            : store.unsavedChanges;
                        if (hasContentChanged) {
                            debouncedAutoSave(id); // Delay to batch changes
                            return {
                                documents: updatedDocuments,
                                unsavedChanges: newUnsavedChanges,
                                isAutoSaving: true, // Add this line
                            };
                        }
                        return {
                            documents: updatedDocuments,
                            unsavedChanges: newUnsavedChanges,
                            isAutoSaving: false, // Add this line
                        };
                    });
                },


                syncUnauthorizedDocument: async () => {
                    const unauthorizedDoc = loadUnauthorizedDocument();
                    if (!unauthorizedDoc) {
                        console.log('No unauthorized document to sync');
                        return;
                    }
                    console.log('Syncing unauthorized document:', unauthorizedDoc.id);
                    const { isAuthenticated, token } = useAuthStore.getState();
                    if (!isAuthenticated || !token) {
                        console.log('User not authenticated, skipping sync');
                        return;
                    }
                    try {
                        set({ isAutoSaving: true });
                        const validatedState: CanvasState = {
                            nodes: Array.isArray(unauthorizedDoc.state.nodes) ? unauthorizedDoc.state.nodes : [],
                            edges: Array.isArray(unauthorizedDoc.state.edges) ? unauthorizedDoc.state.edges : [],
                            selectedNodes: Array.isArray(unauthorizedDoc.state.selectedNodes) ? unauthorizedDoc.state.selectedNodes : [],
                            selectedEdges: Array.isArray(unauthorizedDoc.state.selectedEdges) ? unauthorizedDoc.state.selectedEdges : [],
                            viewport: unauthorizedDoc.state.viewport || { x: 0, y: 0, scale: 1 },
                            tool: unauthorizedDoc.state.tool || 'select',
                            isConnecting: unauthorizedDoc.state.isConnecting || false,
                            connectionSource: unauthorizedDoc.state.connectionSource || null,
                            history: Array.isArray(unauthorizedDoc.state.history) ? unauthorizedDoc.state.history : [],
                            historyIndex: unauthorizedDoc.state.historyIndex || -1,
                            isDragging: unauthorizedDoc.state.isDragging || false,
                            isPanning: unauthorizedDoc.state.isPanning || false,
                            selectionBox: unauthorizedDoc.state.selectionBox || null,
                        };
                        const payload = {
                            id: unauthorizedDoc.id,
                            name: unauthorizedDoc.name,
                            state: validatedState,
                        };
                        console.log('Checking document existence:', unauthorizedDoc.id);
                        const checkResponse = await fetch(`${API_BASE_URL}/api/documents/${unauthorizedDoc.id}`, {
                            method: 'GET',
                            headers: {
                                'Authorization': `Bearer ${token}`,
                                'Content-Type': 'application/json',
                            },
                        });
                        let method = 'POST';
                        if (checkResponse.ok) {
                            method = 'PUT';
                            console.log('Document exists, using PUT');
                        } else if (checkResponse.status === 404) {
                            console.log('Document not found, using POST');
                        } else {
                            const errorData = await checkResponse.json();
                            console.error('Error checking document existence:', errorData);
                            throw new Error(errorData.error || 'Failed to check document existence');
                        }
                        console.log(`Saving document with ${method}:`, unauthorizedDoc.id);
                        const response = await fetch(`${API_BASE_URL}/api/documents`, {
                            method,
                            headers: {
                                'Authorization': `Bearer ${token}`,
                                'Content-Type': 'application/json',
                            },
                            body: JSON.stringify(payload),
                        });
                        if (!response.ok) {
                            const errorData = await response.json();
                            console.error('Backend error response:', errorData);
                            throw new Error(errorData.error || 'Failed to sync unauthorized document');
                        }
                        const savedDocument = await response.json();
                        console.log('Document synced successfully:', unauthorizedDoc.id);
                        set((state) => {
                            const existingDocIndex = state.documents.findIndex((doc) => doc.id === unauthorizedDoc.id);
                            let newDocuments = [...state.documents];
                            if (existingDocIndex !== -1) {
                                newDocuments[existingDocIndex] = { ...unauthorizedDoc, state: validatedState };
                            } else {
                                newDocuments = [...state.documents, { ...unauthorizedDoc, state: validatedState }];
                            }
                            return {
                                documents: newDocuments,
                                activeDocumentId: unauthorizedDoc.id,
                                unsavedChanges: state.unsavedChanges.filter((docId) => docId !== unauthorizedDoc.id),
                                lastSavedState: {
                                    ...state.lastSavedState,
                                    [unauthorizedDoc.id]: {
                                        nodes: JSON.parse(JSON.stringify(validatedState.nodes)),
                                        edges: JSON.parse(JSON.stringify(validatedState.edges)),
                                    },
                                },
                                isAutoSaving: false,
                            };
                        });
                        localStorage.removeItem(UNAUTHORIZED_STORAGE_KEY);
                    } catch (error) {
                        console.error('Failed to sync unauthorized document:', error);
                        set({ isAutoSaving: false });
                        sessionStorage.removeItem(SESSION_STORAGE_KEY);
                        localStorage.removeItem(UNAUTHORIZED_STORAGE_KEY);
                        get().reset();
                    }
                },
            };
        },
        {
            name: 'document-storage',
            storage: createJSONStorage(() => localStorage),
        }
    )
);  