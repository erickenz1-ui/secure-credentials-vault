import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import Card, { CardHeader, CardTitle } from '../components/Card';
import Button from '../components/Button';
import Input from '../components/Input';
import Modal from '../components/Modal';
import { theme } from '../styles/theme';

const VaultContainer = styled.div`
  h1 {
    margin-bottom: ${theme.spacing.lg};
  }
`;

const CardBody = styled.div`
  padding: ${theme.spacing.lg};
`;

const Toolbar = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: ${theme.spacing.lg};
  gap: ${theme.spacing.md};
  flex-wrap: wrap;
`;

const SearchBar = styled.div`
  flex: 1;
  max-width: 400px;
  
  input {
    width: 100%;
    padding: ${theme.spacing.sm} ${theme.spacing.md};
    border: 1px solid ${theme.colors.border};
    border-radius: ${theme.borderRadius.md};
  }
`;

const FilterSelect = styled.select`
  padding: ${theme.spacing.sm} ${theme.spacing.md};
  border: 1px solid ${theme.colors.border};
  border-radius: ${theme.borderRadius.md};
  background-color: white;
`;

const CredentialGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: ${theme.spacing.md};
`;

const CredentialCard = styled(Card)`
  cursor: pointer;
  transition: transform 0.2s, box-shadow 0.2s;
  
  &:hover {
    transform: translateY(-2px);
    box-shadow: ${theme.shadows.lg};
  }
`;

const CredentialMeta = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: start;
  margin-bottom: ${theme.spacing.sm};
  
  h3 {
    font-size: 1rem;
    font-weight: 600;
  }
  
  .type-badge {
    font-size: 0.75rem;
    padding: 2px 8px;
    background-color: ${theme.colors.primary};
    color: white;
    border-radius: 12px;
  }
`;

const CredentialInfo = styled.div`
  font-size: 0.875rem;
  color: ${theme.colors.textLight};
  
  p {
    margin: 2px 0;
  }
  
  .tags {
    display: flex;
    gap: 4px;
    margin-top: ${theme.spacing.xs};
    flex-wrap: wrap;
    
    span {
      font-size: 0.75rem;
      padding: 2px 6px;
      background-color: ${theme.colors.background};
      border-radius: 4px;
    }
  }
`;

const SecretReveal = styled.div`
  background-color: ${theme.colors.background};
  padding: ${theme.spacing.md};
  border-radius: ${theme.borderRadius.md};
  font-family: monospace;
  font-size: 0.875rem;
  word-break: break-all;
  margin: ${theme.spacing.md} 0;
  position: relative;
  
  .actions {
    position: absolute;
    top: ${theme.spacing.sm};
    right: ${theme.spacing.sm};
    display: flex;
    gap: ${theme.spacing.xs};
  }
  
  button {
    padding: 4px 8px;
    font-size: 0.75rem;
    background-color: ${theme.colors.surface};
    border: 1px solid ${theme.colors.border};
    border-radius: 4px;
    cursor: pointer;
    
    &:hover {
      background-color: ${theme.colors.background};
    }
  }
`;

const FormGroup = styled.div`
  margin-bottom: ${theme.spacing.md};
  
  label {
    display: block;
    margin-bottom: ${theme.spacing.xs};
    font-size: 0.875rem;
    font-weight: 500;
  }
  
  input, textarea, select {
    width: 100%;
    padding: ${theme.spacing.sm} ${theme.spacing.md};
    border: 1px solid ${theme.colors.border};
    border-radius: ${theme.borderRadius.md};
    font-family: inherit;
  }
  
  textarea {
    min-height: 100px;
    resize: vertical;
  }
`;

const ButtonGroup = styled.div`
  display: flex;
  gap: ${theme.spacing.sm};
  justify-content: flex-end;
  margin-top: ${theme.spacing.lg};
