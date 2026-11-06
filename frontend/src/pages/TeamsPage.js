import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import api from '../services/api';

const Container = styled.div`
  padding: 24px;
`;

const Header = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
`;

const Title = styled.h1`
  font-size: 24px;
  font-weight: 700;
  color: #1a202c;
  margin: 0;
`;

const Button = styled.button`
  background-color: #2563eb;
  color: white;
  padding: 10px 16px;
  border-radius: 6px;
  border: none;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
  &:hover {
    background-color: #1d4ed8;
  }
`;

const SecondaryButton = styled.button`
  background-color: #e2e8f0;
  color: #334155;
  padding: 6px 12px;
  border-radius: 4px;
  border: none;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  &:hover {
    background-color: #cbd5e1;
  }
`;

const DangerButton = styled.button`
  background-color: #fee2e2;
  color: #dc2626;
  padding: 4px 8px;
  border-radius: 4px;
  border: none;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  &:hover {
    background-color: #fecaca;
  }
`;

const Grid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 20px;
`;

const TeamCard = styled.div`
  background: white;
  border-radius: 8px;
  padding: 20px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  border: 1px solid #e2e8f0;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
`;

const TeamName = styled.h3`
  margin: 0 0 8px 0;
  font-size: 18px;
  color: #1e293b;
`;

const TeamDescription = styled.p`
  color: #64748b;
  font-size: 14px;
  margin: 0 0 16px 0;
`;

const CardFooter = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-top: 1px solid #f1f5f9;
  padding-top: 12px;
  margin-top: auto;
`;

/* Modal Styles */
const ModalOverlay = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
`;

const ModalContent = styled.div`
  background: white;
  padding: 24px;
  border-radius: 8px;
  width: 480px;
  max-height: 85vh;
  overflow-y: auto;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
`;

const ModalTitle = styled.h2`
  margin-top: 0;
  font-size: 20px;
  color: #1e293b;
`;

const FormGroup = styled.div`
  margin-bottom: 16px;
  label {
    display: block;
    font-size: 14px;
    font-weight: 600;
    color: #475569;
    margin-bottom: 6px;
  }
  input, textarea, select {
    width: 100%;
    padding: 8px 12px;
    border: 1px solid #cbd5e1;
    border-radius: 4px;
    font-size: 14px;
    box-sizing: border-box;
    &:focus {
      outline: none;
      border-color: #2563eb;
    }
  }
`;

const MemberList = styled.ul`
  list-style: none;
  padding: 0;
  margin: 16px 0;
  max-height: 200px;
  overflow-y: auto;
  border: 1px solid #e2e8f0;
  border-radius: 4px;
`;

const MemberItem = styled.li`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  border-bottom: 1px solid #f1f5f9;
  font-size: 14px;
  color: #334155;
  &:last-child {
    border-bottom: none;
  }
`;

const ModalActions = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 24px;
`;

const CancelButton = styled.button`
  background: #e2e8f0;
  color: #475569;
  padding: 8px 16px;
  border-radius: 4px;
  border: none;
  font-weight: 600;
  cursor: pointer;
  &:hover {
    background: #cbd5e1;
  }
