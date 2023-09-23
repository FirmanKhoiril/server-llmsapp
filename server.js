import express from "express";
import * as dotenv from "dotenv";
import morgan from "morgan";
import cors from "cors";

import { queryPineconeVectorStoreAndQueryLLM, updatedPinecone } from "./utils/pinecone.js";
import { Pinecone } from "@pinecone-database/pinecone";
import mongoose from "mongoose";
import Transcript from "./models/transcript.js";
// import { PDFLoader } from "langchain/document_loaders/fs/pdf";
// import { TextLoader } from "langchain/document_loaders/fs/text";
// import { DirectoryLoader } from "langchain/document_loaders/fs/directory";

dotenv.config({
  path: "./.env",
});

const PORT = process.env.PORT || 3000;
const app = express();
app.use(cors());
app.use(morgan("dev"));
app.use(express.json());

app.get("/", async (req, res) => {
  res.status(200).send({
    message: "hello world",
  });
});

app.post("/api/transcript", async (req, res) => {
  const { transcript } = req.body;
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

  try {
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
    const text = await queryPineconeVectorStoreAndQueryLLM(pinecone, indexName, question);

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

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_CONNECT);
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.log(error);
    process.exit(1);
  }
};

connectDB()
  .then(() => {
    app.listen(PORT, () => {
      console.log("listening for requests");
    });
  })
  .catch((err) => {
    console.log(err);
  });
