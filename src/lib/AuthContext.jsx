import React, { createContext, useState, useContext, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { getCurrentUserProfile } from '@/lib/db';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [authError, setAuthError] = useState(null);

  useEffect(() => {
    checkAuth();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!session) {
        setUser(null);
        setIsAuthenticated(false);
        return;
      }
      const profileUser = await getCurrentUserProfile();
      setUser(profileUser);
      setIsAuthenticated(true);
    });
    return () => subscription.unsubscribe();
  }, []);

  const checkAuth = async () => {
    try {
      setIsLoading(true);
      setAuthError(null);
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        setUser(null);
        setIsAuthenticated(false);
      } else {
        const profileUser = await getCurrentUserProfile();
        setUser(profileUser);
        setIsAuthenticated(true);
      }
    } catch (error) {
      console.error('Supabase auth check failed:', error);
      setAuthError({
        type: 'auth_required',
        message: error.message || 'Authentication required',
      });
      setUser(null);
      setIsAuthenticated(false);
    } finally {
      setIsLoading(false);
    }
  };

  const login = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    });
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setIsAuthenticated(false);
    window.location.href = '/';
  };

  const navigateToLogin = () => {
    login();
  };

  return (
    <AuthContext.Provider value={{ 
      user,
      isAuthenticated,
      isLoading,
      login,
      logout,
      // Backward compatibility for existing screens.
      isLoadingAuth: isLoading,
      isLoadingPublicSettings: false,
      authError,
      navigateToLogin,
      checkAppState: checkAuth,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
