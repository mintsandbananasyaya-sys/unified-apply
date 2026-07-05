
const express = require("express");
const router = express.Router();

const {
  DISCORD_CLIENT_ID,
  DISCORD_CLIENT_SECRET,
  DISCORD_GUILD_ID,
  DISCORD_CALLBACK_URL,
} = process.env;

router.get("/discord", (req, res) => {
  const params = new URLSearchParams({
    client_id: DISCORD_CLIENT_ID,
    redirect_uri: DISCORD_CALLBACK_URL,
    response_type: "code",
    scope: "identify guilds",
  });
  res.redirect(`https://discord.com/oauth2/authorize?${params.toString()}`);
});

router.get("/discord/callback", async (req, res) => {
  const { code } = req.query;
  if (!code) return res.redirect("/?auth=cancelled");

  try {
    const tokenRes = await fetch("https://discord.com/api/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: DISCORD_CLIENT_ID,
        client_secret: DISCORD_CLIENT_SECRET,
        grant_type: "authorization_code",
        code,
        redirect_uri: DISCORD_CALLBACK_URL,
      }),
    });
    const tokenData = await tokenRes.json();
    if (!tokenData.access_token) return res.redirect("/?auth=error");

    const userRes = await fetch("https://discord.com/api/users/@me", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const userData = await userRes.json();

    const guildsRes = await fetch("https://discord.com/api/users/@me/guilds", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const guildsData = await guildsRes.json();

    const isInGuild = Array.isArray(guildsData) &&
      guildsData.some((g) => g.id === DISCORD_GUILD_ID);

    if (!isInGuild) return res.redirect("/?auth=not_in_server");

    req.session.user = {
      id: userData.id,
      username: userData.username,
      avatar: userData.avatar
        ? `https://cdn.discordapp.com/avatars/${userData.id}/${userData.avatar}.png`
        : null,
    };

    res.redirect("/?auth=success");
  } catch (err) {
    console.error("[auth] callback error:", err);
    res.redirect("/?auth=error");
  }
});

router.get("/me", (req, res) => {
  res.json({ user: req.session.user || null });
});

router.post("/logout", (req, res) => {
  req.session.destroy(() => res.json({ success: true }));
});


const express = require("express");
const router = express.Router();

const {
  DISCORD_CLIENT_ID,
  DISCORD_CLIENT_SECRET,
  DISCORD_GUILD_ID,
  DISCORD_CALLBACK_URL,
} = process.env;

router.get("/discord", (req, res) => {
  const params = new URLSearchParams({
    client_id: DISCORD_CLIENT_ID,
    redirect_uri: DISCORD_CALLBACK_URL,
    response_type: "code",
    scope: "identify guilds",
  });
  res.redirect(`https://discord.com/oauth2/authorize?${params.toString()}`);
});

router.get("/discord/callback", async (req, res) => {
  const { code } = req.query;
  if (!code) return res.redirect("/?auth=cancelled");

  try {
    const tokenRes = await fetch("https://discord.com/api/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: DISCORD_CLIENT_ID,
        client_secret: DISCORD_CLIENT_SECRET,
        grant_type: "authorization_code",
        code,
        redirect_uri: DISCORD_CALLBACK_URL,
      }),
    });
    const tokenData = await tokenRes.json();
    if (!tokenData.access_token) return res.redirect("/?auth=error");

    const userRes = await fetch("https://discord.com/api/users/@me", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const userData = await userRes.json();

    const guildsRes = await fetch("https://discord.com/api/users/@me/guilds", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const guildsData = await guildsRes.json();

    const isInGuild = Array.isArray(guildsData) &&
      guildsData.some((g) => g.id === DISCORD_GUILD_ID);

    if (!isInGuild) return res.redirect("/?auth=not_in_server");

    req.session.user = {
      id: userData.id,
      username: userData.username,
      avatar: userData.avatar
        ? `https://cdn.discordapp.com/avatars/${userData.id}/${userData.avatar}.png`
        : null,
    };

    res.redirect("/?auth=success");
  } catch (err) {
    console.error("[auth] callback error:", err);
    res.redirect("/?auth=error");
  }
});

router.get("/me", (req, res) => {
  res.json({ user: req.session.user || null });
});

router.post("/logout", (req, res) => {
  req.session.destroy(() => res.json({ success: true }));
});


module.exports = router;