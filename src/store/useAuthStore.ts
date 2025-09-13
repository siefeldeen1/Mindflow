import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { useDocumentStore } from '@/store/useDocumentStore';
import { CanvasState } from '@/types';

// Backend API base URL
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';

// Define the User type
interface User {
  id: string;
  email: string;
  name: string;
}

// Define the AuthStore interface
interface AuthStore {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  setUser: (user: User | null) => void;
  setToken: (token: string | null) => void;
  login: (email: string, password: string, activeDocId: string) => Promise<void>;
  register: (email: string, password: string, name: string, activeDocId: string) => Promise<void>;
  logout: () => void;
}

// Create the Zustand store with persistence
export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      setUser: (user: User | null) => {
        set({ user, isAuthenticated: !!user });
      },
      setToken: (token: string | null) => {
        set({ token });
      },
      login: async (email: string, password: string, activeDocId: string) => {
        try {
          const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password }),
          });

          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Login failed');
          }

          const data = await response.json();
          set({ user: data.user, token: data.token, isAuthenticated: true });

          const documentStore = useDocumentStore.getState();
          const activeDoc = documentStore.documents.find((doc) => doc.id === activeDocId);
          if (activeDoc && documentStore.unsavedChanges.includes(activeDoc.id)) {
            const state: CanvasState = {
              nodes: Array.isArray(activeDoc.state.nodes) ? activeDoc.state.nodes : [],
              edges: Array.isArray(activeDoc.state.edges) ? activeDoc.state.edges : [],
              selectedNodes: Array.isArray(activeDoc.state.selectedNodes) ? activeDoc.state.selectedNodes : [],
              selectedEdges: Array.isArray(activeDoc.state.selectedEdges) ? activeDoc.state.selectedEdges : [],
              viewport: activeDoc.state.viewport || { x: 0, y: 0, scale: 1 },
              tool: activeDoc.state.tool || 'select',
              isConnecting: activeDoc.state.isConnecting || false,
              connectionSource: activeDoc.state.connectionSource || null,
              history: Array.isArray(activeDoc.state.history) ? activeDoc.state.history : [],
              historyIndex: activeDoc.state.historyIndex || -1,
              isDragging: activeDoc.state.isDragging || false,
              isPanning: activeDoc.state.isPanning || false,
              selectionBox: activeDoc.state.selectionBox || null,
            };

            await documentStore.saveDocument(activeDoc.id, state);
            sessionStorage.removeItem('temp-document');
            await documentStore.syncUnauthorizedDocument();
            await documentStore.loadDocuments();
            setTimeout(() => {
              documentStore.setActiveDocument(activeDoc.id);

              const updatedDoc = documentStore.documents.find((doc) => doc.id === activeDoc.id);

            }, 0);
          } else {
            await documentStore.syncUnauthorizedDocument();
            await documentStore.loadDocuments();

          }
        } catch (error: any) {
          console.error('Login error:', error);
          throw error;
        }
      },
      register: async (email: string, password: string, name: string, activeDocId: string) => {
        try {
          const response = await fetch(`${API_BASE_URL}/api/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password, name }),
          });

          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Registration failed');
          }

          const data = await response.json();
          set({ user: data.user, token: data.token, isAuthenticated: true });

          const documentStore = useDocumentStore.getState();
          const activeDoc = documentStore.documents.find((doc) => doc.id === activeDocId);
          if (activeDoc && documentStore.unsavedChanges.includes(activeDoc.id)) {
            const state: CanvasState = {
              nodes: Array.isArray(activeDoc.state.nodes) ? activeDoc.state.nodes : [],
              edges: Array.isArray(activeDoc.state.edges) ? activeDoc.state.edges : [],
              selectedNodes: Array.isArray(activeDoc.state.selectedNodes) ? activeDoc.state.selectedNodes : [],
              selectedEdges: Array.isArray(activeDoc.state.selectedEdges) ? activeDoc.state.selectedEdges : [],
              viewport: activeDoc.state.viewport || { x: 0, y: 0, scale: 1 },
              tool: activeDoc.state.tool || 'select',
              isConnecting: activeDoc.state.isConnecting || false,
              connectionSource: activeDoc.state.connectionSource || null,
              history: Array.isArray(activeDoc.state.history) ? activeDoc.state.history : [],
              historyIndex: activeDoc.state.historyIndex || -1,
              isDragging: activeDoc.state.isDragging || false,
              isPanning: activeDoc.state.isPanning || false,
              selectionBox: activeDoc.state.selectionBox || null,
            };

            await documentStore.saveDocument(activeDoc.id, state);
            sessionStorage.removeItem('temp-document');
            await documentStore.syncUnauthorizedDocument();
            await documentStore.loadDocuments();
            setTimeout(() => {
              documentStore.setActiveDocument(activeDoc.id);

              const updatedDoc = documentStore.documents.find((doc) => doc.id === activeDoc.id);

            }, 0);
          } else {
            await documentStore.syncUnauthorizedDocument();
            await documentStore.loadDocuments();

          }
        } catch (error: any) {
          console.error('Registration error:', error);
          throw error;
        }
      },
      logout: () => {
        set({ user: null, token: null, isAuthenticated: false });

      },
    }),
    {
      name: 'auth-storage',
      getStorage: () => localStorage,
    }
  )
);