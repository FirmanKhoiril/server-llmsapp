import mongoose from "mongoose";

const transcriptSchema = {
  name: String,
  isProcessing: Boolean,
  createdAt: { type: Date, default: Date.now, immutable: true },
  content: String,
};

let Transcript = mongoose.model("Transcript", transcriptSchema);

export default Transcript;