`;

const TeamsPage = () => {
  const [teams, setTeams] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modals state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isMemberModalOpen, setIsMemberModalOpen] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState(null);

  // Form states
  const [teamForm, setTeamForm] = useState({ name: '', description: '' });
  const [selectedUserId, setSelectedUserId] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchTeams();
    fetchUsers();
  }, []);

  const fetchTeams = async () => {
    try {
      const response = await api.get('/teams');
      const teamData = response.data.data || response.data;
      setTeams(Array.isArray(teamData) ? teamData : teamData.teams || []);
    } catch (error) {
      console.error('Failed to fetch teams:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const response = await api.get('/users');
      const userData = response.data.data || response.data;
      setUsers(Array.isArray(userData) ? userData : userData.users || []);
    } catch (error) {
      console.error('Failed to fetch users:', error);
    }
  };

  const handleCreateTeam = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.post('/teams', teamForm);
      setIsCreateOpen(false);
      setTeamForm({ name: '', description: '' });
      fetchTeams();
    } catch (error) {
      console.error('Failed to create team:', error);
      alert(error.response?.data?.message || 'Failed to create team.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddMember = async (e) => {
    e.preventDefault();
    if (!selectedTeam || !selectedUserId) return;
    setSubmitting(true);
    try {
      const teamId = selectedTeam.id || selectedTeam._id;
      await api.post(`/teams/${teamId}/members`, { userId: selectedUserId });
      setSelectedUserId('');
      
      // Refresh team details & list
      const updatedTeamRes = await api.get(`/teams/${teamId}`);
      const updatedTeam = updatedTeamRes.data.data || updatedTeamRes.data;
      setSelectedTeam(updatedTeam);
      fetchTeams();
    } catch (error) {
      console.error('Failed to add member:', error);
      alert(error.response?.data?.message || 'Failed to add member.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRemoveMember = async (userId) => {
    if (!window.confirm('Are you sure you want to remove this member from the team?')) return;
    try {
      const teamId = selectedTeam.id || selectedTeam._id;
      await api.delete(`/teams/${teamId}/members/${userId}`);
      
      // Refresh team details & list
      const updatedTeamRes = await api.get(`/teams/${teamId}`);
      const updatedTeam = updatedTeamRes.data.data || updatedTeamRes.data;
      setSelectedTeam(updatedTeam);
      fetchTeams();
    } catch (error) {
      console.error('Failed to remove member:', error);
      alert(error.response?.data?.message || 'Failed to remove member.');
    }
  };

  if (loading) return <Container>Loading teams...</Container>;

  return (
    <Container>
      <Header>
        <Title>Teams Management</Title>
        <Button onClick={() => setIsCreateOpen(true)}>
          + Create Team
        </Button>
      </Header>

      <Grid>
        {teams.length === 0 ? (
          <p style={{ color: '#64748b' }}>No teams found.</p>
        ) : (
          teams.map((team) => (
            <TeamCard key={team.id || team._id || team.name}>
              <div>
                <TeamName>{team.name}</TeamName>
                <TeamDescription>
                  {team.description || 'Manage access and credentials for this department.'}
                </TeamDescription>
              </div>
              <CardFooter>
                <span style={{ fontSize: '13px', color: '#64748b' }}>
                  Members: {team.member_count || team.users?.length || team.members?.length || 0}
                </span>
                <SecondaryButton onClick={async () => { 
                  // Fetch fresh team details with members list before opening modal
                  try {
                    const res = await api.get(`/teams/${team.id || team._id}`);
                    setSelectedTeam(res.data.data || res.data);
                  } catch {
                    setSelectedTeam(team);
                  }
                  setIsMemberModalOpen(true); 
                }}>
                  Manage Members
                </SecondaryButton>
              </CardFooter>
            </TeamCard>
          ))
        )}
      </Grid>

      {/* Create Team Modal */}
      {isCreateOpen && (
        <ModalOverlay>
          <ModalContent>
            <ModalTitle>Create New Team</ModalTitle>
            <form onSubmit={handleCreateTeam}>
              <FormGroup>
                <label>Team Name</label>
                <input
                  type="text"
                  required
                  value={teamForm.name}
                  onChange={(e) => setTeamForm({ ...teamForm, name: e.target.value })}
                  placeholder="e.g. Security Operations"
                />
              </FormGroup>
              <FormGroup>
                <label>Description</label>
                <textarea
                  rows="3"
                  value={teamForm.description}
                  onChange={(e) => setTeamForm({ ...teamForm, description: e.target.value })}
                  placeholder="Brief summary of the team's scope"
                />
              </FormGroup>
              <ModalActions>
                <CancelButton type="button" onClick={() => setIsCreateOpen(false)}>
                  Cancel
                </CancelButton>
                <Button type="submit" disabled={submitting}>
                  {submitting ? 'Creating...' : 'Save Team'}
                </Button>
              </ModalActions>
            </form>
          </ModalContent>
        </ModalOverlay>
      )}

      {/* Manage Members Modal */}
      {isMemberModalOpen && selectedTeam && (
        <ModalOverlay>
          <ModalContent>
            <ModalTitle>Manage Members: {selectedTeam.name}</ModalTitle>
            
            <div style={{ marginTop: '16px' }}>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#475569', marginBottom: '6px' }}>
                Current Members
              </label>
              <MemberList>
                {(() => {
                  const membersList = selectedTeam.users || selectedTeam.members || [];
                  if (membersList.length === 0) {
                    return <li style={{ padding: '12px', color: '#94a3b8', textAlign: 'center' }}>No members assigned yet.</li>;
                  }
                  return membersList.map((user) => (
                    <MemberItem key={user.id || user._id || user.user_id}>
                      <span>
                        {user.name || user.fullName || user.email} 
                        <small style={{ color: '#94a3b8' }}> ({user.role || 'Member'})</small>
                      </span>
                      <DangerButton onClick={() => handleRemoveMember(user.id || user._id || user.user_id)}>
                        Remove
                      </DangerButton>
                    </MemberItem>
                  ));
                })()}
              </MemberList>
            </div>

            <form onSubmit={handleAddMember} style={{ marginTop: '20px' }}>
              <FormGroup>
                <label>Add New Member</label>
                <select
                  value={selectedUserId}
                  onChange={(e) => setSelectedUserId(e.target.value)}
                >
                  <option value="">-- Choose User to Add --</option>
                  {users.map((u) => (
                    <option key={u.id || u._id} value={u.id || u._id}>
                      {u.name || u.fullName || u.email} ({u.role})
                    </option>
                  ))}
                </select>
              </FormGroup>
              <ModalActions>
                <CancelButton type="button" onClick={() => { setIsMemberModalOpen(false); setSelectedTeam(null); }}>
                  Close
                </CancelButton>
                <Button type="submit" disabled={submitting || !selectedUserId}>
                  {submitting ? 'Adding...' : 'Add to Team'}
                </Button>
              </ModalActions>
            </form>
          </ModalContent>
        </ModalOverlay>
      )}
    </Container>
  );
};

export default TeamsPage;