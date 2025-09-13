import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useAuthStore } from '@/store/useAuthStore';
import { useDocumentStore } from '@/store/useDocumentStore';
import { LogIn } from 'lucide-react';
import { GoogleAuthProvider, signInWithRedirect, getAuth, getRedirectResult, onAuthStateChanged, setPersistence, browserLocalPersistence, signOut } from 'firebase/auth';
import { initializeApp } from 'firebase/app';

// Backend API base URL
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';

// Firebase configuration
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'missing-api-key',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'missing-auth-domain',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'missing-project-id',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'missing-storage-bucket',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || 'missing-sender-id',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || 'missing-app-id',
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || 'missing-measurement-id',
};

// Validate Firebase configuration
const isFirebaseConfigValid = Object.values(firebaseConfig).every(
  value => value && !value.includes('missing')
);

// Initialize Firebase
let auth;
try {
  if (isFirebaseConfigValid) {
    const app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    setPersistence(auth, browserLocalPersistence).catch((error) => {
      console.error('Failed to set Firebase persistence:', error);
    });
  } else {
    console.error('Firebase configuration is incomplete. Google Sign-In will be disabled.');
  }
} catch (error) {
  console.error('Failed to initialize Firebase:', error);
}

const provider = auth ? new GoogleAuthProvider() : null;

export const AuthDialog: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const { activeDocumentId } = useDocumentStore();
  const { login, register, isAuthenticated, user, setUser, setToken } = useAuthStore();

  const [loginForm, setLoginForm] = useState({
    email: '',
    password: '',
  });

  const [registerForm, setRegisterForm] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
  });

  // Handle Google Sign-In redirect result
  useEffect(() => {
    if (!auth || !provider) return;

    const handleRedirectResult = async () => {
      try {
        setIsLoading(true);
        setError('');
        const result = await getRedirectResult(auth);
        

        if (result && result.user) {
          const idToken = await result.user.getIdToken();
          const response = await fetch(`${API_BASE_URL}/api/auth/google`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ token: idToken }),
          });

          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Google authentication failed');
          }

          const data = await response.json();
          setUser(data.user);
          setToken(data.token);
          setOpen(false);
        }
      } catch (err: any) {
        console.error('Redirect error:', err);
        setError(`Google authentication failed: ${err.message}`);
      } finally {
        setIsLoading(false);
      }
    };

    handleRedirectResult();
  }, [auth, setUser, setToken]);

