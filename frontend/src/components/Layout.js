import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import styled from 'styled-components';
import { useAuth } from '../contexts/AuthContext';
import { theme } from '../styles/theme';

const LayoutContainer = styled.div`
  display: flex;
  min-height: 100vh;
`;

const Sidebar = styled.aside`
  width: 250px;
  background-color: #1e293b;
  color: white;
  padding: ${theme.spacing.lg};
  display: flex;
  flex-direction: column;
`;

const Logo = styled.div`
  font-size: 1.25rem;
  font-weight: 600;
  margin-bottom: ${theme.spacing.xl};
  padding-bottom: ${theme.spacing.lg};
  border-bottom: 1px solid #334155;
`;

const Nav = styled.nav`
  flex: 1;
`;

const NavItem = styled(NavLink)`
  display: flex;
  align-items: center;
  padding: ${theme.spacing.sm} ${theme.spacing.md};
  margin-bottom: ${theme.spacing.xs};
  border-radius: ${theme.borderRadius.md};
  color: #cbd5e1;
  transition: all 0.2s;
  
  &:hover {
    background-color: #334155;
    color: white;
  }
  
  &.active {
    background-color: ${theme.colors.primary};
    color: white;
  }
  
  span.icon {
    margin-right: ${theme.spacing.sm};
  }
`;

const UserSection = styled.div`
  padding-top: ${theme.spacing.lg};
  border-top: 1px solid #334155;
`;

const UserInfo = styled.div`
  margin-bottom: ${theme.spacing.md};
  
  .name {
    font-weight: 500;
  }
  
  .role {
    font-size: 0.75rem;
    color: #94a3b8;
    text-transform: uppercase;
  }
`;

const LogoutButton = styled.button`
  width: 100%;
  padding: ${theme.spacing.sm};
  background-color: #334155;
  color: white;
  border: none;
  border-radius: ${theme.borderRadius.md};
  cursor: pointer;
  
  &:hover {
    background-color: #475569;
  }
`;

const MainContent = styled.main`
  flex: 1;
  padding: ${theme.spacing.xl};
  background-color: ${theme.colors.background};
  overflow-y: auto;
`;

const Layout = ({ children }) => {
  const { user, logout, isAdmin, isManager } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <LayoutContainer>
      <Sidebar>
        <Logo>🔐 Secure Vault</Logo>
        
        <Nav>
          <NavItem to="/dashboard">
            <span className="icon">📊</span> Dashboard
          </NavItem>
          
          <NavItem to="/credentials">
            <span className="icon">🔑</span> Credentials
          </NavItem>
          
          {isManager && (
            <NavItem to="/teams">
              <span className="icon">👥</span> Teams
            </NavItem>
          )}
          
          {isAdmin && (
            <>
              <NavItem to="/users">
                <span className="icon">👤</span> Users
              </NavItem>
              
              <NavItem to="/audit-logs">
                <span className="icon">📋</span> Audit Logs
              </NavItem>
            </>
          )}
        </Nav>
        
        <UserSection>
          <UserInfo>
            <div className="name">{user?.fullName}</div>
            <div className="role">{user?.role?.replace('_', ' ')}</div>
          </UserInfo>
          <LogoutButton onClick={handleLogout}>Logout</LogoutButton>
        </UserSection>
      </Sidebar>
      
      <MainContent>{children}</MainContent>
    </LayoutContainer>
  );
};

export default Layout;