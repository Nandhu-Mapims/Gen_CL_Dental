const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../config/env');
const User = require('../models/User');
const { ROLES } = require('../models/User');

const JWT_EXPIRES_IN = '8h';

// Password strength validation
const validatePassword = (password) => {
  if (!password || password.length < 8) {
    return { valid: false, message: 'Password must be at least 8 characters long' };
  }
  if (!/[A-Z]/.test(password)) {
    return { valid: false, message: 'Password must contain at least one uppercase letter' };
  }
  if (!/[a-z]/.test(password)) {
    return { valid: false, message: 'Password must contain at least one lowercase letter' };
  }
  if (!/[0-9]/.test(password)) {
    return { valid: false, message: 'Password must contain at least one number' };
  }
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    return { valid: false, message: 'Password must contain at least one special character' };
  }
  return { valid: true };
};

// Email validation
const validateEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

exports.registerAdmin = async (req, res) => {
  try {
    const { name, email, password } = req.body;
    
    // Input validation
    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Name, email, and password are required' });
    }
    
    if (!validateEmail(email)) {
      return res.status(400).json({ message: 'Invalid email format' });
    }
    
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
      return res.status(400).json({ message: passwordValidation.message });
    }
    
    const existing = await User.findOne({ email: email.toLowerCase().trim() });
    if (existing) {
      return res.status(400).json({ message: 'Email already registered' });
    }
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({ 
      name: name.trim(), 
      email: email.toLowerCase().trim(), 
      passwordHash, 
      role: 'SUPER_ADMIN' 
    });
    res.status(201).json({ id: user._id, email: user.email });
  } catch (err) {
    console.error('registerAdmin error', err);
    // Security: Don't leak error details to client
    res.status(500).json({ message: 'Server error' });
  }
};

exports.registerUser = async (req, res) => {
  try {
    const { name, email, password, role = 'STAFF', departmentId, designation } = req.body;
    
    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Name, email, and password are required' });
    }
    
    if (!validateEmail(email)) {
      return res.status(400).json({ message: 'Invalid email format' });
    }
    
    if (role && !ROLES.includes(role)) {
      return res.status(400).json({ message: `Invalid role. Must be one of: ${ROLES.join(', ')}` });
    }
    
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
      return res.status(400).json({ message: passwordValidation.message });
    }
    
    const existing = await User.findOne({ email: email.toLowerCase().trim() });
    if (existing) {
      return res.status(400).json({ message: 'Email already registered' });
    }
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      passwordHash,
      role,
      designation: designation?.trim() || undefined,
      department: ['STAFF', 'SUPERVISOR', 'DEPT_ADMIN'].includes(role) ? departmentId : undefined,
    });
    const populated = await User.findById(user._id).populate('department');
    res.status(201).json({
      id: user._id,
      email: user.email,
      name: user.name,
      role: user.role,
      designation: user.designation,
      department: populated.department,
    });
  } catch (err) {
    console.error('registerUser error', err);
    // Security: Don't leak error details to client
    res.status(500).json({ message: 'Server error' });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // Input validation
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }
    
    if (!validateEmail(email)) {
      return res.status(400).json({ message: 'Invalid email format' });
    }
    
    // Check if MongoDB is connected
    const mongoose = require('mongoose');
    if (mongoose.connection.readyState !== 1) {
      console.error('MongoDB not connected. Connection state:', mongoose.connection.readyState);
      return res.status(503).json({ message: 'Database connection unavailable. Please try again in a moment.' });
    }
    
    // Populate department safely - handle cases where department might not exist
    const user = await User.findOne({ email: email.toLowerCase().trim(), isActive: true })
      .populate({
        path: 'department',
        select: 'name code',
        // If department doesn't exist, set to null instead of throwing error
        options: { lean: false }
      })
      .maxTimeMS(5000); // 5 second timeout for the query
    
    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    
    // Verify user has passwordHash
    if (!user.passwordHash) {
      console.error('User found but passwordHash is missing:', user.email);
      return res.status(500).json({ message: 'Server error' });
    }
    
    const match = await bcrypt.compare(password, user.passwordHash);
    if (!match) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { sub: user._id, role: user.role, email: user.email },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    // Safely extract department info - handle null or missing properties
    let departmentInfo = null;
    if (user.department && user.department._id) {
      departmentInfo = {
        id: user.department._id,
        name: user.department.name || null,
        code: user.department.code || null,
      };
    }

    res.json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        designation: user.designation || null,
        department: departmentInfo,
      },
    });
  } catch (err) {
    console.error('login error', err);
    // Log full error for debugging (server-side only)
    console.error('Login error details:', {
      message: err.message,
      stack: err.stack,
      email: req.body?.email,
      errorName: err.name,
    });
    
    // Handle specific error types
    if (err.name === 'MongooseError' || err.message?.includes('buffering')) {
      console.error('MongoDB connection issue during login');
      return res.status(503).json({ message: 'Database connection issue. Please try again.' });
    }
    
    // Security: Generic error message to prevent user enumeration
    res.status(500).json({ message: 'Server error' });
  }
};

