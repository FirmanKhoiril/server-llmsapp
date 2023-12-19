import express from "express";
import * as dotenv from "dotenv";
import morgan from "morgan";
import cors from "cors";
import mongoose from "mongoose";
import Name from "./models/name.js";
import Transcript from "./models/transcript.js";
import { queryPineconeVectorStoreAndQueryLLM } from "./utils/pinecone.js";
import { Pinecone } from "@pinecone-database/pinecone";
import { GENERATE_CONTEXTUAL_RECOMMENDATIONS_PROMPT, LIVE_CHAT_PROMPT } from "./utils/Constant.js";
import { generateRandomId } from "./utils/randomId.js";

dotenv.config({
  path: "./.env",
});

const MONGO_URI = "mongodb+srv://firmankhoiril:RUlHaCe3UBTv7ybj@cluster0.wggmcnp.mongodb.net/?retryWrites=true&w=majority";

const app = express();

app.use(cors());
app.use(morgan("dev"));
app.use(express.json());

const PORT = process.env.PORT || 3000;

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.log(error);
    process.exit(1);
  }
};

app.get("/", (req, res) => {
  res.status(200).send("<h1>Hello Welcome back King Crimson</h1>");
});

app.post("/api/new-transcript", async (req, res) => {
  const { name, isProcessing } = req.body;

  try {
    const checkIfNameAlreadyExist = await Transcript.findOne({
      name,
    });

    if (!checkIfNameAlreadyExist) res.status(400).json(`${name} is Already exist`);

    const newTranscript = new Transcript({
      content: "",
      name,
      isProcessing: true,
    });

    await newTranscript.save();
    res.status(200).json(newTranscript);
  } catch (error) {
    res.status(400).json({
      message: "Failed Create new Transcript History",
    });
  }
});

app.post("/api/saved-transcript", async (req, res) => {
  const { id, content, name } = req.body;

  let isProcessing = false;

  try {
    const checkIdExist = await Transcript.findById(id);

    if (checkIdExist) {
      await Transcript.updateOne({ _id: id }, { $set: { content, name, isProcessing } });
    }
  } catch (error) {
    res.status(400).json({
      message: "error saving transcript",
    });
  }
});

app.post("/api/save/transcript", async (req, res) => {
  const { data, chatId } = req.body;
  try {
    const checkIsTitleAlreadyExist = await Transcript.findOne({
      chatId,
    });

    if (!checkIsTitleAlreadyExist) {
      const newTranscript = new Transcript({
        chatId,
        transcript: data,
      });

      await newTranscript.save();
    } else {
      checkIsTitleAlreadyExist.transcript = data;
      await checkIsTitleAlreadyExist.save();
      res.status(200).json("Data Updated Successfully");
    }
  } catch (error) {
    res.status(500).json({
      error: error.message,
    });
  }
});

app.post("/api/transcript/id", async (req, res) => {
  const { id } = req.body;
  try {
    const data = await Transcript.findById(id);
    res.status(200).json({
      data,
    });
  } catch (error) {
    res.status(400).json({
      err: error,
    });
  }
});

app.get("/api/transcript", async (req, res) => {
  try {
    const getTranscript = await Transcript.find();

    res.status(200).json(getTranscript);
  } catch (error) {
    res.status(404).json({ message: error.message });
  }
});

app.post("/api/question", async (req, res) => {
  const { question } = req.body;

  const indexName = process.env.PINECONE_INDEX;

  const pinecone = new Pinecone({
    apiKey: process.env.PINECONE_API_KEY,
    environment: process.env.PINECONE_ENVIRONMENT,
  });

  try {
    const text = await queryPineconeVectorStoreAndQueryLLM(pinecone, indexName, question, LIVE_CHAT_PROMPT);

    res.status(200).json({
      text,
    });
  } catch (error) {
    console.log(error);
    res.status(500).send({
      error,
    });
  }
});

app.post("/api/question/recomended", async (req, res) => {
  const { question, title, audioUrl } = req.body;

  const indexName = process.env.PINECONE_INDEX;

  const pinecone = new Pinecone({
    apiKey: process.env.PINECONE_API_KEY,
    environment: process.env.PINECONE_ENVIRONMENT,
  });

  const randomId = generateRandomId();

  try {
    const text = await queryPineconeVectorStoreAndQueryLLM(pinecone, indexName, question, GENERATE_CONTEXTUAL_RECOMMENDATIONS_PROMPT);
    const createName = new Name({
      content: {
        title,
        role: "You",
        audioUrl: audioUrl,
        content: question,
        _id: randomId,
        contentBot: {
          title,
          _id: randomId,
          role: "Leadership Copilot",
          content: text.bot,
        },
      },
    });
    await createName.save();
    res.status(200).json({
      createName,
    });
  } catch (error) {
    console.log(error);
    res.status(500).send({
      error,
    });
  }
});

connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`Server Listening to ${PORT}`);
  });
});
