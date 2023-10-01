import mongoose from "mongoose";

const nameSchema = {
  content: {
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
};

let Name = mongoose.model("Name", nameSchema);

export default Name;