useEffect(() => {
  const validateToken = async () => {
    const { token, logout } = useAuthStore.getState();
    if (!token) return;

    try {
      const res = await fetch(`${API_BASE_URL}/api/documents`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        console.warn("Token invalid, logging out...");
        logout();
        useDocumentStore.getState().reset();
      }
    } catch (err) {
      console.error("Token validation error:", err);
      logout();
      useDocumentStore.getState().reset();
    }
  };

  validateToken();
}, []);

  // Monitor Firebase auth state changes
  useEffect(() => {
    if (!auth) return;

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser && !isAuthenticated) {
        try {
          if (useAuthStore.getState().token) return;

          const idToken = await firebaseUser.getIdToken();
          const response = await fetch(`${API_BASE_URL}/api/auth/google`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: idToken }),
          });

          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Google authentication failed');
          }

          const data = await response.json();
          setUser(data.user);
          setToken(data.token);
          setOpen(false);
        } catch (err: any) {
          console.error('Auth state change error:', err);
          setError(`Google authentication failed: ${err.message}`);
        }
      }
    });

    return () => unsubscribe();
  }, [auth, isAuthenticated, setUser, setToken]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      await login(loginForm.email, loginForm.password, activeDocumentId);
      setOpen(false);
    } catch (err: any) {
      setError('Invalid email or password');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    if (registerForm.password !== registerForm.confirmPassword) {
      setError('Passwords do not match');
      setIsLoading(false);
      return;
    }

    try {
      await register(registerForm.email, registerForm.password, registerForm.name, activeDocumentId);
      setOpen(false);
    } catch (err: any) {
      setError('Registration failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    if (!auth || !provider) {
      setError('Google Sign-In is not available due to configuration issues');
      return;
    }

    setIsLoading(true);
    setError('');
    
    try {
      await signInWithRedirect(auth, provider);
      
    } catch (err: any) {
      console.error('Google Sign-In error:', err);
      setError(`Google authentication failed: ${err.message}`);
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      
      const { unsavedChanges, documents, saveDocument } = useDocumentStore.getState();
      for (const docId of unsavedChanges) {
        const doc = documents.find((d) => d.id === docId);
        if (doc) {
          
          await saveDocument(doc.id, doc.state);
        }
      }
      if (auth) {
        
        await signOut(auth);
      }
      useAuthStore.getState().logout();
      useDocumentStore.getState().reset();
      
      setLogoutConfirmOpen(false);
    } catch (error: any) {
      console.error('handleLogout: Logout failed:', error);
      setError('Failed to log out. Please try again.');
    }
  };

  return (
    <>
      <div className="flex items-center gap-2">
        {isAuthenticated ? (
          <>
            <Button
              variant="outline"
              size="sm"
             
            >
              {user?.name || user?.email || 'User'}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                
                setLogoutConfirmOpen(true);
              }}
            >
              Logout
            </Button>
          </>
        ) : (
          <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
            <LogIn className="w-4 h-4 mr-2" />
            Login
          </Button>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Authentication</DialogTitle>
            <DialogDescription>
              Login or create an account to save your mind maps permanently. You can create temporary mind maps without signing in.
            </DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="login" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="login">Login</TabsTrigger>
              <TabsTrigger value="register">Register</TabsTrigger>
            </TabsList>

            <TabsContent value="login" className="space-y-4">
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={loginForm.email}
                    onChange={(e) =>
                      setLoginForm({ ...loginForm, email: e.target.value })
                    }
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    value={loginForm.password}
                    onChange={(e) =>
                      setLoginForm({ ...loginForm, password: e.target.value })
                    }
                    required
                  />
                </div>
                {auth && (
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    onClick={handleGoogleSignIn}
                    disabled={isLoading}
                  >
                    Sign in with Google
                  </Button>
                )}
                {error && (
                  <p className="text-sm text-destructive">{error}</p>
                )}
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? 'Logging in...' : 'Login'}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="register" className="space-y-4">
              <form onSubmit={handleRegister} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Name</Label>
                  <Input
                    id="name"
                    type="text"
                    value={registerForm.name}
                    onChange={(e) =>
                      setRegisterForm({ ...registerForm, name: e.target.value })
                    }
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="reg-email">Email</Label>
                  <Input
                    id="reg-email"
                    type="email"
                    value={registerForm.email}
                    onChange={(e) =>
                      setRegisterForm({ ...registerForm, email: e.target.value })
                    }
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="reg-password">Password</Label>
                  <Input
                    id="reg-password"
                    type="password"
                    value={registerForm.password}
                    onChange={(e) =>
                      setRegisterForm({ ...registerForm, password: e.target.value })
                    }
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirm-password">Confirm Password</Label>
                  <Input
                    id="confirm-password"
                    type="password"
                    value={registerForm.confirmPassword}
                    onChange={(e) =>
                      setRegisterForm({
                        ...registerForm,
                        confirmPassword: e.target.value,
                      })
                    }
                    required
                  />
                </div>
                {auth && (
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    onClick={handleGoogleSignIn}
                    disabled={isLoading}
                  >
                    Sign in with Google
                  </Button>
                )}
                {error && (
                  <p className="text-sm text-destructive">{error}</p>
                )}
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? 'Creating account...' : 'Register'}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      <Dialog open={logoutConfirmOpen} onOpenChange={setLogoutConfirmOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Confirm Log Out</DialogTitle>
            <DialogDescription>
              Are you sure you want to log out? All unsaved changes will be saved before logging out.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button
              variant="secondary"
              onClick={() => {
                
                setLogoutConfirmOpen(false);
              }}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                
                handleLogout();
              }}
            >
              Log Out
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};