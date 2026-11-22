const express = require("express");
const session = require("express-session");
const path = require("path");

require("./db");

const app = express();
const isProduction = process.env.NODE_ENV === "production";

if (isProduction) {
  /* Needed when running behind a host that handles HTTPS for you. */
  app.set("trust proxy", 1);
}

if (isProduction && !process.env.SESSION_SECRET) {
  console.error("Set the SESSION_SECRET environment variable before starting in production.");
  process.exit(1);
}

app.use(express.json({ limit: "10kb" }));

app.use(session({
  name: "mehlwane.sid",
  secret: process.env.SESSION_SECRET || "dev-only-change-me",
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: "lax",
    secure: isProduction,
    maxAge: 1000 * 60 * 60 * 8
  }
}));

app.use("/api", require("./routes/signup"));
app.use("/api", require("./routes/user"));

app.use(express.static(path.join(__dirname, "public")));

app.use("/api", (req, res) => res.status(404).json({ error: "Not found." }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("Portal running at http://localhost:" + PORT);
});
