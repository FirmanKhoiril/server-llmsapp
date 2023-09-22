import mongoose from "mongoose";

const transcriptSchema = {
  title: String,
  transcript: [
    {
      title: String,
      role: String,
      content: String,
      _id: mongoose.Types.ObjectId,
    },
  ],
};

let Transcript = mongoose.model("Transcript", transcriptSchema);

export default Transcript;
