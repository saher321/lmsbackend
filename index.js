
const express = require("express");
const mongoose = require("mongoose");
const db = require("./connection");
const User = require("./Models/UserModel");
const Course = require("./Models/CourseModel");
const Assignment = require("./Models/AssignmetModel");
const Grade = require("./Models/GradeModel");
const Submission = require("./Models/SubmissionModel");
const bodyparser = require("body-parser");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const cors = require("cors");
db;
const app = express();
app.use(bodyparser.json());
app.use(cors());
app.get("/", (req, res) => {
  res.send("Hello World");
});

app.post("/register", async (req, res) => {
  try {
    const password = req.body.password;
    const hashedpassword = await bcrypt.hash(password, 10);
    const user = new User({
      name: req.body.name,
      email: req.body.email.toLowerCase(),
      password: hashedpassword,
      role: req.body.role,
    });
    await user.save();
    res.send("User Register Sucessfully");
  } catch (err) {
    res.send("Something went wrong!!" + err);
  }
});

app.post("/login", async (req, res) => {
  try {
    const email = req.body.email.trim().toLowerCase();
    const password = req.body.password;
    const data = await User.findOne({ email: { $regex: new RegExp(`^${email.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') } });
    if (data) {
      const passwordcomp = await bcrypt.compare(password, data.password);
      if (passwordcomp) {
        const secretkey = "ABCDEFGHIJKL";
        const token = jwt.sign({ userId: data._id }, secretkey, {
          expiresIn: "1h",
        });
        res.json({
          message: "Login successfully",
          status: 200,
          role: data.role,
          name: data.name,
          userId: data._id,
          token: token,
        });
      } else {
        res.json({
          message: "Password Incorrect",
        });
      }
    } else {
      res.json({
        message: "User not found",
      });
    }
  } catch (err) {
    res.status(500).json({
      message: "An error occurred during login",
    });
  }
});

app.post("/addcourse", async (req, res) => {
  try {
    const course = new Course(req.body);
    await course.save();
    res.send("Course added Sucessfully");
  } catch {
    res.send("Something went wrong");
  }
});

app.get("/getcourse", async (req, res) => {
  const data = await Course.find();
  res.send(data);
});

app.get("/enrolledcourses/:studentId", async (req, res) => {
  try {
    const studentId = req.params.studentId;
    const data = await Course.find({ enrolled_student_id: studentId });
    res.send(data);
  } catch (err) {
    res.status(500).send("Something went wrong: " + err.message);
  }
});

app.post("/addassignment", async (req, res) => {
  try {
    const assignment = new Assignment({
      ...req.body,
      course_id: new mongoose.Types.ObjectId(req.body.course_id)
    });
    await assignment.save();
    res.send("Assignment added Sucessfully");
  } catch (err) {
    res.send("Something went wrong: " + err.message);
  }
});

app.get("/getassignment", async (req, res) => {
  const data = await Assignment.find().populate('course_id');
  res.send(data);
});

app.post("/gradeassignment", async (req, res) => {
  try {
    const grade = new Grade(req.body);
    await grade.save();
    res.send("Assignment graded Sucessfully");
  } catch {
    res.send("Something went wrong");
  }
});

app.get("/studentgrades/:id", async (req, res) => {
  try {
    id = req.params.id;
    const data = await Grade.findOne({ students_id: id });
    await res.send(data);
  } catch {
    res.send("Something went wrong!!");
  }
});

app.put("/enrollcourse/:id", async (req, res) => {
  try {
    const courseId = req.params.id;
    const studentId = new mongoose.Types.ObjectId(req.body.studentId);

    // Check if the course exists
    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).send("Course not found");
    }

    // Check if the student is already enrolled
    if (course.enrolled_student_id.some(id => id.equals(studentId))) {
      return res.status(400).send("Student already enrolled in this course");
    }

    // Add the student to the enrolled students array using updateOne to avoid full validation
    await Course.updateOne(
      { _id: courseId },
      { $push: { enrolled_student_id: studentId } }
    );

    res.send("Student enrolled successfully");
  } catch (err) {
    res.status(500).send("Something went wrong: " + err.message);
  }
});

app.get("/courseassgiment/:id", async (req, res) => {
  try {
    id = req.params.id;
    const data = await Assignment.findOne({ course_id: id });
    await res.send(data);
  } catch {
    res.send("Something went wrong!!!");
  }
});

app.get("/enrolledcourses/:studentId", async (req, res) => {
  try {
    const studentId = req.params.studentId;
    const data = await Course.find({ enrolled_student_id: studentId });
    res.send(data);
  } catch (err) {
    res.status(500).send("Something went wrong: " + err.message);
  }
});

app.get("/studentassignments/:studentId", async (req, res) => {
  try {
    const studentId = new mongoose.Types.ObjectId(req.params.studentId);
    const enrolledCourses = await Course.find({ enrolled_student_id: studentId });
    const courseIds = enrolledCourses.map(course => course._id);
    const assignments = await Assignment.find({ course_id: { $in: courseIds } }).populate('course_id');

    // Get submissions for this student
    const submissions = await Submission.find({
      student_id: studentId,
      assignment_id: { $in: assignments.map(a => a._id) }
    });

    // Merge assignment with submission data
    const assignmentsWithSubmissions = assignments.map(assignment => {
      const submission = submissions.find(s => s.assignment_id.toString() === assignment._id.toString());
      return {
        ...assignment.toObject(),
        submission: submission || null
      };
    });

    res.json(assignmentsWithSubmissions);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/submitassignment", async (req, res) => {
  try {
    console.log("Received submission request:", req.body);
    const { assignment_id, student_id, answer } = req.body;

    // Convert IDs to ObjectId
    const assignmentObjectId = new mongoose.Types.ObjectId(assignment_id);
    const studentObjectId = new mongoose.Types.ObjectId(student_id);

    console.log("Converted IDs:", { assignmentObjectId, studentObjectId });

    // Check if submission already exists
    let submission = await Submission.findOne({
      assignment_id: assignmentObjectId,
      student_id: studentObjectId
    });

    console.log("Existing submission found:", submission);

    if (submission) {
      // Update existing submission
      submission.answer = answer;
      submission.submitted_date = new Date();
      submission.status = "Submitted";
      await submission.save();
      console.log("Updated submission:", submission);
    } else {
      // Create new submission
      submission = new Submission({
        assignment_id: assignmentObjectId,
        student_id: studentObjectId,
        answer,
        submitted_date: new Date(),
        status: "Submitted"
      });
      await submission.save();
      console.log("Created new submission:", submission);
    }

    res.json({ message: "Assignment submitted successfully", submission });
  } catch (error) {
    console.error("Error in submitassignment:", error);
    res.status(500).json({ error: error.message });
  }
});

app.get("/getsubmissions/:assignmentId", async (req, res) => {
  try {
    const assignmentId = new mongoose.Types.ObjectId(req.params.assignmentId);

    // Get the assignment details
    const assignment = await Assignment.findById(assignmentId).populate('course_id');
    if (!assignment) {
      return res.status(404).json({ error: "Assignment not found" });
    }

    // Get all submissions for this assignment with student details
    const submissions = await Submission.find({ assignment_id: assignmentId })
      .populate('student_id', 'name email')
      .sort({ submitted_date: -1 });

    res.json({
      assignment: assignment,
      submissions: submissions
    });
  } catch (error) {
    console.error("Error in getsubmissions:", error);
    res.status(500).json({ error: error.message });
  }
});

app.put("/gradesubmission/:submissionId", async (req, res) => {
  try {
    const submissionId = new mongoose.Types.ObjectId(req.params.submissionId);
    const { obtainmarks, comments } = req.body;

    const submission = await Submission.findById(submissionId);
    if (!submission) {
      return res.status(404).json({ error: "Submission not found" });
    }

    submission.obtainmarks = obtainmarks;
    submission.comments = comments;
    submission.status = "checked";
    await submission.save();

    res.json({ message: "Submission graded successfully", submission });
  } catch (error) {
    console.error("Error in gradesubmission:", error);
    res.status(500).json({ error: error.message });
  }
});

app.get("/getallsubmissions", async (req, res) => {
  try {
    const submissions = await Submission.find()
      .populate('student_id', 'name email')
      .populate({
        path: 'assignment_id',
        populate: {
          path: 'course_id',
          select: 'code'
        }
      })
      .sort({ submitted_date: -1 });
    res.json(submissions);
  } catch (error) {
    console.error("Error in getallsubmissions:", error);
    res.status(500).json({ error: error.message });
  }
});

app.get("/studentsubmissions/:studentId", async (req, res) => {
  try {
    const studentId = new mongoose.Types.ObjectId(req.params.studentId);
    const submissions = await Submission.find({ student_id: studentId })
      .populate({
        path: 'assignment_id',
        populate: {
          path: 'course_id',
          select: 'code title'
        }
      })
      .sort({ submitted_date: -1 });
    res.json(submissions);
  } catch (error) {
    console.error("Error in studentsubmissions:", error);
    res.status(500).json({ error: error.message });
  }
});

app.listen(3210);
