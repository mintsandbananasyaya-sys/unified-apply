require("dotenv").config();
const express = require("express");
const session = require("express-session");
const path = require("path");

const authRouter = require("./routes/auth");

const app = express();
const PORT = process.env.PORT || 3001;

app.use(express.json());

app.use(session({
  secret: process.env.SESSION_SECRET || "change_me",
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 1000 * 60 * 60 * 24 * 7,
    httpOnly: true,
    secure: false,
  },
}));

app.use("/auth", authRouter);
app.use(express.static(path.join(__dirname, "public")));

app.listen(PORT, () => {
  console.log(`[Unified Applications] Server running on http://localhost:${PORT}`);
});