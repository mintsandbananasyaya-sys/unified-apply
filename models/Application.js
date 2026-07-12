const mongoose = require("mongoose");

const applicationSchema = new mongoose.Schema(
  {
    discordId:       { type: String, required: true },
    discordUsername: { type: String, required: true },
    discordAvatar:   { type: String, default: null },

    attemptNumber: { type: Number, default: 1 },
    season:        { type: String, default: "season-1" },

    status: {
      type: String,
      enum: ["pending", "accepted", "rejected"],
      default: "pending",
    },

    canReapply:           { type: Boolean, default: false },
    reapplyGrantedBy:     { type: String,  default: null },
    blocked:              { type: Boolean, default: false },
    reviewedBy:           { type: String,  default: null },
    reviewedAt:           { type: Date,    default: null },
    reviewNote:           { type: String,  default: "" },
    reversedBy:           { type: String,  default: null },
    reversedAt:           { type: Date,    default: null },
    reversalNote:         { type: String,  default: "" },

    // Section A — Information
    minecraftUsername:    { type: String, default: "" },
    age:                  { type: String, default: "" },
    timezone:             { type: String, default: "" },
    country:              { type: String, default: "" },
    hoursAvailable:       { type: String, default: "" },
    hasVoiceChat:         { type: String, default: "" },
    canShareRecordings:   { type: String, default: "" },

    // Section B — Minecraft Experience
    yearsPlayed:          { type: String, default: "" },
    javaOrBedrock:        { type: String, default: "" },
    playerType:           { type: String, default: "" },
    pvpSkill:             { type: Number, default: 0 },
    buildingSkill:        { type: Number, default: 0 },

    // Section C — Event Questions
    whyJoin:              { type: String, default: "" },
    whatPlanToDo:         { type: String, default: "" },
    whatMakesFit:         { type: String, default: "" },
    preferredCountry:     { type: String, default: "" },

    // Section D — Final Checks
    agreeInactivity:      { type: String, default: "" },
    understandInactivity: { type: String, default: "" },
    commitment:           { type: Number, default: 0 },
    anythingElse:         { type: String, default: "" },
    understandNotPvp:     { type: String, default: "" },
    understandRules:      { type: String, default: "" },
  },
  { timestamps: true }
);

applicationSchema.index({ discordId: 1, season: 1, attemptNumber: 1 }, { unique: true });

module.exports = mongoose.model("Application", applicationSchema);