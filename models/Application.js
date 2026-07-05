const mongoose = require("mongoose");

const applicationSchema = new mongoose.Schema(
  {
    discordId: { type: String, required: true },
    discordUsername: { type: String, required: true },
    discordAvatar: { type: String, default: null },
    status: {
      type: String,
      enum: ["pending", "accepted", "rejected"],
      default: "pending",
    },
    reviewedBy: { type: String, default: null },
    reviewedAt: { type: Date, default: null },
    reviewNote: { type: String, default: "" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Application", applicationSchema);