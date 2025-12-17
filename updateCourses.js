const mongoose = require('mongoose');
const Course = require('./Models/CourseModel');
const db = require('./connection');

db.then(async () => {
  try {
    await Course.updateMany(
      { credithours: { $exists: false } },
      { $set: { credithours: 'N/A' } }
    );
    console.log('Updated existing courses');
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
});
