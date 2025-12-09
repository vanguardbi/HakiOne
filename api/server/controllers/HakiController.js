const { buildHakiChain } = require('~/server/services/HakiService');
const { ChatOpenAI } = require('@langchain/openai');
const { StringOutputParser } = require('@langchain/core/output_parsers');

const formatHistory = (messages) => {
  // Take all messages except the last one (current query)
  const history = messages.slice(0, -1);
  return history
    .map((m) => {
      const role = m.role === 'user' ? 'Human' : 'AI';
      return `${role}: ${m.content}`;
    })
    .join('\n');
};

const hakiController = async (req, res) => {
  try {
    const { messages, model } = req.body;

    console.log('[HakiController] Request received:', { model, messageCount: messages?.length });

    // Safety check
    if (!messages || !messages.length) {
      return res.status(400).json({ error: 'No messages provided' });
    }

    // Handle Title Generation Request (Easiest Option)
    if (model === 'haki-title') {
      console.log('[HakiController] Generating title...');
      if (!process.env.OPENAI_API_KEY) {
        console.error('[HakiController] OPENAI_API_KEY is missing!');
      }
      const lastMessage = messages[messages.length - 1];
      const prompt = lastMessage.content;

      // Use a simple, fast model for titling (bypassing RAG)
      const titleModel = new ChatOpenAI({
        openAIApiKey: process.env.OPENAI_API_KEY,
        modelName: 'gpt-4o-mini', // Fast and cheap for titling
        temperature: 0.5,
      });

      const outputParser = new StringOutputParser();
      const chain = titleModel.pipe(outputParser);
      
      const title = await chain.invoke(prompt);
      console.log('[HakiController] Title generated:', title);

      return res.json({
        id: 'chatcmpl-' + Date.now(),
        object: 'chat.completion',
        created: Math.floor(Date.now() / 1000),
        model: 'haki-title',
        choices: [
          {
            message: { role: 'assistant', content: title },
            index: 0,
            finish_reason: 'stop',
          },
        ],
      });
    }

    const lastMessage = messages[messages.length - 1];
    const question = lastMessage.content;
    const chatHistory = formatHistory(messages);

    // Set headers for Server-Sent Events (SSE)
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const chain = await buildHakiChain();

    const stream = await chain.stream({
      question,
      chatHistory,
    });

    for await (const chunk of stream) {
      // Create OpenAI-compatible chunk
      const payload = {
        id: 'chatcmpl-' + Date.now(),
        object: 'chat.completion.chunk',
        created: Math.floor(Date.now() / 1000),
        model: 'haki-legal',
        choices: [
          {
            delta: { content: chunk },
            index: 0,
            finish_reason: null,
          },
        ],
      };
      res.write(`data: ${JSON.stringify(payload)}\n\n`);
    }

    // Signal stream end
    res.write('data: [DONE]\n\n');
    res.end();
  } catch (error) {
    console.error('Error in Haki Controller:', error);
    const errorPayload = {
      error: {
        message: `Internal Server Error in Haki Chain: ${error.message}`,
        type: 'internal_server_error',
      },
    };
    // If headers haven't been sent, send 500
    if (!res.headersSent) {
      res.status(500).json(errorPayload);
    } else {
      // If streaming started, try to send error as data
      res.write(`data: ${JSON.stringify(errorPayload)}\n\n`);
      res.end();
    }
  }
};

module.exports = { hakiController };
