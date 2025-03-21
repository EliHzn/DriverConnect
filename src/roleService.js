import axios from 'axios';
const apiUrl = import.meta.env.VITE_APP_API_URL;

// Function to set custom claims
export const setCustomClaims = async (uid, claims) => {
    try {
        const response = await axios.post('${apiUrl}/setCustomClaims', {
            uid,
            claims
        });
        return response.data;
    } catch (error) {
        console.error('Error setting custom claims:', error);
        throw error;
    }
};
