const express = require("express");
const router = express.Router();
const { Client, GatewayIntentBits } = require("discord.js");
const Application = require("../models/Application");

const APP_REVIEWER_ROLE_ID = process.env.APP_REVIEWER_ROLE_ID;
const PARTICIPANT_ROLE_ID  = process.env.PARTICIPANT_ROLE_ID;
const GUILD_ID             = process.env.DISCORD_GUILD_ID;
const BOT_TOKEN            = process.env.BOT_TOKEN;

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

  try {
    const guildRes = await fetch(
      `https://discord.com/api/guilds/${GUILD_ID}/members/${req.session.user.id}`,
      { headers: { Authorization: `Bot ${BOT_TOKEN}` } }
    );

    if (!guildRes.ok) {
      return res.status(403).json({ success: false, message: "Could not verify your roles." });
    }

    const member = await guildRes.json();
    const hasRole = member.roles?.includes(APP_REVIEWER_ROLE_ID);

    if (!hasRole) {
      return res.status(403).json({ success: false, message: "You don't have permission to do that." });
    }

    next();
  } catch (err) {
    console.error("[requireReviewer]", err);
    return res.status(500).json({ success: false, message: "Server error." });
  }
}

/* ---- GET /api/applications/me ----
   Check if the logged-in user already has an application */
router.get("/me", requireAuth, async (req, res) => {
  try {
    const app = await Application.findOne({ discordId: req.session.user.id });
    return res.json({ success: true, application: app || null });
  } catch (err) {
    console.error("[GET /api/applications/me]", err);
    return res.status(500).json({ success: false, message: "Server error." });
  }
});

/* ---- GET /api/applications ----
   Staff only — returns all applications */
router.get("/", requireReviewer, async (req, res) => {
  try {
    const { status } = req.query;
    const query = status && status !== "all" ? { status } : {};
    const apps = await Application.find(query).sort({ createdAt: -1 }).lean();
    return res.json({ success: true, applications: apps });
  } catch (err) {
    console.error("[GET /api/applications]", err);
    return res.status(500).json({ success: false, message: "Server error." });
  }
});

/* ---- PATCH /api/applications/:id ----
   Staff only — accept or reject an application */
router.patch("/:id", requireReviewer, async (req, res) => {
  const { status, reviewNote } = req.body;

  if (!["accepted", "rejected"].includes(status)) {
    return res.status(400).json({ success: false, message: "Invalid status." });
  }

  try {
    const app = await Application.findById(req.params.id);
    if (!app) return res.status(404).json({ success: false, message: "Application not found." });
    if (app.status !== "pending") {
      return res.status(400).json({ success: false, message: "Application already reviewed." });
    }

    app.status = status;
    app.reviewedBy = req.session.user.username;
    app.reviewedAt = new Date();
    app.reviewNote = reviewNote || "";
    await app.save();

    // If accepted — assign role + DM the user via bot
    if (status === "accepted") {
      try {
        // Assign the Participant role
        await fetch(
          `https://discord.com/api/guilds/${GUILD_ID}/members/${app.discordId}/roles/${PARTICIPANT_ROLE_ID}`,
          { method: "PUT", headers: { Authorization: `Bot ${BOT_TOKEN}` } }
        );

        // DM the user
        const dmChannelRes = await fetch(
          `https://discord.com/api/users/@me/channels`,
          {
            method: "POST",
            headers: {
              Authorization: `Bot ${BOT_TOKEN}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ recipient_id: app.discordId }),
          }
        );
        const dmChannel = await dmChannelRes.json();

        if (dmChannel.id) {
          await fetch(`https://discord.com/api/channels/${dmChannel.id}/messages`, {
            method: "POST",
            headers: {
              Authorization: `Bot ${BOT_TOKEN}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              content: `🎉 **Your application has been accepted!**\n\nWelcome to Season 1 — you've been given the Season 1 Participant role. See you in the server!${reviewNote ? `\n\nNote from staff: ${reviewNote}` : ""}`,
            }),
          });
        }
      } catch (err) {
        console.error("[role/dm assign failed]", err);
        // Don't fail the whole request — application is still marked accepted
      }
    }

    // If rejected — DM the user
    if (status === "rejected") {
      try {
        const dmChannelRes = await fetch(
          `https://discord.com/api/users/@me/channels`,
          {
            method: "POST",
            headers: {
              Authorization: `Bot ${BOT_TOKEN}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ recipient_id: app.discordId }),
          }
        );
        const dmChannel = await dmChannelRes.json();

        if (dmChannel.id) {
          await fetch(`https://discord.com/api/channels/${dmChannel.id}/messages`, {
            method: "POST",
            headers: {
              Authorization: `Bot ${BOT_TOKEN}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              content: `Your application was reviewed and unfortunately wasn't successful this time.${reviewNote ? `\n\nNote from staff: ${reviewNote}` : ""}\n\nYou're welcome to apply again when applications reopen.`,
            }),
          });
        }
      } catch (err) {
        console.error("[rejection dm failed]", err);
      }
    }

    return res.json({ success: true, application: app });
  } catch (err) {
    console.error("[PATCH /api/applications/:id]", err);
    return res.status(500).json({ success: false, message: "Server error." });
  }
});

module.exports = router;