import React, { createContext, useState, useContext, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { getCurrentUserProfile } from '@/lib/db';

const AuthContext = createContext();
const isAuthLockError = (error) => {
  const name = error?.name || '';
  const message = error?.message || '';
  return name.includes('NavigatorLockAcquireTimeoutError') || message.includes('another request stole it');
};
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
      if (isAuthLockError(error)) {
        // Lock contention should not block UI; send user to login screen.
        setUser(null);
        setIsAuthenticated(false);
        setAuthError(null);
        return;
      }
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

  const login = async (email, password) => {
    try {
      setAuthError(null);
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;
      return { ok: true };
    } catch (error) {
      setAuthError({
        type: 'auth_required',
        message: error.message || 'Authentication failed',
      });
      return { ok: false, error };
    }
  };

  const signup = async (email, password, fullName) => {
    try {
      setAuthError(null);
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: fullName || '' },
          emailRedirectTo: window.location.origin,
        },
      });
      if (error) throw error;
      return {
        ok: true,
        needsEmailConfirm: !data.session,
      };
    } catch (error) {
      setAuthError({
        type: 'auth_required',
        message: error.message || 'Sign up failed',
      });
      return { ok: false, error };
    }
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setIsAuthenticated(false);
    window.location.href = '/';
  };

  const navigateToLogin = () => {
    setAuthError({
      type: 'auth_required',
      message: 'Please log in to continue',
    });
  };

  return (
    <AuthContext.Provider value={{ 
      user,
      isAuthenticated,
      isLoading,
      login,
      signup,
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
