import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import styled from 'styled-components';
import { useAuth } from '../contexts/AuthContext';
import Input from '../components/Input';
import Button from '../components/Button';
import { theme } from '../styles/theme';

const LoginContainer = styled.div`
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
`;

const LoginCard = styled.div`
  background-color: ${theme.colors.surface};
  border-radius: ${theme.borderRadius.lg};
  padding: ${theme.spacing.xxl};
  width: 100%;
  max-width: 400px;
  box-shadow: ${theme.shadows.lg};
`;

const Logo = styled.div`
  text-align: center;
  margin-bottom: ${theme.spacing.xl};
  
  h1 {
    font-size: 1.5rem;
    color: ${theme.colors.primary};
    margin-bottom: ${theme.spacing.xs};
  }
  
  p {
    color: ${theme.colors.textLight};
    font-size: 0.875rem;
  }
`;

const ErrorMessage = styled.div`
  background-color: #fee;
  color: ${theme.colors.danger};
  padding: ${theme.spacing.sm} ${theme.spacing.md};
  border-radius: ${theme.borderRadius.md};
  margin-bottom: ${theme.spacing.md};
  font-size: 0.875rem;
`;

const DemoCredentials = styled.div`
  margin-top: ${theme.spacing.lg};
  padding: ${theme.spacing.md};
  background-color: ${theme.colors.background};
  border-radius: ${theme.borderRadius.md};
  font-size: 0.75rem;
  color: ${theme.colors.textLight};
  
  h4 {
    margin-bottom: ${theme.spacing.xs};
    color: ${theme.colors.text};
  }
  
  p {
    margin: 2px 0;
  }
`;

const LoginPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login(email, password);
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <LoginContainer>
      <LoginCard>
        <Logo>
          <h1>🔐 Secure Vault</h1>
          <p>Credentials Management System</p>
        </Logo>

        {error && <ErrorMessage>{error}</ErrorMessage>}

        <form onSubmit={handleSubmit}>
          <Input
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />

          <Input
            label="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
          />

          <Button
            type="submit"
            variant="primary"
            disabled={loading}
            style={{ width: '100%', padding: '0.75rem' }}
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </Button>
        </form>

        {process.env.NODE_ENV === 'development' && (
          <DemoCredentials>
            <h4>Demo Credentials (dev only)</h4>
            <p><strong>Super Admin:</strong> superadmin@vault.local</p>
            <p><strong>Admin:</strong> admin@vault.local</p>
            <p><strong>Manager:</strong> manager@vault.local</p>
            <p><strong>User:</strong> user@vault.local</p>
            <p><strong>Read-Only:</strong> readonly@vault.local</p>
            <p style={{ marginTop: '4px' }}>Password: Password123!</p>
          </DemoCredentials>
        )}
      </LoginCard>
    </LoginContainer>
  );
};

export default LoginPage;