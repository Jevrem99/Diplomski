const authService = require('../services/authService');

const loginUser = async (req, res)=>{
   const { username, password } = req.body;

    try {

        const token = await authService.login(username, password);
        return res.status(200).json({ token });
        
    } catch (error) {

        console.error('Login error:', error.message);
        
        if (error.message === 'Invalid username or password') {
            return res.status(401).json({ error: error.message });
        }
        
        return res.status(500).json({ error: 'Internal server error' });
    }
}

module.exports = {
    loginUser
}