// List users with role SUPERVISOR (for reviewer dropdown)
exports.listSupervisors = async (req, res) => {
  try {
    const supervisors = await User.find({ role: 'SUPERVISOR', isActive: true })
      .select('_id name designation')
      .sort({ name: 1 });
    res.json(supervisors);
  } catch (err) {
    console.error('listSupervisors error', err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.listUsers = async (req, res) => {
  try {
    const users = await User.find()
      .select('-passwordHash')
      .populate('department', 'name code')
      .sort({ createdAt: -1 });
    res.json(users);
  } catch (err) {
    console.error('listUsers error', err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, role, isActive, departmentId, designation, password } = req.body;

    const update = {
      name: name?.trim(),
      email: email?.toLowerCase().trim(),
      role,
      isActive,
      designation: designation?.trim() || '',
    };

    if (update.email && !validateEmail(update.email)) {
      return res.status(400).json({ message: 'Invalid email format' });
    }

    if (password && String(password).trim() !== '') {
      const passwordValidation = validatePassword(password);
      if (!passwordValidation.valid) {
        return res.status(400).json({ message: passwordValidation.message });
      }
      update.passwordHash = await bcrypt.hash(password, 10);
    }

    if (update.email) {
      const duplicate = await User.findOne({
        email: update.email,
        _id: { $ne: id },
      }).select('_id');
      if (duplicate) {
        return res.status(400).json({ message: 'Email already registered' });
      }
    }

    if (role === 'SUPER_ADMIN' || role === 'QA') {
      update.department = undefined;
    } else if (['STAFF', 'SUPERVISOR', 'DEPT_ADMIN'].includes(role) && departmentId) {
      update.department = departmentId;
    } else if (['STAFF', 'SUPERVISOR', 'DEPT_ADMIN'].includes(role)) {
      update.department = undefined;
    }

    const user = await User.findByIdAndUpdate(id, update, { new: true, runValidators: true })
      .select('-passwordHash')
      .populate('department', 'name code');
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json(user);
  } catch (err) {
    console.error('updateUser error', err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.deleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    await User.findByIdAndDelete(id);
    res.status(204).send();
  } catch (err) {
    console.error('deleteUser error', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Change password for logged-in user (admin, auditor, chief)
exports.changePassword = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id;
    if (!userId) return res.status(401).json({ message: 'Not authenticated' });
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: 'Current password and new password are required' });
    }
    const user = await User.findById(userId).select('passwordHash');
    if (!user) return res.status(404).json({ message: 'User not found' });
    const match = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!match) return res.status(401).json({ message: 'Current password is incorrect' });
    const validation = validatePassword(newPassword);
    if (!validation.valid) return res.status(400).json({ message: validation.message });
    user.passwordHash = await bcrypt.hash(newPassword, 10);
    await user.save();
    res.json({ message: 'Password changed successfully' });
  } catch (err) {
    console.error('changePassword error', err);
    res.status(500).json({ message: 'Server error' });
  }
};


