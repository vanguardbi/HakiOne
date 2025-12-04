const { buildHakiChain } = require('~/server/services/HakiService');
const { ChatOpenAI } = require('@langchain/openai');
const { StringOutputParser } = require('@langchain/core/output_parsers');
const { log } = require('~/server/utils/hakiLogger');

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
    // Handle both standard and "Responses API" style payloads
    let { messages, model, stream, prompt } = req.body;

    log('[HakiController] Request received', { 
      model, 
      stream, 
      messageCount: messages?.length,
      hasPrompt: !!prompt,
      bodyKeys: Object.keys(req.body),
      fullBody: JSON.stringify(req.body, null, 2)
    });

    // If 'messages' is missing but 'prompt' exists, convert prompt to messages
    if ((!messages || !messages.length) && prompt) {
      log('[HakiController] Converting prompt to messages');
      messages = [{ role: 'user', content: prompt }];
    }

    // Handle 'input' array (Responses API / Custom Format)
    if ((!messages || !messages.length) && Array.isArray(req.body.input)) {
      log('[HakiController] Converting input to messages');
      messages = req.body.input.map(item => ({
        role: item.role,
        content: item.content
      }));
    }

    // Safety check
    if (!messages || !messages.length) {
      log('[HakiController] No messages provided');
      return res.status(400).json({ error: 'No messages provided' });
    }

    // Handle Title Generation Request (Easiest Option)
    if (model === 'haki-title') {
      log('[HakiController] Generating title...');
      try {
        if (!process.env.OPENAI_API_KEY) {
          throw new Error('OPENAI_API_KEY is missing');
        }
        const lastMessage = messages[messages.length - 1];
        const prompt = lastMessage.content;

        // Use a simple, fast model for titling (bypassing RAG)
        const titleModel = new ChatOpenAI({
          openAIApiKey: process.env.OPENAI_API_KEY,
          modelName: 'gpt-4o', // Changed to gpt-4o for reliability
          temperature: 0.5,
        });

        const outputParser = new StringOutputParser();
        const chain = titleModel.pipe(outputParser);
        
        const title = await chain.invoke(prompt);
        log('[HakiController] Title generated:', title);

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
      } catch (titleError) {
        log('[HakiController] Title generation failed:', titleError.message);
        // Return a fallback title instead of crashing
        return res.json({
          id: 'chatcmpl-' + Date.now(),
          object: 'chat.completion',
          created: Math.floor(Date.now() / 1000),
          model: 'haki-title',
          choices: [
            {
              message: { role: 'assistant', content: 'New Chat' },
              index: 0,
              finish_reason: 'stop',
            },
          ],
        });
      }
    }

    const lastMessage = messages[messages.length - 1];
    const question = lastMessage.content;
    const chatHistory = formatHistory(messages);
    // Default to false (non-streaming) if undefined, to match OpenAI standard
    const isStreaming = stream === true; 

    log('[HakiController] Building chain...');
    const chain = await buildHakiChain();
    log('[HakiController] Chain built.');

    if (isStreaming) {
      log('[HakiController] Starting stream...');
      // Set headers for Server-Sent Events (SSE)
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      const stream = await chain.stream({
        question,
        chatHistory,
      });

      const streamId = 'chatcmpl-' + Date.now();
      
      // Send initial chunk with role to satisfy strict parsers
      const initialPayload = {
        id: streamId,
        object: 'chat.completion.chunk',
        created: Math.floor(Date.now() / 1000),
        model: 'haki-legal',
        choices: [
          {
            delta: { role: 'assistant', content: '' },
            index: 0,
            finish_reason: null,
          },
        ],
      };
      res.write(`data: ${JSON.stringify(initialPayload)}\n\n`);
      if (res.flush) res.flush();

      let chunkCount = 0;
      
      for await (const chunk of stream) {
        chunkCount++;
        
        // Debug first chunk
        if (chunkCount === 1) {
          log('[HakiController] First chunk type:', typeof chunk);
        }

        // Ensure chunk is a string
        const content = typeof chunk === 'string' ? chunk : JSON.stringify(chunk);
        
        // Create OpenAI-compatible chunk
        const payload = {
          id: streamId, // Use consistent ID for the whole stream
          object: 'chat.completion.chunk',
          created: Math.floor(Date.now() / 1000),
          model: 'haki-legal',
          choices: [
            {
              delta: { content: content },
              index: 0,
              finish_reason: null,
            },
          ],
        };
        res.write(`data: ${JSON.stringify(payload)}\n\n`);
        if (res.flush) res.flush();
      }

      // Send final chunk with finish_reason: stop
      const finalPayload = {
        id: streamId,
        object: 'chat.completion.chunk',
        created: Math.floor(Date.now() / 1000),
        model: 'haki-legal',
        choices: [
          {
            delta: {},
            index: 0,
            finish_reason: 'stop',
          },
        ],
      };
      res.write(`data: ${JSON.stringify(finalPayload)}\n\n`);
      if (res.flush) res.flush();

      log(`[HakiController] Stream finished. Sent ${chunkCount} chunks.`);

      // Signal stream end
      res.write('data: [DONE]\n\n');
      res.end();
    } else {
      log('[HakiController] Starting non-streaming invoke...');
      // Non-streaming response
      const response = await chain.invoke({
        question,
        chatHistory,
      });
      log('[HakiController] Invoke finished.');

      // Ensure response is a string
      const content = typeof response === 'string' ? response : JSON.stringify(response);

      return res.json({
        id: 'chatcmpl-' + Date.now(),
        object: 'chat.completion',
        created: Math.floor(Date.now() / 1000),
        model: 'haki-legal',
        choices: [
          {
            message: { role: 'assistant', content: content },
            index: 0,
            finish_reason: 'stop',
          },
        ],
      });
    }
  } catch (error) {
    log('[HakiController] Error:', error.message);
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
