import mongoose from "mongoose";

const transcriptSchema = {
  chatId: String,
  transcript: [
    {
      title: String,
      role: String,
      content: String,
      createdAt: { type: Date, default: Date.now, immutable: true },
      _id: String,
      contentBot: {
        title: String,
        role: String,
        _id: String,
        content: String,
        createdAt: { type: Date, default: Date.now, immutable: true },
      },
    },
  ],
};

let Transcript = mongoose.model("Transcript", transcriptSchema);

export default Transcript;
