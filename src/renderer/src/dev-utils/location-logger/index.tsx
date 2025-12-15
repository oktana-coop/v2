import { useEffect } from 'react';
import { useLocation } from 'react-router';

export const LocationLogger = () => {
  const location = useLocation();

  useEffect(() => {
    console.log('Current path:', location.pathname);
    console.log('Full location object:', location);
  }, [location]);

  return null;
};

export default LocationLogger;
