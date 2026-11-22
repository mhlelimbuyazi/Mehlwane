const express = require("express");
const bcrypt = require("bcryptjs");
const rateLimit = require("express-rate-limit");
const db = require("../db");

const router = express.Router();

const signupLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many sign-up attempts. Please try again later." }
});

const VALID_GRADES = ["Grade 8", "Grade 9", "Grade 10", "Grade 11", "Grade 12"];

const insertUser = db.prepare(`
  INSERT INTO users (name, username, password_hash, date_of_birth, grade)
  VALUES (?, ?, ?, ?, ?)
`);

function validate(body) {
  const { name, username, password, dateOfBirth, grade } = body || {};

  if (![name, username, password, dateOfBirth, grade].every(v => typeof v === "string")) {
    return "Please complete all fields.";
  }

  const cleanName = name.trim();
  if (cleanName.length < 3 || cleanName.length > 80) {
    return "Please enter your name and surname.";
  }

  if (!/^[A-Za-z0-9_]{3,20}$/.test(username.trim())) {
    return "Username must be 3 to 20 characters: letters, numbers or underscore.";
  }

  if (password.length < 8 || password.length > 72) {
    return "Password must be 8 to 72 characters.";
  }

  if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
    return "Password must contain at least one letter and one number.";
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth)) {
    return "Please enter a valid date of birth.";
  }

  const birth = new Date(dateOfBirth);
  const now = new Date();
  if (isNaN(birth.getTime()) || birth > now) {
    return "Please enter a valid date of birth.";
  }

  const age = now.getFullYear() - birth.getFullYear();
  if (age < 10 || age > 30) {
    return "Please check your date of birth.";
  }

  if (!VALID_GRADES.includes(grade)) {
    return "Please select a valid grade.";
  }

  return null;
}

router.post("/signup", signupLimiter, async (req, res) => {
  const problem = validate(req.body);
  if (problem) {
    return res.status(400).json({ error: problem });
  }

  const name = req.body.name.trim();
  const username = req.body.username.trim();
  const { password, dateOfBirth, grade } = req.body;

  try {
    const hash = await bcrypt.hash(password, 12);
    insertUser.run(name, username, hash, dateOfBirth, grade);
    return res.status(201).json({ message: "Registration successful. You can now log in." });
  } catch (err) {
    if (/UNIQUE constraint failed/.test(String(err.message))) {
      return res.status(409).json({ error: "That username is already taken. Please choose another." });
    }
    console.error("Signup error:", err);
    return res.status(500).json({ error: "Something went wrong. Please try again." });
  }
});

module.exports = router;
