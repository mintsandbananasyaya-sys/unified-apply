const express = require("express");
const router  = express.Router();
const Application = require("../models/Application");

const APP_REVIEWER_ROLE_ID = process.env.APP_REVIEWER_ROLE_ID;
const OWNER_ROLE_ID        = process.env.OWNER_ROLE_ID;
const PARTICIPANT_ROLE_ID  = process.env.PARTICIPANT_ROLE_ID;
const GUILD_ID             = process.env.DISCORD_GUILD_ID;
const BOT_TOKEN            = process.env.BOT_TOKEN;
const UNIFIED_EVENTS_URL   = process.env.UNIFIED_EVENTS_URL;
const INTERNAL_SECRET      = process.env.INTERNAL_SECRET;
const CURRENT_SEASON       = process.env.CURRENT_SEASON || "season-1";

/* ---- Notify Unified Events dashboard ---- */
async function sendUnifiedEventsNotification(userId, title, description) {
  if (!UNIFIED_EVENTS_URL || !INTERNAL_SECRET) return;
  try {
    await fetch(`${UNIFIED_EVENTS_URL}/api/notifications/internal`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-internal-secret": INTERNAL_SECRET,
      },
      body: JSON.stringify({ userId, title, description }),
    });
  } catch (err) {
    console.error("[sendUnifiedEventsNotification]", err.message);
  }
}

