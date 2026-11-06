import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import api from '../services/api';
import { theme } from '../styles/theme';

const Container = styled.div`
  padding: 24px;
  h1 {
    margin-bottom: ${theme.spacing.lg};
  }
`;

const TableWrapper = styled.div`
  background: white;
  border-radius: ${theme.borderRadius.md};
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  overflow-x: auto;
  border: 1px solid ${theme.colors.border};
`;

const Table = styled.table`
  width: 100%;
  border-collapse: collapse;
  text-align: left;
  font-size: 0.875rem;

  th, td {
    padding: 12px 16px;
    border-bottom: 1px solid ${theme.colors.border};
  }

  th {
    background-color: ${theme.colors.background};
    font-weight: 600;
    color: ${theme.colors.text};
  }

  tr:hover {
    background-color: #f8fafc;
  }
`;

const Badge = styled.span`
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 0.75rem;
  font-weight: 500;
  background-color: ${theme.colors.primary};
  color: white;
`;

const AuditLogsPage = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAuditLogs();
  }, []);

  const fetchAuditLogs = async () => {
    try {
      const response = await api.get('/audit');
      const logData = response.data.data || response.data;
      setLogs(Array.isArray(logData) ? logData : logData.logs || []);
    } catch (error) {
      console.error('Failed to fetch audit logs:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <Container>Loading audit logs...</Container>;

  return (
    <Container>
      <h1>Audit Logs</h1>
      <TableWrapper>
        <Table>
          <thead>
            <tr>
              <th>Timestamp</th>
              <th>Action</th>
              <th>User</th>
              <th>Target / Details</th>
              <th>IP Address</th>
            </tr>
          </thead>
          <tbody>
            {logs.length === 0 ? (
              <tr>
                <td colSpan="5" style={{ textAlign: 'center', color: '#64748b', padding: '24px' }}>
                  No audit logs recorded yet.
                </td>
              </tr>
            ) : (
              logs.map((log) => (
                <tr key={log.id || log._id}>
                  <td>{log.created_at ? new Date(log.created_at).toLocaleString() : 'N/A'}</td>
                  <td>
                    <Badge>{log.action || log.event_type || 'INFO'}</Badge>
                  </td>
                  <td>{log.user_name || log.user_email || log.user_id || 'System'}</td>
                  <td>{log.details || log.target || JSON.stringify(log.metadata) || '-'}</td>
                  <td>{log.ip_address || 'N/A'}</td>
                </tr>
              ))
            )}
          </tbody>
        </Table>
      </TableWrapper>
    </Container>
  );
};

export default AuditLogsPage;