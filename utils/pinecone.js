import { OpenAIEmbeddings } from "langchain/embeddings/openai";
// import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { loadQAStuffChain, ConversationChain } from "langchain/chains";
import { Document } from "langchain/document";

import { ChatPromptTemplate, HumanMessagePromptTemplate, SystemMessagePromptTemplate, MessagesPlaceholder } from "langchain/prompts";
import { BufferMemory } from "langchain/memory";
import { ChatOpenAI } from "langchain/chat_models/openai";
import { LIVE_CHAT_PROMPT } from "./Constant.js";

// export const updatedPinecone = async (pinecone, indexName, docs) => {
//   const index = pinecone.index(indexName);

//   for (const doc of docs) {
//     const textPath = doc.metadata.source;

//     const text = doc.pageContent;

//     const textSplitter = new RecursiveCharacterTextSplitter({
//       chunkSize: 1000,
//     });

//     const chunks = await textSplitter.createDocuments([text]);

//     const embeddingsArray = await new OpenAIEmbeddings({
//       openAIApiKey: process.env.OPENAI_KEY,
//     }).embedDocuments(chunks.map((chunk) => chunk.pageContent.replace(/\n/g, "")));

//     const batchSize = 100;
//     let batch = [];
//     for (let idx = 0; idx < chunks.length; idx++) {
//       const chunk = chunks[idx];
//       const vector = {
//         id: `${textPath}_${idx}`,
//         values: embeddingsArray[idx],
//         metadata: {
//           ...chunk.metadata,
//           loc: JSON.stringify(chunk.metadata.loc),
//           pageContent: chunk.pageContent,
//           txtPath: textPath,
//         },
//       };
//       batch = [...batch, vector];

//       if (batch.length === batchSize || idx === chunks.length - 1) {
//         await index.upsert(batch);
//         batch = [];
//       }
//     }
//   }
// };

export const queryPineconeVectorStoreAndQueryLLM = async (pinecone, indexName, question) => {
  const chat = new ChatOpenAI({
    temperature: 0,
    modelName: "gpt-3.5-turbo",
    openAIApiKey: process.env.OPENAI_KEY,
    streaming: true,
  });
  const chatPrompt = ChatPromptTemplate.fromPromptMessages([SystemMessagePromptTemplate.fromTemplate(LIVE_CHAT_PROMPT), new MessagesPlaceholder("history"), HumanMessagePromptTemplate.fromTemplate("{input}")]);

  const chain = new ConversationChain({
    memory: new BufferMemory({ returnMessages: true, memoryKey: "history" }),
    prompt: chatPrompt,
    llm: chat,
  });

  const response = await chain.call({
    input: question,
  });

  const index = pinecone.Index(indexName);
  const queryEmbedding = await new OpenAIEmbeddings({
    openAIApiKey: process.env.OPENAI_KEY,
    modelName: "text-embedding-ada-002",
  }).embedQuery(question);

  console.log(queryEmbedding);
  const queryResponse = {
    topK: 10,
    vector: queryEmbedding,
    includeMetadata: true,
  };

  const queryFound = await index.query(queryResponse);

  if (queryFound.matches) {
    const chain = loadQAStuffChain(chat);
    const concatenatedPageContent = queryFound.matches.map((match) => match.metadata.pageContent).join(" ");
    const result = await chain.call({
      input_documents: [new Document({ pageContent: concatenatedPageContent })],
      question: response.response,
    });
    return {
      user: question,
      bot: result.text,
    };
  } else {
    console.log("Since there are no matches, GPT-3 will not be queried.");
  }
};
