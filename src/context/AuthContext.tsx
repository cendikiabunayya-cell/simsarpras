import React, { createContext, useContext, useEffect, useState } from 'react';
import { UserProfile, UserRole } from '../types';
import { api, IS_MOCK_MODE, MOCK_NOTICE_MESSAGE, getStoredToken } from '../services/api';
import { MOCK_USERS } from '../data/mockData';

interface AuthContextType {
  currentUser: UserProfile;
  allUsers: UserProfile[];
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (identifier: string, password: string) => Promise<UserProfile>;
  logout: () => Promise<void>;
  switchUser: (user: UserProfile) => Promise<void>;
  switchRole: (role: UserRole) => Promise<void>;
  isMock: boolean;
  mockNotice: string;
  canApproveLoans: boolean;
  canManageAssets: boolean;
  canReceiveReturns: boolean;
  canInspectReturns: boolean;
  canViewExecutiveReports: boolean;
  resetAllMockData: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<UserProfile>(MOCK_USERS[0]);
  const [allUsers] = useState<UserProfile[]>(MOCK_USERS);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(IS_MOCK_MODE || Boolean(getStoredToken()));
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    let isMounted = true;
    const initAuth = async () => {
      try {
        if (IS_MOCK_MODE) {
          const user = await api.getCurrentUser();
          if (isMounted) {
            setCurrentUser(user);
            setIsAuthenticated(true);
          }
        } else {
          const token = getStoredToken();
          if (token) {
            const user = await api.getCurrentUser();
            if (isMounted) {
              setCurrentUser(user);
              setIsAuthenticated(true);
            }
          } else {
            if (isMounted) {
              setIsAuthenticated(false);
            }
          }
        }
      } catch (err) {
        console.warn('[AuthContext] Sesi awal tidak dapat dimuat:', err);
        if (isMounted) {
          setIsAuthenticated(false);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    initAuth();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleLogin = async (identifier: string, password: string): Promise<UserProfile> => {
    setIsLoading(true);
    try {
      const res = await api.login(identifier, password);
      setCurrentUser(res.user);
      setIsAuthenticated(true);
      return res.user;
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
    setIsLoading(true);
    try {
      await api.logout();
    } finally {
      setIsAuthenticated(false);
      if (IS_MOCK_MODE) {
        setCurrentUser(MOCK_USERS[0]);
      }
      setIsLoading(false);
    }
  };

  const handleSwitchUser = async (user: UserProfile) => {
    await api.switchUser(user);
    setCurrentUser(user);
    setIsAuthenticated(true);
  };

  const handleSwitchRole = async (role: UserRole) => {
    const userWithRole = allUsers.find((u) => u.role === role) || allUsers[0];
    await handleSwitchUser(userWithRole);
  };

  const resetAllMockData = () => {
    api.resetMockData();
    window.location.reload();
  };

  const canApproveLoans = currentUser.role === 'ADMIN_SARPRAS';
  const canManageAssets = currentUser.role === 'ADMIN_SARPRAS';
  const canReceiveReturns = currentUser.role === 'ADMIN_SARPRAS';
  const canInspectReturns = currentUser.role === 'ADMIN_SARPRAS';
  const canViewExecutiveReports =
    currentUser.role === 'ADMIN_SARPRAS' || currentUser.role === 'KEPALA_SEKOLAH';

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        allUsers,
        isAuthenticated,
        isLoading,
        login: handleLogin,
        logout: handleLogout,
        switchUser: handleSwitchUser,
        switchRole: handleSwitchRole,
        isMock: IS_MOCK_MODE,
        mockNotice: MOCK_NOTICE_MESSAGE,
        canApproveLoans,
        canManageAssets,
        canReceiveReturns,
        canInspectReturns,
        canViewExecutiveReports,
        resetAllMockData,
      }}
    >
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

