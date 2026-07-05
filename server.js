require("dotenv").config();
const express = require("express");
const session = require("express-session");
const mongoose = require("mongoose");
const path = require("path");

const authRouter         = require("./routes/auth");
const applicationsRouter = require("./routes/applications");

const app  = express();
const PORT = process.env.PORT || 3001;

app.use(express.json());

app.use(session({
  secret: process.env.SESSION_SECRET || "change_me",
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 1000 * 60 * 60 * 24 * 7,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
  },
}));

app.use("/auth", authRouter);
app.use("/api/applications", applicationsRouter);
app.use(express.static(path.join(__dirname, "public")));

// MongoDB
if (!process.env.MONGO_URI) {
  console.warn("[Unified Applications] No MONGO_URI set — applications won't save.");
} else {
  mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log("[Unified Applications] Connected to MongoDB"))
    .catch((err) => console.error("[Unified Applications] MongoDB error:", err));
}

app.listen(PORT, () => {
  console.log(`[Unified Applications] Running on http://localhost:${PORT}`);
});