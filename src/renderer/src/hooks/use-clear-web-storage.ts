import { useNavigate } from 'react-router';

export const useClearWebStorage = () => {
  const navigate = useNavigate();

  const clearWebStorage = async () => {
    await window.electronAPI.clearWebStorage();
    navigate('/', { replace: true });
  };

  return clearWebStorage;
};
