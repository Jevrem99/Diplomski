const express = require('express');
const cors = require('cors');
const config = require('./config/config');
const userRoutes = require('./routes/userRoutes');
const authRoutes = require('./routes/authRoutes');
const profesorRoutes = require('./routes/profesorRoutes');
const predmetRoutes = require('./routes/predmetRoutes');
const ispitRoutes = require('./routes/ispitRoutes');
const adminRoutes = require('./routes/adminRoutes');
const uploadRoutes = require('./routes/uploadRoutes');
const dezurstvaRoutes = require('./routes/dezurstvaRoutes');
const obavezaRoutes = require('./routes/obavezaRoutes');
const ucionicaRoutes = require('./routes/ucioniceRoutes');
const app = express();

app.use(cors());
app.use(express.json());

app.use('/users', userRoutes);
app.use('/auth', authRoutes);
app.use('/profesors', profesorRoutes);
app.use('/predmet', predmetRoutes);
app.use('/ispit', ispitRoutes);
app.use('/admin', adminRoutes);
app.use('/upload', uploadRoutes);
app.use('/dezurstva', dezurstvaRoutes);
app.use('/obaveze', obavezaRoutes);
app.use('/ucionice', ucionicaRoutes);
app.listen(config.port, () => {
    console.log(`Server is running on port ${config.port}`);
});