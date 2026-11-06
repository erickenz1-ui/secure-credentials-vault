import styled from 'styled-components';
import { theme } from '../styles/theme';

const InputWrapper = styled.div`
  margin-bottom: ${theme.spacing.md};
`;

const Label = styled.label`
  display: block;
  margin-bottom: ${theme.spacing.xs};
  font-size: 0.875rem;
  font-weight: 500;
  color: ${theme.colors.text};
`;

const StyledInput = styled.input`
  width: 100%;
  padding: ${theme.spacing.sm} ${theme.spacing.md};
  border: 1px solid ${theme.colors.border};
  border-radius: ${theme.borderRadius.md};
  font-size: 0.875rem;
  transition: border-color 0.2s;
  
  &:focus {
    outline: none;
    border-color: ${theme.colors.primary};
  }
  
  &:disabled {
    background-color: ${theme.colors.background};
    cursor: not-allowed;
  }
`;

const ErrorText = styled.span`
  display: block;
  margin-top: ${theme.spacing.xs};
  font-size: 0.75rem;
  color: ${theme.colors.danger};
`;

const Input = ({ label, error, ...props }) => {
  return (
    <InputWrapper>
      {label && <Label>{label}</Label>}
      <StyledInput {...props} />
      {error && <ErrorText>{error}</ErrorText>}
    </InputWrapper>
  );
};

export default Input;