const { z } = require('zod');
const { RunnableSequence, RunnablePassthrough } = require('@langchain/core/runnables');
const { StringOutputParser } = require('@langchain/core/output_parsers');
const { PromptTemplate } = require('@langchain/core/prompts');
const { ChatOpenAI } = require('@langchain/openai');
const { Pinecone } = require('@pinecone-database/pinecone');
const { OpenAIEmbeddings } = require('@langchain/openai');
const { PineconeStore } = require('@langchain/pinecone');
const { log } = require('~/server/utils/hakiLogger');

// --- Configuration & Env ---
const envSchema = z.object({
  OPENAI_API_KEY: z.string().trim().min(1),
  PINECONE_API_KEY: z.string().trim().min(1),
  PINECONE_INDEX_NAME: z.string().trim().min(1),
});

// Validate environment variables
const env = envSchema.parse({
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  PINECONE_API_KEY: process.env.PINECONE_API_KEY,
  PINECONE_INDEX_NAME: process.env.PINECONE_INDEX_NAME,
});

// --- Pinecone Singleton ---
let pineconeInstance = null;

async function getPinecone() {
  if (!pineconeInstance) {
    pineconeInstance = new Pinecone({ apiKey: env.PINECONE_API_KEY });
  }
  return pineconeInstance;
}

async function getVectorStore(client) {
  const pineconeIndex = client.Index(env.PINECONE_INDEX_NAME);
  return await PineconeStore.fromExistingIndex(
    new OpenAIEmbeddings({ openAIApiKey: env.OPENAI_API_KEY }),
    { pineconeIndex },
  );
}

// --- Prompts ---
const STANDALONE_QUESTION_TEMPLATE = `Given the following conversation and a follow up question, 
rephrase the follow up question to be a standalone question.

Chat History:
{chatHistory}
Follow Up Input: {question}
Standalone question:`;

const QA_TEMPLATE = `You are Haki, an enthusiastic AI legal assistant developed by Haki AI. Mention this only when asked about your identity - otherwise just proceed to help the user. Use the context of cases and rulings provided to answer the question at the end. If a query is unrelated to this context, use your general knowledge to attempt a legally sound answer, or politely explain if the information is beyond the scope of the provided materials. If you respond based on general knowledge rather than the provided context, explicitly state that you did so.

When addressing what the law says on a subject, assume the question pertains to Kenyan law. Always cite and quote verbatim from your data sources, explicitly stating that you are quoting them.

{context}

Question: {question}
Helpful answer:`;

const questionGeneratorPrompt = PromptTemplate.fromTemplate(STANDALONE_QUESTION_TEMPLATE);
const answerPrompt = PromptTemplate.fromTemplate(QA_TEMPLATE);

// --- Models ---
const nonStreamingModel = new ChatOpenAI({
  openAIApiKey: env.OPENAI_API_KEY,
  modelName: 'gpt-4o', // Changed to gpt-4o for reliability
  temperature: 0.1,
  verbose: true,
});

const streamingModel = new ChatOpenAI({
  openAIApiKey: env.OPENAI_API_KEY,
  modelName: 'gpt-4o', // Adjust model as needed
  streaming: true,
  temperature: 0.1,
  verbose: true,
});

// --- Utilities ---
const combineDocuments = (docs) => {
  return docs.map((doc) => doc.pageContent).join('\n\n');
};

// --- Main Chain Builder ---
async function buildHakiChain() {
  const pineconeClient = await getPinecone();
  const vectorStore = await getVectorStore(pineconeClient);
  const retriever = vectorStore.asRetriever();

  const standaloneQuestionChain = questionGeneratorPrompt
    .pipe(nonStreamingModel)
    .pipe(new StringOutputParser());

  const retrieverChain = RunnableSequence.from([
    (prevResult) => prevResult.standalone_question,
    retriever,
    combineDocuments,
  ]);

  const answerChain = answerPrompt.pipe(streamingModel).pipe(new StringOutputParser());

  const chain = RunnableSequence.from([
    {
      standalone_question: standaloneQuestionChain,
      original_input: new RunnablePassthrough(),
    },
    async (prevItems) => {
      log('[HakiService] Standalone Question:', prevItems.standalone_question);
      // Resolve context from Pinecone
      const context = await retrieverChain.invoke({
        standalone_question: prevItems.standalone_question,
      });
      log('[HakiService] Context retrieved length:', context ? context.length : 0);
      return {
        context: context,
        question: prevItems.original_input.question,
        standalone_question: prevItems.standalone_question,
      };
    },
    answerChain,
  ]);

  return chain;
}

module.exports = { buildHakiChain };
