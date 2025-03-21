// C:\Users\eliha\firebase\webapp\src\hooks\useAuth.js
import { useContext } from 'react';
import FirebaseContext from 'contexts/FirebaseContext';

/**
 * useAuth() - A custom hook that retrieves authentication/FireContext data
 * from FirebaseContext.
 *
 * Because this file uses a default export,
 * you should import it in other files as:
 *
 *   import useAuth from 'hooks/useAuth';
 */
const useAuth = () => {
    return useContext(FirebaseContext);
};

export default useAuth;
