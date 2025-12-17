const mongoose = require("mongoose");

const db = mongoose
  .connect(
    "mongodb+srv://khubaib2005azam:inteli77700K@clusterjk.vmaj2.mongodb.net/lms"
  )
  .then(() => {
    console.log("database connected");
  })
  .catch(() => {
    console.log("database not connected");
  });

module.exports = db;