/* ---- DM a user via bot ---- */
async function sendDiscordDM(discordId, content) {
  try {
    const dmRes = await fetch("https://discord.com/api/users/@me/channels", {
      method: "POST",
      headers: { Authorization: `Bot ${BOT_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({ recipient_id: discordId }),
    });
    const dm = await dmRes.json();
    if (dm.id) {
      await fetch(`https://discord.com/api/channels/${dm.id}/messages`, {
        method: "POST",
        headers: { Authorization: `Bot ${BOT_TOKEN}`, "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
    }
  } catch (err) {
    console.error("[sendDiscordDM]", err.message);
  }
}

/* ---- Get member roles from Discord ---- */
async function getMemberRoles(discordId) {
  try {
    const res = await fetch(
      `https://discord.com/api/guilds/${GUILD_ID}/members/${discordId}`,
      { headers: { Authorization: `Bot ${BOT_TOKEN}` } }
    );
    if (!res.ok) return [];
    const member = await res.json();
    return member.roles || [];
  } catch {
    return [];
  }
}

/* ---- Middleware: must be logged in ---- */
function requireAuth(req, res, next) {
  if (!req.session.user) {
    return res.status(401).json({ success: false, message: "Not logged in." });
  }
  next();
}

/* ---- Middleware: must have App Reviewer role ---- */
async function requireReviewer(req, res, next) {
  if (!req.session.user) {
    return res.status(401).json({ success: false, message: "Not logged in." });
  }
  const roles = await getMemberRoles(req.session.user.id);
  if (!roles.includes(APP_REVIEWER_ROLE_ID)) {
    return res.status(403).json({ success: false, message: "You don't have permission." });
  }
  next();
}

/* ---- Middleware: must have Owner role ---- */
async function requireOwner(req, res, next) {
  if (!req.session.user) {
    return res.status(401).json({ success: false, message: "Not logged in." });
  }
  const roles = await getMemberRoles(req.session.user.id);
  if (!roles.includes(OWNER_ROLE_ID)) {
    return res.status(403).json({ success: false, message: "Owner only." });
  }
  next();
}

/* ================================================================
   GET /api/applications/me
   Check current user's application status
================================================================ */
router.get("/me", requireAuth, async (req, res) => {
  try {
    const apps = await Application.find({
      discordId: req.session.user.id,
      season: CURRENT_SEASON,
    }).sort({ attemptNumber: -1 });

    const latest = apps[0] || null;
    const blocked = latest?.blocked || false;
    const attemptCount = apps.length;

    return res.json({ success: true, application: latest, attemptCount, blocked });
  } catch (err) {
    console.error("[GET /api/applications/me]", err);
    return res.status(500).json({ success: false, message: "Server error." });
  }
});

/* ================================================================
   POST /api/applications
   Submit a new application
================================================================ */
router.post("/", requireAuth, async (req, res) => {
  try {
    const { discordId, discordUsername, discordAvatar } = req.session.user;
    const userId   = req.session.user.id;
    const username = req.session.user.username;
    const avatar   = req.session.user.avatar;

    // Check existing applications this season
    const existing = await Application.find({
      discordId: userId,
      season: CURRENT_SEASON,
    }).sort({ attemptNumber: 1 });

    // Blocked entirely
    if (existing.some(a => a.blocked)) {
      return res.status(403).json({
        success: false,
        message: "You are blocked from applying this season.",
      });
    }

    // Already has a pending or accepted application
    const active = existing.find(a => a.status === "pending" || a.status === "accepted");
    if (active) {
      return res.status(400).json({
        success: false,
        message: active.status === "pending"
          ? "You already have a pending application."
          : "Your application was already accepted.",
      });
    }

    // Check attempt count
    const attemptCount = existing.length;

    if (attemptCount >= 2) {
      return res.status(403).json({
        success: false,
        message: "You have used both application attempts this season.",
      });
    }

    // If this is attempt 2, check they were granted reapply
    if (attemptCount === 1) {
      const firstApp = existing[0];
      if (!firstApp.canReapply) {
        return res.status(403).json({
          success: false,
          message: "You have not been granted a second attempt.",
        });
      }
    }

    const newApp = await Application.create({
      discordId:       userId,
      discordUsername: username,
      discordAvatar:   avatar,
      attemptNumber:   attemptCount + 1,
      season:          CURRENT_SEASON,
    });

    return res.json({ success: true, application: newApp });
  } catch (err) {
    console.error("[POST /api/applications]", err);
    return res.status(500).json({ success: false, message: "Server error." });
  }
});

/* ================================================================
   GET /api/applications
   Staff — all applications
================================================================ */
router.get("/", requireReviewer, async (req, res) => {
  try {
    const { status, season } = req.query;
    const query = {};
    if (status && status !== "all") query.status = status;
    if (season) query.season = season;
    const apps = await Application.find(query).sort({ createdAt: -1 }).lean();
    return res.json({ success: true, applications: apps });
  } catch (err) {
    console.error("[GET /api/applications]", err);
    return res.status(500).json({ success: false, message: "Server error." });
  }
});

/* ================================================================
   GET /api/applications/history/:discordId
   Staff — full application history for one user
================================================================ */
router.get("/history/:discordId", requireReviewer, async (req, res) => {
  try {
    const apps = await Application.find({
      discordId: req.params.discordId,
    }).sort({ createdAt: 1 }).lean();
    return res.json({ success: true, applications: apps });
  } catch (err) {
    console.error("[GET /api/applications/history]", err);
    return res.status(500).json({ success: false, message: "Server error." });
  }
});

/* ================================================================
   PATCH /api/applications/:id
   Staff — accept, reject, reverse, or grant reapply
================================================================ */
router.patch("/:id", requireReviewer, async (req, res) => {
  const { action, reviewNote, reversalNote } = req.body;

  const validActions = ["accepted", "rejected", "reverse", "grant-reapply", "revoke-reapply"];
  if (!validActions.includes(action)) {
    return res.status(400).json({ success: false, message: "Invalid action." });
  }

  try {
    const app = await Application.findById(req.params.id);
    if (!app) return res.status(404).json({ success: false, message: "Application not found." });

    /* ---- ACCEPT ---- */
    if (action === "accepted") {
      if (app.status !== "pending") {
        return res.status(400).json({ success: false, message: "Application already reviewed." });
      }

      app.status     = "accepted";
      app.reviewedBy = req.session.user.username;
      app.reviewedAt = new Date();
      app.reviewNote = reviewNote || "";
      await app.save();

      // Assign role
      try {
        await fetch(
          `https://discord.com/api/guilds/${GUILD_ID}/members/${app.discordId}/roles/${PARTICIPANT_ROLE_ID}`,
          { method: "PUT", headers: { Authorization: `Bot ${BOT_TOKEN}` } }
        );
      } catch (err) { console.error("[role assign failed]", err.message); }

      // DM
      await sendDiscordDM(
        app.discordId,
        `🎉 **Your application has been accepted!**\n\nWelcome to Season 1 — you've been given the Season 1 Participant role.${reviewNote ? `\n\nNote from staff: ${reviewNote}` : ""}`
      );

      // Unified Events notification
      await sendUnifiedEventsNotification(
        app.discordId,
        "Your application was accepted! 🎉",
        `Welcome to Season 1 — you've been given the Season 1 Participant role.${reviewNote ? ` Note from staff: ${reviewNote}` : ""}`
      );
    }

    /* ---- REJECT ---- */
    else if (action === "rejected") {
      if (app.status !== "pending") {
        return res.status(400).json({ success: false, message: "Application already reviewed." });
      }

      app.status     = "rejected";
      app.reviewedBy = req.session.user.username;
      app.reviewedAt = new Date();
      app.reviewNote = reviewNote || "";

      // Check if this is their 2nd rejection — block them
      const previousApps = await Application.find({
        discordId: app.discordId,
        season:    app.season,
        status:    "rejected",
        _id:       { $ne: app._id },
      });

      if (previousApps.length >= 1) {
        app.blocked = true;
      }

      await app.save();

      const isBlocked = app.blocked;
      const dmMsg = isBlocked
        ? `Your application was reviewed and unfortunately wasn't successful.${reviewNote ? `\n\nNote from staff: ${reviewNote}` : ""}\n\nThis was your second attempt — you won't be able to apply again until a new season opens.`
        : `Your application wasn't successful this time.${reviewNote ? `\n\nNote from staff: ${reviewNote}` : ""}\n\nYou may be granted a second attempt — keep an eye on your notifications.`;

      await sendDiscordDM(app.discordId, dmMsg);
      await sendUnifiedEventsNotification(
        app.discordId,
        isBlocked ? "Application denied — no further attempts" : "Application update",
        isBlocked
          ? `Your second application was denied. You cannot apply again until a new season opens.${reviewNote ? ` Note: ${reviewNote}` : ""}`
          : `Your application wasn't successful. You may be granted a second attempt.${reviewNote ? ` Note: ${reviewNote}` : ""}`
      );
    }

    /* ---- REVERSE (undo accept or reject) ---- */
    else if (action === "reverse") {
      if (app.status === "pending") {
        return res.status(400).json({ success: false, message: "Application is still pending." });
      }

      const previousStatus = app.status;
      app.status      = "pending";
      app.reversedBy  = req.session.user.username;
      app.reversedAt  = new Date();
      app.reversalNote = reversalNote || "";
      app.reviewedBy  = null;
      app.reviewedAt  = null;
      app.blocked     = false;
      app.canReapply  = false;
      await app.save();

      // If reversing an acceptance — remove the role
      if (previousStatus === "accepted") {
        try {
          await fetch(
            `https://discord.com/api/guilds/${GUILD_ID}/members/${app.discordId}/roles/${PARTICIPANT_ROLE_ID}`,
            { method: "DELETE", headers: { Authorization: `Bot ${BOT_TOKEN}` } }
          );
        } catch (err) { console.error("[role remove failed]", err.message); }
      }

      await sendDiscordDM(
        app.discordId,
        `Your application decision has been reversed by staff and is back to pending review.${reversalNote ? `\n\nNote: ${reversalNote}` : ""}`
      );
    }

    /* ---- GRANT REAPPLY ---- */
    else if (action === "grant-reapply") {
      if (app.status !== "rejected") {
        return res.status(400).json({ success: false, message: "Can only grant reapply on rejected applications." });
      }
      if (app.attemptNumber >= 2) {
        return res.status(400).json({ success: false, message: "User has already used both attempts." });
      }

      app.canReapply        = true;
      app.blocked           = false;
      app.reapplyGrantedBy  = req.session.user.username;
      await app.save();

      await sendDiscordDM(
        app.discordId,
        `✅ You've been granted a second application attempt. Head back to the applications portal to apply again.\nhttps://unified-apply.onrender.com`
      );
      await sendUnifiedEventsNotification(
        app.discordId,
        "You've been granted a second application attempt",
        "Staff have allowed you to reapply. Visit the applications portal to submit your second attempt."
      );
    }

    /* ---- REVOKE REAPPLY ---- */
    else if (action === "revoke-reapply") {
      if (!app.canReapply) {
        return res.status(400).json({ success: false, message: "Reapply was not granted." });
      }
      app.canReapply       = false;
      app.reapplyGrantedBy = null;
      await app.save();
    }

    return res.json({ success: true, application: app });
  } catch (err) {
    console.error("[PATCH /api/applications/:id]", err);
    return res.status(500).json({ success: false, message: "Server error." });
  }
});

/* ================================================================
   POST /api/applications/reset-season
   Owner only — unblocks all users and opens new season
================================================================ */
router.post("/reset-season", requireOwner, async (req, res) => {
  try {
    await Application.updateMany(
      { blocked: true },
      { $set: { blocked: false } }
    );

    return res.json({ success: true, message: "All blocked users have been reset." });
  } catch (err) {
    console.error("[POST /api/applications/reset-season]", err);
    return res.status(500).json({ success: false, message: "Server error." });
  }
});

/* ================================================================
   GET /api/applications/me/is-owner
   Check if current user has the owner role
================================================================ */
router.get("/me/is-owner", requireAuth, async (req, res) => {
  try {
    const roles = await getMemberRoles(req.session.user.id);
    return res.json({ success: true, isOwner: roles.includes(OWNER_ROLE_ID) });
  } catch (err) {
    return res.json({ success: true, isOwner: false });
  }
});

module.exports = router;