`;

const CredentialsPage = () => {
  const { isStandardUser } = useAuth();
  const [credentials, setCredentials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedCredential, setSelectedCredential] = useState(null);
  const [revealedSecret, setRevealedSecret] = useState('');
  const [showSecret, setShowSecret] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    credentialType: 'password',
    secretData: '',
    tags: '',
  });

  useEffect(() => {
    fetchCredentials();
  }, [search, typeFilter]);

  const fetchCredentials = async () => {
    try {
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      if (typeFilter) params.append('type', typeFilter);

      const response = await api.get(`/credentials?${params}`);
      setCredentials(response.data.data.credentials);
    } catch (error) {
      console.error('Failed to fetch credentials:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    
    try {
      await api.post('/credentials', {
        ...formData,
        tags: formData.tags.split(',').map(t => t.trim()).filter(Boolean),
      });
      
      setShowCreateModal(false);
      setFormData({
        name: '',
        description: '',
        credentialType: 'password',
        secretData: '',
        tags: '',
      });
      fetchCredentials();
    } catch (error) {
      alert('Failed to create credential: ' + (error.response?.data?.error || error.message));
    }
  };

  const handleViewDetail = async (credential) => {
    setSelectedCredential(credential);
    setShowDetailModal(true);
    setRevealedSecret('');
    setShowSecret(false);
  };

  const handleReveal = async () => {
    try {
      const response = await api.get(`/credentials/${selectedCredential.id}/reveal`);
      setRevealedSecret(response.data.data.secret);
      setShowSecret(true);
    } catch (error) {
      alert('Failed to reveal secret: ' + (error.response?.data?.error || error.message));
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(revealedSecret);
    alert('Copied to clipboard!');
  };

  const handleDelete = async () => {
    if (!window.confirm('Are you sure you want to delete this credential?')) return;
    
    try {
      await api.delete(`/credentials/${selectedCredential.id}`);
      setShowDetailModal(false);
      fetchCredentials();
    } catch (error) {
      alert('Failed to delete credential');
    }
  };

  if (loading) return <div>Loading...</div>;

  return (
    <VaultContainer>
      <h1>Credential Vault</h1>

      <Toolbar>
        <SearchBar>
          <input
            type="text"
            placeholder="Search credentials..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </SearchBar>

        <div style={{ display: 'flex', gap: theme.spacing.sm }}>
          <FilterSelect
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
          >
            <option value="">All Types</option>
            <option value="password">Password</option>
            <option value="api_key">API Key</option>
            <option value="private_key">Private Key</option>
            <option value="certificate">Certificate</option>
            <option value="ssh_key">SSH Key</option>
            <option value="other">Other</option>
          </FilterSelect>

          {isStandardUser && (
            <Button variant="primary" onClick={() => setShowCreateModal(true)}>
              + New Credential
            </Button>
          )}
        </div>
      </Toolbar>

      <CredentialGrid>
        {credentials.map((cred) => (
          <CredentialCard key={cred.id} onClick={() => handleViewDetail(cred)}>
            <CredentialMeta>
              <h3>{cred.name}</h3>
              <span className="type-badge">{cred.credential_type}</span>
            </CredentialMeta>
            <CredentialInfo>
              {cred.description && <p>{cred.description}</p>}
              <p>Owner: {cred.owner_name}</p>
              {cred.team_name && <p>Team: {cred.team_name}</p>}
              {cred.tags && cred.tags.length > 0 && (
                <div className="tags">
                  {cred.tags.map((tag, i) => (
                    <span key={i}>{tag}</span>
                  ))}
                </div>
              )}
            </CredentialInfo>
          </CredentialCard>
        ))}
      </CredentialGrid>

      {credentials.length === 0 && (
        <Card>
          <CardBody style={{ textAlign: 'center', padding: theme.spacing.xl }}>
            <p>No credentials found. {isStandardUser && 'Create your first credential!'}</p>
          </CardBody>
        </Card>
      )}

      {/* Create Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Create New Credential"
      >
        <form onSubmit={handleCreate}>
          <FormGroup>
            <label>Name *</label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            />
          </FormGroup>

          <FormGroup>
            <label>Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            />
          </FormGroup>

          <FormGroup>
            <label>Type *</label>
            <select
              value={formData.credentialType}
              onChange={(e) => setFormData({ ...formData, credentialType: e.target.value })}
            >
              <option value="password">Password</option>
              <option value="api_key">API Key</option>
              <option value="private_key">Private Key</option>
              <option value="certificate">Certificate</option>
              <option value="ssh_key">SSH Key</option>
              <option value="other">Other</option>
            </select>
          </FormGroup>

          <FormGroup>
            <label>Secret Data *</label>
            <textarea
              required
              value={formData.secretData}
              onChange={(e) => setFormData({ ...formData, secretData: e.target.value })}
              placeholder="Enter the secret value..."
            />
          </FormGroup>

          <FormGroup>
            <label>Tags (comma-separated)</label>
            <input
              type="text"
              value={formData.tags}
              onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
              placeholder="production, database, critical"
            />
          </FormGroup>

          <ButtonGroup>
            <Button type="button" variant="ghost" onClick={() => setShowCreateModal(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary">
              Create Credential
            </Button>
          </ButtonGroup>
        </form>
      </Modal>

      {/* Detail Modal */}
      <Modal
        isOpen={showDetailModal}
        onClose={() => setShowDetailModal(false)}
        title={selectedCredential?.name}
      >
        {selectedCredential && (
          <div>
            <p style={{ marginBottom: theme.spacing.md }}>
              <strong>Type:</strong> {selectedCredential.credential_type}
            </p>
            
            {selectedCredential.description && (
              <p style={{ marginBottom: theme.spacing.md }}>
                <strong>Description:</strong> {selectedCredential.description}
              </p>
            )}

            <p style={{ marginBottom: theme.spacing.md }}>
              <strong>Owner:</strong> {selectedCredential.owner_name}
            </p>

            {selectedCredential.team_name && (
              <p style={{ marginBottom: theme.spacing.md }}>
                <strong>Team:</strong> {selectedCredential.team_name}
              </p>
            )}

            <div style={{ marginTop: theme.spacing.lg }}>
              <Button variant="primary" onClick={handleReveal}>
                {showSecret ? 'Hide Secret' : 'Reveal Secret'}
              </Button>
            </div>

            {showSecret && revealedSecret && (
              <SecretReveal>
                <div className="actions">
                  <button onClick={handleCopy}>📋 Copy</button>
                </div>
                {revealedSecret}
              </SecretReveal>
            )}

            <ButtonGroup>
              {isStandardUser && (
                <Button variant="danger" onClick={handleDelete}>
                  Delete
                </Button>
              )}
              <Button variant="ghost" onClick={() => setShowDetailModal(false)}>
                Close
              </Button>
            </ButtonGroup>
          </div>
        )}
      </Modal>
    </VaultContainer>
  );
};

export default CredentialsPage;