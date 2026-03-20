//loh
// Load config first (in production uses process.env; in dev loads .env via env.js)
const config = require('./config/env');
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const helmet = require('helmet');
const connectDB = require('./config/db');
const User = require('./models/User');
const bcrypt = require('bcrypt');

const app = express();
const path = require('path');

// Trust proxy when behind nginx/Docker - required for correct client IP in rate limiting
app.set('trust proxy', 1);

// Security: Helmet.js for security headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
  crossOriginEmbedderPolicy: false, // Allow iframe embedding if needed
}));

// Middleware
// CORS configuration - restrict to frontend origin
const corsOptions = {
  origin: config.CORS_ORIGIN,
  credentials: true,
  optionsSuccessStatus: 200
};
app.use(cors(corsOptions));
// Security: Limit request body size to prevent DoS attacks
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(morgan('dev'));

// DB connection and auto-create default admin user
(async () => {
  try {
    await connectDB();

    // Auto-create default SUPER_ADMIN if it doesn't exist
    const adminEmail = 'admin@hospital.com';
    const adminPassword = 'TataTiago@2026';
    const existingAdmin = await User.findOne({ email: adminEmail });

    if (!existingAdmin) {
      const passwordHash = await bcrypt.hash(adminPassword, 10);
      await User.create({
        name: 'System Administrator',
        email: adminEmail,
        passwordHash,
        role: 'SUPER_ADMIN',
        isActive: true,
      });
      console.log('✅ Auto-created default SUPER_ADMIN user');
      console.log(`   Email: ${adminEmail}`);
      console.log(`   Password: ${adminPassword}`);
    } else {
      const passwordHash = await bcrypt.hash(adminPassword, 10);
      existingAdmin.passwordHash = passwordHash;
      existingAdmin.role = 'SUPER_ADMIN';
      existingAdmin.isActive = true;
      await existingAdmin.save();
      console.log('✅ Updated default SUPER_ADMIN user');
      console.log(`   Email: ${adminEmail}`);
      console.log(`   Password: ${adminPassword}`);
    }
  } catch (err) {
    console.error('Error creating/updating admin user:', err);
    // Don't exit - let server continue even if admin creation fails
  }
})();

// Health check (no auth) for Docker/load balancers
app.get('/health', (_req, res) => res.status(200).json({ ok: true }));

// Public static files (supervisor signatures)
const uploadsRoot = path.join(__dirname, '../uploads');
app.use('/uploads', express.static(uploadsRoot, { maxAge: '7d', fallthrough: true }));

// Routes
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/departments', require('./routes/departmentRoutes'));
app.use('/api/locations', require('./routes/locationRoutes'));
app.use('/api/assets', require('./routes/assetRoutes'));
app.use('/api/shifts', require('./routes/shiftRoutes'));
app.use('/api/checklists', require('./routes/checklistRoutes'));
app.use('/api/audits', require('./routes/auditRoutes'));
app.use('/api/form-templates', require('./routes/formTemplateRoutes'));
app.use('/api/patients', require('./routes/patientRoutes'));
app.use('/api/admissions', require('./routes/admissionRoutes'));
app.use('/api/chief-doctors', require('./routes/chiefDoctorRoutes'));
app.use('/api/chief', require('./routes/chiefRoutes'));
app.use('/api/notifications', require('./routes/notificationRoutes'));
app.use('/api/master-data', require('./routes/masterDataRoutes'));

// Serve frontend in production or when running on Render
if (config.NODE_ENV === 'production' || process.env.RENDER || process.env.IS_PULL_REQUEST) {
  const frontendDistPath = path.join(__dirname, '../../frontend/dist');
  app.use(express.static(frontendDistPath));

  app.get('/{*splat}', (req, res) => {
    res.sendFile(path.join(frontendDistPath, 'index.html'));
  });
} else {
  app.get('/', (_req, res) => {
    res.json({ status: 'General Operations Checklist API running' });
  });
}

app.listen(config.PORT, () => {
  console.log(`Server running on port ${config.PORT}`);
});

module.exports = app;


