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

    // After 1st rejection — staff can grant one more attempt
    canReapply:   { type: Boolean, default: false },
    reapplyGrantedBy: { type: String, default: null },

    // After 2nd rejection — blocked until owner resets season
    blocked: { type: Boolean, default: false },

    reviewedBy:   { type: String, default: null },
    reviewedAt:   { type: Date,   default: null },
    reviewNote:   { type: String, default: "" },

    // Reversal support
    reversedBy:   { type: String, default: null },
    reversedAt:   { type: Date,   default: null },
    reversalNote: { type: String, default: "" },
  },
  { timestamps: true }
);

// Unique per user per season per attempt
applicationSchema.index({ discordId: 1, season: 1, attemptNumber: 1 }, { unique: true });

module.exports = mongoose.model("Application", applicationSchema);