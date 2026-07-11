// frontend/src/api.js

const BASE_URL = import.meta.env.MODE === 'development' 
  ? '' 
  : 'https://shared-expenses-backend-85eh.onrender.com';

export default BASE_URL;
