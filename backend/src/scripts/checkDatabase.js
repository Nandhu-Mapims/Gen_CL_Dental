const dotenv = require('dotenv');
const mongoose = require('mongoose');
dotenv.config();

const checkDatabase = async () => {
  try {
    const uri = process.env.MONGO_URI || 'mongodb://localhost:27017/mrd_audit';
    console.log('Connecting to:', uri.replace(/\/\/[^:]+:[^@]+@/, '//***:***@')); // Hide password
    
    await mongoose.connect(uri);
    console.log('✅ Connected to MongoDB\n');
    
    const db = mongoose.connection.db;
    const dbName = db.databaseName;
    console.log(`📊 Database: ${dbName}\n`);
    
    const collections = await db.listCollections().toArray();
    console.log('📋 Collections found:');
    collections.forEach(c => console.log(`   - ${c.name}`));
    
    console.log('\n📈 Document counts:');
    for (const col of collections) {
      const count = await db.collection(col.name).countDocuments();
      console.log(`   ${col.name}: ${count} documents`);
    }
    
    // Show sample data from key collections
    console.log('\n👥 Sample Users:');
    const users = await db.collection('users').find({}).limit(3).toArray();
    users.forEach(u => console.log(`   - ${u.name} (${u.email}) - ${u.role}`));
    
    console.log('\n🏥 Sample Departments:');
    const depts = await db.collection('departments').find({}).limit(5).toArray();
    depts.forEach(d => console.log(`   - ${d.name} (${d.code})`));
    
    console.log('\n👤 Sample Patients:');
    const patients = await db.collection('patients').find({}).limit(3).toArray();
    patients.forEach(p => console.log(`   - ${p.patientName} (${p.uhid}) - Ward: ${p.ward || 'N/A'}`));
    
    await mongoose.connection.close();
    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
};

checkDatabase();

