const express = require("express");
const bcrypt = require("bcryptjs");
const rateLimit = require("express-rate-limit");
const db = require("../db");

const router = express.Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many login attempts. Please wait 15 minutes and try again." }
});

const findByUsername = db.prepare(
  "SELECT id, name, username, password_hash, grade FROM users WHERE username = ?"
);
const findById = db.prepare("SELECT name, grade FROM users WHERE id = ?");

/* Used so a wrong username takes as long as a wrong password. */
const DUMMY_HASH = bcrypt.hashSync("not-a-real-password-1", 12);

router.post("/login", loginLimiter, async (req, res) => {
  const { username, password } = req.body || {};

  if (typeof username !== "string" || typeof password !== "string" ||
      !username.trim() || !password) {
    return res.status(400).json({ error: "Please enter both username and password." });
  }

  try {
    const user = findByUsername.get(username.trim());
    const ok = await bcrypt.compare(password, user ? user.password_hash : DUMMY_HASH);

    if (!user || !ok) {
      return res.status(401).json({ error: "Invalid username or password." });
    }

    /* New session id on login prevents session fixation. */
    req.session.regenerate((err) => {
      if (err) {
        console.error("Session error:", err);
        return res.status(500).json({ error: "Something went wrong. Please try again." });
      }

      req.session.userId = user.id;

      req.session.save((saveErr) => {
        if (saveErr) {
          console.error("Session save error:", saveErr);
          return res.status(500).json({ error: "Something went wrong. Please try again." });
        }
        return res.json({ name: user.name, grade: user.grade });
      });
    });
  } catch (err) {
    console.error("Login error:", err);
    return res.status(500).json({ error: "Something went wrong. Please try again." });
  }
});

router.get("/me", (req, res) => {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ error: "Not logged in." });
  }

  const user = findById.get(req.session.userId);
  if (!user) {
    return req.session.destroy(() => res.status(401).json({ error: "Not logged in." }));
  }

  return res.json({ name: user.name, grade: user.grade });
});

router.post("/logout", (req, res) => {
  req.session.destroy(() => {
    res.clearCookie("mehlwane.sid");
    res.json({ message: "Logged out." });
  });
});

module.exports = router;
