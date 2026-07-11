const BASE_URL = import.meta.env.MODE === 'development' 
  ? '' 
  : 'https://shared-expenses-backend.onrender.com'; 

export default BASE_URL;