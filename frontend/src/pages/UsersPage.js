import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import Card, { CardHeader, CardTitle, CardBody } from '../components/Card';
import Button from '../components/Button';
import Modal from '../components/Modal';
import { theme } from '../styles/theme';

const UsersContainer = styled.div`
  h1 {
    margin-bottom: ${theme.spacing.lg};
  }
`;

const UsersTable = styled.table`
  width: 100%;
  border-collapse: collapse;
  
  th, td {
    padding: ${theme.spacing.sm} ${theme.spacing.md};
    text-align: left;
    border-bottom: 1px solid ${theme.colors.border};
  }
  
  th {
    font-weight: 600;
    color: ${theme.colors.textLight};
    font-size: 0.875rem;
  }
  
  td {
    font-size: 0.875rem;
  }
`;

const RoleBadge = styled.span`
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 0.75rem;
  font-weight: 500;
  
  ${props => props.role === 'super_admin' && `
    background-color: #fef3c7;
    color: #92400e;
  `}
  
  ${props => props.role === 'admin' && `
    background-color: #dbeafe;
    color: #1e40af;
  `}
  
  ${props => props.role === 'manager' && `
    background-color: #d1fae5;
    color: #065f46;
  `}
  
  ${props => props.role === 'standard' && `
    background-color: #f3f4f6;
    color: #374151;
  `}
  
  ${props => props.role === 'read_only' && `
    background-color: #fee2e2;
    color: #991b1b;
  `}
`;

const StatusBadge = styled.span`
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 0.75rem;
  
  ${props => props.active ? `
    background-color: #d1fae5;
    color: #065f46;
  ` : `
    background-color: #fee2e2;
    color: #991b1b;
  `}
`;

const FormGroup = styled.div`
  margin-bottom: ${theme.spacing.md};
  
  label {
    display: block;
    margin-bottom: ${theme.spacing.xs};
    font-size: 0.875rem;
    font-weight: 500;
  }
  
  input, select {
    width: 100%;
    padding: ${theme.spacing.sm} ${theme.spacing.md};
    border: 1px solid ${theme.colors.border};
    border-radius: ${theme.borderRadius.md};
  }
`;

const ButtonGroup = styled.div`
  display: flex;
  gap: ${theme.spacing.sm};
  justify-content: flex-end;
  margin-top: ${theme.spacing.lg};
`;

const UsersPage = () => {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);

  // Form state
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    fullName: '',
    role: 'standard',
  });

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const response = await api.get('/users');
      setUsers(response.data.data.users);
    } catch (error) {
      console.error('Failed to fetch users:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    
    try {
      await api.post('/users', formData);
      setShowCreateModal(false);
      setFormData({ email: '', password: '', fullName: '', role: 'standard' });
      fetchUsers();
    } catch (error) {
      alert('Failed to create user: ' + (error.response?.data?.error || error.message));
    }
  };

  const handleUpdateRole = async (userId, newRole) => {
    try {
      await api.put(`/users/${userId}`, { role: newRole });
      fetchUsers();
    } catch (error) {
      alert('Failed to update role: ' + (error.response?.data?.error || error.message));
    }
  };

  const handleToggleActive = async (userId, isActive) => {
    try {
      await api.put(`/users/${userId}`, { isActive: !isActive });
      fetchUsers();
    } catch (error) {
      alert('Failed to update user: ' + (error.response?.data?.error || error.message));
    }
  };

  const handleDelete = async (userId) => {
    if (!window.confirm('Are you sure you want to delete this user?')) return;
    
    try {
      await api.delete(`/users/${userId}`);
      fetchUsers();
    } catch (error) {
      alert('Failed to delete user: ' + (error.response?.data?.error || error.message));
    }
  };

  if (loading) return <div>Loading...</div>;

  return (
    <UsersContainer>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: theme.spacing.lg }}>
        <h1>User Management</h1>
        <Button variant="primary" onClick={() => setShowCreateModal(true)}>
          + New User
        </Button>
      </div>

      <Card>
        <CardBody>
          <UsersTable>
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Status</th>
                <th>Last Login</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id}>
                  <td>{user.full_name}</td>
                  <td>{user.email}</td>
                  <td>
                    <RoleBadge role={user.role}>
                      {user.role.replace('_', ' ')}
                    </RoleBadge>
                  </td>
                  <td>
                    <StatusBadge active={user.is_active}>
                      {user.is_active ? 'Active' : 'Inactive'}
                    </StatusBadge>
                  </td>
                  <td>
                    {user.last_login_at
                      ? new Date(user.last_login_at).toLocaleDateString()
                      : 'Never'}
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: theme.spacing.xs }}>
                      {user.id !== currentUser.id && user.role !== 'super_admin' && (
                        <>
                          <Button
                            variant="ghost"
                            onClick={() => handleToggleActive(user.id, user.is_active)}
                          >
                            {user.is_active ? 'Deactivate' : 'Activate'}
                          </Button>
                          
                          <Button
                            variant="danger"
                            onClick={() => handleDelete(user.id)}
                          >
                            Delete
                          </Button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </UsersTable>
        </CardBody>
      </Card>

      {/* Create User Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Create New User"
      >
        <form onSubmit={handleCreate}>
          <FormGroup>
            <label>Full Name *</label>
            <input
              type="text"
              required
              value={formData.fullName}
              onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
            />
          </FormGroup>

          <FormGroup>
            <label>Email *</label>
            <input
              type="email"
              required
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            />
          </FormGroup>

          <FormGroup>
            <label>Password *</label>
            <input
              type="password"
              required
              minLength={12}
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
            />
            <small style={{ color: theme.colors.textLight }}>
              Min 12 chars, 1 uppercase, 1 lowercase, 1 number, 1 special char
            </small>
          </FormGroup>

          <FormGroup>
            <label>Role *</label>
            <select
              value={formData.role}
              onChange={(e) => setFormData({ ...formData, role: e.target.value })}
            >
              <option value="standard">Standard User</option>
              <option value="read_only">Read-Only User</option>
              <option value="manager">Manager</option>
              <option value="admin">Administrator</option>
            </select>
          </FormGroup>

          <ButtonGroup>
            <Button type="button" variant="ghost" onClick={() => setShowCreateModal(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary">
              Create User
            </Button>
          </ButtonGroup>
        </form>
      </Modal>
    </UsersContainer>
  );
};

export default UsersPage;