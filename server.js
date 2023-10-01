import express from "express";
import * as dotenv from "dotenv";
import morgan from "morgan";
import cors from "cors";

import { queryPineconeVectorStoreAndQueryLLM, updatedPinecone } from "./utils/pinecone.js";
import { Pinecone } from "@pinecone-database/pinecone";
import mongoose from "mongoose";
import Transcript from "./models/transcript.js";
// import { PDFLoader } from "langchain/document_loaders/fs/pdf";
import { TextLoader } from "langchain/document_loaders/fs/text";
import { createFile } from "./data/createFile.js";
import { GENERATE_CONTEXTUAL_RECOMMENDATIONS_PROMPT, LIVE_CHAT_PROMPT } from "./utils/Constant.js";
import Name from "./models/name.js";
// import { DirectoryLoader } from "langchain/document_loaders/fs/directory";

dotenv.config({
  path: "./.env",
});

const PORT = process.env.PORT || 3000;

const MONGO_URI = "mongodb+srv://firmankhoiril:RUlHaCe3UBTv7ybj@cluster0.wggmcnp.mongodb.net/?retryWrites=true&w=majority";
const app = express();
app.use(cors());
app.use(morgan("dev"));
app.use(express.json());

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
  res.status(200).json({
    message: "test",
  });
});

app.post("/api/save/transcript", async (req, res) => {
  const { data, chatId } = req.body;
  try {
    // Check if a Transcript with the given title exists
    const checkIsTitleAlreadyExist = await Transcript.findOne({
      chatId,
    });

    if (!checkIsTitleAlreadyExist) {
      // If it doesn't exist, create a new Transcript
      const newTranscript = new Transcript({
        chatId,
        transcript: data,
      });

      await newTranscript.save();
    } else {
      // If it exists, update the existing Transcript
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

app.post("/api/transcript", async (req, res) => {
  const { transcript } = req.body;

  let contentDocument = "";

  let data = {
    title: "",
    role: "",
    content: "",
  };

  const title = transcript?.transcript?.map((item) => {
    data = {
      title: item?.title,
      role: item?.role,
      content: item?.content,
    };
    return data;
  });

  const content = transcript?.transcript.map((script) => {
    return `${script.role === "Sales Copilot" ? "" : `Conversation ${transcript?.title}`} 
    ""
    ${script.content}`;
  });

  console.log(transcript.title);
  const filename = `./data/${transcript.title}.txt`;
  contentDocument = `${content}`;
  createFile(filename, contentDocument);

  const indexName = process.env.PINECONE_INDEX;

  const pinecone = new Pinecone({
    apiKey: process.env.PINECONE_API_KEY,
    environment: process.env.PINECONE_ENVIRONMENT,
  });

  try {
    const loader = new TextLoader(`./data/${transcript.title}.txt`);

    const docs = await loader.load();

    await updatedPinecone(pinecone, indexName, docs);

    const checkIsTitleAlreadyExist = await Transcript.findOne({
      title: transcript.title,
    });

    if (checkIsTitleAlreadyExist)
      return res.status(401).json({
        message: `This ${transcript.title} Title is already exist`,
      });

    const newTranscript = new Transcript({
      title: transcript?.title,
      transcript: title,
    });
    await newTranscript.save();
    res.status(200).json({
      newTranscript,
    });
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

  // const loader = new DirectoryLoader("./data", {
  //   ".txt": (path) => new TextLoader(path),
  //   ".pdf": (path) => new PDFLoader(path),
  // });
  // const docs = await loader.load();

  const indexName = process.env.PINECONE_INDEX;

  const pinecone = new Pinecone({
    apiKey: process.env.PINECONE_API_KEY,
    environment: process.env.PINECONE_ENVIRONMENT,
  });
  try {
    // await updatedPinecone(pinecone, indexName, docs);
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
  const { question, title } = req.body;

  const indexName = process.env.PINECONE_INDEX;

  const pinecone = new Pinecone({
    apiKey: process.env.PINECONE_API_KEY,
    environment: process.env.PINECONE_ENVIRONMENT,
  });

  function generateRandomId() {
    const length = 8; // You can adjust the length of the random ID as needed
    const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let randomId = "";

    for (let i = 0; i < length; i++) {
      const randomIndex = Math.floor(Math.random() * characters.length);
      randomId += characters.charAt(randomIndex);
    }

    return randomId;
  }

  const randomId = generateRandomId();

  try {
    const text = await queryPineconeVectorStoreAndQueryLLM(pinecone, indexName, question, GENERATE_CONTEXTUAL_RECOMMENDATIONS_PROMPT);

    const createName = new Name({
      content: {
        title,
        role: "You",
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
    console.log("listening for requests");
  });
});
