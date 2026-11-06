import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import styled from 'styled-components';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';
import Card, { CardHeader, CardTitle, CardBody } from '../components/Card';
import { theme } from '../styles/theme';

const DashboardContainer = styled.div`
  h1 {
    margin-bottom: ${theme.spacing.xl};
  }
`;

const StatsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: ${theme.spacing.lg};
  margin-bottom: ${theme.spacing.xl};
`;

const StatCard = styled(Card)`
  display: flex;
  align-items: center;
  justify-content: space-between;
`;

const StatInfo = styled.div`
  h3 {
    font-size: 0.875rem;
    color: ${theme.colors.textLight};
    margin-bottom: ${theme.spacing.xs};
  }
  
  .value {
    font-size: 2rem;
    font-weight: 600;
    color: ${theme.colors.text};
  }
`;

const StatIcon = styled.div`
  font-size: 2.5rem;
  opacity: 0.8;
`;

const RecentSection = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: ${theme.spacing.lg};
  
  @media (max-width: 1024px) {
    grid-template-columns: 1fr;
  }
`;

const CredentialList = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${theme.spacing.sm};
`;

const CredentialItem = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: ${theme.spacing.sm} ${theme.spacing.md};
  background-color: ${theme.colors.background};
  border-radius: ${theme.borderRadius.md};
  cursor: pointer;
  transition: background-color 0.2s;

  &:hover {
    background-color: ${theme.colors.border};
  }
  
  .info {
    h4 {
      font-size: 0.875rem;
      margin-bottom: 2px;
    }
    
    span {
      font-size: 0.75rem;
      color: ${theme.colors.textLight};
    }
  }
  
  .type {
    font-size: 0.75rem;
    padding: 2px 8px;
    background-color: ${theme.colors.primary};
    color: white;
    border-radius: 12px;
  }
`;

const ActionList = styled.ul`
  list-style: none;
  padding: 0;
  margin: 0;
`;

const ActionItem = styled.li`
  margin-bottom: ${theme.spacing.sm};
  padding: ${theme.spacing.sm} ${theme.spacing.md};
  border-radius: ${theme.borderRadius.md};
  color: ${theme.colors.primary};
  font-weight: 500;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
  transition: background-color 0.2s;

  &:hover {
    background-color: ${theme.colors.background};
    text-decoration: underline;
  }
`;

const DashboardPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    totalCredentials: 0,
    myCredentials: 0,
    teamCredentials: 0,
    sharedWithMe: 0,
  });
  const [recentCredentials, setRecentCredentials] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      // Fetch credentials with different filters
      const [allCreds, myCreds] = await Promise.all([
        api.get('/credentials?limit=5&sortBy=updated_at'),
        api.get('/credentials?limit=100'),
      ]);

      // Calculate stats safely
      const credentials = myCreds.data.data.credentials;
      const myCount = credentials.filter(c => c.owner_id === user.id).length;
      const teamCount = credentials.filter(c => c.team_id && c.owner_id !== user.id).length;
      const sharedCount = credentials.filter(c => !c.team_id && c.owner_id !== user.id).length;

      setStats({
        totalCredentials: myCreds.data.data.total,
        myCredentials: myCount,
        teamCredentials: teamCount,
        sharedWithMe: sharedCount,
      });

      setRecentCredentials(allCreds.data.data.credentials);
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div>Loading...</div>;

  return (
    <DashboardContainer>
      <h1>Welcome back, {user?.fullName}!</h1>

      <StatsGrid>
        <StatCard>
          <StatInfo>
            <h3>Total Credentials</h3>
            <div className="value">{stats.totalCredentials}</div>
          </StatInfo>
          <StatIcon>🔐</StatIcon>
        </StatCard>

        <StatCard>
          <StatInfo>
            <h3>My Credentials</h3>
            <div className="value">{stats.myCredentials}</div>
          </StatInfo>
          <StatIcon>👤</StatIcon>
        </StatCard>

        <StatCard>
          <StatInfo>
            <h3>Team Credentials</h3>
            <div className="value">{stats.teamCredentials}</div>
          </StatInfo>
          <StatIcon>👥</StatIcon>
        </StatCard>

        <StatCard>
          <StatInfo>
            <h3>Shared With Me</h3>
            <div className="value">{stats.sharedWithMe}</div>
          </StatInfo>
          <StatIcon>🤝</StatIcon>
        </StatCard>
      </StatsGrid>

      <RecentSection>
        <Card>
          <CardHeader>
            <CardTitle>Recent Credentials</CardTitle>
          </CardHeader>
          <CardBody>
            <CredentialList>
              {recentCredentials.map((cred) => (
                <CredentialItem key={cred.id} onClick={() => navigate('/credentials')}>
                  <div className="info">
                    <h4>{cred.name}</h4>
                    <span>
                      {cred.owner_name} • {new Date(cred.updated_at).toLocaleDateString()}
                    </span>
                  </div>
                  <span className="type">{cred.credential_type}</span>
                </CredentialItem>
              ))}
            </CredentialList>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardBody>
            <p style={{ marginBottom: theme.spacing.md, color: theme.colors.textLight }}>
              Common tasks you might want to perform:
            </p>
            <ActionList>
              <ActionItem onClick={() => navigate('/credentials')}>
                ➕ Create a new credential
              </ActionItem>
              <ActionItem onClick={() => navigate('/credentials')}>
                🔍 Search credentials
              </ActionItem>
              <ActionItem onClick={() => navigate('/teams')}>
                👥 Manage team access
              </ActionItem>
              <ActionItem onClick={() => navigate('/audit-logs')}>
                📋 View audit logs
              </ActionItem>
            </ActionList>
          </CardBody>
        </Card>
      </RecentSection>
    </DashboardContainer>
  );
};

export default DashboardPage;