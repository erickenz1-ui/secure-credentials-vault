import styled from 'styled-components';
import { theme } from '../styles/theme';

const Button = styled.button`
  padding: ${theme.spacing.sm} ${theme.spacing.md};
  border-radius: ${theme.borderRadius.md};
  font-size: 0.875rem;
  font-weight: 500;
  transition: all 0.2s;
  
  ${props => props.variant === 'primary' && `
    background-color: ${theme.colors.primary};
    color: white;
    
    &:hover {
      background-color: ${theme.colors.primaryDark};
    }
  `}
  
  ${props => props.variant === 'secondary' && `
    background-color: ${theme.colors.secondary};
    color: white;
    
    &:hover {
      background-color: #475569;
    }
  `}
  
  ${props => props.variant === 'danger' && `
    background-color: ${theme.colors.danger};
    color: white;
    
    &:hover {
      background-color: #dc2626;
    }
  `}
  
  ${props => props.variant === 'ghost' && `
    background-color: transparent;
    color: ${theme.colors.text};
    border: 1px solid ${theme.colors.border};
    
    &:hover {
      background-color: ${theme.colors.background};
    }
  `}
  
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

export default Button;