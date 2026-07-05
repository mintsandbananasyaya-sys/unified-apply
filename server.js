require("dotenv").config();
const express = require("express");
const session = require("express-session");
const MongoStore = require("connect-mongo");
const mongoose = require("mongoose");
const path = require("path");

const authRouter         = require("./routes/auth");
const applicationsRouter = require("./routes/applications");

const app  = express();
const PORT = process.env.PORT || 3001;

app.use(express.json());

// Connect to MongoDB first so MongoStore can use it
const MONGO_URI = process.env.MONGO_URI;
if (!MONGO_URI) {
  console.warn("[Unified Applications] No MONGO_URI set — applications won't save.");
} else {
  mongoose.connect(MONGO_URI)
    .then(() => console.log("[Unified Applications] Connected to MongoDB"))
    .catch((err) => console.error("[Unified Applications] MongoDB error:", err));
}

app.use(session({
  secret: process.env.SESSION_SECRET || "change_me",
  resave: false,
  saveUninitialized: false,
  store: MONGO_URI ? MongoStore.create({
    mongoUrl: MONGO_URI,
    collectionName: "sessions",
    ttl: 60 * 60 * 24 * 7, // 7 days
  }) : undefined,
  cookie: {
    maxAge: 1000 * 60 * 60 * 24 * 7,
    httpOnly: true,
    secure: false,
  },
}));

app.use("/auth", authRouter);
app.use("/api/applications", applicationsRouter);
app.use(express.static(path.join(__dirname, "public")));

app.listen(PORT, () => {
  console.log(`[Unified Applications] Running on http://localhost:${PORT}`);
});